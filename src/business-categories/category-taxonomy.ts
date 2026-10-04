export type TaxonomyGroup = {
  name: string;
  slug: string;
  children: { name: string; services: string[] }[];
};

export const weddingTaxonomy: TaxonomyGroup[] = [
  {
    name: 'Venues & Locations',
    slug: 'venues-locations',
    children: [
      {
        name: 'Wedding Venues & Hotels',
        services: [
          'Indoor Banquet Halls',
          'Outdoor & Garden Venues',
          'Beachfront Wedding Venues',
        ],
      },
      {
        name: 'Photoshoot Locations',
        services: ['Studio Spaces & Sets', 'Outdoor & Nature Locations'],
      },
      {
        name: 'Honeymoon Destinations',
        services: ['Local Resorts & Villas', 'Overseas Tour Packages'],
      },
    ],
  },
  {
    name: 'Attire & Fashion',
    slug: 'attire-fashion',
    children: [
      {
        name: 'Bridal Wear',
        services: [
          'Bridal Sarees & Osari',
          'Western Wedding Gowns',
          'Pre-Shoot & Casual Dresses',
        ],
      },
      {
        name: 'Groom Attire',
        services: ['Mul Anduma / Nilame Wear', 'Western Suits & Tuxedos'],
      },
      {
        name: 'Dress Designers & Tailoring',
        services: [
          'Bridal Dress Designers',
          'Gents Suit Designers & Tailoring',
        ],
      },
      {
        name: 'Footwear & Accessories',
        services: ['Bridal Shoes', 'Groom Shoes'],
      },
    ],
  },
  {
    name: 'Hair, Beauty & Grooming',
    slug: 'hair-beauty-grooming',
    children: [
      {
        name: 'Bridal Salons & Makeup',
        services: ['Traditional & Western Bridal Dressing', 'Mehendi Artists'],
      },
      {
        name: 'Groom Grooming & Salons',
        services: ['Groom Hair Styling & Grooming Packages'],
      },
    ],
  },
  {
    name: 'Jewellery & Accessories',
    slug: 'jewellery-accessories',
    children: [
      {
        name: 'Real Gold Jewellery',
        services: ['Wedding Rings', 'Custom Gold Jewellery'],
      },
      {
        name: 'Bridal Costume Jewellery & Rentals',
        services: [
          'Traditional Poruwa Jewellery Sets',
          'Modern / Western Bridal Sets',
        ],
      },
    ],
  },
  {
    name: 'Photography & Media',
    slug: 'photography-media',
    children: [
      {
        name: 'Wedding Photographers',
        services: [
          'Full Day Wedding Coverage',
          'Pre-Wedding / Pre-Shoot Photography',
        ],
      },
      {
        name: 'Cinematography & Video',
        services: [
          'Cinematic Wedding Films',
          'Drone / Aerial Videography',
          'Live Streaming Services',
        ],
      },
      {
        name: 'Live Wedding Painters',
        services: ['Live Event & Portrait Painters'],
      },
    ],
  },
  {
    name: 'Floral & Event Styling',
    slug: 'floral-event-styling',
    children: [
      {
        name: 'Wedding Planning',
        services: ['Full Wedding Planners', 'Day-of Coordinators'],
      },
      {
        name: 'Floral Decorators',
        services: ['Poruwa, Stage & Table Decor', 'Church & Outdoor Setups'],
      },
      {
        name: 'Bouquet Designers',
        services: ['Fresh & Artificial Bridal Bouquets'],
      },
    ],
  },
  {
    name: 'Traditional, Legal & Rituals',
    slug: 'traditional-legal-rituals',
    children: [
      {
        name: 'Poruwa & Cultural Rituals',
        services: [
          'Ashtaka Masters',
          'Jayamangala Gatha Groups',
          'Poruwa Gift Packs & Ritual Items',
        ],
      },
      {
        name: 'Marriage Registration Info',
        services: ['Marriage Registrars Directory & Regional Contacts'],
      },
    ],
  },
  {
    name: 'Music, Dance & Entertainment',
    slug: 'music-dance-entertainment',
    children: [
      {
        name: 'Music, Sound & Lights',
        services: [
          'Live Bands & Acoustic Sets',
          'DJs, Sound & Ambient Lighting',
        ],
      },
      {
        name: 'Choreography & Dance Troupes',
        services: [
          'Traditional Wedding Dancers & Drummers',
          'First Dance Couple Choreographers',
          'Modern & Western Dance Crews',
        ],
      },
    ],
  },
  {
    name: 'Stationery & Favors',
    slug: 'stationery-favors',
    children: [
      {
        name: 'Wedding Stationery',
        services: [
          'Wedding Invitation Cards (Laser Cut, Box, Modern)',
          'Thank You Cards & Digital Invitations',
        ],
      },
      {
        name: 'Souvenirs & Favors',
        services: ['Guest Favors & Keepsakes', 'Traditional Return Gift Boxes'],
      },
    ],
  },
  {
    name: 'Cakes, Pastries & Catering',
    slug: 'cakes-pastries-catering',
    children: [
      {
        name: 'Wedding Cakes',
        services: ['Wedding Cake Structures', 'Cake Boxes & Giveaways'],
      },
      {
        name: 'Pastries & Short Eats (Outdoor/Cocktail Events)',
        services: [
          'Savory Short Eats & Canapés',
          'Dessert Tables & Sweet Treats',
          'Mobile Coffee & Beverage Bars',
        ],
      },
    ],
  },
  {
    name: 'Wedding Cars & Transport',
    slug: 'wedding-cars-transport',
    children: [
      {
        name: 'Wedding Cars',
        services: [
          'Vintage & Classic Cars',
          'Modern Luxury Sedans & Limousines',
        ],
      },
      {
        name: 'Guest Transport',
        services: [
          'Passenger Vans & Mini-Buses',
          'Luxury Coaches for Wedding Guests',
        ],
      },
    ],
  },
  {
    name: 'Event Security & Crowd Control (ආරක්ෂක සේවා)',
    slug: 'event-security-crowd-control',
    children: [
      {
        name: 'Security Personnel',
        services: [
          'Wedding Bouncers & VIP Protection',
          'Parking & Guest Crowd Management',
        ],
      },
    ],
  },
];

