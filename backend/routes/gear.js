const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { 
  isS3Enabled, 
  uploadBufferToS3, 
  deleteFromS3, 
  getS3KeyFromUrl, 
  getJsonFromS3, 
  putJsonToS3 
} = require('../utils/s3');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Data file for persistent storage
const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads/gear');
const dataFilePath = path.join(dataDir, 'gear.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

async function loadGear() {
  try {
    // Prefer S3 if configured
    if (isS3Enabled()) {
      const s3Key = 'gear/gear.json';
      const fromS3 = await getJsonFromS3(s3Key);
      if (fromS3) return fromS3;
    }

    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, 'utf8');
      return JSON.parse(raw);
    } else {
      // Initialize with default gear items if file doesn't exist
      const defaultGear = [
        {
          id: 1,
          title: "Team Backpack",
          price: "X",
          images: [],
          description: "Durable backpack perfect for training and travel. Image coming soon."
        },
        {
          id: 2,
          title: "Swim Cap",
          price: "X",
          images: [],
          description: "Silicone swim cap with UofT Tri Club logo. Image coming soon."
        },
        {
          id: 3,
          title: "Team Sweatshirt",
          price: "X",
          images: [],
          description: "Comfortable sweatshirt with UofT Tri Club branding. Image coming soon."
        }
      ];
      await saveGear(defaultGear);
      console.log('📦 [GEAR] Initialized default gear items');
      return defaultGear;
    }
  } catch (e) {
    console.error('Error reading gear.json:', e);
    return [];
  }
}

