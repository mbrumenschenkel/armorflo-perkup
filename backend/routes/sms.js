/**
 * routes/sms.js
 * ─────────────────────────────────────────────────────────────
 * Handles the full multi-step SMS conversation:
 *
 *  Step 0 — Customer texts CADENCE (or any trigger word)
 *           → Bot sends welcome + asks for first name
 *
 *  Step 1 — Customer replies with their name
 *           → Bot asks for email address
 *
 *  Step 2 — Customer replies with email
 *           → Bot confirms and asks them to send a photo of the receipt
 *
 *  Step 3 — Customer sends MMS with receipt image
 *           → AI analyzes → result texted back + email sent + logged
 *
 *  Anytime — HELP → instructions, STOP → opt-out (handled by Twilio)
 */

const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');

const { analyzeReceipt } = require('../services/analyzer');
const { sendConfirmation } = require('../services/mailer');
const { getActiveProducts, getSettings } = require('../services/products');
const { getSession, setSession, clearSession, saveSubmission } = require('../services/store');

const MessagingResponse = twilio.twiml.MessagingResponse;

// ── Twilio signature validation (production only) ──
// In dev, leaving this off makes local curl/Postman testing possible.
if (process.env.NODE_ENV === 'production') {
  const validateRequest = require('../middleware/validateTwilio');
  router.use(validateRequest);
}

// ── Per-phone rate limit on the webhook ──
router.use(require('../middleware/smsRateLimit'));

// ── Trigger keywords that start a new session ──
const TRIGGER_WORDS = ['cadence', 'perkup', 'perk up', 'armorflo', 'rewards', 'rebate', 'start'];

