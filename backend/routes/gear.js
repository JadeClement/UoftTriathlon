const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Data file for persistent storage
const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads/gear');
const dataFilePath = path.join(dataDir, 'gear.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function loadGear() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading gear.json:', e);
  }
  return [];
}

function saveGear(items) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(items, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing gear.json:', e);
  }
}

// Multer for image uploads
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'gear-' + unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: function (_req, file, cb) {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// GET all gear
router.get('/', (_req, res) => {
  const items = loadGear();
  res.json({ items });
});

// PUT update a gear item (price, description, title, images order)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, price, description, images } = req.body;
    console.log('🛠️ [GEAR PUT] id:', id, 'title:', title, 'price:', price, 'descLen:', (description||'').length, 'images?', Array.isArray(images));

    const items = loadGear();
    const idx = items.findIndex(g => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Gear item not found' });

    const updated = {
      ...items[idx],
      title: title !== undefined ? title : items[idx].title,
      price: price !== undefined ? price : items[idx].price,
      description: description !== undefined ? description : items[idx].description,
      images: Array.isArray(images) && images.length > 0 ? images : items[idx].images
    };

    items[idx] = updated;
    saveGear(items);
    console.log('✅ [GEAR PUT] updated item images count:', (updated.images||[]).length);
    res.json({ message: 'Updated', item: updated });
  } catch (e) {
    console.error('❌ Update gear error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST upload images for a gear item
router.post('/:id/images', authenticateToken, requireAdmin, upload.array('images', 10), (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const files = req.files || [];
    console.log('🖼️ [GEAR IMAGES POST] id:', id, 'files:', files.map(f=>({name:f.originalname,size:f.size,mime:f.mimetype})));

    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const items = loadGear();
    const idx = items.findIndex(g => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Gear item not found' });

    const newUrls = files.map(f => `/uploads/gear/${f.filename}`);
    items[idx].images = [...(items[idx].images || []), ...newUrls];

    // Clean placeholder text in description if present once images exist
    try {
      const desc = items[idx].description || '';
      const cleaned = desc.replace(/image coming soon\.?/ig, '').trim();
      items[idx].description = cleaned;
      console.log('🧹 [GEAR IMAGES POST] Cleaned description:', cleaned);
    } catch (_) {}

    console.log('✅ [GEAR IMAGES POST] total images now:', (items[idx].images||[]).length);
    saveGear(items);

    res.json({ message: 'Images uploaded', images: items[idx].images });
  } catch (e) {
    console.error('❌ Upload gear images error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


