const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Data file for persistent storage
const dataDir = path.join(__dirname, '../data');
const dataFilePath = path.join(dataDir, 'merch-orders.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function loadOrders() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading merch-orders.json:', e);
  }
  return [];
}

function saveOrders(items) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(items, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing merch-orders.json:', e);
  }
}

// GET all orders
router.get('/', authenticateToken, requireAdmin, (_req, res) => {
  const orders = loadOrders();
  res.json({ orders });
});

// POST create order
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, firstName, lastName, email, item, size, quantity } = req.body || {};
    
    // Handle both old and new formats
    const finalFirstName = firstName || (name ? name.split(' ')[0] : '');
    const finalLastName = lastName || (name ? name.split(' ').slice(1).join(' ') : '');
    
    if (!finalFirstName || !email || !item) return res.status(400).json({ error: 'firstName, email, and item are required' });

    const orders = loadOrders();
    const newId = Math.max(0, ...orders.map(o => o.id || 0)) + 1;
    const qty = Number(quantity) || 1;

    const newOrder = {
      id: newId,
      firstName: String(finalFirstName).trim(),
      lastName: String(finalLastName).trim(),
      email: String(email).trim(),
      item: String(item).trim(),
      size: size ? String(size).trim() : '',
      quantity: qty,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    orders.push(newOrder);
    saveOrders(orders);
    res.json({ message: 'Order created', order: newOrder });
  } catch (e) {
    console.error('Create order error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update order
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const orders = loadOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    const { name, firstName, lastName, email, item, size, quantity } = req.body || {};
    const qty = quantity !== undefined ? Number(quantity) : orders[idx].quantity;
    
    // Handle both old and new formats
    const finalFirstName = firstName !== undefined ? firstName : (name ? name.split(' ')[0] : orders[idx].firstName);
    const finalLastName = lastName !== undefined ? lastName : (name ? name.split(' ').slice(1).join(' ') : orders[idx].lastName);

    const updated = {
      ...orders[idx],
      firstName: String(finalFirstName).trim(),
      lastName: String(finalLastName).trim(),
      email: email !== undefined ? String(email).trim() : orders[idx].email,
      item: item !== undefined ? String(item).trim() : orders[idx].item,
      size: size !== undefined ? String(size).trim() : orders[idx].size,
      quantity: isNaN(qty) ? orders[idx].quantity : qty,
      updated_at: new Date().toISOString()
    };

    orders[idx] = updated;
    saveOrders(orders);
    res.json({ message: 'Order updated', order: updated });
  } catch (e) {
    console.error('Update order error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE order
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const orders = loadOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });
    orders.splice(idx, 1);
    saveOrders(orders);
    res.json({ message: 'Order deleted' });
  } catch (e) {
    console.error('Delete order error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


