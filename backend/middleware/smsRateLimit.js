/**
 * middleware/smsRateLimit.js
 * ─────────────────────────────────────────────────────────────
 * Sliding-window rate limit keyed by the Twilio From phone number.
 * Guards the expensive Claude analysis path from runaway costs and
 * abusive senders. In-memory — state is per-process.
 *
 * Defaults: 8 requests per rolling 60 s per phone number.
 */

const twilio = require('twilio');

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

const buckets = new Map(); // phone → timestamps[]

function sweep(now) {
  for (const [phone, times] of buckets) {
    const kept = times.filter(t => now - t < WINDOW_MS);
    if (kept.length === 0) buckets.delete(phone);
    else buckets.set(phone, kept);
  }
}

module.exports = function smsRateLimit(req, res, next) {
  const from = req.body && req.body.From;
  if (!from) return next();

  const now = Date.now();
  if (buckets.size > 5000) sweep(now);

  const times = (buckets.get(from) || []).filter(t => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    console.warn(`[sms] Rate limit exceeded for ${from} (${times.length} hits in 60s)`);
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message('Too many messages right now. Please wait a minute and try again.');
    return res.type('text/xml').status(429).send(twiml.toString());
  }
  times.push(now);
  buckets.set(from, times);
  next();
};
