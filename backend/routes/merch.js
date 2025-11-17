const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireAdmin, requireMember } = require('../middleware/auth');

const router = express.Router();

// GET /api/merch-orders - list merch orders
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get filter parameter (all, archived, not_archived)
    const filter = req.query.filter || 'not_archived'; // Default to not_archived
    
    // Build query based on filter
    let query = `SELECT id, first_name, last_name, email, item, size, quantity, gender, created_at, archived 
                 FROM merch_orders`;
    
    if (filter === 'archived') {
      query += ' WHERE archived = true';
    } else if (filter === 'not_archived') {
      query += ' WHERE archived = false OR archived IS NULL';
    }
    // If filter is 'all', no WHERE clause needed
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query);
    const orders = (result.rows || []).map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      item: row.item,
      size: row.size,
      quantity: row.quantity,
      gender: row.gender,
      created_at: row.created_at,
      archived: row.archived || false,
    }));
    res.json({ orders });
  } catch (error) {
    console.error('List merch orders error:', error);
    res.status(500).json({ error: 'Failed to list merch orders' });
  }
});

// POST /api/merch-orders - create merch order
router.post('/', authenticateToken, requireMember, async (req, res) => {
  try {
    const { firstName, lastName, email, item, size, quantity, gender } = req.body;
    if (!firstName || !lastName || !email || !item) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const qty = Number.isFinite(quantity) ? quantity : parseInt(quantity, 10) || 1;
    const genderValue = gender === 'womens' ? 'W' : 'M'; // Store as M/W
    const result = await pool.query(
      `INSERT INTO merch_orders (first_name, last_name, email, item, size, quantity, gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, first_name, last_name, email, item, size, quantity, gender, created_at`,
      [firstName, lastName, email, item, size || null, qty, genderValue]
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
        gender: row.gender,
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

// Archive multiple orders
router.put('/archive', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { orderIds } = req.body;
    
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds must be a non-empty array' });
    }
    
    // Validate all IDs are numbers
    const validIds = orderIds.filter(id => !isNaN(parseInt(id, 10))).map(id => parseInt(id, 10));
    if (validIds.length === 0) {
      return res.status(400).json({ error: 'No valid order IDs provided' });
    }
    
    // Update all orders to archived = true
    const placeholders = validIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
      `UPDATE merch_orders SET archived = true WHERE id IN (${placeholders})`,
      validIds
    );
    
    res.json({ 
      message: `${result.rowCount} order(s) archived successfully`,
      archivedCount: result.rowCount
    });
  } catch (error) {
    console.error('Archive orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
