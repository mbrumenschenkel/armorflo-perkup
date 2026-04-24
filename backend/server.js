// dotenv is optional — Railway injects env vars directly.
try { require('dotenv').config(); } catch (_) { /* no-op in production */ }
const express = require('express');
const path = require('path');
const fs = require('fs');
const smsRoutes = require('./routes/sms');
const adminRoutes = require('./routes/admin');
const claimRoutes = require('./routes/claim');
const analyzeRoutes = require('./routes/analyze');
const requireAdmin = require('./middleware/requireAdmin');

const app = express();
// Raised limit accommodates base64-encoded receipt images (~6 MB raw -> ~8 MB base64).
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// ── CORS (API endpoints only) ────────────────────────────────
// Only requests whose Origin is in ALLOWED_ORIGINS get CORS
// headers. Same-origin calls (like admin.html → /api/admin)
// don't need CORS at all and are unaffected.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();

  const origin = req.headers.origin;
  const allowed = origin && allowedOrigins.includes(origin);
  if (allowed) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Admin-Token');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(allowed ? 204 : 403);
  }
  next();
});

// ── Serve frontend HTML files ────────────────────────────────
// Works in two layouts:
//   backend/frontend/  (Railway deploy)
//   ../frontend/       (local dev, sibling folders)
const frontendPath = fs.existsSync(path.join(__dirname, 'frontend'))
  ? path.join(__dirname, 'frontend')
  : path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'receipt-approval.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(frontendPath, 'admin.html')));
app.get('/privacy-policy', (req, res) => res.sendFile(path.join(frontendPath, 'privacy-policy.html')));
app.get('/terms-and-conditions', (req, res) => res.sendFile(path.join(frontendPath, 'terms-and-conditions.html')));
app.get('/support', (req, res) => res.sendFile(path.join(frontendPath, 'support.html')));

// Claim portal — served gracefully if claim.html is missing.
app.get('/claim', (req, res) => {
  res.sendFile(path.join(frontendPath, 'claim.html'), err => {
    if (err) {
      res.status(503).send(
        'Claim portal is temporarily unavailable. ' +
        'Please contact support at rewards@cadencepetroleum.com.'
      );
    }
  });
});

// ── API Routes ───────────────────────────────────────────────
app.use('/sms', smsRoutes);                       // Twilio webhook
app.use('/api/admin', requireAdmin, adminRoutes); // admin.html REST API
app.use('/api/claim', claimRoutes);               // customer-facing claim flow
app.use('/api/analyze', analyzeRoutes);           // web form receipt analysis

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'ArmorFlo Perk Up' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🛡️  ArmorFlo Perk Up running on port ${PORT}`);
  console.log(`   Customer site: http://localhost:${PORT}/`);
  console.log(`   Admin portal:  http://localhost:${PORT}/admin`);
  console.log(`   SMS webhook:   POST http://localhost:${PORT}/sms/incoming`);
  if (!process.env.ADMIN_API_KEY) {
    console.warn('   ⚠️  ADMIN_API_KEY not set — admin API is unauthenticated.');
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn('   ⚠️  NODE_ENV != production — Twilio signature validation is OFF.');
  }
  console.log('');
});