export const categorySlug = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function taxonomyRows() {
  const rows: {
    name: string;
    slug: string;
    parentSlug: string | null;
    sortOrder: number;
  }[] = [];
  weddingTaxonomy.forEach((root, i) => {
    rows.push({
      name: root.name,
      slug: root.slug,
      parentSlug: null,
      sortOrder: i + 1,
    });
    root.children.forEach((child, j) => {
      const slug = categorySlug(child.name);
      rows.push({
        name: child.name,
        slug,
        parentSlug: root.slug,
        sortOrder: j + 1,
      });
      child.services.forEach((name, k) =>
        rows.push({
          name,
          slug: categorySlug(name),
          parentSlug: slug,
          sortOrder: k + 1,
        }),
      );
    });
  });
  return rows;
}

// Broad legacy classifications map to broad main categories, never a guessed specialty.
export const legacyCategoryTargets: Record<string, string> = {
  'hotels-venues': 'venues-locations',
  photographers: 'photography-media',
  videographers: 'photography-media',
  'beauty-makeup': 'hair-beauty-grooming',
  'beauty-salons': 'hair-beauty-grooming',
  'bridal-wear': 'attire-fashion',
  'bridal-dresses': 'attire-fashion',
  'decorators-florists': 'floral-event-styling',
  decorators: 'floral-event-styling',
  florists: 'floral-event-styling',
  entertainment: 'music-dance-entertainment',
  'catering-cakes': 'cakes-pastries-catering',
  cakes: 'cakes-pastries-catering',
  'vehicle-rental': 'wedding-cars-transport',
  'event-planners': 'floral-event-styling',
  'invitations-printing': 'stationery-favors',
};
