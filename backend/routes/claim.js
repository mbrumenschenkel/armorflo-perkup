const express = require('express');
const router  = express.Router();
const { getSubmissionById, markClaimed } = require('../services/store');

router.get('/:id', (req, res) => {
  const sub = getSubmissionById(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  if (!sub.approved) return res.status(400).json({ error: 'This submission was not approved.' });
  res.json({
    submission: {
      id:          sub.id,
      name:        sub.name,
      approved:    sub.approved,
      totalRebate: sub.totalRebate,
      matches:     sub.matches,
      claimed:     sub.claimed || false,
      claimedAt:   sub.claimedAt || null,
    },
  });
});

router.post('/:id', (req, res) => {
  const sub = getSubmissionById(req.params.id);
  if (!sub)          return res.status(404).json({ error: 'Submission not found.' });
  if (!sub.approved) return res.status(400).json({ error: 'This submission was not approved.' });
  if (sub.claimed)   return res.status(409).json({ error: 'This reward has already been claimed.' });

  const { name, address } = req.body || {};
  if (!name || typeof name !== 'string' || name.length > 100) {
    return res.status(400).json({ error: 'Please provide a valid name.' });
  }
  if (!address || typeof address !== 'object' ||
      !address.line1 || !address.city || !address.state || !address.zip) {
    return res.status(400).json({ error: 'Please fill in all required address fields.' });
  }
  const updated = markClaimed(req.params.id, { name, address });
  if (!updated) return res.status(500).json({ error: 'Failed to save claim. Please try again.' });
  console.log(`[claim] ${req.params.id} claimed by ${name} → ${address.city}, ${address.state}`);
  res.json({ success: true });
});

module.exports = router;
