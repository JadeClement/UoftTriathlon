const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { isS3Enabled, uploadBufferToS3, getJsonFromS3, putJsonToS3 } = require('../utils/s3');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { pool } = require('../database-pg');

// Path to the persistent data file
// NOTE: team-profiles.json is the SINGLE SOURCE OF TRUTH for team member data
const dataFilePath = path.join(__dirname, '../data/team-profiles.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const VALID_CATEGORIES = ['coach', 'exec', 'past-president'];

const POSITION_METADATA = {
  'swim-coach': { category: 'coach', emoji: '🏊‍♂️', slug: 'justin-konik', sortOrder: 0 },
  'run-coach': { category: 'coach', emoji: '🏃‍♂️', slug: 'run-coach', sortOrder: 1 },
  'co-president': { category: 'past-president', emoji: '👑', slug: 'jade-clement', sortOrder: 0, profileLabel: '2025-26' },
  'co-president-2': { category: 'exec', emoji: '👑', slug: 'marlene-garijo', sortOrder: 0 },
  'treasurer': { category: 'exec', emoji: '💰', slug: 'edward-ing', sortOrder: 1 },
  'secretary': { category: 'exec', emoji: '📝', slug: 'lauren-williams', sortOrder: 2 },
  'social-coordinator': { category: 'exec', emoji: '🎉', slug: 'katy-tiper', sortOrder: 3 },
  'social-media': { category: 'exec', emoji: '📱', slug: 'paulette-dalton', sortOrder: 4 },
  'webmaster': { category: 'exec', emoji: '💻', slug: 'ilan-gofman', sortOrder: 5 },
  'workout-coordinator': { category: 'exec', emoji: '🏃‍♂️', slug: 'workout-coordinator', sortOrder: 6 }
};

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'member';
}

function enrichMember(id, member) {
  const meta = POSITION_METADATA[id] || {};
  return {
    ...member,
    id: member.id || id,
    category: member.category || meta.category || 'exec',
    emoji: member.emoji || meta.emoji || '👤',
    slug: member.slug || meta.slug || slugify(member.name || id),
    sortOrder: member.sortOrder ?? meta.sortOrder ?? 999,
    profileLabel: member.profileLabel ?? meta.profileLabel ?? ''
  };
}

function enrichAllMembers(teamMembers) {
  const enriched = {};
  for (const [id, member] of Object.entries(teamMembers)) {
    enriched[id] = enrichMember(id, member);
  }
  return enriched;
}

function generateUniqueId(teamMembers, baseId) {
  let candidate = slugify(baseId);
  if (!teamMembers[candidate]) return candidate;
  let counter = 2;
  while (teamMembers[`${candidate}-${counter}`]) counter += 1;
  return `${candidate}-${counter}`;
}

// Load team member data from file or use defaults
async function loadTeamMembers() {
  try {
    // Prefer S3 if available
    if (isS3Enabled()) {
      const s3Key = 'team-profiles/team-profiles.json';
      const fromS3 = await getJsonFromS3(s3Key);
      if (fromS3) {
        console.log('📁 Loaded team members from S3 JSON:', Object.keys(fromS3));
        return enrichAllMembers(fromS3);
      }
    }
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      const parsedData = JSON.parse(data);
      console.log('📁 Loaded team members from JSON file:', Object.keys(parsedData));
      return enrichAllMembers(parsedData);
    } else {
      console.log('⚠️ JSON file not found, using default data');
    }
  } catch (error) {
    console.error('Error loading team members:', error);
  }
  
  // Initialize sensible defaults for all roles if nothing found
  console.log('⚠️ No team-profiles.json found in S3 or local. Initializing defaults.');
  const rawDefaults = {
    'swim-coach': { id: 'swim-coach', name: 'Coach Name', role: 'Swim Coach', image: '/images/icon.png', email: '', bio: 'Bio coming soon!' },
    'run-coach': { id: 'run-coach', name: 'Coach Name', role: 'Run Coach', image: '/images/icon.png', email: '', bio: 'Bio coming soon!' },
    'co-president': { id: 'co-president', name: 'Co-President', role: 'Co-President', image: '/images/icon.png', email: '', bio: 'Bio coming soon!' },
    'co-president-2': { id: 'co-president-2', name: 'Co-President', role: 'Co-President', image: '/images/icon.png', email: '', bio: 'Bio coming soon!' },
    'treasurer': { id: 'treasurer', name: 'Treasurer', role: 'Treasurer', image: '/images/icon.png', email: '', bio: 'Bio coming soon!' },
    'secretary': { id: 'secretary', name: 'Secretary', role: 'Secretary', image: '/images/icon.png', email: '', bio: 'Bio coming soon!' },
    'social-coordinator': { id: 'social-coordinator', name: 'Social Coordinator', role: 'Social Coordinator/Recruitment', image: '/images/icon.png', email: '', bio: 'Bio coming soon!' },
    'social-media': { id: 'social-media', name: 'Social Media Manager', role: 'Social Media Manager', image: '/images/icon.png', email: '', bio: 'Bio coming soon!' },
    'webmaster': { id: 'webmaster', name: 'Webmaster', role: 'Webmaster', image: '/images/icon.png', email: '', bio: 'Bio coming soon!' },
    'workout-coordinator': { id: 'workout-coordinator', name: 'Workout/Race Coordinator', role: 'Workout/Race Coordinator', image: '/images/icon.png', email: '', bio: 'Bio coming soon!' }
  };
  const defaults = enrichAllMembers(rawDefaults);
  try {
    await saveTeamMembers(defaults);
  } catch (_) {}
  return defaults;
}

