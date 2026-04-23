/**
 * store.js
 * ─────────────────────────────────────────────────────────────
 * In-memory submission log and session state.
 * Replace with a real DB in production — data is lost on restart.
 */

const { v4: uuidv4 } = require('uuid');

const sessions = new Map();   // phone → session object
const submissions = [];       // all completed submissions

const SESSION_TTL_MS = 30 * 60 * 1000; // 30-minute session timeout

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

function saveSubmission(submission) {
  const id = submission.id || uuidv4();
  submissions.push({
    ...submission,
    id,
    createdAt: submission.createdAt || new Date().toISOString(),
  });
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
