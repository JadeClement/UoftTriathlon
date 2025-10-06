const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
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

// Load team member data from file or use defaults
function loadTeamMembers() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf8');
      const parsedData = JSON.parse(data);
      console.log('📁 Loaded team members from JSON file:', Object.keys(parsedData));
      console.log('🏃 Run coach data:', parsedData['run-coach']);
      return parsedData;
    } else {
      console.log('⚠️ JSON file not found, using default data');
    }
  } catch (error) {
    console.error('Error loading team members from file:', error);
  }
  
  // Minimal fallback data if no file exists (should rarely happen)
  console.log('⚠️ Using minimal fallback data - team-profiles.json should exist!');
  return {
    'swim-coach': {
      id: 'swim-coach',
      name: 'Coach Name',
      role: 'Swim Coach',
      image: '/images/icon.png',
      email: '',
      bio: 'Bio coming soon!'
    },
    'run-coach': {
      id: 'run-coach',
      name: 'Coach Name',
      role: 'Run Coach',
      image: '/images/icon.png',
      email: '',
      bio: 'Bio coming soon!'
    }
  };
}

// Save team member data to file
function saveTeamMembers(teamMembers) {
  try {
    // Create backup before saving
    const backupPath = dataFilePath + '.backup';
    if (fs.existsSync(dataFilePath)) {
      fs.copyFileSync(dataFilePath, backupPath);
    }
    
    fs.writeFileSync(dataFilePath, JSON.stringify(teamMembers, null, 2), 'utf8');
    console.log('💾 Team members saved to file:', dataFilePath);
    console.log('📊 Saved data keys:', Object.keys(teamMembers));
    
    // Verify the file was written correctly
    try {
      const verifyData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      console.log('✅ File verification successful, keys:', Object.keys(verifyData));
    } catch (verifyError) {
      console.error('❌ File verification failed:', verifyError);
      console.error('❌ File exists after write:', fs.existsSync(dataFilePath));
      console.error('❌ File size:', fs.existsSync(dataFilePath) ? fs.statSync(dataFilePath).size : 'N/A');
    }
  } catch (error) {
    console.error('❌ Error saving team members to file:', error);
    console.error('❌ File path:', dataFilePath);
    console.error('❌ Directory exists:', fs.existsSync(path.dirname(dataFilePath)));
  }
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/team-profiles');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
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

// Get all team member profiles
router.get('/', async (req, res) => {
  try {
    const teamMembers = loadTeamMembers();
    
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
    const teamMembers = loadTeamMembers();
    
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
    const { name, bio, image, email } = req.body;
    const imageFile = req.file;

    console.log('🔄 Updating profile for:', id);
    console.log('👤 New name:', name);
    console.log('📧 New email:', email);
    console.log('📝 New bio:', bio);
    console.log('🖼️ New image URL:', image);
    console.log('🖼️ Image file:', imageFile ? imageFile.filename : 'No new image');

    // Load current data
    const teamMembers = loadTeamMembers();
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
      image: image || currentMember.image
    };
    
    // Clean up undefined values to prevent JSON issues
    Object.keys(updatedMember).forEach(key => {
      if (updatedMember[key] === undefined) {
        updatedMember[key] = '';
      }
    });

    // Handle new image if uploaded
    if (imageFile) {
      const imageUrl = `/uploads/team-profiles/${imageFile.filename}`;
      updatedMember.image = imageUrl;
    }

    // Save the updated data
    teamMembers[id] = updatedMember;
    console.log('🔄 About to save team members with updated member:', id);
    console.log('📊 Updated member data:', updatedMember);
    saveTeamMembers(teamMembers);

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
