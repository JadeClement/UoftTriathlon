const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Public: get banner (supports single or multiple banners)
router.get('/banner', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', ['banner_json']);
    const raw = result.rows[0]?.value || '';

    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (_e) {
      parsed = null;
    }

    // Normalize to unified shape: { enabled: boolean, items: [{ message }], rotationIntervalMs }
    let banner = { enabled: false, items: [], rotationIntervalMs: 6000 };
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const enabled = !!parsed.enabled;
      const rotationIntervalMs = Number(parsed.rotationIntervalMs) > 0 ? Number(parsed.rotationIntervalMs) : 6000;

      if (Array.isArray(parsed.items)) {
        const items = parsed.items
          .map((it) => (typeof it === 'string' ? { message: it } : { message: String(it?.message || '') }))
          .filter((it) => it.message);
        banner = { enabled: enabled && items.length > 0, items, rotationIntervalMs };
      } else if (typeof parsed.message === 'string') {
        const items = parsed.message ? [{ message: parsed.message }] : [];
        banner = { enabled: enabled && items.length > 0, items, rotationIntervalMs };
      }
    }

    res.json({ banner });
  } catch (error) {
    console.error('Get banner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: update banner (supports multiple items)
router.put('/banner', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const enabled = !!body.enabled;
    const rotationIntervalMs = Number(body.rotationIntervalMs) > 0 ? Number(body.rotationIntervalMs) : 6000;

    let itemsInput = body.items;
    if (!Array.isArray(itemsInput) && typeof body.message === 'string') {
      itemsInput = [{ message: body.message }];
    }

    let items = Array.isArray(itemsInput)
      ? itemsInput.map((it) => (typeof it === 'string' ? { message: it } : { message: String(it?.message || '') }))
      : [];

    // Enforce constraints: trim, max length 50, drop empties, cap at 10 items
    items = items
      .map((it) => ({ message: (it.message || '').toString().trim().slice(0, 50) }))
      .filter((it) => it.message)
      .slice(0, 10);

    const banner = { enabled: enabled && items.length > 0, items, rotationIntervalMs };
    const value = JSON.stringify(banner);

    await pool.query(
      `
      INSERT INTO site_settings(key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `,
      ['banner_json', value]
    );

    res.json({ message: 'Banner updated', banner });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


