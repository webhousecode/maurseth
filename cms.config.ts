import { defineConfig, defineCollection, defineBlock } from '@webhouse/cms';

export default defineConfig({
  blocks: [
    defineBlock({
      name: 'hero',
      label: 'Hero (Parallax)',
      fields: [
        { name: 'image', type: 'image', label: 'Baggrundsbillede' },
        { name: 'title', type: 'text', label: 'Titel' },
        { name: 'subtitle', type: 'text', label: 'Undertitel' },
      ],
    }),
    defineBlock({
      name: 'text-section',
      label: 'Tekstsektion',
      fields: [
        { name: 'heading', type: 'text', label: 'Overskrift' },
        { name: 'content', type: 'richtext', label: 'Indhold' },
      ],
    }),
    defineBlock({
      name: 'image-gallery',
      label: 'Billedgalleri',
      fields: [
        { name: 'heading', type: 'text', label: 'Overskrift' },
        { name: 'images', type: 'image-gallery', label: 'Billeder' },
      ],
    }),
    defineBlock({
      name: 'profile',
      label: 'Profil',
      fields: [
        { name: 'heading', type: 'text', label: 'Overskrift' },
        { name: 'bio', type: 'richtext', label: 'Biografi' },
        { name: 'portraitImage', type: 'image', label: 'Portræt' },
      ],
    }),
    defineBlock({
      name: 'contact-info',
      label: 'Kontakt',
      fields: [
        { name: 'heading', type: 'text', label: 'Overskrift' },
        { name: 'address', type: 'textarea', label: 'Adresse' },
        { name: 'email', type: 'text', label: 'Email' },
        { name: 'phone', type: 'text', label: 'Telefon' },
      ],
    }),
    defineBlock({
      name: 'exhibition-list',
      label: 'Udstillingsliste',
      fields: [
        { name: 'heading', type: 'text', label: 'Overskrift' },
        { name: 'showYears', type: 'text', label: 'Vis kun disse år (kommasepareret, tom = alle)' },
      ],
    }),
    defineBlock({
      name: 'artwork-grid',
      label: 'Værk-grid',
      fields: [
        { name: 'heading', type: 'text', label: 'Overskrift' },
        { name: 'category', type: 'select', label: 'Kategori', options: [
          { label: 'Alle', value: 'all' },
          { label: 'Værker', value: 'vaerker' },
          { label: 'Grafik', value: 'grafik' },
          { label: 'Collager', value: 'collager' },
        ]},
        { name: 'maxItems', type: 'number', label: 'Maks antal (0 = alle)' },
      ],
    }),
    defineBlock({
      name: 'cv-section',
      label: 'CV Sektion',
      fields: [
        { name: 'heading', type: 'text', label: 'Overskrift' },
        { name: 'content', type: 'richtext', label: 'Indhold' },
      ],
    }),
  ],

  collections: [
    defineCollection({
      name: 'globals',
      label: 'Siteindstillinger',
      fields: [
        { name: 'siteName', type: 'text', label: 'Sitenavn', required: true },
        { name: 'artistName', type: 'text', label: 'Kunstnernavn' },
        { name: 'artistTitle', type: 'text', label: 'Titel (f.eks. Billedkunstner)' },
        { name: 'email', type: 'text', label: 'Email' },
        { name: 'phone', type: 'text', label: 'Telefon' },
        { name: 'studioAddress', type: 'textarea', label: 'Atelier-adresse' },
        { name: 'postAddress', type: 'textarea', label: 'Postadresse' },
        { name: 'instagramUrl', type: 'text', label: 'Instagram URL' },
        { name: 'facebookUrl', type: 'text', label: 'Facebook URL' },
        { name: 'heroImage', type: 'image', label: 'Hero-billede (forside)' },
        { name: 'logoImage', type: 'image', label: 'Logo' },
        { name: 'footerText', type: 'text', label: 'Footer tekst' },
        { name: 'cookieText', type: 'text', label: 'Cookie-banner tekst' },
        { name: 'metaDescription', type: 'textarea', label: 'Standard meta description' },
      ],
    }),

    defineCollection({
      name: 'pages',
      label: 'Sider',
      urlPrefix: '/',
      fields: [
        { name: 'title', type: 'text', label: 'Titel', required: true },
        { name: 'metaDescription', type: 'textarea', label: 'Meta description' },
        { name: 'sections', type: 'blocks', label: 'Sektioner', blocks: [
          'hero', 'text-section', 'image-gallery', 'profile', 'contact-info',
          'exhibition-list', 'artwork-grid', 'cv-section',
        ]},
      ],
    }),

    defineCollection({
      name: 'posts',
      label: 'Nyheder',
      urlPrefix: '/nyheder',
      fields: [
        { name: 'title', type: 'text', label: 'Titel', required: true },
        { name: 'date', type: 'date', label: 'Dato' },
        { name: 'excerpt', type: 'textarea', label: 'Uddrag' },
        { name: 'content', type: 'richtext', label: 'Indhold' },
        { name: 'featuredImage', type: 'image', label: 'Hovedbillede' },
        { name: 'category', type: 'select', label: 'Kategori', options: [
          { label: 'Nyheder', value: 'nyheder' },
          { label: 'Udstilling', value: 'udstilling' },
          { label: 'Arrangement', value: 'arrangement' },
          { label: 'Workshop', value: 'workshop' },
          { label: 'Kursus', value: 'kursus' },
        ]},
        { name: 'tags', type: 'tags', label: 'Tags' },
      ],
    }),

    defineCollection({
      name: 'exhibitions',
      label: 'Udstillinger',
      urlPrefix: '/udstillinger',
      fields: [
        { name: 'title', type: 'text', label: 'Titel', required: true },
        { name: 'year', type: 'number', label: 'År' },
        { name: 'venue', type: 'text', label: 'Sted' },
        { name: 'location', type: 'text', label: 'By/land' },
        { name: 'description', type: 'richtext', label: 'Beskrivelse' },
        { name: 'featuredImage', type: 'image', label: 'Billede' },
        { name: 'startDate', type: 'date', label: 'Startdato' },
        { name: 'endDate', type: 'date', label: 'Slutdato' },
        { name: 'category', type: 'select', label: 'Type', options: [
          { label: 'Udstilling', value: 'udstilling' },
          { label: 'Arrangement', value: 'arrangement' },
          { label: 'Workshop', value: 'workshop' },
        ]},
      ],
    }),

    defineCollection({
      name: 'gallery',
      label: 'Galleri',
      urlPrefix: '/galleri',
      fields: [
        { name: 'title', type: 'text', label: 'Titel', required: true },
        { name: 'medium', type: 'text', label: 'Medie (akryl, olie, grafik...)' },
        { name: 'dimensions', type: 'text', label: 'Mål (f.eks. 100 x 100)' },
        { name: 'year', type: 'number', label: 'År' },
        { name: 'image', type: 'image', label: 'Billede' },
        { name: 'sold', type: 'boolean', label: 'Solgt' },
        { name: 'category', type: 'select', label: 'Kategori', options: [
          { label: 'Værker', value: 'vaerker' },
          { label: 'Grafik', value: 'grafik' },
          { label: 'Collager', value: 'collager' },
        ]},
        { name: 'sortOrder', type: 'number', label: 'Sortering' },
      ],
    }),
  ],

  storage: {
    adapter: 'filesystem',
    filesystem: { contentDir: 'content' },
  },
  build: { outDir: 'dist', baseUrl: '/' },
});