// Save team member data to file
async function saveTeamMembers(teamMembers) {
  try {
    // Write to S3 if configured
    if (isS3Enabled()) {
      const s3Key = 'team-profiles/team-profiles.json';
      await putJsonToS3(s3Key, teamMembers);
      console.log('💾 Team members saved to S3:', s3Key);
    }

    // Always keep local backup copy
    const backupPath = dataFilePath + '.backup';
    if (fs.existsSync(dataFilePath)) {
      fs.copyFileSync(dataFilePath, backupPath);
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(teamMembers, null, 2), 'utf8');
    console.log('💾 Team members saved locally:', dataFilePath);
  } catch (error) {
    console.error('❌ Error saving team members:', error);
  }
}

// Configure multer for image uploads (memory if S3 enabled, disk otherwise)
const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/team-profiles');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: isS3Enabled() ? memoryStorage : diskStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Create a new team position (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, category, emoji, name, email, bio, slug, profileLabel, sortOrder } = req.body;

    if (!role || !String(role).trim()) {
      return res.status(400).json({ error: 'Position title is required' });
    }

    const memberCategory = category || 'exec';
    if (!VALID_CATEGORIES.includes(memberCategory)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const teamMembers = await loadTeamMembers();
    const id = generateUniqueId(teamMembers, role);
    const memberName = name?.trim() || role.trim();
    const memberSlug = slug?.trim() ? slugify(slug) : slugify(memberName);

    const newMember = enrichMember(id, {
      id,
      name: memberName,
      role: role.trim(),
      category: memberCategory,
      emoji: emoji?.trim() || '👤',
      slug: memberSlug,
      profileLabel: profileLabel?.trim() || '',
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : Object.values(teamMembers).filter(m => m.category === memberCategory).length,
      image: '/images/icon.png',
      email: email?.trim() || '',
      bio: bio?.trim() || 'Bio coming soon!'
    });

    teamMembers[id] = newMember;
    await saveTeamMembers(teamMembers);

    res.status(201).json({
      message: 'Position created successfully',
      member: newMember
    });
  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({ error: 'Failed to create position' });
  }
});

// Get all team member profiles
router.get('/', async (req, res) => {
  try {
    const teamMembers = await loadTeamMembers();
    
    // Convert object to array for frontend compatibility
    const teamMembersArray = Object.values(teamMembers);
    
    console.log('📊 Returning team members:', teamMembersArray.length, 'members');
    
    res.json({ teamMembers: teamMembersArray });
  } catch (error) {
    console.error('Error getting team members:', error);
    res.status(500).json({ error: 'Failed to get team members' });
  }
});

// Get specific team member profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const teamMembers = await loadTeamMembers();
    
    const member = teamMembers[id];
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.json({ member });
  } catch (error) {
    console.error('Error getting team member:', error);
    res.status(500).json({ error: 'Failed to get team member' });
  }
});

// Update team member profile (admin only)
router.put('/:id', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, bio, image, email, role, emoji, profileLabel, slug } = req.body;
    const imageFile = req.file;

    console.log('🔄 Updating profile for:', id);
    console.log('👤 New name:', name);
    console.log('🏷️ New role:', role);
    console.log('📧 New email:', email);
    console.log('📝 New bio:', bio);
    console.log('🖼️ New image URL:', image);
    console.log('🖼️ Image file:', imageFile ? imageFile.filename : 'No new image');

    // Load current data
    const teamMembers = await loadTeamMembers();
    const currentMember = teamMembers[id];
    
    if (!currentMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Update the member data
    const updatedMember = {
      ...currentMember,
      name: name || currentMember.name,
      email: email !== undefined ? email : currentMember.email,
      bio: bio || currentMember.bio,
      image: image || currentMember.image,
      role: role !== undefined ? role : currentMember.role,
      emoji: emoji !== undefined ? emoji : currentMember.emoji,
      profileLabel: profileLabel !== undefined ? profileLabel : currentMember.profileLabel,
      slug: slug !== undefined ? slugify(slug) : currentMember.slug
    };
    
    // Clean up undefined values to prevent JSON issues
    Object.keys(updatedMember).forEach(key => {
      if (updatedMember[key] === undefined) {
        updatedMember[key] = '';
      }
    });

    // Handle new image if uploaded
    if (imageFile) {
      if (isS3Enabled()) {
        const ext = path.extname(imageFile.originalname || '.jpg').toLowerCase() || '.jpg';
        const key = `team-profiles/${id}-${Date.now()}${ext}`;
        const url = await uploadBufferToS3(key, imageFile.buffer, imageFile.mimetype);
        updatedMember.image = url;
      } else {
        const imageUrl = `/uploads/team-profiles/${imageFile.filename}`;
        updatedMember.image = imageUrl;
      }
    }

    // Save the updated data
    teamMembers[id] = updatedMember;
    console.log('🔄 About to save team members with updated member:', id);
    console.log('📊 Updated member data:', updatedMember);
    await saveTeamMembers(teamMembers);

    res.json({ 
      message: 'Profile updated successfully',
      member: updatedMember
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Note: Images are now served statically via the main server
// No need for this route anymore

module.exports = router;
