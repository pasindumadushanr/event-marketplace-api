import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import type { StorageProvider } from '../common/providers/storage.provider';
import { currentBrandContent } from './brand-content';
import { AdminActor, recordActivity } from '../admin-activity/activity';
import { validateImageUpload, validateSiteMedia } from './site-media';
import {
  validateSetting,
  fields,
  pickStrings,
  managedKeys,
} from '../platform-settings/validation';
import {
  faqInput,
  pageInput,
  isPolicy,
  publication,
  PUBLICATION_PREFIX,
  validatePublication,
} from './content-validation';

@Injectable()
export class AdminCmsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  // Banners
  async getBanners() {
    return this.prisma.banner
      .findMany({
        orderBy: { sortOrder: 'asc' },
      })
      .then(currentBrandContent);
  }

  async getActiveBanners() {
    return this.prisma.banner
      .findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })
      .then(currentBrandContent);
  }

  async createBanner(data: any, file?: Express.Multer.File) {
    let imageUrl = data.imageUrl || '';
    if (file) {
      imageUrl = await this.storage.uploadFile(file, 'banners');
    }

    return this.prisma.banner.create({
      data: {
        title: data.title,
        subtitle: data.subtitle,
        link: data.link,
        imageUrl: imageUrl,
        isActive: data.isActive === 'true' || data.isActive === true,
        sortOrder: parseInt(data.sortOrder || '0', 10),
      },
    });
  }

  async updateBanner(id: string, data: any, file?: Express.Multer.File) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');

    let imageUrl = banner.imageUrl;
    if (file) {
      // Delete old file if it's from cloudinary
      if (imageUrl && imageUrl.includes('cloudinary')) {
        await this.storage.deleteFile(imageUrl);
      }
      imageUrl = await this.storage.uploadFile(file, 'banners');
    } else if (data.imageUrl !== undefined) {
      imageUrl = data.imageUrl;
    }

    return this.prisma.banner.update({
      where: { id },
      data: {
        title: data.title,
        subtitle: data.subtitle,
        link: data.link,
        imageUrl,
        isActive:
          data.isActive !== undefined
            ? data.isActive === 'true' || data.isActive === true
            : undefined,
        sortOrder:
          data.sortOrder !== undefined
            ? parseInt(data.sortOrder, 10)
            : undefined,
      },
    });
  }

  async deleteBanner(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (banner && banner.imageUrl && banner.imageUrl.includes('cloudinary')) {
      await this.storage.deleteFile(banner.imageUrl);
    }
    return this.prisma.banner.delete({ where: { id } });
  }

  // FAQs
  async getFaqs() {
    return this.prisma.faq
      .findMany({
        orderBy: { sortOrder: 'asc' },
      })
      .then(currentBrandContent);
  }

  async getPublicFaqs() {
    return this.prisma.faq
      .findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          question: true,
          answer: true,
          category: true,
          sortOrder: true,
        },
      })
      .then(currentBrandContent);
  }

  async createFaq(data: any) {
    return this.prisma.faq.create({
      data: faqInput(data),
    });
  }

  async updateFaq(id: string, data: any) {
    return this.prisma.faq.update({
      where: { id },
      data: faqInput(data, true),
    });
  }

  async deleteFaq(id: string) {
    return this.prisma.faq.delete({ where: { id } });
  }

  // Pages
  async getPages() {
    return this.prisma.page
      .findMany({
        orderBy: { createdAt: 'desc' },
      })
      .then(currentBrandContent);
  }

  async getPageBySlug(slug: string, publicOnly = false) {
    if (publicOnly) {
      const snapshot = await this.prisma.setting.findUnique({
        where: { key: PUBLICATION_PREFIX + slug },
      });
      if (snapshot) return currentBrandContent(snapshot.value);
    }
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('Page not found');
    if (publicOnly && page.status !== 'PUBLISHED')
      throw new NotFoundException('Page not found');
    return currentBrandContent(page);
  }

  async createPage(data: any) {
    const input = pageInput(data);
    if (input.status === 'PUBLISHED') validatePublication(input);
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.page.create({ data: input });
      if (page.status === 'PUBLISHED') {
        const value = publication(page);
        await tx.setting.upsert({
          where: { key: PUBLICATION_PREFIX + page.slug },
          create: { key: PUBLICATION_PREFIX + page.slug, value },
          update: { value },
        });
      }
      return page;
    });
  }

  async updatePage(id: string, data: any) {
    const input = pageInput(data, true);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.page.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Page not found');
      const key = PUBLICATION_PREFIX + existing.slug;
      const saved = await tx.setting.findUnique({ where: { key } });
      if (
        input.slug &&
        input.slug !== existing.slug &&
        (isPolicy(existing.slug) || saved || existing.status === 'PUBLISHED')
      )
        throw new BadRequestException(
          'The URL of a policy or published page cannot be renamed',
        );
      // A content edit without an explicit Publish action must never change the live copy.
      input.status = input.status || 'DRAFT';
      if (input.status === 'PUBLISHED')
        validatePublication({ ...existing, ...input });
      if (!saved && existing.status === 'PUBLISHED') {
        await tx.setting.create({
          data: { key, value: publication(existing) },
        });
      }
      const page = await tx.page.update({ where: { id }, data: input });
      if (page.status === 'PUBLISHED') {
        const value = publication(page);
        await tx.setting.upsert({
          where: { key: PUBLICATION_PREFIX + page.slug },
          create: { key: PUBLICATION_PREFIX + page.slug, value },
          update: { value },
        });
      }
      return page;
    });
  }

  async deletePage(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.page.findUnique({ where: { id } });
      if (!page) throw new NotFoundException('Page not found');
      if (isPolicy(page.slug))
        throw new BadRequestException(
          'Terms and Privacy cannot be deleted. Edit and publish a replacement instead.',
        );
      await tx.setting.deleteMany({
        where: { key: PUBLICATION_PREFIX + page.slug },
      });
      return tx.page.delete({ where: { id } });
    });
  }

  // Blog Posts
  async getBlogPosts() {
    return this.prisma.blogPost
      .findMany({
        include: {
          author: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      .then(currentBrandContent);
  }

  async getPublishedBlogPosts() {
    return this.prisma.blogPost
      .findMany({
        where: { status: 'PUBLISHED' },
        include: {
          author: {
            select: { firstName: true, lastName: true, profileImage: true },
          },
        },
        orderBy: { publishedAt: 'desc' },
      })
      .then(currentBrandContent);
  }

  async getBlogPostBySlug(slug: string, publicOnly = false) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug },
      include: {
        author: {
          select: { firstName: true, lastName: true, profileImage: true },
        },
      },
    });
    if (!post) throw new NotFoundException('Blog post not found');
    if (publicOnly && post.status !== 'PUBLISHED')
      throw new NotFoundException('Blog post not found');
    return currentBrandContent(post);
  }

  async createBlogPost(
    data: any,
    authorId: string,
    file?: Express.Multer.File,
  ) {
    let coverImage = data.coverImage || '';
    if (file) {
      coverImage = await this.storage.uploadFile(file, 'blog');
    }

    const isPublished = data.status === 'PUBLISHED';

    return this.prisma.blogPost.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        content: data.content,
        coverImage,
        authorId,
        status: data.status || 'DRAFT',
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        publishedAt: isPublished ? new Date() : null,
      },
    });
  }

  async updateBlogPost(id: string, data: any, file?: Express.Multer.File) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Blog post not found');

    let coverImage = post.coverImage;
    if (file) {
      if (coverImage && coverImage.includes('cloudinary')) {
        await this.storage.deleteFile(coverImage);
      }
      coverImage = await this.storage.uploadFile(file, 'blog');
    } else if (data.coverImage !== undefined) {
      coverImage = data.coverImage;
    }

    const isNewlyPublished =
      data.status === 'PUBLISHED' && post.status !== 'PUBLISHED';

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        content: data.content,
        coverImage,
        status: data.status,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        publishedAt: isNewlyPublished ? new Date() : undefined,
      },
    });
  }

  async deleteBlogPost(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (post && post.coverImage && post.coverImage.includes('cloudinary')) {
      await this.storage.deleteFile(post.coverImage);
    }
    return this.prisma.blogPost.delete({ where: { id } });
  }

  // Settings
  async uploadSiteImage(file?: Express.Multer.File) {
    const image = validateImageUpload(file);
    return { url: await this.storage.uploadFile(image, 'site-media') };
  }

  async getSetting(key: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });
    if (key === 'SITE_MEDIA') return setting?.value ?? {};
    if (managedKeys.includes(key))
      return setting ? pickStrings(setting.value, fields[key]) : null;
    return setting ? currentBrandContent(setting.value) : null;
  }

  async upsertSetting(key: string, value: any, actor: AdminActor) {
    if (key.startsWith(PUBLICATION_PREFIX))
      throw new BadRequestException(
        'Use the page Publish action to update published content',
      );
    if (key === 'SITE_MEDIA') value = validateSiteMedia(value);
    if (managedKeys.includes(key)) value = validateSetting(key, value);
    if (key === 'apikeys') value = { ...value, _analyticsConfigured: true };
    const footerSocials = key === 'FOOTER_CONTENT' ? value?.socials : undefined;
    return this.prisma.$transaction(async (tx) => {
      if (key === 'FOOTER_CONTENT') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new BadRequestException('Footer content must be an object');
        for (const name of ['description', 'copyright', 'subtext']) {
          if (
            value[name] !== undefined &&
            (typeof value[name] !== 'string' || value[name].length > 3000)
          )
            throw new BadRequestException('Invalid footer text');
        }
        const previous = await tx.setting.findUnique({ where: { key } });
        value = { ...((previous?.value || {}) as object), ...value };
      }
      const setting = await tx.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
      // Both footer editors share one set of social links. Preserve other networks.
      if (key === 'FOOTER_CONTENT' && footerSocials) {
        const previous = await tx.setting.findUnique({
          where: { key: 'social' },
        });
        const social = {
          ...pickStrings(previous?.value, fields.social),
          ...pickStrings(footerSocials, fields.social),
        };
        validateSetting('social', {
          website: '',
          facebook: '',
          instagram: '',
          linkedin: '',
          twitter: '',
          youtube: '',
          tiktok: '',
          ...social,
        });
        await tx.setting.upsert({
          where: { key: 'social' },
          create: { key: 'social', value: social },
          update: { value: social },
        });
      }
      await recordActivity(
        tx,
        actor,
        'SETTING_CHANGED',
        'SETTING',
        key,
        `Platform setting ${key} updated (values redacted)`,
      );
      return setting.value;
    });
  }
}
