import { descendantIds, isCategoryActive } from './category-tree';
import { taxonomyRows, weddingTaxonomy } from './category-taxonomy';

describe('wedding category hierarchy', () => {
  const rows = taxonomyRows();
  const nodes = rows.map((row) => ({
    id: row.slug,
    parentId: row.parentSlug,
    status: 'ACTIVE',
  }));
  it('contains all 12 roots with unique names and slugs and three levels', () => {
    expect(weddingTaxonomy).toHaveLength(12);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(rows.length);
    expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length);
    expect(rows.filter((row) => !row.parentSlug)).toHaveLength(12);
    expect(
      rows.filter(
        (row) =>
          row.parentSlug &&
          weddingTaxonomy.some((root) => root.slug === row.parentSlug),
      ),
    ).toHaveLength(28);
    for (const row of rows)
      expect(isCategoryActive(nodes, row.slug)).toBe(true);
  });
  it('includes all descendants, but no unrelated category', () => {
    expect(descendantIds(nodes, 'wedding-cars-transport')).toEqual(
      expect.arrayContaining([
        'wedding-cars',
        'guest-transport',
        'vintage-classic-cars',
        'luxury-coaches-for-wedding-guests',
      ]),
    );
    expect(descendantIds(nodes, 'wedding-cars-transport')).not.toContain(
      'wedding-cakes',
    );
  });
  it('hides inactive ancestors and guards against cycles and orphans', () => {
    expect(
      isCategoryActive(
        nodes.map((node) =>
          node.id === 'wedding-cars-transport'
            ? { ...node, status: 'INACTIVE' }
            : node,
        ),
        'vintage-classic-cars',
      ),
    ).toBe(false);
    expect(
      isCategoryActive([{ id: 'a', parentId: 'a', status: 'ACTIVE' }], 'a'),
    ).toBe(false);
    expect(
      isCategoryActive(
        [{ id: 'a', parentId: 'missing', status: 'ACTIVE' }],
        'a',
      ),
    ).toBe(false);
    expect(
      descendantIds([{ id: 'a', parentId: 'a', status: 'ACTIVE' }], 'a'),
    ).toEqual(['a']);
  });
});
