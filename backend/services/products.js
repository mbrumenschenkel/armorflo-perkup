/**
 * products.js
 * ─────────────────────────────────────────────────────────────
 * In-memory product catalog and promotion settings.
 * In production, replace with a real database (Postgres, DynamoDB, etc.)
 * The admin.html frontend can call the /api/admin routes to read/write these.
 */

let products = [
  {
    id: 'af-5w30-fs',
    name: 'ArmorFlo 5W-30 Full Synthetic',
    sku: 'AF-5W30-FS-QT',
    category: 'Full Synthetic',
    keywords: ['ArmorFlo', 'Armor Flo', 'ARMORFLO', '5W-30', '5W30', 'full synthetic', 'AF-5W30', 'armorflo 5w30'],
    rebate: 10.00,
    status: 'active',
  },
  {
    id: 'af-5w30-sb',
    name: 'ArmorFlo 5W-30 Synthetic Blend',
    sku: 'AF-5W30-SB-QT',
    category: 'Synthetic Blend',
    keywords: ['ArmorFlo', '5W-30', '5W30', 'synthetic blend', 'AF-5W30-SB'],
    rebate: 8.00,
    status: 'active',
  },
  {
    id: 'af-5w20-fs',
    name: 'ArmorFlo 5W-20 Full Synthetic',
    sku: 'AF-5W20-FS-QT',
    category: 'Full Synthetic',
    keywords: ['ArmorFlo', '5W-20', '5W20', 'full synthetic', 'AF-5W20'],
    rebate: 10.00,
    status: 'active',
  },
  {
    id: 'af-0w20-sb',
    name: 'ArmorFlo 0W-20 Synthetic Blend',
    sku: 'AF-0W20-SB-QT',
    category: 'Synthetic Blend',
    keywords: ['ArmorFlo', '0W-20', '0W20', 'synthetic blend'],
    rebate: 8.00,
    status: 'active',
  },
  {
    id: 'af-10w40-sb',
    name: 'ArmorFlo 10W-40 Synthetic Blend',
    sku: 'AF-10W40-SB-QT',
    category: 'Synthetic Blend',
    keywords: ['ArmorFlo', '10W-40', '10W40', 'synthetic blend'],
    rebate: 8.00,
    status: 'active',
  },
];

let settings = {
  promoName: 'ArmorFlo Perk Up',
  dateStart: '02/19/2024',
  dateEnd: '04/19/2026',
  fuzzyThreshold: 'medium', // strict | medium | loose
  requireDate: true,
  contextPrompt: `This is the ArmorFlo Perk Up rebate program for ArmorFlo motor oil and lubricant products purchased at participating automotive service providers. ArmorFlo is the house brand of Cadence Petroleum Group.`,
};

module.exports = {
  getActiveProducts: () => products.filter(p => p.status === 'active'),
  getAllProducts: () => products,
  getSettings: () => settings,
  updateSettings: (patch) => { settings = { ...settings, ...patch }; return settings; },
  addProduct: (p) => { products.push(p); return p; },
  updateProduct: (id, patch) => {
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...patch };
    return products[idx];
  },
  deleteProduct: (id) => {
    const before = products.length;
    products = products.filter(p => p.id !== id);
    return products.length < before;
  },
};
