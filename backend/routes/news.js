const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireMember, requireRole } = require('../middleware/auth');
const { personalizeBulletinHtml } = require('../utils/bulletinContent');

const router = express.Router();

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Bulletins for members, coaches, exec, and admins. Newest first.
router.get('/', authenticateToken, requireMember, async (req, res) => {
  try {
    const rawQuery = String(req.query.q || '').trim().slice(0, 200);
    const params = [];
    let where = 'WHERE removed_at IS NULL';

    if (rawQuery) {
      params.push(`%${escapeLike(rawQuery)}%`);
      where += ` AND search_text ILIKE $1 ESCAPE '\\'`;
    }

    const result = await pool.query(
      `SELECT id, title, sent_at
       FROM news_bulletins
       ${where}
       ORDER BY sent_at DESC, id DESC`,
      params
    );

    res.json({ bulletins: result.rows });
  } catch (error) {
    console.error('List news bulletins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticateToken, requireMember, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid bulletin id' });
    }

    const result = await pool.query(
      `SELECT id, title, banner_title, html_body, sent_at
       FROM news_bulletins
       WHERE id = $1 AND removed_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulletin not found' });
    }

    const nameResult = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const bulletin = result.rows[0];
    bulletin.html_body = personalizeBulletinHtml(bulletin.html_body, nameResult.rows[0]?.name);

    res.json({ bulletin });
  } catch (error) {
    console.error('Get news bulletin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Hide a bulletin from News. The email that already went out is unchanged.
router.delete('/:id', authenticateToken, requireRole('exec'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid bulletin id' });
    }

    const result = await pool.query(
      `UPDATE news_bulletins
       SET removed_at = CURRENT_TIMESTAMP, removed_by = $2
       WHERE id = $1 AND removed_at IS NULL
       RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bulletin not found' });
    }

    res.json({ message: 'Bulletin removed from News' });
  } catch (error) {
    console.error('Remove news bulletin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
