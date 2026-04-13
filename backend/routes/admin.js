/**
 * routes/admin.js
 * ─────────────────────────────────────────────────────────────
 * REST API for the admin.html frontend.
 * In production, add authentication middleware before these routes.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
  getAllProducts, getActiveProducts, getSettings,
  updateSettings, addProduct, updateProduct, deleteProduct,
} = require('../services/products');
const { getSubmissions } = require('../services/store');

// ── CORS for local development (remove in production or restrict origin) ──
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Products ──────────────────────────────────────────────────

// GET all products
router.get('/products', (req, res) => {
  res.json({ products: getAllProducts() });
});

// GET active products only
router.get('/products/active', (req, res) => {
  res.json({ products: getActiveProducts() });
});

// POST add product
router.post('/products', (req, res) => {
  const { name, sku, category, keywords, rebate, status, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Product name is required' });
  const product = addProduct({
    id: uuidv4(),
    name, sku: sku || '', category: category || '',
    keywords: Array.isArray(keywords) ? keywords : [],
    rebate: parseFloat(rebate) || 0,
    status: status || 'active',
    notes: notes || '',
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ product });
});

// PUT update product
router.put('/products/:id', (req, res) => {
  const updated = updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: updated });
});

// DELETE product
router.delete('/products/:id', (req, res) => {
  const deleted = deleteProduct(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true });
});

// ── Settings ─────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  res.json({ settings: getSettings() });
});

router.put('/settings', (req, res) => {
  const updated = updateSettings(req.body);
  res.json({ settings: updated });
});

// ── Submissions ───────────────────────────────────────────────

router.get('/submissions', (req, res) => {
  const subs = getSubmissions();
  const stats = {
    total: subs.length,
    approved: subs.filter(s => s.approved).length,
    denied: subs.filter(s => !s.approved).length,
    totalRebates: subs
      .filter(s => s.approved && s.totalRebate)
      .reduce((sum, s) => sum + Number(s.totalRebate || 0), 0)
      .toFixed(2),
  };
  res.json({ submissions: subs, stats });
});

// POST a web-form submission (called by receipt-approval.html)
router.post('/submissions', (req, res) => {
  const { saveSubmission } = require('../services/store');
  saveSubmission({ ...req.body, source: req.body.source || 'web' });
  res.status(201).json({ success: true });
});

module.exports = router;
