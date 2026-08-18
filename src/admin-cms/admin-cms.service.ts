import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import type { StorageProvider } from '../common/providers/storage.provider';

@Injectable()
export class AdminCmsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  // Banners
  async getBanners() {
    return this.prisma.banner.findMany({
      orderBy: { sortOrder: 'asc' }
    });
  }

  async getActiveBanners() {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });
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
        sortOrder: parseInt(data.sortOrder || '0', 10)
      }
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
        isActive: data.isActive !== undefined ? (data.isActive === 'true' || data.isActive === true) : undefined,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : undefined
      }
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
    return this.prisma.faq.findMany({
      orderBy: { sortOrder: 'asc' }
    });
  }

  async createFaq(data: any) {
    return this.prisma.faq.create({
      data: {
        question: data.question,
        answer: data.answer,
        category: data.category || 'GENERAL',
        isActive: data.isActive !== undefined ? data.isActive : true,
        sortOrder: data.sortOrder || 0
      }
    });
  }

  async updateFaq(id: string, data: any) {
    return this.prisma.faq.update({
      where: { id },
      data
    });
  }

  async deleteFaq(id: string) {
    return this.prisma.faq.delete({ where: { id } });
  }

  // Pages
  async getPages() {
    return this.prisma.page.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getPageBySlug(slug: string, publicOnly = false) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('Page not found');
    if (publicOnly && page.status !== 'PUBLISHED') throw new NotFoundException('Page not found');
    return page;
  }

  async createPage(data: any) {
    return this.prisma.page.create({
      data: {
        title: data.title,
        slug: data.slug,
        content: data.content,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        status: data.status || 'DRAFT'
      }
    });
  }

  async updatePage(id: string, data: any) {
    return this.prisma.page.update({
      where: { id },
      data: {
        title: data.title,
        slug: data.slug,
        content: data.content,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        status: data.status
      }
    });
  }

  async deletePage(id: string) {
    return this.prisma.page.delete({ where: { id } });
  }

  // Blog Posts
  async getBlogPosts() {
    return this.prisma.blogPost.findMany({
      include: {
        author: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getPublishedBlogPosts() {
    return this.prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        author: { select: { firstName: true, lastName: true, profileImage: true } }
      },
      orderBy: { publishedAt: 'desc' }
    });
  }

  async getBlogPostBySlug(slug: string, publicOnly = false) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug },
      include: {
        author: { select: { firstName: true, lastName: true, profileImage: true } }
      }
    });
    if (!post) throw new NotFoundException('Blog post not found');
    if (publicOnly && post.status !== 'PUBLISHED') throw new NotFoundException('Blog post not found');
    return post;
  }

  async createBlogPost(data: any, authorId: string, file?: Express.Multer.File) {
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
        publishedAt: isPublished ? new Date() : null
      }
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

    const isNewlyPublished = data.status === 'PUBLISHED' && post.status !== 'PUBLISHED';

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
        publishedAt: isNewlyPublished ? new Date() : undefined
      }
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
  async getSetting(key: string) {
    return (this.prisma as any).siteSetting.findUnique({
      where: { key }
    });
  }

  async upsertSetting(key: string, value: any) {
    return (this.prisma as any).siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  }
}
