import { vendorTrial } from './vendor-trial';
import { AuthService } from './auth.service';

describe('Vendor two-calendar-month free period', () => {
  it('uses the original signup time and does not charge or hide pages after expiry', () => {
    expect(
      vendorTrial(
        new Date('2026-11-13T05:00:00Z'),
        new Date('2027-01-13T05:00:00Z'),
      ),
    ).toEqual({
      startsAt: '2026-11-13T05:00:00.000Z',
      endsAt: '2027-01-13T05:00:00.000Z',
      status: 'EXPIRED',
      automaticCharge: false,
      hidePageOnExpiry: false,
    });
  });
  it('remains active immediately before expiry', () => {
    expect(
      vendorTrial(
        new Date('2026-11-13T05:00:00Z'),
        new Date('2027-01-13T04:59:59Z'),
      ).status,
    ).toBe('ACTIVE');
  });
  it('clamps month-end and handles leap years in Sri Lanka time', () => {
    expect(vendorTrial(new Date('2026-12-31T18:00:00Z')).endsAt).toBe(
      '2027-02-28T18:00:00.000Z',
    );
    expect(vendorTrial(new Date('2027-12-31T18:00:00Z')).endsAt).toBe(
      '2028-02-29T18:00:00.000Z',
    );
    expect(vendorTrial(new Date('2026-12-31T20:00:00Z')).endsAt).toBe(
      '2027-02-28T20:00:00.000Z',
    );
  });
  it('looks up only the authenticated account and does not mutate account data', async () => {
    const users = {
      findAuthById: jest
        .fn()
        .mockResolvedValue({
          id: 'owner',
          status: 'ACTIVE',
          role: { name: 'VENDOR' },
          createdAt: new Date('2026-01-01'),
        }),
    };
    const service = new AuthService(
      users as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect((await service.getVendorTrial('owner')).status).toBe('EXPIRED');
    expect(users.findAuthById).toHaveBeenCalledWith('owner');
  });
  it.each(['CUSTOMER', 'ADMIN'])('denies %s accounts', async (role) => {
    const users = {
      findAuthById: jest
        .fn()
        .mockResolvedValue({
          status: 'ACTIVE',
          role: { name: role },
          createdAt: new Date(),
        }),
    };
    const service = new AuthService(
      users as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(service.getVendorTrial('other')).rejects.toThrow(
      'Vendor account required',
    );
  });
});
