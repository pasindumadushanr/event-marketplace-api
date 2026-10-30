import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { InvitationsService } from './invitations.service';
import {
  InvitationStudioController,
  PublicInvitationsController,
} from './invitations.controller';
import { invitationContent, invitationSlug } from './invitation-content';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioAccessGuard } from './studio-access.guard';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
const content = {
  partnerOne: 'Amaya',
  partnerTwo: 'Kasun',
  welcome: 'Celebrate with us',
  weddingAt: '2027-09-18T16:00:00+05:30',
  venue: 'Hotel',
  address: 'Colombo',
  mapUrl: 'https://maps.app.goo.gl/example',
  rsvpPhone: '0771234567',
  couplePhoto: '/images/invitations/w01-demo-couple.jpg',
  story: '',
  gallery: [],
  music: true,
};
const id = '10000000-0000-4000-8000-000000000001';
describe('Invitation validation', () => {
  it('normalizes WhatsApp and validates complete publication content', () => {
    expect(invitationContent(content, true).rsvpPhone).toBe('94771234567');
    expect(() => invitationContent({ ...content, venue: '' }, true)).toThrow();
    expect(invitationContent({})).toMatchObject({
      partnerOne: '',
      music: false,
      gallery: [],
    });
  });
  it.each([
    { mapUrl: 'javascript:alert(1)' },
    { mapUrl: 'https://maps.app.goo.gl.evil.com/x' },
    { couplePhoto: 'https://evil.com/photo.jpg' },
    { couplePhoto: 'data:image/svg+xml,x' },
    { gallery: Array(9).fill('/images/invitations/a.jpg') },
    { music: 'true' },
    { weddingAt: '2027-09-18T16:00' },
    { weddingAt: '2027-02-30T16:00:00+05:30' },
    { rsvpPhone: 'not-a-number' },
    { extra: 'unexpected' },
  ])('rejects malformed or unsafe content %j', (change) => {
    expect(() => invitationContent({ ...content, ...change })).toThrow();
  });
  it.each([
    'demo',
    'catalogue',
    'review',
    '../admin',
    'With spaces',
    'a',
    '<script>',
  ])('rejects invalid/reserved slug %s', (slug) =>
    expect(() => invitationSlug(slug)).toThrow(),
  );
});
describe('Invitation lifecycle and privacy', () => {
  let row: any;
  let db: any;
  let service: InvitationsService;
  beforeEach(() => {
    row = {
      id,
      slug: 'amaya-kasun',
      templateId: 'W01',
      draft: invitationContent(content),
      published: null,
      status: 'DRAFT',
      revision: 1,
      previewDigest: null,
      previewExpires: null,
    };
    db = {
      weddingInvitation: {
        findUnique: jest.fn(async ({ where }) =>
          where.id === id || where.slug === row.slug ? { ...row } : null,
        ),
        updateMany: jest.fn(async ({ where, data }) => {
          if (where.revision !== row.revision) return { count: 0 };
          row = { ...row, ...data, revision: row.revision + 1 };
          return { count: 1 };
        }),
        create: jest.fn(async ({ data }) => ({ ...row, ...data })),
        findMany: jest.fn(async () => [row]),
      },
      setting: { findUnique: jest.fn(async () => null), upsert: jest.fn() },
    };
    service = new InvitationsService(db);
  });
  it('does not expose draft invitations publicly', async () => {
    await expect(service.publicInvitation(row.slug)).rejects.toThrow(
      'Invitation not available',
    );
    const safe = await service.get(id);
    expect(safe).not.toHaveProperty('previewDigest');
  });
  it('requires customer approval and publishes a separate snapshot', async () => {
    await expect(
      service.action(id, { action: 'publish', revision: 1 }, id),
    ).rejects.toThrow('Confirm customer approval');
    await service.action(
      id,
      { action: 'publish', revision: 1, approved: true },
      id,
    );
    await service.save(
      id,
      { revision: 2, draft: { ...content, partnerOne: 'Changed draft' } },
      id,
    );
    expect((await service.publicInvitation(row.slug)).content).toMatchObject({
      partnerOne: 'Amaya',
    });
    expect(row.draft.partnerOne).toBe('Changed draft');
  });
  it('rejects stale tabs and invalid actions without writes', async () => {
    await expect(
      service.save(id, { revision: 99, draft: content }, id),
    ).rejects.toThrow('changed in another tab');
    await expect(
      service.action(id, { revision: 1, action: 'delete-all' }, id),
    ).rejects.toThrow('Unknown invitation action');
    expect(row.revision).toBe(1);
  });
  it('keeps links fixed and rejects unimplemented templates', async () => {
    await service.save(
      id,
      { revision: 1, slug: 'different-slug', draft: content },
      id,
    );
    expect(row.slug).toBe('amaya-kasun');
    await expect(
      service.create(
        { slug: 'other-couple', templateId: 'W02', draft: content },
        id,
      ),
    ).rejects.toThrow('Template W01');
  });
  it('hashes review tokens, expires them and revokes them when edits are saved', async () => {
    const reviewed = await service.action(
      id,
      { action: 'review', revision: 1 },
      id,
    );
    expect(row.previewDigest).not.toBe(reviewed.reviewToken);
    expect(
      await service.review({ id, token: reviewed.reviewToken }),
    ).toHaveProperty('content');
    await expect(
      service.review({ id, token: 'a'.repeat(64) }),
    ).rejects.toThrow();
    row.previewExpires = new Date(Date.now() - 1000);
    await expect(
      service.review({ id, token: reviewed.reviewToken }),
    ).rejects.toThrow();
    row.previewExpires = new Date(Date.now() + 100000);
    await service.save(id, { revision: 2, draft: content }, id);
    await expect(
      service.review({ id, token: reviewed.reviewToken }),
    ).rejects.toThrow();
  });
  it('unpublishes and archives without deleting the draft', async () => {
    await service.action(
      id,
      { action: 'publish', revision: 1, approved: true },
      id,
    );
    await service.action(id, { action: 'unpublish', revision: 2 }, id);
    await expect(service.publicInvitation(row.slug)).rejects.toThrow();
    expect(row.draft.partnerOne).toBe('Amaya');
    await service.action(id, { action: 'archive', revision: 3 }, id);
    expect(row.status).toBe('ARCHIVED');
  });
});
describe('Studio HTTP role boundaries', () => {
  let app: INestApplication;
  let approvedAdmin = false;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InvitationStudioController, PublicInvitationsController],
      providers: [
        StudioAccessGuard,
        {
          provide: PrismaService,
          useValue: {
            invitationStudioMember: {
              findUnique: jest.fn(async () =>
                approvedAdmin ? { userId: id } : null,
              ),
            },
          },
        },
        {
          provide: InvitationsService,
          useValue: {
            list: jest.fn(() => []),
            settings: jest.fn(() => ({ orderPhone: '' })),
            publicInvitation: jest.fn(() => ({ content })),
          },
        },
        { provide: STORAGE_PROVIDER, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(ctx: any) {
          const req = ctx.switchToHttp().getRequest();
          const role = req.headers['x-test-role'];
          if (!role) throw new UnauthorizedException();
          req.user = { id, role: { name: role } };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it.each(['CUSTOMER', 'VENDOR', 'ADMIN'])(
    'blocks marketplace %s from studio records',
    async (role) => {
      await request(app.getHttpServer())
        .get('/invitation-studio/invitations')
        .set('x-test-role', role)
        .expect(403);
    },
  );
  it('blocks anonymous access', async () => {
    await request(app.getHttpServer())
      .get('/invitation-studio/invitations')
      .expect(401);
  });
  it('allows the explicitly approved existing admin without changing the ADMIN role', async () => {
    approvedAdmin = true;
    try {
      await request(app.getHttpServer())
        .get('/invitation-studio/invitations')
        .set('x-test-role', 'ADMIN')
        .expect(200);
    } finally {
      approvedAdmin = false;
    }
  });
  it.each(['SUPER_ADMIN', 'INVITATION_STAFF'])(
    'permits authorized %s',
    async (role) => {
      await request(app.getHttpServer())
        .get('/invitation-studio/invitations')
        .set('x-test-role', role)
        .expect(200);
    },
  );
  it('sets no-store and noindex on public invitation responses', async () => {
    await request(app.getHttpServer())
      .get('/public/invitations/amaya-kasun')
      .expect('Cache-Control', 'no-store')
      .expect('X-Robots-Tag', /noindex/)
      .expect(200);
  });
});
