require('dotenv').config();
const express = require('express');
const path = require('path');
const smsRoutes = require('./routes/sms');
const adminRoutes = require('./routes/admin');
const claimRoutes = require('./routes/claim');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Serve frontend HTML files ────────────────────────────────
// receipt-approval.html  →  https://your-server.com/
// admin.html             →  https://your-server.com/admin
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/receipt-approval.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../frontend/admin.html')));

// ── API Routes ───────────────────────────────────────────────
app.use('/sms', smsRoutes);         // Twilio webhook endpoint
app.use('/api/admin', adminRoutes); // REST API for admin.html and receipt-approval.html

app.use('/api/claim', claimRoutes);
app.get('/claim', (req, res) =>
  res.sendFile(path.join(__dirname, '../frontend/claim.html')));

// Health check
app.get('/privacy-policy', (req, res) =>
  res.sendFile(path.join(__dirname, '../frontend/privacy-policy.html')));

app.get('/terms-and-conditions', (req, res) =>
  res.sendFile(path.join(__dirname, '../frontend/terms-and-conditions.html')));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'ArmorFlo Perk Up' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🛡️  ArmorFlo Perk Up running on port ${PORT}`);
  console.log(`   Customer site: http://localhost:${PORT}/`);
  console.log(`   Admin portal:  http://localhost:${PORT}/admin`);
  console.log(`   SMS webhook:   POST http://localhost:${PORT}/sms/incoming\n`);
});
