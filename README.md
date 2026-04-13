# 🛡️ ArmorFlo Perk Up — Complete Project

> AI-powered receipt rebate program for ArmorFlo products.
> Customers can submit receipts via the **website** or by **texting a photo** to your Twilio number.
> The admin portal manages products, settings, and views all submissions from both channels in one place.

---

## What's Included

```
armorflo-perkup/
│
├── frontend/
│   ├── receipt-approval.html   ← Customer-facing web submission page
│   └── admin.html              ← Admin portal (products, submissions, settings)
│
└── backend/
    ├── server.js               ← Express server — serves frontend + handles all routes
    ├── package.json
    ├── .env.example            ← Copy to .env and fill in your credentials
    ├── routes/
    │   ├── sms.js              ← Twilio webhook — full SMS conversation flow
    │   └── admin.js            ← REST API consumed by both HTML pages
    ├── services/
    │   ├── analyzer.js         ← Downloads MMS image → Claude AI fuzzy analysis
    │   ├── mailer.js           ← Branded ArmorFlo HTML email confirmations
    │   ├── products.js         ← Product catalog + promotion settings store
    │   └── store.js            ← Session state + submission log
    └── middleware/
        └── validateTwilio.js   ← Optional Twilio request signature validation
```

---

## How It Works

### Channel 1 — Website

1. Customer visits your site and uploads a receipt photo
2. Claude AI scans the image for qualifying ArmorFlo products using fuzzy matching
3. Instant approved ✅ or denied ❌ result with rebate amount
4. Submission is logged in the admin dashboard

### Channel 2 — SMS (Text a Photo)

Put this on receipts, signage, and packaging:

> **"Text CADENCE to (336) 567-3552 to claim your rebate"**

```
Customer:  CADENCE
Bot:       Welcome to ArmorFlo Perk Up! What's your first name?

Customer:  Jane
Bot:       Nice to meet you, Jane! What's your email address?

Customer:  jane@example.com
Bot:       Perfect! Now send a photo of your receipt. 📸

Customer:  [sends MMS photo]
Bot:       Got it! Analyzing... (10-15 seconds)

Bot:       ✅ APPROVED — $10.00 rebate on ArmorFlo 5W-30 Full Synthetic
           Claim here: https://cadenceperkup.com/claim?id=abc123
           Confirmation email sent to jane@example.com
```

Both channels feed into the same admin dashboard.

---

## Quick Start (5 steps)

### Step 1 — Install dependencies

```bash
cd backend
npm install
```

### Step 2 — Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
# Twilio (twilio.com/console)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+13365673552

# Claude AI (console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx

# Email confirmations (any SMTP provider)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=rewards@cadencepetroleum.com
SMTP_PASS=your_gmail_app_password

# Reward claim link
REWARD_LINK_BASE=https://www.cadenceperkup.com/claim

PORT=3000
```

> **Gmail tip:** Use an App Password, not your regular password.
> Go to Google Account → Security → 2-Step Verification → App passwords.

### Step 3 — Start the server

```bash
npm start
```

You'll see:
```
🛡️  ArmorFlo Perk Up running on port 3000
   Customer site: http://localhost:3000/
   Admin portal:  http://localhost:3000/admin
   SMS webhook:   POST http://localhost:3000/sms/incoming
```

### Step 4 — Connect Twilio (for SMS)

Twilio needs a public URL to send messages to. During development, use [ngrok](https://ngrok.com):

```bash
# In a new terminal
ngrok http 3000
# → https://abc123.ngrok.io
```

Then in your Twilio Console:
1. Go to **Phone Numbers → Manage → Active Numbers**
2. Click your ArmorFlo number: **(336) 567-3552**
3. Under **Messaging → A message comes in**, set:
   - **Webhook:** `https://abc123.ngrok.io/sms/incoming`
   - **Method:** `POST`
4. Save

### Step 5 — Open the site

| URL | What it is |
|-----|-----------|
| `http://localhost:3000/` | Customer receipt submission page |
| `http://localhost:3000/admin` | Admin portal |

---

## Deploying to Production

Pick any of these — all work great with Node.js:

### Railway (easiest, ~5 min)
```bash
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
```
Set your env vars in the Railway dashboard under Variables.
Your live URL will be something like `https://armorflo-perkup.up.railway.app`

### Render
1. Push this repo to GitHub
2. Create a new **Web Service** on render.com
3. Set root directory to `backend/`
4. Add env vars in the Render dashboard
5. Update Twilio webhook to your Render URL

### Heroku
```bash
cd backend
heroku create armorflo-perkup
heroku config:set TWILIO_ACCOUNT_SID=... ANTHROPIC_API_KEY=... # etc
git push heroku main
```

### VPS (DigitalOcean, Linode, EC2)
```bash
npm install -g pm2
cd backend
pm2 start server.js --name perkup
pm2 save && pm2 startup
```

**After deploying:** Update your Twilio webhook URL to your live domain.

---

## Admin Portal Guide

Visit `/admin` to manage the program.

### Products tab
- Add, edit, activate/deactivate, or delete eligible products
- Each product has a **fuzzy keyword list** — the AI matches receipt text against these keywords
- Add every variation, abbreviation, and common OCR error (e.g. "ArmorFlo", "Armor Flo", "ARMORFLO", "5W-30", "5W30", "SW30")
- Set the **rebate amount** per product

### Submissions tab
- Unified view of both **web** and **SMS** submissions
- Shows customer name, email/phone, matched products, rebate amount, and approval status
- Stats cards show totals at a glance

### Settings tab
- **Promotion name** — shown to customers
- **Valid date range** — receipts outside this window are denied
- **Fuzzy match threshold** — strict / medium / loose
- **Context prompt** — extra context sent to the AI

---

## SMS Trigger Words

Customers can text any of these to start a submission:

`CADENCE` · `PERKUP` · `PERK UP` · `ARMORFLO` · `REWARDS` · `REBATE` · `START`

---

## Production Checklist

- [ ] Move to a real database (replace in-memory store in `services/store.js` and `services/products.js`)
- [ ] Enable Twilio signature validation — uncomment 2 lines in `routes/sms.js`
- [ ] Add authentication to `/admin` (basic auth or login page)
- [ ] Set `NODE_ENV=production`
- [ ] HTTPS required — use Render/Railway (automatic) or set up Certbot on a VPS
- [ ] Register your 10DLC SMS campaign with Twilio for A2P compliance (required for business texting in the US)
- [ ] Set up error monitoring (Sentry is free tier)
- [ ] Test MMS delivery end-to-end with a real receipt photo

---

## Architecture Overview

```
Customer (Web)          Customer (SMS)
      │                       │
      │  Upload receipt        │  Text CADENCE + photo
      ▼                       ▼
receipt-approval.html    Twilio → POST /sms/incoming
      │                       │
      │  POST /api/admin/      │
      │  submissions           │
      ▼                       ▼
      ┌─────────────────────────────┐
      │     Express Backend         │
      │  services/analyzer.js       │
      │  (Claude claude-sonnet-4-20250514 vision)    │
      └─────────────┬───────────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
    SMS reply back       Email confirmation
    (Twilio)             (Nodemailer/SMTP)
          │                   │
          └─────────┬─────────┘
                    ▼
            Admin Dashboard
            /admin (admin.html)
            GET /api/admin/submissions
```

---

## Support

- Twilio docs: [twilio.com/docs/sms](https://twilio.com/docs/sms)
- Claude API: [docs.anthropic.com](https://docs.anthropic.com)
- Program support: [cadenceperkup.com/support](https://cadenceperkup.com/support)
