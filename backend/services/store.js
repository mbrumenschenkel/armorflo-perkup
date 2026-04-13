/**
 * store.js
 * ─────────────────────────────────────────────────────────────
 * In-memory submission log and session state.
 * Replace with a real DB in production.
 *
 * Sessions track multi-step SMS conversations:
 *   1. Customer texts CADENCE (or any keyword)
 *   2. Bot asks for their name
 *   3. Bot asks for their email
 *   4. Bot tells them to send a photo
 *   5. Customer sends MMS with receipt image
 *   6. AI analyzes → result texted back
 */

const sessions = new Map();   // phone → session object
const submissions = [];       // all completed submissions

const SESSION_TTL_MS = 30 * 60 * 1000; // 30-minute session timeout

function getSession(phone) {
  const s = sessions.get(phone);
  if (!s) return null;
  // Expire old sessions
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
  Object.keys(_sessions).forEach(phone => {
    if (now - _sessions[phone].updatedAt > SESSION_TTL_MS) {
      delete _sessions[phone];
    }
  });
  return Object.keys(_sessions).length;
}

function saveSubmission(submission) {
  submissions.push({ ...submission, id: Date.now().toString(), createdAt: new Date().toISOString() });
}

function getSubmissions() {
  return submissions.slice().reverse();
}

function getSubmissionById(id) {
  return _submissions.find(s => s.id === id) || null;
}

function clearSubmissions() {
  _submissions = [];
}

function getSubmissionStats() {
  const total = _submissions.length;
  const approved = _submissions.filter(s => s.approved).length;
  const denied = total - approved;
  const totalRebates = _submissions
    .filter(s => s.approved && s.totalRebate)
    .reduce((sum, s) => sum + Number(s.totalRebate || 0), 0)
    .toFixed(2);
  return { total, approved, denied, totalRebates };
}

function getSubmissionById(id) {
  return _submissions.find(s => s.id === id) || null;
}

function markClaimed(id, claimData) {
  const sub = _submissions.find(s => s.id === id);
  if (!sub) return null;
  sub.claimed = true;
  sub.claimedAt = new Date().toISOString();
  sub.claimName = claimData.name;
  sub.claimAddress = claimData.address;
  return sub;
}

function markClaimed(id, claimData) {
  const sub = _submissions.find(s => s.id === id);
  if (!sub) return null;
  sub.claimed = true;
  sub.claimedAt = new Date().toISOString();
  sub.claimName = claimData.name;
  sub.claimAddress = claimData.address;
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
  markClaimed,
  getSubmissionStats,
};
