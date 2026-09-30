import { currentBrandContent } from './brand-content';

describe('currentBrandContent', () => {
  it('updates platform copy and legacy links in nested CMS content', () => {
    expect(
      currentBrandContent({
        title: 'Welcome to LuxeEvents',
        value: {
          copyright: 'Event Marketplace',
          socials: { website: 'https://www.luxeevents.fun' },
        },
        content: '<a href="mailto:support@luxeevents.com">LuxeEvents</a>',
      }),
    ).toEqual({
      title: 'Welcome to Nakathata.lk',
      value: {
        copyright: 'Nakathata.lk',
        socials: { website: 'https://www.nakathata.lk' },
      },
      content: '<a href="mailto:support@nakathata.lk">Nakathata.lk</a>',
    });
  });

  it('preserves authors, identifiers, assets, dates, secrets and the source record', () => {
    const record = {
      title: 'LuxeEvents',
      slug: 'luxeevents',
      imageUrl: 'https://luxeevents.fun/uploads/banner.jpg',
      author: { firstName: 'LuxeEvents' },
      password: 'LuxeEvents',
      createdAt: new Date('2026-09-30'),
      isActive: true,
    };
    const result = currentBrandContent(record);
    expect(result).toEqual({ ...record, title: 'Nakathata.lk' });
    expect(record.title).toBe('LuxeEvents');
    expect(currentBrandContent(null)).toBeNull();
  });

  it('handles lists and leaves current branding unchanged', () => {
    const result = currentBrandContent([
      { question: 'Why LuxeEvents?', answer: 'Nakathata.lk' },
    ]);
    expect(result).toEqual([
      { question: 'Why Nakathata.lk?', answer: 'Nakathata.lk' },
    ]);
    expect(currentBrandContent(result)).toEqual(result);
  });
});
