const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const parsePopupSettings = (rawValue) => {
  let popup = { enabled: false, message: '', popupId: null };
  if (!rawValue) return popup;
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object') {
      popup = {
        enabled: !!parsed.enabled && !!parsed.message,
        message: parsed.message || '',
        popupId: parsed.popupId || null
      };
    }
  } catch (_err) {
    // ignore parse errors, fall back to defaults
  }
  return popup;
};

const loadPopupSettings = async () => {
  const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', ['popup_json']);
  return parsePopupSettings(result.rows[0]?.value || '');
};

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
        // Preserve enabled state as saved, don't force it off
        banner = { enabled: enabled, items, rotationIntervalMs };
      } else if (typeof parsed.message === 'string') {
        const items = parsed.message ? [{ message: parsed.message }] : [];
        // Preserve enabled state as saved, don't force it off
        banner = { enabled: enabled, items, rotationIntervalMs };
      }
    }

    const popup = await loadPopupSettings();

    res.json({ banner, popup });
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

    // Helper function to calculate display length (excluding URLs in links)
    const getDisplayLength = (text) => {
      if (!text) return 0;
      // Replace [text](url) with just the display text for counting
      const withoutUrls = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
      return withoutUrls.length;
    };

    // Enforce constraints: trim, max display length 50, drop empties, cap at 10 items
    items = items
      .map((it) => {
        const message = (it.message || '').toString().trim();
        // Only enforce 50-char limit on display text, preserve full links
        return getDisplayLength(message) <= 50 ? { message } : null;
      })
      .filter((it) => it && it.message)
      .slice(0, 10);

    // Preserve the enabled state as sent by the user, even if there are no items
    const banner = { enabled: enabled, items, rotationIntervalMs };
    const value = JSON.stringify(banner);

    await pool.query(
      `
      INSERT INTO site_settings(key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `,
      ['banner_json', value]
    );

    // Handle popup settings
    const popupEnabled = !!body.popupEnabled;
    const popupMessage = (body.popupMessage || '').toString().trim();
    const previousPopup = await loadPopupSettings();

    let popupPayload = { enabled: false, message: '', popupId: null };
    if (popupEnabled && popupMessage) {
      let popupId = previousPopup.popupId;
      if (!popupId || previousPopup.message !== popupMessage) {
        popupId = `popup-${Date.now()}`;
      }
      popupPayload = {
        enabled: true,
        message: popupMessage,
        popupId
      };
    }

    await pool.query(
      `
      INSERT INTO site_settings(key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `,
      ['popup_json', JSON.stringify(popupPayload)]
    );

    res.json({ message: 'Banner updated', banner, popup: popupPayload });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authenticated: get popup status for current user
router.get('/popup/status', authenticateToken, async (req, res) => {
  try {
    const popup = await loadPopupSettings();

    if (!popup.enabled || !popup.message || !popup.popupId) {
      return res.json({ popup: { enabled: false, shouldShow: false } });
    }

    const result = await pool.query(
      'SELECT 1 FROM user_popup_views WHERE user_id = $1 AND popup_id = $2',
      [req.user.id, popup.popupId]
    );

    res.json({
      popup: {
        ...popup,
        shouldShow: result.rowCount === 0
      }
    });
  } catch (error) {
    console.error('Get popup status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authenticated: mark popup as seen for the current user
router.post('/popup/seen', authenticateToken, async (req, res) => {
  try {
    const popupId = req.body?.popupId;
    if (!popupId) {
      return res.status(400).json({ error: 'popupId is required' });
    }

    await pool.query(
      `
      INSERT INTO user_popup_views (user_id, popup_id, seen_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, popup_id) DO UPDATE SET seen_at = EXCLUDED.seen_at
    `,
      [req.user.id, popupId]
    );

    res.json({ message: 'Popup marked as seen' });
  } catch (error) {
    console.error('Mark popup seen error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


