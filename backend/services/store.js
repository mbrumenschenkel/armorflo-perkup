/**
 * store.js
 * ─────────────────────────────────────────────────────────────
 * Submission log + session state.
 *
 * Submissions persist to JSON on disk. On Railway, mount a volume
 * at /data (or set DATA_DIR) so submissions survive redeploys.
 * If no writable directory is found, falls back to in-memory only
 * and logs a warning.
 *
 * Sessions are in-memory only — they expire after 30 minutes anyway.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ── Data directory resolution ────────────────────────────────
function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    '/data',
    path.join(__dirname, '..', 'data'),
  ].filter(Boolean);

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const test = path.join(dir, '.write-test');
      fs.writeFileSync(test, '');
      fs.unlinkSync(test);
      console.log(`[store] Using data directory: ${dir}`);
      return dir;
    } catch (_) { /* try next */ }
  }
  console.warn('[store] No writable data directory — submissions will be in-memory only.');
  return null;
}

const DATA_DIR = resolveDataDir();
const SUBMISSIONS_FILE = DATA_DIR ? path.join(DATA_DIR, 'submissions.json') : null;

// ── State ───────────────────────────────────────────────────
const sessions = new Map();
const submissions = [];

const SESSION_TTL_MS = 30 * 60 * 1000;

// ── Load persisted submissions on startup ───────────────────
if (SUBMISSIONS_FILE && fs.existsSync(SUBMISSIONS_FILE)) {
  try {
    const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
    const loaded = JSON.parse(raw);
    if (Array.isArray(loaded)) {
      submissions.push(...loaded);
      console.log(`[store] Loaded ${loaded.length} submission(s) from disk.`);
    }
  } catch (err) {
    console.error('[store] Failed to load submissions from disk:', err.message);
  }
}

function persist() {
  if (!SUBMISSIONS_FILE) return;
  try {
    const tmp = SUBMISSIONS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(submissions, null, 2));
    fs.renameSync(tmp, SUBMISSIONS_FILE);
  } catch (err) {
    console.error('[store] Failed to persist submissions:', err.message);
  }
}

// ── Sessions ────────────────────────────────────────────────
function getSession(phone) {
  const s = sessions.get(phone);
  if (!s) return null;
  if (Date.now() - s.updatedAt > SESSION_TTL_MS) {
    sessions.delete(phone);
    return null;
  }
  return s;
}

function setSession(phone, data) {
  const existing = sessions.get(phone) || {};
  sessions.set(phone, { ...existing, ...data, phone, updatedAt: Date.now() });
}

function clearSession(phone) {
  sessions.delete(phone);
}

function getActiveSessions() {
  const now = Date.now();
  for (const [phone, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL_MS) sessions.delete(phone);
  }
  return sessions.size;
}

// ── Submissions ─────────────────────────────────────────────
function saveSubmission(submission) {
  const id = submission.id || uuidv4();
  submissions.push({
    ...submission,
    id,
    createdAt: submission.createdAt || new Date().toISOString(),
  });
  persist();
  return id;
}

function getSubmissions() {
  return submissions.slice().reverse();
}

function getSubmissionById(id) {
  return submissions.find(s => s.id === id) || null;
}

function clearSubmissions() {
  submissions.length = 0;
  persist();
}

function getSubmissionStats() {
  const total = submissions.length;
  const approved = submissions.filter(s => s.approved).length;
  const denied = total - approved;
  const totalRebates = submissions
    .filter(s => s.approved && s.totalRebate)
    .reduce((sum, s) => sum + Number(s.totalRebate || 0), 0)
    .toFixed(2);
  return { total, approved, denied, totalRebates };
}

function markClaimed(id, claimData) {
  const sub = submissions.find(s => s.id === id);
  if (!sub) return null;
  sub.claimed = true;
  sub.claimedAt = new Date().toISOString();
  sub.claimName = claimData.name;
  sub.claimAddress = claimData.address;
  persist();
  return sub;
}

module.exports = {
  getSession,
  setSession,
  clearSession,
  getActiveSessions,
  saveSubmission,
  getSubmissions,
  clearSubmissions,
  getSubmissionById,
  getSubmissionStats,
  markClaimed,
};
