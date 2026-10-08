import { coordinates, distanceKm } from './geo';
import { DiscoveryService } from './discovery.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type SearchResult = {
  data: { id: string; distanceKm?: number | null }[];
  meta: { total: number };
};

describe('Nearby discovery within 50 km', () => {
  const origin = { latitude: 6.9271, longitude: 79.8612 };
  const vendor = (id: string, km?: number) => ({
    id,
    name: id,
    city: 'Colombo',
    packages: [],
    reviews: [],
    profileSettings:
      km === undefined
        ? {}
        : {
            location: {
              latitude: origin.latitude + km / 111.1950802335329,
              longitude: origin.longitude,
            },
          },
  });
  const findMany = jest.fn<Promise<unknown[]>, [Prisma.BusinessFindManyArgs]>();
  const count = jest.fn();
  const service = new DiscoveryService({
    business: { findMany, count },
  } as unknown as PrismaService);
  const query = () => findMany.mock.calls[0][0];
  beforeEach(() => {
    jest.resetAllMocks();
    count.mockResolvedValue(99);
  });

  it('validates coordinates, including zero and invalid legacy values', () => {
    expect(coordinates({ latitude: 0, longitude: 0 })).toEqual({
      latitude: 0,
      longitude: 0,
    });
    for (const value of [
      null,
      [],
      {},
      { latitude: '6', longitude: 80 },
      { latitude: NaN, longitude: 80 },
      { latitude: 91, longitude: 80 },
      { latitude: 6, longitude: Infinity },
      { latitude: 6, longitude: -181 },
    ])
      expect(coordinates(value)).toBeNull();
    expect(distanceKm(origin, origin)).toBe(0);
    expect(
      distanceKm(
        { latitude: 0, longitude: 179.9 },
        { latitude: 0, longitude: -179.9 },
      ),
    ).toBeCloseTo(22.24, 1);
  });

  it('filters before pagination, excludes missing coordinates, and sorts nearest first', async () => {
    findMany.mockResolvedValue([
      vendor('far', 50.01),
      vendor('edge', 49.99),
      vendor('near', 2),
      vendor('middle', 10),
      vendor('missing'),
    ]);
    const result = (await service.search(
      { ...origin, page: 2, limit: 2 },
      true,
    )) as SearchResult;
    expect(result.meta).toMatchObject({
      total: 3,
      page: 2,
      totalPages: 2,
      radiusKm: 50,
    });
    expect(result.data.map((v) => v.id)).toEqual(['edge']);
    expect(result.data[0].distanceKm).toBeCloseTo(49.99, 2);
    expect(result.data[0]).not.toHaveProperty('latitude');
    expect(query()).not.toHaveProperty('take');
    expect(query().where).toMatchObject({
      status: 'ACTIVE',
      vendorStatus: 'APPROVED',
    });
  });

  it('keeps keyword filters and price sorting inside the radius', async () => {
    findMany.mockResolvedValue([
      { ...vendor('a', 10), packages: [{ price: 200 }] },
      { ...vendor('b', 5), packages: [{ price: 100 }] },
      { ...vendor('far', 80), packages: [{ price: 50 }] },
    ]);
    const result = (await service.search(
      { ...origin, q: 'wedding', sortBy: 'PRICE_ASC' },
      true,
    )) as SearchResult;
    expect(result.data.map((v) => v.id)).toEqual(['b', 'a']);
    expect(query().where?.OR).toHaveLength(2);
  });

  it('rejects invalid nearby origins and distance sorting without location', async () => {
    await expect(service.search({ latitude: 0 }, true)).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.search({ ...origin, longitude: 181 }, true),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.search({ sortBy: 'DISTANCE' })).rejects.toMatchObject({
      status: 400,
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('preserves normal search and does not require vendor coordinates', async () => {
    findMany.mockResolvedValue([vendor('missing')]);
    const result = (await service.search({})) as SearchResult;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).not.toHaveProperty('distanceKm');
    expect(result.meta.total).toBe(99);
    expect(query()).toMatchObject({ skip: 0, take: 12 });
  });
});
