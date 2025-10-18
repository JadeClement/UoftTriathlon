const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/merch-orders - list merch orders
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, item, size, quantity, created_at
       FROM merch_orders
       ORDER BY created_at DESC`
    );
    const orders = (result.rows || []).map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      item: row.item,
      size: row.size,
      quantity: row.quantity,
      created_at: row.created_at,
    }));
    res.json({ orders });
  } catch (error) {
    console.error('List merch orders error:', error);
    res.status(500).json({ error: 'Failed to list merch orders' });
  }
});

// POST /api/merch-orders - create merch order
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, item, size, quantity } = req.body;
    if (!firstName || !lastName || !email || !item) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const qty = Number.isFinite(quantity) ? quantity : parseInt(quantity, 10) || 1;
    const result = await pool.query(
      `INSERT INTO merch_orders (first_name, last_name, email, item, size, quantity)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, first_name, last_name, email, item, size, quantity, created_at`,
      [firstName, lastName, email, item, size || null, qty]
    );
    const row = result.rows[0];
    res.status(201).json({
      order: {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        item: row.item,
        size: row.size,
        quantity: row.quantity,
        created_at: row.created_at,
      }
    });
  } catch (error) {
    console.error('Create merch order error:', error);
    res.status(500).json({ error: 'Failed to create merch order' });
  }
});

// PUT /api/merch-orders/:id - update merch order
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, item, size, quantity } = req.body;
    const fields = [];
    const values = [];
    let i = 0;
    if (firstName !== undefined) { fields.push(`first_name = $${++i}`); values.push(firstName); }
    if (lastName !== undefined)  { fields.push(`last_name = $${++i}`); values.push(lastName); }
    if (email !== undefined)     { fields.push(`email = $${++i}`); values.push(email); }
    if (item !== undefined)      { fields.push(`item = $${++i}`); values.push(item); }
    if (size !== undefined)      { fields.push(`size = $${++i}`); values.push(size); }
    if (quantity !== undefined)  { fields.push(`quantity = $${++i}`); values.push(parseInt(quantity, 10) || 1); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const result = await pool.query(
      `UPDATE merch_orders SET ${fields.join(', ')} WHERE id = $${++i} RETURNING id`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order updated' });
  } catch (error) {
    console.error('Update merch order error:', error);
    res.status(500).json({ error: 'Failed to update merch order' });
  }
});

// DELETE /api/merch-orders/:id - delete merch order
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM merch_orders WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (error) {
    console.error('Delete merch order error:', error);
    res.status(500).json({ error: 'Failed to delete merch order' });
  }
});

module.exports = router;
