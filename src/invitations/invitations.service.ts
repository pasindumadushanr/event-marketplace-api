import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { invitationContent, invitationSlug } from './invitation-content';
import { whatsappNumber } from '../vendor-business/public-contact';

const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const safeRow = (row: any) => {
  const { previewDigest: _digest, previewExpires: _expiry, ...safe } = row;
  return safe;
};
@Injectable()
export class InvitationsService {
  constructor(private readonly db: PrismaService) {}
  async settings() {
    const row = await this.db.setting.findUnique({
      where: { key: 'INVITATION_STUDIO_CONTACT' },
    });
    const value = row?.value as any;
    return { orderPhone: whatsappNumber(value?.orderPhone) || '' };
  }
  async saveSettings(body: any) {
    const raw = body?.orderPhone;
    if (typeof raw !== 'string' || (raw.trim() && !whatsappNumber(raw)))
      throw new BadRequestException('Enter a valid ordering WhatsApp number');
    const value = { orderPhone: whatsappNumber(raw) || '' };
    await this.db.setting.upsert({
      where: { key: 'INVITATION_STUDIO_CONTACT' },
      create: { key: 'INVITATION_STUDIO_CONTACT', value },
      update: { value },
    });
    return value;
  }
  async list() {
    return this.db.weddingInvitation.findMany({
      take: 200,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        status: true,
        templateId: true,
        revision: true,
        updatedAt: true,
        draft: true,
      },
    });
  }
  async get(id: string) {
    const row = await this.db.weddingInvitation.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Invitation not found');
    return safeRow(row);
  }
  async create(body: any, actor: string) {
    const draft = invitationContent(body?.draft);
    const slug = invitationSlug(body?.slug);
    if (!['W01', 'W02'].includes(body.templateId))
      throw new BadRequestException('Choose an available invitation template');
    try {
      return safeRow(
        await this.db.weddingInvitation.create({
          data: {
            slug,
            draft,
            templateId: body.templateId,
            createdBy: actor,
            updatedBy: actor,
          },
        }),
      );
    } catch (e: any) {
      if (e.code === 'P2002')
        throw new ConflictException('That invitation link is already taken');
      throw e;
    }
  }
  private async change(
    id: string,
    revision: unknown,
    actor: string,
    data: any,
  ) {
    if (!Number.isInteger(revision) || (revision as number) < 1)
      throw new BadRequestException('Reload the invitation before saving');
    const changed = await this.db.weddingInvitation.updateMany({
      where: { id, revision: revision as number },
      data: { ...data, updatedBy: actor, revision: { increment: 1 } },
    });
    if (!changed.count)
      throw new ConflictException(
        'This invitation changed in another tab. Reload before trying again.',
      );
    return this.get(id);
  }
  async save(id: string, body: any, actor: string) {
    // Slugs are permanent after creation, so customer links cannot break.
    return this.change(id, body?.revision, actor, {
      draft: invitationContent(body?.draft),
      previewDigest: null,
      previewExpires: null,
    });
  }
  async action(id: string, body: any, actor: string) {
    const row = await this.get(id);
    switch (body?.action) {
      case 'publish':
        if (body.approved !== true)
          throw new BadRequestException(
            'Confirm customer approval before publishing',
          );
        return this.change(id, body.revision, actor, {
          published: invitationContent(row.draft, true),
          status: 'PUBLISHED',
          previewDigest: null,
          previewExpires: null,
        });
      case 'unpublish':
      case 'archive':
        return this.change(id, body.revision, actor, {
          published: Prisma.DbNull,
          status: body.action === 'archive' ? 'ARCHIVED' : 'DRAFT',
          previewDigest: null,
          previewExpires: null,
        });
      case 'review': {
        invitationContent(row.draft, true);
        const token = randomBytes(32).toString('hex');
        const result = await this.change(id, body.revision, actor, {
          previewDigest: digest(token),
          previewExpires: new Date(Date.now() + 7 * 86400000),
          ...(row.status === 'PUBLISHED' ? {} : { status: 'REVIEW' }),
        });
        return { ...result, reviewToken: token };
      }
      default:
        throw new BadRequestException('Unknown invitation action');
    }
  }
  async publicInvitation(slug: string) {
    const row = await this.db.weddingInvitation.findUnique({ where: { slug } });
    if (!row || row.status !== 'PUBLISHED' || !row.published)
      throw new NotFoundException('Invitation not available');
    return {
      slug: row.slug,
      templateId: row.templateId,
      content: row.published,
    };
  }
  async review(body: any) {
    if (
      typeof body?.id !== 'string' ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.id) ||
      typeof body.token !== 'string' ||
      !/^[0-9a-f]{64}$/.test(body.token)
    )
      throw new NotFoundException('Review link not available');
    const row = await this.db.weddingInvitation.findUnique({
      where: { id: body.id },
    });
    if (
      !row?.previewDigest ||
      !row.previewExpires ||
      row.previewExpires.getTime() < Date.now() ||
      digest(body.token) !== row.previewDigest ||
      row.status === 'ARCHIVED'
    )
      throw new NotFoundException('Review link expired or not available');
    return { slug: row.slug, templateId: row.templateId, content: row.draft };
  }
}
