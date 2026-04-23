/**
 * middleware/requireAdmin.js
 * ─────────────────────────────────────────────────────────────
 * Bearer-token auth for /api/admin routes.
 *
 * Accepts either:
 *   Authorization: Bearer <ADMIN_API_KEY>
 *   X-Admin-Token: <ADMIN_API_KEY>
 *
 * If ADMIN_API_KEY is unset, requests pass through and a warning
 * is logged once — keeps existing dev setups working but makes it
 * loud that production must set the key.
 */

let warned = false;

module.exports = function requireAdmin(req, res, next) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) {
    if (!warned) {
      console.warn('[security] ADMIN_API_KEY is not set — /api/admin routes are unauthenticated.');
      warned = true;
    }
    return next();
  }

  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const provided = bearer || req.headers['x-admin-token'];

  if (!provided || provided !== key) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