// ── Helpers ──
function twimlReply(res, message, mediaUrl = null) {
  const twiml = new MessagingResponse();
  const msg = twiml.message(message);
  if (mediaUrl) msg.media(mediaUrl);
  res.type('text/xml').send(twiml.toString());
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildClaimLink(submissionId) {
  const base = process.env.REWARD_LINK_BASE || 'https://www.cadenceperkup.com/claim';
  return `${base}?id=${submissionId}`;
}

// ── Main webhook handler ──
router.post('/incoming', async (req, res) => {
  const from = req.body.From;           // Customer's phone number e.g. "+19195551234"
  const body = (req.body.Body || '').trim();
  const bodyLower = body.toLowerCase();
  const numMedia = parseInt(req.body.NumMedia || '0', 10);
  const mediaUrl = numMedia > 0 ? req.body.MediaUrl0 : null;
  const mediaType = numMedia > 0 ? req.body.MediaContentType0 : null;

  console.log(`[sms] Incoming from ${from}: "${body}" | media: ${numMedia}`);

  // ── STOP / HELP shortcuts ──
  if (bodyLower === 'stop' || bodyLower === 'unstop') {
    clearSession(from);
    return twimlReply(res, 'You have been unsubscribed from ArmorFlo Perk Up messages. Text CADENCE to re-subscribe.');
  }
  if (bodyLower === 'help') {
    return twimlReply(res,
      'ArmorFlo Perk Up Rewards Help:\n' +
      '• Text CADENCE to start a new submission\n' +
      '• Text STOP to unsubscribe\n' +
      '• Visit cadenceperkup.com for support\n' +
      'Msg & data rates may apply.'
    );
  }

  const session = getSession(from);

  // ── Step 0: New session trigger ──
  if (!session || TRIGGER_WORDS.some(w => bodyLower === w || bodyLower.startsWith(w + ' '))) {
    clearSession(from);
    setSession(from, { step: 1 });
    return twimlReply(res,
      'Welcome to ArmorFlo Perk Up! 🛡️\n\n' +
      'Get cash back on qualifying ArmorFlo purchases. It only takes 60 seconds.\n\n' +
      'Msg freq varies (up to 6 msgs/submission). Msg & data rates may apply. Reply HELP for help, STOP to cancel.\n\n' +
      'What\'s your first name?'
    );
  }

  // ── No active session ──
  if (!session) {
    return twimlReply(res,
      'Text CADENCE to start your ArmorFlo Perk Up rebate submission. ' +
      'Text HELP for more info.'
    );
  }

  // ── Step 1: Collect name ──
  if (session.step === 1) {
    const name = body.split(' ')[0]; // just the first name
    if (name.length < 1 || name.length > 50) {
      return twimlReply(res, 'Please reply with your first name to continue.');
    }
    setSession(from, { step: 2, name });
    return twimlReply(res,
      `Nice to meet you, ${name}! 👋\n\nWhat's your email address? We'll send your rebate confirmation there.`
    );
  }

  // ── Step 2: Collect email ──
  if (session.step === 2) {
    const email = body.trim().toLowerCase();
    if (!isValidEmail(email)) {
      return twimlReply(res,
        'That doesn\'t look like a valid email address. Please try again.\n\n' +
        'Example: jane@example.com'
      );
    }
    setSession(from, { step: 3, email });
    return twimlReply(res,
      `Perfect! We'll send your confirmation to ${email}.\n\n` +
      '📸 Now, take a clear photo of your ArmorFlo purchase receipt and send it as a picture message to this number.\n\n' +
      'Make sure the product names and totals are visible.'
    );
  }

  // ── Step 3: Waiting for receipt image ──
  if (session.step === 3) {
    // Customer sent text instead of image
    if (!mediaUrl) {
      return twimlReply(res,
        'We\'re waiting for a photo of your receipt! 📸\n\n' +
        'Please send your receipt as a picture message (MMS). ' +
        'Make sure product names are clearly visible.\n\n' +
        'Need to start over? Text CADENCE.'
      );
    }

    // Validate it's an image
    if (mediaType && !mediaType.startsWith('image/')) {
      return twimlReply(res,
        'Please send an image file (JPG or PNG) of your receipt, not a PDF or other file type.'
      );
    }

    // Acknowledge receipt immediately — AI takes a few seconds
    twimlReply(res,
      `Got it, ${session.name}! 🔍 Analyzing your receipt now...\n\n` +
      'This usually takes 10-15 seconds. We\'ll text you the result right away.'
    );

    // Process asynchronously so we don't hold up the TwiML response
    setImmediate(async () => {
      try {
        let products, settings;
        try {
          products = getActiveProducts();
          settings = getSettings();
        } catch (cfgErr) {
          console.error('[sms] Failed to load products/settings:', cfgErr.message);
          throw new Error('Configuration unavailable');
        }
        const result = await analyzeReceipt(mediaUrl, products, settings);

        const submissionId = uuidv4();
        const claimLink = buildClaimLink(submissionId);

        // Save to submission log
        saveSubmission({
          id: submissionId,
          phone: from,
          name: session.name,
          email: session.email,
          approved: result.approved,
          matches: (result.matches || []).map(m => m.matched_product),
          totalRebate: result.total_rebate,
          analysis: result.analysis,
          confidence: result.overall_confidence,
          claimLink,
        });

        // ── Send result SMS ──
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

        if (result.approved) {
          const matchSummary = (result.matches || [])
            .map(m => `• ${m.matched_product} — $${Number(m.rebate_amount || 0).toFixed(2)}`)
            .join('\n');

          await twilioClient.messages.create({
            from: process.env.TWILIO_PHONE_NUMBER,
            to: from,
            body:
              `✅ APPROVED — ArmorFlo Perk Up\n\n` +
              `${result.analysis}\n\n` +
              `Qualifying products:\n${matchSummary}\n\n` +
              `💰 Total rebate: $${Number(result.total_rebate || 0).toFixed(2)}\n\n` +
              `Claim your reward:\n${claimLink}\n\n` +
              `A confirmation email is on its way to ${session.email}. ` +
              `Allow 6-8 weeks for your prepaid card.\n\n` +
              `Every Motor. Every Mile. 🛡️`
          });
        } else {
          await twilioClient.messages.create({
            from: process.env.TWILIO_PHONE_NUMBER,
            to: from,
            body:
              `❌ NOT APPROVED — ArmorFlo Perk Up\n\n` +
              `${result.analysis}\n\n` +
              `${result.denial_reason ? 'Reason: ' + result.denial_reason + '\n\n' : ''}` +
              `If you believe this is an error, visit cadenceperkup.com/support or text HELP.\n\n` +
              `Want to try a different receipt? Text CADENCE to start over.`
          });
        }

        // ── Send confirmation email ──
        if (session.email) {
          try {
            await sendConfirmation({
              to: session.email,
              name: session.name,
              approved: result.approved,
              matches: result.matches || [],
              totalRebate: result.total_rebate || 0,
              denialReason: result.denial_reason,
              claimLink,
            });
          } catch (emailErr) {
            console.error('[mailer] Email failed:', emailErr.message);
          }
        }

        // Clear session after successful submission
        clearSession(from);
        console.log(`[sms] Submission complete — ${from} → ${result.approved ? 'APPROVED' : 'DENIED'} ($${result.total_rebate || 0})`);

      } catch (err) {
        console.error('[sms] Analysis error:', err.message);
        // Notify the customer something went wrong
        try {
          const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await twilioClient.messages.create({
            from: process.env.TWILIO_PHONE_NUMBER,
            to: from,
            body:
              'Sorry, we had trouble reading your receipt. Please make sure it\'s a clear, well-lit photo and try again.\n\n' +
              'Text CADENCE to start a new submission, or visit cadenceperkup.com for help.'
          });
        } catch (smsErr) {
          console.error('[sms] Failed to send error SMS:', smsErr.message);
        }
        clearSession(from);
      }
    });

    return; // TwiML already sent above
  }

  // ── Fallback ──
  return twimlReply(res,
    'Text CADENCE to start your ArmorFlo Perk Up rebate submission, or text HELP for assistance.'
  );
});

module.exports = router;
