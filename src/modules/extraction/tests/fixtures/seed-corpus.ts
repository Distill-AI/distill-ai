import type { ExtractionV1 } from '../../schemas/extraction-v1.schema';

export interface SeedCorpusEntry {
  id: string;
  sourceText: string;
  expected: ExtractionV1;
}

export const SEED_CORPUS: SeedCorpusEntry[] = [
  {
    id: 'acme-bolts-rfq',
    sourceText: `From: john@acme.com
Company: Acme Industrial
Contact: John Smith
Need delivery by 2026-07-15

Please quote:
- 100x M5 bolts
- 50x widget-A
- 20x rubber gasket`,
    expected: {
      company: 'Acme Industrial',
      contact: 'John Smith',
      sender_address: null,
      sender_email: 'john@acme.com',
      delivery_date: '2026-07-15',
      line_items: [
        { position: 1, raw_text: 'M5 bolts', quantity: 100, unit: 'pcs' },
        { position: 2, raw_text: 'widget-A', quantity: 50, unit: 'pcs' },
        { position: 3, raw_text: 'rubber gasket', quantity: 20, unit: 'pcs' },
      ],
    },
  },
  {
    id: 'partsco-skus',
    sourceText: `Company: PartsCo
Contact: Jane Doe
RFQ for SKU-1234, SKU-5678, qty 50 each
2 line items total`,
    expected: {
      company: 'PartsCo',
      contact: 'Jane Doe',
      sender_address: null,
      sender_email: null,
      delivery_date: null,
      line_items: [
        { position: 1, raw_text: 'SKU-1234', quantity: 50, unit: 'pcs' },
        { position: 2, raw_text: 'SKU-5678', quantity: 50, unit: 'pcs' },
      ],
    },
  },
  {
    id: 'stated-total-qty',
    sourceText: `Company: BuildRight
Contact: Sam Lee
Items:
1. Steel plate 10 pcs
2. Anchor bolts 5 pcs
Total quantity: 15 units`,
    expected: {
      company: 'BuildRight',
      contact: 'Sam Lee',
      sender_address: null,
      sender_email: null,
      delivery_date: null,
      line_items: [
        { position: 1, raw_text: 'Steel plate', quantity: 10, unit: 'pcs' },
        { position: 2, raw_text: 'Anchor bolts', quantity: 5, unit: 'pcs' },
      ],
    },
  },
  {
    id: 'sparse-contact',
    sourceText: `Subject: Urgent parts request
We need 25 hydraulic hoses (1/2 inch) ASAP.
Company name not on letterhead.`,
    expected: {
      company: null,
      contact: null,
      sender_address: null,
      sender_email: null,
      delivery_date: null,
      line_items: [
        { position: 1, raw_text: 'hydraulic hoses (1/2 inch)', quantity: 25, unit: 'pcs' },
      ],
    },
  },
];
