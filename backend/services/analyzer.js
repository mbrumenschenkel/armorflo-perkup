/**
 * analyzer.js
 * ─────────────────────────────────────────────────────────────
 * Downloads the MMS image from Twilio and sends it to Claude
 * for fuzzy product matching and rebate determination.
 */

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FUZZY_RULES = {
  strict: 'STRICT matching: accept only exact product names or very near-identical text (e.g. "5W-30" = "5W30" is OK).',
  medium: 'MEDIUM fuzzy matching: accept minor typos, abbreviations, partial names, OCR artifacts, spacing/punctuation differences, and mixed case. "ArmorFlo" matches "Armor Flo", "ARMORFLO", "Armorflo"; "5W-30" matches "5W30", "SW30".',
  loose: 'LOOSE fuzzy matching: accept any plausible abbreviation, shorthand, or partial name that clearly refers to the product.',
};

/**
 * Download image from Twilio MMS URL and convert to base64.
 * Twilio requires HTTP Basic Auth using account SID + auth token.
 */
async function downloadImage(mediaUrl) {
  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    auth: {
      username: process.env.TWILIO_ACCOUNT_SID,
      password: process.env.TWILIO_AUTH_TOKEN,
    },
  });
  const base64 = Buffer.from(response.data).toString('base64');
  const contentType = response.headers['content-type'] || 'image/jpeg';
  return { base64, contentType };
}

/**
 * Build the AI prompt with the full eligible products catalog.
 */
function buildPrompt(products, settings) {
  const fuzzyRule = FUZZY_RULES[settings.fuzzyThreshold] || FUZZY_RULES.medium;
  const productList = products.map((p, i) =>
    `${i + 1}. "${p.name}" | SKU: ${p.sku || 'N/A'} | Category: ${p.category || 'N/A'} | Rebate: $${Number(p.rebate || 0).toFixed(2)}\n   Fuzzy keywords: ${(p.keywords || []).join(' | ')}`
  ).join('\n\n');

  return `You are an automated receipt verification AI for the "${settings.promoName}" rebate program.

PROGRAM CONTEXT: ${settings.contextPrompt}
Valid purchase window: ${settings.dateStart} through ${settings.dateEnd}.

FUZZY MATCHING RULE: ${fuzzyRule}
Always account for: OCR errors, partial text, ALL-CAPS formatting, truncated names, receipt shorthand. If the receipt text strongly implies a product is present, count it as a fuzzy match.

ELIGIBLE PRODUCTS CATALOG:
${productList}

TASK:
1. Read all visible text on the receipt image carefully.
2. For every line item on the receipt, check if it matches any eligible product using the fuzzy matching rule above.
3. For each match, record: the exact text seen on the receipt, which product it matches, whether it was exact or fuzzy, and your confidence.
4. Sum rebate amounts for all matched products.
5. Decide APPROVED (at least one qualifying match found) or DENIED.

Respond ONLY with valid JSON — no markdown, no preamble, nothing else:
{
  "approved": true,
  "receipt_summary": "brief description of what the receipt shows",
  "matches": [
    {
      "receipt_text": "exact text seen on receipt",
      "matched_product": "catalog product name",
      "match_type": "exact or fuzzy",
      "match_confidence": "high, medium, or low",
      "rebate_amount": 10.00
    }
  ],
  "unmatched_items": ["other non-qualifying items found"],
  "total_rebate": 10.00,
  "analysis": "1-2 sentence plain-English explanation for the customer",
  "denial_reason": null,
  "overall_confidence": "high, medium, or low"
}`;
}

/**
 * Main entry point: download image → analyze with Claude → return structured result.
 */
async function analyzeReceipt(mediaUrl, products, settings) {
  const { base64, contentType } = await downloadImage(mediaUrl);
  const prompt = buildPrompt(products, settings);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: contentType, data: base64 },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const raw = response.content.find(b => b.type === 'text')?.text || '';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[analyzer] Failed to parse Claude response (first 500 chars):', cleaned.slice(0, 500));
    throw new Error('Analyzer returned invalid JSON: ' + err.message);
  }
}

module.exports = { analyzeReceipt };
