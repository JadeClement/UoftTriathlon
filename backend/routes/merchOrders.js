const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireAdmin, requireMember } = require('../middleware/auth');
const db = require('../database-pg');

const router = express.Router();

// Legacy JSON path (for optional one-time backfill)
const dataDir = path.join(__dirname, '../data');
const dataFilePath = path.join(dataDir, 'merch-orders.json');

// GET all orders
router.get('/', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    // Load from DB
    const { rows } = await db.query(
      'SELECT id, first_name AS "firstName", last_name AS "lastName", email, item, size, quantity, created_at FROM merch_orders ORDER BY created_at DESC'
    );

    // If DB empty but legacy JSON exists, backfill once
    if (rows.length === 0 && fs.existsSync(dataFilePath)) {
      try {
        const legacy = JSON.parse(fs.readFileSync(dataFilePath, 'utf8')) || [];
        if (Array.isArray(legacy) && legacy.length > 0) {
          for (const o of legacy) {
            const firstName = (o.firstName || (o.name ? String(o.name).split(' ')[0] : '') || '').trim();
            const lastName = (o.lastName || (o.name ? String(o.name).split(' ').slice(1).join(' ') : '') || '').trim();
            const email = (o.email || '').trim();
            const item = (o.item || '').trim();
            const size = (o.size || '').trim();
            const quantity = Number(o.quantity) || 1;
            if (firstName && email && item) {
              await db.query(
                'INSERT INTO merch_orders (first_name, last_name, email, item, size, quantity, created_at) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, NOW()))',
                [firstName, lastName, email, item, size, quantity, o.created_at ? new Date(o.created_at) : null]
              );
            }
          }
          const after = await db.query('SELECT id, first_name AS "firstName", last_name AS "lastName", email, item, size, quantity, created_at FROM merch_orders ORDER BY created_at DESC');
          return res.json({ orders: after.rows });
        }
      } catch (bfErr) {
        console.error('Merch orders backfill error:', bfErr);
      }
    }

    res.json({ orders: rows });
  } catch (e) {
    console.error('Get merch orders error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create order
router.post('/', authenticateToken, requireMember, async (req, res) => {
  try {
    console.log('🔍 Merch order POST - User:', req.user);
    console.log('🔍 Merch order POST - Body:', req.body);
    
    const { name, firstName, lastName, email, item, size, quantity } = req.body || {};
    const finalFirstName = (firstName || (name ? name.split(' ')[0] : '') || '').trim();
    const finalLastName = (lastName || (name ? name.split(' ').slice(1).join(' ') : '') || '').trim();
    const finalEmail = (email || '').trim();
    const finalItem = (item || '').trim();
    const finalSize = (size || '').trim();
    const qty = Number(quantity) || 1;

    console.log('🔍 Processed data:', { finalFirstName, finalLastName, finalEmail, finalItem, finalSize, qty });

    if (!finalFirstName || !finalEmail || !finalItem) {
      console.log('❌ Missing required fields:', { finalFirstName, finalEmail, finalItem });
      return res.status(400).json({ error: 'firstName, email, and item are required' });
    }

    const insert = await db.query(
      'INSERT INTO merch_orders (first_name, last_name, email, item, size, quantity) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, first_name AS "firstName", last_name AS "lastName", email, item, size, quantity, created_at',
      [finalFirstName, finalLastName, finalEmail, finalItem, finalSize, qty]
    );
    res.json({ message: 'Order created', order: insert.rows[0] });
  } catch (e) {
    console.error('Create order error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update order
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.query('SELECT * FROM merch_orders WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const current = existing.rows[0];
    const { name, firstName, lastName, email, item, size, quantity } = req.body || {};
    const finalFirstName = (firstName !== undefined ? firstName : (name ? name.split(' ')[0] : current.first_name) || '').trim();
    const finalLastName = (lastName !== undefined ? lastName : (name ? name.split(' ').slice(1).join(' ') : current.last_name) || '').trim();
    const finalEmail = email !== undefined ? String(email).trim() : current.email;
    const finalItem = item !== undefined ? String(item).trim() : current.item;
    const finalSize = size !== undefined ? String(size).trim() : current.size;
    const qty = quantity !== undefined ? Number(quantity) : current.quantity;

    const upd = await db.query(
      'UPDATE merch_orders SET first_name=$1, last_name=$2, email=$3, item=$4, size=$5, quantity=$6 WHERE id=$7 RETURNING id, first_name AS "firstName", last_name AS "lastName", email, item, size, quantity, created_at',
      [finalFirstName, finalLastName, finalEmail, finalItem, finalSize, isNaN(qty) ? current.quantity : qty, id]
    );
    res.json({ message: 'Order updated', order: upd.rows[0] });
  } catch (e) {
    console.error('Update order error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE order
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const del = await db.query('DELETE FROM merch_orders WHERE id = $1', [id]);
    if (del.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (e) {
    console.error('Delete order error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


