import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { descendantIds, isCategoryActive } from './category-tree';
import { readCategories } from './category-reader';

@Injectable()
export class BusinessCategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    const { rows: categories } = await readCategories(this.prisma, true);
    const visible = includeInactive
      ? categories
      : categories.filter((node) => isCategoryActive(categories, node.id));
    return visible.map((node) => {
      const ids = new Set(descendantIds(visible, node.id));
      return {
        ...node,
        businessCount: visible
          .filter((item) => ids.has(item.id))
          .reduce((sum, item) => sum + (item._count?.businesses || 0), 0),
      };
    });
  }

  findById(id: string) {
    return this.prisma.businessCategory.findUnique({ where: { id } });
  }

  private async validateParent(parentId: string | null, id?: string) {
    if (!parentId) return;
    const nodes = await this.prisma.businessCategory.findMany();
    if (!nodes.some((node) => node.id === parentId))
      throw new BadRequestException('Parent category does not exist');
    if (id && descendantIds(nodes, id).includes(parentId))
      throw new BadRequestException('A category cannot be its own ancestor');
    let depth = 0;
    let parent = nodes.find((node) => node.id === parentId);
    const visited = new Set<string>();
    while (parent) {
      if (visited.has(parent.id))
        throw new BadRequestException('Invalid category hierarchy');
      visited.add(parent.id);
      depth++;
      parent = nodes.find((node) => node.id === parent!.parentId);
    }
    const height = (nodeId: string): number =>
      1 +
      Math.max(
        0,
        ...nodes
          .filter((node) => node.parentId === nodeId)
          .map((node) => height(node.id)),
      );
    if (depth + (id ? height(id) : 1) > 3)
      throw new BadRequestException('Use at most three category levels');
  }

  private clean(data: Record<string, unknown>) {
    const allowed = [
      'name',
      'slug',
      'description',
      'icon',
      'coverImage',
      'sortOrder',
      'isFeatured',
      'status',
      'parentId',
    ];
    const result = Object.fromEntries(
      Object.entries(data).filter(([key]) => allowed.includes(key)),
    );
    for (const key of ['name', 'slug']) {
      if (
        key in result &&
        (typeof result[key] !== 'string' || !String(result[key]).trim())
      )
        throw new BadRequestException(`${key} is required`);
    }
    if (result.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(result.slug)))
      throw new BadRequestException('Use a lowercase URL slug');
    if (
      result.status &&
      !['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(String(result.status))
    )
      throw new BadRequestException('Invalid status');
    return result;
  }

  async create(data: Record<string, unknown>) {
    const values = this.clean(data);
    if (!values.name || !values.slug)
      throw new BadRequestException('Name and slug are required');
    await this.validateParent(values.parentId as string | null);
    return this.prisma.businessCategory.create({
      data: values as { name: string; slug: string; parentId?: string },
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    const values = this.clean(data);
    if ('parentId' in values)
      await this.validateParent(values.parentId as string | null, id);
    return this.prisma.businessCategory.update({ where: { id }, data: values });
  }

  updateStatus(id: string, status: string) {
    return this.update(id, { status });
  }

  async delete(id: string) {
    const node = await this.prisma.businessCategory.findUnique({
      where: { id },
      include: { _count: { select: { businesses: true, children: true } } },
    });
    if (!node) throw new NotFoundException('Category not found');
    if (node._count.businesses || node._count.children)
      throw new BadRequestException(
        'This category has vendors or subcategories. Deactivate it instead.',
      );
    return this.prisma.businessCategory.delete({ where: { id } });
  }
}
