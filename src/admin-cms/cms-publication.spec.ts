import { AdminCmsService } from './admin-cms.service';
import { AdminCmsController } from './admin-cms.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { faqInput, pageInput, PUBLICATION_PREFIX } from './content-validation';

describe('CMS publication boundary', () => {
  let page: any;
  let snapshots: Map<string, any>;
  let tx: any;
  let service: AdminCmsService;
  beforeEach(() => {
    page = {
      id: 'page-1',
      slug: 'terms-and-conditions',
      title: 'Terms',
      content: '<p>Original live terms</p>',
      status: 'PUBLISHED',
      metaTitle: null,
      metaDescription: null,
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    };
    snapshots = new Map();
    tx = {
      page: {
        findUnique: jest.fn(async () => page),
        update: jest.fn(
          async ({ data }) =>
            (page = {
              ...page,
              ...data,
              updatedAt: new Date('2026-10-09T00:00:00Z'),
            }),
        ),
        create: jest.fn(async ({ data }) => (page = { ...page, ...data })),
        delete: jest.fn(async () => page),
      },
      setting: {
        findUnique: jest.fn(async ({ where }) =>
          snapshots.has(where.key) ? { value: snapshots.get(where.key) } : null,
        ),
        create: jest.fn(async ({ data }) =>
          snapshots.set(data.key, data.value),
        ),
        upsert: jest.fn(async ({ where, create, update }) =>
          snapshots.set(
            where.key,
            snapshots.has(where.key) ? update.value : create.value,
          ),
        ),
        deleteMany: jest.fn(async ({ where }) => snapshots.delete(where.key)),
      },
      faq: {
        findMany: jest.fn(async () => []),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (action) => action(tx)),
    };
    service = new AdminCmsService(tx, {} as any);
  });

  it('preserves live content and publication date while saving a draft', async () => {
    await service.updatePage(page.id, {
      content: '<p>Private draft</p>',
      status: 'DRAFT',
    });
    expect((await service.getPageBySlug(page.slug)).content).toContain(
      'Private draft',
    );
    const live: any = await service.getPageBySlug(page.slug, true);
    expect(live.content).toContain('Original live terms');
    expect(live.updatedAt).toBe('2026-10-01T00:00:00.000Z');
    await service.updatePage(page.id, {
      content: '<p>Second private draft</p>',
      status: 'DRAFT',
    });
    expect(
      ((await service.getPageBySlug(page.slug, true)) as any).content,
    ).toContain('Original live terms');
  });
  it('only replaces live content and date after explicit publication', async () => {
    await service.updatePage(page.id, {
      content: '<p>Published replacement</p>',
      status: 'PUBLISHED',
    });
    const live: any = await service.getPageBySlug(page.slug, true);
    expect(live.content).toContain('Published replacement');
    expect(live.updatedAt).toBe('2026-10-09T00:00:00.000Z');
    await service.updatePage(page.id, { content: '<p>Implicit draft</p>' });
    expect(page.status).toBe('DRAFT');
    expect(
      ((await service.getPageBySlug(page.slug, true)) as any).content,
    ).toContain('Published replacement');
  });
  it('publishes new pages atomically and never exposes an unpublished draft', async () => {
    await service.createPage({
      title: 'Privacy',
      slug: 'privacy-policy',
      content: '<p>Private</p>',
      status: 'DRAFT',
    });
    await expect(service.getPageBySlug('privacy-policy', true)).rejects.toThrow(
      'Page not found',
    );
    await service.createPage({
      title: 'Privacy',
      slug: 'privacy-policy',
      content: '<p>Public</p>',
      status: 'PUBLISHED',
    });
    expect(
      snapshots.get(PUBLICATION_PREFIX + 'privacy-policy').content,
    ).toContain('Public');
    expect(tx.$transaction).toHaveBeenCalledTimes(2);
  });
  it.each(['terms-and-conditions', 'privacy-policy'])(
    'locks policy URL and deletion: %s',
    async (slug) => {
      page.slug = slug;
      await expect(
        service.updatePage(page.id, { slug: 'renamed' }),
      ).rejects.toThrow('cannot be renamed');
      await expect(service.deletePage(page.id)).rejects.toThrow(
        'cannot be deleted',
      );
      expect(tx.page.update).not.toHaveBeenCalled();
      expect(tx.page.delete).not.toHaveBeenCalled();
    },
  );
  it('removes the published snapshot when deleting an ordinary page', async () => {
    page.slug = 'ordinary-page';
    snapshots.set(PUBLICATION_PREFIX + page.slug, { content: 'live' });
    await service.deletePage(page.id);
    expect(snapshots.size).toBe(0);
    expect(tx.page.delete).toHaveBeenCalled();
  });
  it('rejects blank publication without touching the saved version', async () => {
    await expect(
      service.updatePage(page.id, {
        content: '<p><br></p>',
        status: 'PUBLISHED',
      }),
    ).rejects.toThrow('before publishing');
    expect(tx.page.update).not.toHaveBeenCalled();
  });
  it('guards FAQ drafts and policy writes but allows filtered public reads', async () => {
    const controller = new AdminCmsController(service);
    for (const method of [
      'getFaqs',
      'createFaq',
      'updateFaq',
      'deleteFaq',
      'getAdminPage',
      'createPage',
      'updatePage',
      'deletePage',
    ]) {
      expect(
        Reflect.getMetadata(GUARDS_METADATA, controller[method]),
      ).toHaveLength(2);
      expect(Reflect.getMetadata('roles', controller[method])).toEqual([
        'ADMIN',
        'SUPER_ADMIN',
      ]);
    }
    await service.getPublicFaqs();
    expect(tx.faq.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, controller.getPublicFaqs),
    ).toBeUndefined();
    await expect(
      controller.getSetting(PUBLICATION_PREFIX + page.slug),
    ).rejects.toThrow();
    await expect(
      service.upsertSetting(PUBLICATION_PREFIX + page.slug, {}, {} as any),
    ).rejects.toThrow('Publish action');
  });
  it('whitelists FAQ edits instead of allowing id/timestamp injection', () => {
    expect(
      faqInput({ isActive: false, id: 'other', createdAt: 'fake' }, true),
    ).toEqual({ isActive: false });
    expect(faqInput({ question: ' Q ', answer: ' A ' })).toEqual({
      question: 'Q',
      answer: 'A',
      category: 'GENERAL',
    });
  });
  it.each([
    {},
    { question: '', answer: 'a' },
    { question: 'q', answer: 'a', isActive: 'false' },
    { question: 'q', answer: 'a', sortOrder: 1.5 },
    { question: 'q', answer: 'a', category: '' },
  ])('rejects invalid FAQ payload %j', (input) => {
    expect(() => faqInput(input)).toThrow();
  });
  it.each([
    {},
    { title: 'Title', slug: '../bad', content: '' },
    { title: 'Title', slug: 'valid', content: 9 },
    { title: 'Title', slug: 'valid', content: '', status: 'OTHER' },
  ])('rejects invalid page payload %j', (input) => {
    expect(() => pageInput(input)).toThrow();
  });
});
