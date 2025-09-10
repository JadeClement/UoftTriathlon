const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { pool } = require('../database-pg');

// Path to the persistent data file
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
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading team members from file:', error);
  }
  
  // Default data if no file exists
  return {
    'swim-coach': {
      id: 'swim-coach',
      name: 'Justin Konik',
      role: 'Swim Coach',
      image: '/images/swimcoach.png',
      bio: 'Justin Konik is our dedicated swim coach with over 10 years of experience in competitive swimming and triathlon coaching. He specializes in stroke technique, endurance training, and helping athletes overcome their fear of open water swimming.'
    },
    'co-president': {
      id: 'co-president',
      name: 'Jade Clement',
      role: 'Co-President',
      image: '',
      bio: 'Jade Clement is one of our Co-Presidents, leading the UofT Triathlon Club with passion and dedication. With a strong background in triathlon and a commitment to building community, Jade works tirelessly to ensure every member feels welcome and supported.'
    },
    'co-president-2': {
      id: 'co-president-2',
      name: 'Marlene Garijo',
      role: 'Co-President',
      image: '',
      bio: 'Marlene Garijo serves as Co-President alongside Jade, bringing her unique perspective and energy to club leadership. With a background in competitive sports and event organization, Marlene excels at creating memorable experiences for club members.'
    },
    'treasurer': {
      id: 'treasurer',
      name: 'Edward Ing',
      role: 'Treasurer',
      image: '/images/exec_treasurer.jpg',
      bio: 'Edward Ing serves as our club\'s Treasurer, managing the financial health of the UofT Triathlon Club with precision and care. With a background in finance and a passion for triathlon, Edward ensures that club resources are allocated effectively to benefit all members.'
    },
    'secretary': {
      id: 'secretary',
      name: 'Lauren Williams',
      role: 'Secretary',
      image: '',
      bio: 'Lauren Williams is our club Secretary, responsible for maintaining clear communication and record-keeping within the club. With excellent organizational skills and attention to detail, Lauren ensures that important information reaches all members and that club activities are well-documented.'
    },
    'social-coordinator': {
      id: 'social-coordinator',
      name: 'Katy Tiper',
      role: 'Social Coordinator/Recruitment',
      image: '/images/team-photo4.jpg',
      bio: 'Katy Tiper serves as our Social Coordinator and Recruitment specialist, bringing energy and creativity to building our club community. With a natural ability to connect people and organize engaging events, Katy plays a vital role in making our club welcoming to new and existing members.'
    },
    'social-media': {
      id: 'social-media',
      name: 'Paulette Dalton',
      role: 'Social Media Manager',
      image: '/images/exec_socialmedia.jpg',
      bio: 'Paulette Dalton has been a long time member of the club (confirmed by this vintage jersey!) and is returning to your exec team this year as RECRUITMENT & RACE COORDINATOR. Paulette has been doing triathlons since 2002 (yes almost 20 years) and has completed 9 Ironmans and over 20 marathons (including The Boston Marathon 10 times). Paulette is also an NCCP Level 1 Triathlon Coach. This year you\'ll find her leading the Friday evening BRICKS and at most of the track workouts and Sunday swims. ASK HER ABOUT: anything bike related (training, aerodynamics, fit, nutrition…) Paulette also manages this Instagram account so send me all your club pics to post!'
    },
    'webmaster': {
      id: 'webmaster',
      name: 'Ilan Gofman',
      role: 'Webmaster',
      image: '/images/icon.png',
      bio: 'Ilan Gofman serves as our club\'s Webmaster, managing our digital infrastructure and ensuring that our online presence effectively serves our members. With technical expertise and a commitment to user experience, Ilan maintains the systems that keep our club connected and informed.'
    },
    'run-coach': {
      id: 'run-coach',
      name: 'Paulette Dalton',
      role: 'Run Coach',
      image: '',
      bio: 'Coming soon!'
    }
  };
}

// Save team member data to file
function saveTeamMembers(teamMembers) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(teamMembers, null, 2), 'utf8');
    console.log('💾 Team members saved to file:', dataFilePath);
  } catch (error) {
    console.error('Error saving team members to file:', error);
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
    const { bio } = req.body;
    const imageFile = req.file;

    console.log('🔄 Updating profile for:', id);
    console.log('📝 New bio:', bio);
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
      bio: bio || currentMember.bio
    };

    // Handle new image if uploaded
    if (imageFile) {
      // Generate the URL for the uploaded image using the static file serving
      const imageUrl = `/uploads/team-profiles/${imageFile.filename}`;
      updatedMember.image = imageUrl;
      
      console.log('📸 New image uploaded:', imageFile.filename);
      console.log('🔗 Generated image URL:', imageUrl);
      console.log('📁 File saved to:', path.join(__dirname, '../uploads/team-profiles', imageFile.filename));
    }

    // Save the updated data
    teamMembers[id] = updatedMember;
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
