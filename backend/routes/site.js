const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Public: get banner
router.get('/banner', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', ['banner_json']);
    const raw = result.rows[0]?.value || '';
    const parsed = raw ? JSON.parse(raw) : { enabled: false, message: '' };
    res.json({ banner: parsed });
  } catch (error) {
    console.error('Get banner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: update banner
router.put('/banner', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { enabled = false, message = '' } = req.body || {};
    const value = JSON.stringify({ enabled: !!enabled, message: String(message || '') });
    await pool.query(`
      INSERT INTO site_settings(key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, ['banner_json', value]);
    res.json({ message: 'Banner updated', banner: { enabled: !!enabled, message: String(message || '') } });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


