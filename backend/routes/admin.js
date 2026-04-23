/**
 * routes/admin.js
 * ─────────────────────────────────────────────────────────────
 * REST API for the admin.html frontend.
 * Auth is applied in server.js via the requireAdmin middleware.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
  getAllProducts, getActiveProducts, getSettings,
  updateSettings, addProduct, updateProduct, deleteProduct,
} = require('../services/products');
const { getSubmissions, saveSubmission } = require('../services/store');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Products ──────────────────────────────────────────────────

router.get('/products', (req, res) => {
  res.json({ products: getAllProducts() });
});

router.get('/products/active', (req, res) => {
  res.json({ products: getActiveProducts() });
});

router.post('/products', (req, res) => {
  const { name, sku, category, keywords, rebate, status, notes } = req.body || {};
  if (!name || typeof name !== 'string' || name.length > 200) {
    return res.status(400).json({ error: 'Valid product name is required' });
  }
  const rebateNum = parseFloat(rebate);
  if (rebate !== undefined && rebate !== '' &&
      (!Number.isFinite(rebateNum) || rebateNum < 0 || rebateNum > 10000)) {
    return res.status(400).json({ error: 'Rebate must be a number between 0 and 10000' });
  }
  const product = addProduct({
    id: uuidv4(),
    name,
    sku: typeof sku === 'string' ? sku : '',
    category: typeof category === 'string' ? category : '',
    keywords: Array.isArray(keywords) ? keywords.filter(k => typeof k === 'string') : [],
    rebate: Number.isFinite(rebateNum) ? rebateNum : 0,
    status: status === 'inactive' ? 'inactive' : 'active',
    notes: typeof notes === 'string' ? notes : '',
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ product });
});

router.put('/products/:id', (req, res) => {
  const updated = updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: updated });
});

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
  const updated = updateSettings(req.body || {});
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

router.post('/submissions', (req, res) => {
  const body = req.body || {};
  const { email, name, approved, totalRebate } = body;

  if (!name || typeof name !== 'string' || name.length > 100) {
    return res.status(400).json({ error: 'Valid name is required' });
  }
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (typeof approved !== 'boolean') {
    return res.status(400).json({ error: 'approved (boolean) is required' });
  }

  const rebateNum = Number(totalRebate);
  if (totalRebate !== undefined && totalRebate !== null && totalRebate !== '' &&
      (!Number.isFinite(rebateNum) || rebateNum < 0 || rebateNum > 10000)) {
    return res.status(400).json({ error: 'totalRebate must be a number between 0 and 10000' });
  }

  const id = saveSubmission({
    ...body,
    totalRebate: Number.isFinite(rebateNum) ? rebateNum : 0,
    source: body.source === 'sms' ? 'sms' : 'web',
  });
  res.status(201).json({ success: true, id });
});

module.exports = router;
