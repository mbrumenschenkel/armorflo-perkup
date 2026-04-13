/**
 * middleware/validateTwilio.js
 * ─────────────────────────────────────────────────────────────
 * Validates that incoming requests actually come from Twilio
 * by checking the X-Twilio-Signature header.
 *
 * RECOMMENDED in production to prevent spoofed requests.
 *
 * Usage in routes/sms.js:
 *   const validateRequest = require('../middleware/validateTwilio');
 *   router.use(validateRequest);
 */

const twilio = require('twilio');

module.exports = function validateTwilio(req, res, next) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioSignature = req.headers['x-twilio-signature'];

  // Build the full URL Twilio will use to validate
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const fullUrl = `${protocol}://${host}${req.originalUrl}`;

  const valid = twilio.validateRequest(authToken, twilioSignature, fullUrl, req.body);

  if (!valid) {
    console.warn(`[security] Invalid Twilio signature from ${req.ip}`);
    return res.status(403).send('Forbidden: Invalid Twilio signature');
  }

  next();
};
