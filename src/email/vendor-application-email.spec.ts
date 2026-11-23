import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { VendorBusinessService } from '../vendor-business/vendor-business.service';

describe('Vendor application admin email', () => {
  const db: any = {
    businessCategory: { findMany: jest.fn() },
    business: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
    applicationReviewEvent: { create: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const provider = { sendMail: jest.fn() };
  const email = new EmailService(provider);
  const service = new VendorBusinessService(db, email);
  const application = {
    id: 'application-1',
    name: 'Sunrise Weddings',
    categoryId: 'photo',
    city: 'Jaffna',
    district: 'Jaffna',
    email: 'vendor@example.com',
    phone: '0771234567',
    vendorStatus: 'PENDING',
    status: 'INACTIVE',
    address: '10 Main Road',
    description: 'Wedding photography',
    logo: '/logo.jpg',
    coverImage: '/cover.jpg',
    profileSettings: { policies: { bookingPolicy: 'Call to book' } },
  };
  const originalUrl = process.env.FRONTEND_URL;
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    process.env.FRONTEND_URL = 'https://www.luxeevents.fun';
    db.businessCategory.findMany.mockResolvedValue([
      {
        id: 'photo',
        name: 'Wedding Photographers',
        parentId: null,
        status: 'ACTIVE',
      },
    ]);
    db.business.findFirst.mockResolvedValue(null);
    db.business.create.mockResolvedValue(application);
    db.business.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementation((run) => run(db));
    db.user.findUnique.mockResolvedValue({
      emailVerified: true,
      firstName: 'Nimali',
      lastName: 'Perera',
    });
    provider.sendMail.mockResolvedValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalUrl;
  });

  it('sends the saved application to the requested inbox with useful details and the correct review link', async () => {
    await expect(
      service.submitOnboarding('vendor-1', {
        name: application.name,
        categoryId: 'photo',
      }),
    ).resolves.toEqual(application);
    expect(provider.sendMail).not.toHaveBeenCalled();
    db.business.findFirst.mockResolvedValue(application);
    await service.submitProfileReview('vendor-1');
    expect(provider.sendMail).toHaveBeenCalledTimes(1);
    const sent = provider.sendMail.mock.calls[0][0];
    expect(sent.to).toBe('admineventmarketplace@gmail.com');
    expect(sent.subject).toBe(
      'New Vendor Application Submitted - Nakathata.lk',
    );
    for (const text of [
      'Nimali Perera',
      'Sunrise Weddings',
      'application-1',
      'Wedding Photographers',
      'Jaffna',
      'vendor@example.com',
      '0771234567',
      'https://nakathata.lk/admin/vendors/approvals',
    ])
      expect(sent.html).toContain(text);
    expect(db.business.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      provider.sendMail.mock.invocationCallOrder[0],
    );
    expect(db.business.create).toHaveBeenCalledWith({
      data: {
        name: application.name,
        categoryId: 'photo',
        vendorId: 'vendor-1',
        vendorStatus: 'PENDING',
        status: 'INACTIVE',
        submittedAt: expect.any(Date),
      },
    });
  });
  it('does not send email for duplicate applications', async () => {
    db.business.findFirst.mockResolvedValue(application);
    await expect(
      service.submitOnboarding('vendor-1', {
        name: application.name,
        categoryId: 'photo',
      }),
    ).rejects.toThrow('already have submitted');
    expect(provider.sendMail).not.toHaveBeenCalled();
    expect(db.business.create).not.toHaveBeenCalled();
  });
  it('does not send email when saving fails', async () => {
    db.business.create.mockRejectedValue(new Error('Database failure'));
    await expect(
      service.submitOnboarding('vendor-1', {
        name: application.name,
        categoryId: 'photo',
      }),
    ).rejects.toThrow('Failed to create business');
    expect(provider.sendMail).not.toHaveBeenCalled();
  });
  it('does not send email for invalid categories', async () => {
    await expect(
      service.submitOnboarding('vendor-1', {
        name: application.name,
        categoryId: 'unknown',
      }),
    ).rejects.toThrow('active business category');
    expect(provider.sendMail).not.toHaveBeenCalled();
  });
  it.each([false, 'throw'])(
    'keeps the saved application when delivery fails (%s)',
    async (failure) => {
      if (failure === 'throw')
        provider.sendMail.mockRejectedValue(new Error('Provider unavailable'));
      else provider.sendMail.mockResolvedValue(false);
      db.business.findFirst.mockResolvedValue(application);
      await expect(
        service.submitProfileReview('vendor-1'),
      ).resolves.toMatchObject({ vendorStatus: 'UNDER_REVIEW' });
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('admin email delivery failed'),
      );
      expect(db.business.updateMany).toHaveBeenCalledTimes(1);
    },
  );
  it('still returns the saved application if fetching the vendor name fails', async () => {
    db.business.findFirst.mockResolvedValue(application);
    db.user.findUnique.mockResolvedValueOnce({ emailVerified: true })
      .mockRejectedValueOnce(new Error('Lookup unavailable'));
    await expect(
      service.submitProfileReview('vendor-1'),
    ).resolves.toMatchObject({ vendorStatus: 'UNDER_REVIEW' });
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('admin notification failed'),
    );
  });
  it('sends even when the optional notification recipient name lookup is empty', async () => {
    db.business.findFirst.mockResolvedValue(application);
    db.user.findUnique.mockResolvedValueOnce({ emailVerified: true }).mockResolvedValue(null);
    await service.submitProfileReview('vendor-1');
    expect(provider.sendMail).toHaveBeenCalledTimes(1);
    expect(provider.sendMail.mock.calls[0][0].to).toBe(
      'admineventmarketplace@gmail.com',
    );
  });
  it('keeps incomplete profiles out of the review queue', async () => {
    db.business.findFirst.mockResolvedValue({ ...application, coverImage: '' });
    await expect(service.submitProfileReview('vendor-1')).rejects.toMatchObject({ status: 400 });
    expect(db.business.updateMany).not.toHaveBeenCalled();
    expect(provider.sendMail).not.toHaveBeenCalled();
  });
  it('escapes vendor content and uses the configured frontend origin', async () => {
    process.env.FRONTEND_URL = 'https://nakathata.lk/some-path';
    await email.sendNewVendorApplicationNotification(
      'admineventmarketplace@gmail.com',
      '<img src=x>',
      'Cake & Cars',
      {
        applicationId: 'id',
        category: '<script>bad</script>',
        location: 'Jaffna',
        email: 'vendor@example.com',
        phone: '0771234567',
      },
    );
    const html = provider.sendMail.mock.calls[0][0].html;
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('Cake &amp; Cars');
    expect(html).not.toContain('<script>');
    expect(html).toContain(
      'href="https://nakathata.lk/admin/vendors/approvals"',
    );
  });
  it.each(['javascript:alert(1)', 'not a url'])(
    'uses a safe public review link for invalid site configuration %s',
    async (url) => {
      process.env.FRONTEND_URL = url;
      await email.sendNewVendorApplicationNotification(
        'admineventmarketplace@gmail.com',
        'Vendor',
        'Business',
      );
      expect(provider.sendMail.mock.calls[0][0].html).toContain(
        'href="https://nakathata.lk/admin/vendors/approvals"',
      );
    },
  );
});
