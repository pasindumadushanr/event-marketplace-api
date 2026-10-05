import { BusinessCategoriesService } from './business-categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BusinessCategoriesService', () => {
  const nodes = [
    { id: 'root', parentId: null, status: 'ACTIVE', _count: { businesses: 1 } },
    {
      id: 'child',
      parentId: 'root',
      status: 'ACTIVE',
      _count: { businesses: 2 },
    },
    {
      id: 'leaf',
      parentId: 'child',
      status: 'ACTIVE',
      _count: { businesses: 3 },
    },
    {
      id: 'hidden',
      parentId: 'root',
      status: 'INACTIVE',
      _count: { businesses: 10 },
    },
  ];
  const category = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const service = new BusinessCategoriesService({
    businessCategory: category,
  } as unknown as PrismaService);
  beforeEach(() => {
    jest.clearAllMocks();
    category.findMany.mockResolvedValue(nodes);
  });
  it('returns active categories with descendant vendor totals', async () => {
    const result = await service.findAll();
    expect(result).toHaveLength(3);
    expect(result.find((node) => node.id === 'root')?.businessCount).toBe(6);
    expect(await service.findAll(true)).toHaveLength(4);
  });
  it('rejects cycles and fourth-level categories', async () => {
    await expect(service.update('root', { parentId: 'leaf' })).rejects.toThrow(
      'ancestor',
    );
    await expect(
      service.create({ name: 'Too deep', slug: 'too-deep', parentId: 'leaf' }),
    ).rejects.toThrow('three');
    await expect(service.update('child', { parentId: 'leaf' })).rejects.toThrow(
      'ancestor',
    );
    expect(category.update).not.toHaveBeenCalled();
  });
  it('protects categories with children or vendor assignments', async () => {
    category.findUnique.mockResolvedValue({
      _count: { businesses: 0, children: 1 },
    });
    await expect(service.delete('root')).rejects.toThrow('Deactivate');
    category.findUnique.mockResolvedValue({
      _count: { businesses: 1, children: 0 },
    });
    await expect(service.delete('leaf')).rejects.toThrow('Deactivate');
    expect(category.delete).not.toHaveBeenCalled();
  });
  it('allows third-level categories and strips unexpected mutation fields', async () => {
    await service.create({
      name: 'New service',
      slug: 'new-service',
      parentId: 'child',
      businesses: { deleteMany: {} },
    });
    expect(category.create).toHaveBeenCalledWith({
      data: { name: 'New service', slug: 'new-service', parentId: 'child' },
    });
  });
});
