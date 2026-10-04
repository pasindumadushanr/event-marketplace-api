import { PrismaClient } from '@prisma/client';
import { seedCategories } from '../../prisma/seed-categories';

describe('category catalog synchronization', () => {
  it('preserves vendors, maps broad legacy categories, and is safe to repeat', async () => {
    type Node = {
      id: string;
      slug: string;
      name: string;
      parentId: string | null;
      status: string;
    };
    const nodes: Node[] = [
      {
        id: 'old-cars',
        slug: 'vehicle-rental',
        name: 'Vehicle Rental',
        parentId: null,
        status: 'ACTIVE',
      },
      {
        id: 'old-attire',
        slug: 'bridal-wear',
        name: 'Bridal Dress & Suit Shops',
        parentId: null,
        status: 'ACTIVE',
      },
      {
        id: 'other',
        slug: 'other',
        name: 'Other Event Services',
        parentId: null,
        status: 'ACTIVE',
      },
    ];
    const businesses = [
      { id: 'car-vendor', categoryId: 'old-cars' },
      { id: 'suit-vendor', categoryId: 'old-attire' },
      { id: 'unclassified-vendor', categoryId: 'other' },
    ];
    const tx = {
      businessCategory: {
        findMany: async () => nodes.map((node) => ({ ...node })),
        upsert: async ({ where, update, create }) => {
          let node = nodes.find((item) => item.slug === where.slug);
          if (node) Object.assign(node, update);
          else {
            node = {
              id: `id-${create.slug}`,
              status: 'ACTIVE',
              parentId: null,
              ...create,
            };
            nodes.push(node!);
          }
          return node;
        },
        update: async ({ where, data }) =>
          Object.assign(
            nodes.find((node) => node.id === where.id)!,
            data,
          ),
        updateMany: async ({ where, data }) =>
          nodes
            .filter((node) => node.slug === where.slug)
            .forEach((node) => Object.assign(node, data)),
      },
      business: {
        updateMany: async ({ where, data }) =>
          businesses
            .filter((business) => business.categoryId === where.categoryId)
            .forEach((business) => Object.assign(business, data)),
      },
    };
    const prisma = {
      $transaction: async (operation) => operation(tx),
    } as unknown as PrismaClient;
    expect(await seedCategories(prisma)).toEqual({ roots: 12, categories: 98 });
    expect(businesses).toEqual([
      { id: 'car-vendor', categoryId: 'id-wedding-cars-transport' },
      { id: 'suit-vendor', categoryId: 'id-attire-fashion' },
      { id: 'unclassified-vendor', categoryId: 'other' },
    ]);
    expect(nodes.find((node) => node.id === 'old-cars')?.status).toBe(
      'INACTIVE',
    );
    businesses.push({ id: 'new-bridal-vendor', categoryId: 'old-attire' });
    const count = nodes.length;
    await seedCategories(prisma);
    expect(nodes.length).toBe(count);
    expect(
      businesses.find((business) => business.id === 'new-bridal-vendor')
        ?.categoryId,
    ).toBe('old-attire');
    expect(
      nodes.filter((node) => node.status === 'ACTIVE' && !node.parentId),
    ).toHaveLength(12);
  });
});
