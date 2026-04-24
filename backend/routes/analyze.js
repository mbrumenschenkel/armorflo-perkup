/**
 * routes/analyze.js
 * ─────────────────────────────────────────────────────────────
 * Server-side receipt analysis for the web form.
 * Keeps the Anthropic API key on the server instead of the browser.
 *
 *   POST /api/analyze
 *   body: { imageBase64, imageMediaType, fname, lname, email, phone, purchaseDate }
 *   ->   { submissionId, result }
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { analyzeImage } = require('../services/analyzer');
const { getActiveProducts, getSettings } = require('../services/products');
const { saveSubmission } = require('../services/store');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BASE64_SIZE = 8 * 1024 * 1024; // ~6 MB raw image
const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
]);

// IP-based sliding-window rate limit (5 per 60 s).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const buckets = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
  const now = Date.now();
  const times = (buckets.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }
  times.push(now);
  buckets.set(ip, times);
  next();
}

router.post('/', rateLimit, async (req, res) => {
  const body = req.body || {};
  const { imageBase64, imageMediaType, fname, lname, email, phone, purchaseDate } = body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'Receipt image is required.' });
  }
  if (imageBase64.length > MAX_BASE64_SIZE) {
    return res.status(413).json({ error: 'Image is too large. Please upload under 6 MB.' });
  }
  const mediaType = typeof imageMediaType === 'string' && ALLOWED_MEDIA_TYPES.has(imageMediaType)
    ? imageMediaType
    : 'image/jpeg';

  if (!fname || typeof fname !== 'string' || fname.length > 100) {
    return res.status(400).json({ error: 'First name is required.' });
  }
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  let products, settings;
  try {
    products = getActiveProducts();
    settings = getSettings();
  } catch (err) {
    console.error('[analyze] Failed to load products/settings:', err.message);
    return res.status(500).json({ error: 'Server configuration error.' });
  }
  if (!products.length) {
    return res.status(503).json({ error: 'No active eligible products configured.' });
  }

  let result;
  try {
    result = await analyzeImage(imageBase64, mediaType, products, settings);
  } catch (err) {
    const upstreamStatus = err.status || err.statusCode;
    console.error('[analyze] Analysis failed:', upstreamStatus || '', err.message);

    // Map known upstream failures to actionable public messages.
    const msg = String(err.message || '');
    let publicMsg;
    if (/credit[_ ]?balance|billing|insufficient[_ ]?(funds|credit)|purchase[_ ]?credits/i.test(msg)) {
      publicMsg = 'Analyzer billing issue. Admin: add credits at console.anthropic.com/settings/billing.';
    } else if (upstreamStatus === 401 || /unauthorized|api[_-]?key/i.test(msg)) {
      publicMsg = 'Receipt analyzer is not configured (ANTHROPIC_API_KEY missing or invalid).';
    } else if (upstreamStatus === 404 || /not[_ ]found|model/i.test(msg)) {
      publicMsg = 'Receipt analyzer model is unavailable. Check CLAUDE_MODEL env var.';
    } else if (upstreamStatus === 429 || /rate[_ ]?limit/i.test(msg)) {
      publicMsg = 'Analyzer is busy. Please try again in a minute.';
    } else if (upstreamStatus === 400 || /invalid[_ ]request/i.test(msg)) {
      publicMsg = 'Analyzer rejected the image — try a different format or smaller size.';
    } else {
      publicMsg = 'Could not analyze receipt. See detail below.';
    }

    return res.status(502).json({
      error: publicMsg,
      detail: msg,
      upstreamStatus: upstreamStatus || null,
    });
  }

  const submissionId = uuidv4();
  try {
    saveSubmission({
      id: submissionId,
      source: 'web',
      name: fname + (lname && typeof lname === 'string' ? ' ' + lname : ''),
      email,
      phone: typeof phone === 'string' ? phone : null,
      purchaseDate: typeof purchaseDate === 'string' ? purchaseDate : null,
      approved: !!result.approved,
      totalRebate: Number(result.total_rebate || 0),
      matches: (result.matches || []).map(m => m.matched_product),
      analysis: result.analysis,
      confidence: result.overall_confidence,
    });
  } catch (err) {
    // Analysis already succeeded — log but don't fail the request.
    console.error('[analyze] Failed to save submission:', err.message);
  }

  res.json({ submissionId, result });
});

module.exports = router;