async function saveGear(items) {
  try {
    // Save to S3 if enabled
    if (isS3Enabled()) {
      const s3Key = 'gear/gear.json';
      await putJsonToS3(s3Key, items);
    }
    // Always keep a local backup
    fs.writeFileSync(dataFilePath, JSON.stringify(items, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing gear.json:', e);
  }
}

// Multer for image uploads (use memory when S3 enabled, disk otherwise)
const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'gear-' + unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: isS3Enabled() ? memoryStorage : diskStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: function (_req, file, cb) {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// GET all gear
router.get('/', async (_req, res) => {
  const items = await loadGear();
  res.json({ items });
});

// POST create new gear item
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, price, description, hasGender, hasSize, availableSizes } = req.body;
    
    if (!title) return res.status(400).json({ error: 'Title is required' });
    
    const items = await loadGear();
    const newId = Math.max(...items.map(item => item.id), 0) + 1;
    
    const newItem = {
      id: newId,
      title: title.trim(),
      price: price || 'X',
      description: description || 'Description coming soon.',
      images: [],
      hasGender: hasGender === true || hasGender === 'true',
      hasSize: hasSize === true || hasSize === 'true',
      availableSizes: Array.isArray(availableSizes) ? availableSizes : []
    };
    
    items.push(newItem);
    await saveGear(items);
    
    console.log('✅ [GEAR POST] Created new item:', newItem);
    res.json({ message: 'Gear item created', item: newItem });
  } catch (e) {
    console.error('❌ Create gear error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update a gear item (price, description, title, images order, hasGender, hasSize, availableSizes)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, price, description, images, hasGender, hasSize, availableSizes } = req.body;
    console.log('🛠️ [GEAR PUT] id:', id, 'title:', title, 'price:', price, 'descLen:', (description||'').length, 'images?', Array.isArray(images), 'images:', images, 'hasGender:', hasGender, 'hasSize:', hasSize, 'availableSizes:', availableSizes);

    const items = await loadGear();
    const idx = items.findIndex(g => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Gear item not found' });

    const updated = {
      ...items[idx],
      title: title !== undefined ? title : items[idx].title,
      price: price !== undefined ? price : items[idx].price,
      description: description !== undefined ? description : items[idx].description,
      images: Array.isArray(images) ? images : items[idx].images,
      hasGender: hasGender !== undefined ? (hasGender === true || hasGender === 'true') : (items[idx].hasGender || false),
      hasSize: hasSize !== undefined ? (hasSize === true || hasSize === 'true') : (items[idx].hasSize || false),
      availableSizes: availableSizes !== undefined ? (Array.isArray(availableSizes) ? availableSizes : []) : (items[idx].availableSizes || [])
    };

    items[idx] = updated;
    await saveGear(items);
    console.log('✅ [GEAR PUT] updated item images count:', (updated.images||[]).length);
    res.json({ message: 'Updated', item: updated });
  } catch (e) {
    console.error('❌ Update gear error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST upload images for a gear item
router.post('/:id/images', authenticateToken, requireAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const files = req.files || [];
    console.log('🖼️ [GEAR IMAGES POST] id:', id, 'files:', files.map(f=>({name:f.originalname,size:f.size,mime:f.mimetype})));

    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const items = await loadGear();
    const idx = items.findIndex(g => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Gear item not found' });

    let newUrls = [];
    if (isS3Enabled()) {
      // Upload each buffer to S3
      for (const f of files) {
        const ext = path.extname(f.originalname || '.jpg').toLowerCase() || '.jpg';
        const key = `gear/${id}/gear-${Date.now()}-${Math.round(Math.random()*1e6)}${ext}`;
        const url = await uploadBufferToS3(key, f.buffer, f.mimetype);
        newUrls.push(url);
      }
    } else {
      newUrls = files.map(f => `/uploads/gear/${f.filename}`);
    }
    items[idx].images = [...(items[idx].images || []), ...newUrls];

    // Clean placeholder text in description if present once images exist
    try {
      const desc = items[idx].description || '';
      const cleaned = desc.replace(/image coming soon\.?/ig, '').trim();
      items[idx].description = cleaned;
      console.log('🧹 [GEAR IMAGES POST] Cleaned description:', cleaned);
    } catch (_) {}

    console.log('✅ [GEAR IMAGES POST] total images now:', (items[idx].images||[]).length);
    await saveGear(items);

    res.json({ message: 'Images uploaded', images: items[idx].images });
  } catch (e) {
    console.error('❌ Upload gear images error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE remove an image from a gear item
router.delete('/:id/images', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { imageUrl } = req.body;

    if (!imageUrl) return res.status(400).json({ error: 'Image URL required' });

    const items = await loadGear();
    const idx = items.findIndex(g => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Gear item not found' });

    // Remove the image from the array
    items[idx].images = (items[idx].images || []).filter(img => img !== imageUrl);
    
    // Delete the actual file (skip placeholder images)
    if (!imageUrl.includes('placeholder-gear.svg') && !imageUrl.includes('/images/')) {
      try {
        const s3Key = getS3KeyFromUrl(imageUrl);
        if (s3Key && isS3Enabled()) {
          await deleteFromS3(s3Key);
        } else {
          const filename = imageUrl.split('/').pop();
          const filepath = path.join(uploadsDir, filename);
          console.log('🗑️ [GEAR DELETE] Attempting to delete file:', filepath);
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        }
      } catch (fileError) {
        console.error('❌ [GEAR DELETE] Error deleting file:', fileError.message);
      }
    } else {
      console.log('🗑️ [GEAR DELETE] Skipping placeholder image deletion:', imageUrl);
    }

    await saveGear(items);
    res.json({ message: 'Image removed', images: items[idx].images });
  } catch (e) {
    console.error('❌ Delete gear image error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE remove a gear item
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const items = await loadGear();
    const idx = items.findIndex(g => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Gear item not found' });
    
    const item = items[idx];
    
    // Delete all associated image files
    if (item.images && Array.isArray(item.images)) {
      for (const imageUrl of item.images) {
        try {
          const s3Key = getS3KeyFromUrl(imageUrl);
          if (s3Key && isS3Enabled()) {
            await deleteFromS3(s3Key);
          } else {
            const filename = imageUrl.split('/').pop();
            const filepath = path.join(uploadsDir, filename);
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
              console.log('🗑️ [GEAR DELETE] Removed file:', filename);
            }
          }
        } catch (fileError) {
          console.warn('⚠️ [GEAR DELETE] Could not delete file:', fileError.message);
        }
      }
    }
    
    // Remove item from array
    items.splice(idx, 1);
    await saveGear(items);
    
    console.log('✅ [GEAR DELETE] Removed item:', item.title);
    res.json({ message: 'Gear item deleted' });
  } catch (e) {
    console.error('❌ Delete gear error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


