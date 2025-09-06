import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Profile.css';

const Profile = () => {
  const params = useParams();
  const { role, name } = params;
  const { currentUser, updateUser } = useAuth();
  const [teamMembers, setTeamMembers] = useState({});
  const [teamLoading, setTeamLoading] = useState(true);
  
  console.log('🔍 All URL params:', params);
  console.log('🔍 Role param:', role);
  console.log('🔍 Name param:', name);
  console.log('👤 Current user:', currentUser);
  console.log('👤 Current user ID:', currentUser?.id);
  console.log('👤 Current user profile_picture_url:', currentUser?.profile_picture_url);

  // Load team members from backend API
  useEffect(() => {
    const loadTeamMembers = async () => {
      try {
        setTeamLoading(true);
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/profiles`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch team members');
        }
        
        const data = await response.json();
        
        // Convert array to object with id as key
        const membersObject = {};
        if (Array.isArray(data.teamMembers)) {
          data.teamMembers.forEach(member => {
            let image = member.image;
            // If no image provided, or is blank/whitespace, use default blue profile image
            if (!image || (typeof image === 'string' && image.trim() === '')) {
              image = '/images/icon.png';
            }
            // Convert relative image URLs to full URLs for display
            const normalizedImage = image && image.startsWith('/uploads/')
              ? `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/..${image}`
              : image;
            
            membersObject[member.id] = {
              ...member,
              image: normalizedImage
            };
          });
          console.log('✅ Loaded team members:', membersObject);
        }
        
        setTeamMembers(membersObject);
      } catch (error) {
        console.error('Error loading team members:', error);
      } finally {
        setTeamLoading(false);
      }
    };

    loadTeamMembers();
  }, []);
  
  const [editMode, setEditMode] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedImage, setEditedImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState('');

  // Check if this is a user profile page or team member page
  const isUserProfile = React.useMemo(() => {
    const result = !role;
    console.log('🧮 isUserProfile calculated:', { role, result });
    return result;
  }, [role]);
  
  // If it's a user profile, use current user data
  React.useEffect(() => {
    console.log('🔄 Profile useEffect triggered with:', {
      isUserProfile,
      currentUserId: currentUser?.id,
      role,
      currentUserName: currentUser?.name,
      currentUserProfilePicture: currentUser?.profilePictureUrl
    });
    
    if (isUserProfile && currentUser) {
      console.log('👤 Loading user profile for:', currentUser.name);
      console.log('📊 Current user data:', currentUser);
      // Ensure we always have a valid image, defaulting to the default profile image
      const profileImage = currentUser.profilePictureUrl 
        ? `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/..${currentUser.profilePictureUrl}` 
        : '/images/default_profile.png';
      
      console.log('🖼️ Profile image set to:', profileImage);
      
      setUserProfile({
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone_number || currentUser.phone || '',
        image: profileImage,
        role: currentUser.role,
        bio: currentUser.bio || '' // Include bio from currentUser
      });
      setLoading(false);
    } else if (role && teamMembers[role]) {
      // This is a team member page, use backend data
      console.log('👥 Loading team member profile for:', role);
      const member = teamMembers[role];
      setUserProfile({
        id: role,
        name: member.name,
        role: member.role,
        image: member.image || '/images/default_profile.png',
        bio: member.bio,
        email: member.email || '', // Use email from backend data
        phone: ''
      });
      setLoading(false);
    } else {
      console.log('❌ No valid profile found');
      setLoading(false);
    }
  }, [isUserProfile, currentUser, role, teamMembers]);

  // Initialize form data when userProfile changes (only for user profiles, not team members)
  React.useEffect(() => {
    console.log('📝 Form initialization useEffect triggered with:', {
      hasUserProfile: !!userProfile,
      isUserProfile,
      justSaved,
      userProfileName: userProfile?.name,
      userProfileImage: userProfile?.image
    });
    
    if (userProfile && isUserProfile && !justSaved) {
      console.log('✅ Initializing form fields with user profile data');
      setEditedName(userProfile.name || '');
      setEditedEmail(userProfile.email || '');
      setEditedPhone(userProfile.phone || '');
      setEditedBio(userProfile.bio || ''); // Initialize bio
      setEditedImage(userProfile.image || '/images/default_profile.png');
    } else {
      console.log('⏭️ Skipping form initialization:', {
        reason: !userProfile ? 'No userProfile' : !isUserProfile ? 'Not user profile' : 'Just saved'
      });
    }
  }, [userProfile, isUserProfile, justSaved]);

  const [loading, setLoading] = useState(true);

  const handleEdit = () => {
    if (!isUserProfile) return; // Only allow editing for user profiles, not team member bios
    
    setJustSaved(false); // Reset the flag when starting to edit
    setError(''); // Clear any previous errors
    setEditedName(userProfile.name || '');
    setEditedEmail(userProfile.email || '');
    setEditedPhone(userProfile.phone || '');
    setEditedBio(userProfile.bio || ''); // Set bio for editing
    setEditedImage(userProfile.image || '/images/default_profile.png');
    setEditMode(true);
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // First, update the text fields (name, email, phone)
      const profileData = {
        name: editedName,
        email: editedEmail,
        phone_number: editedPhone,
        bio: editedBio
      };

      console.log('📝 Sending profile data:', profileData);
      console.log('🔍 Data types:', {
        name: typeof editedName,
        email: typeof editedEmail,
        phone_number: typeof editedPhone
      });
      console.log('🔍 Data values:', {
        name: editedName,
        email: editedEmail,
        phone_number: editedPhone
      });

      const profileResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      if (!profileResponse.ok) {
        const errorData = await profileResponse.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      console.log('✅ Profile text fields updated successfully');

      // Then, if there's a new image, upload it separately
      let profilePictureUrl = null;
      if (editedImage && editedImage !== userProfile.image && editedImage.startsWith('blob:')) {
        console.log('🖼️ Processing new image for upload...');
        
        // Convert blob URL to file
        const response = await fetch(editedImage);
        const blob = await response.blob();
        const file = new File([blob], 'profile-image.jpg', { type: 'image/jpeg' });
        
        console.log('✅ Image file prepared:', file.name, file.size, file.type);
        
        // Upload image to separate endpoint
        const imageFormData = new FormData();
        imageFormData.append('profilePicture', file);
        
        const imageResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/users/profile-picture`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: imageFormData
        });

        if (imageResponse.ok) {
          const imageResult = await imageResponse.json();
          profilePictureUrl = imageResult.profilePictureUrl;
          console.log('✅ Profile picture uploaded successfully:', profilePictureUrl);
        } else {
          console.warn('⚠️ Failed to upload profile picture, but profile was updated');
        }
      } else {
        console.log('ℹ️ No new image to upload');
      }

      // Update local state with the new image
      let finalImage;
      if (profilePictureUrl) {
        // New image was uploaded and saved to backend
        finalImage = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/..${profilePictureUrl}`;
        console.log('🖼️ New image uploaded and saved:', finalImage);
      } else {
        // No new image, keep the current one
        finalImage = userProfile.image;
        console.log('🖼️ Keeping current image:', finalImage);
      }
      
      const updatedProfile = {
        name: editedName,
        email: editedEmail,
        phone: editedPhone,
        image: finalImage,
        bio: editedBio // Include bio in the update
      };
      
      setUserProfile(prev => ({
        ...prev,
        ...updatedProfile
      }));

      // Update the auth context so changes persist across navigation
      // Use the exact field names that the auth context expects
      const authUpdateData = {
        name: editedName,
        email: editedEmail,
        phone_number: editedPhone,  // Match the database field name
        profile_picture_url: profilePictureUrl || null,  // Use the new image URL from backend
        bio: editedBio // Include bio in the auth context update
      };
      
      console.log('🔄 Updating auth context with:', authUpdateData);
      updateUser(authUpdateData);
      
      // Also update localStorage directly to ensure persistence
      const currentStoredUser = JSON.parse(localStorage.getItem('triathlonUser') || '{}');
      const updatedStoredUser = { ...currentStoredUser, ...authUpdateData };
      localStorage.setItem('triathlonUser', JSON.stringify(updatedStoredUser));
      console.log('💾 Updated localStorage with:', updatedStoredUser);
      
      // The auth context update should automatically propagate to all components
      // that use currentUser.profile_picture_url
      console.log('✅ Profile image update complete - all components should now show the new image');
      
      // Dispatch a custom event to notify other components that the profile has been updated
      const profileUpdateEvent = new CustomEvent('profileUpdated', {
        detail: {
          userId: currentUser.id,
          newImageUrl: profilePictureUrl ? `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/..${profilePictureUrl}` : userProfile.image,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(profileUpdateEvent);
      console.log('📡 Dispatched profileUpdated event:', profileUpdateEvent.detail);
      
      // Debug: Check what the auth context now contains
      console.log('🔍 Current auth context after update:', {
        name: authUpdateData.name,
        email: authUpdateData.email,
        phone_number: authUpdateData.phone_number,
        profile_picture_url: authUpdateData.profile_picture_url
      });
      
      // Debug: Check localStorage
      const storedUser = JSON.parse(localStorage.getItem('triathlonUser') || '{}');
      console.log('💾 localStorage after update:', {
        name: storedUser.name,
        email: storedUser.email,
        phone_number: storedUser.phone_number,
        profile_picture_url: storedUser.profile_picture_url
      });

      setEditMode(false);
      setSaving(false);
      setJustSaved(true);
      setError(''); // Clear any errors on successful save
      
      // Reset the justSaved flag after a short delay
      setTimeout(() => setJustSaved(false), 100);
      
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      setError(error.message);
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    if (isUserProfile) {
      setEditedName(userProfile?.name || '');
      setEditedEmail(userProfile?.email || '');
      setEditedPhone(userProfile?.phone || '');
      setEditedBio(userProfile?.bio || ''); // Reset bio on cancel
      setEditedImage(userProfile?.image || '/images/default_profile.png');
    }
  };

  if (loading || teamLoading) {
    return (
      <div className="profile-container">
        <div className="container">
          <div className="loading-state">
            <h2>Loading profile...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="profile-container">
        <div className="container">
          <div className="error-state">
            <h2>Profile Not Found</h2>
            <p>Sorry, we couldn't find the profile you're looking for.</p>
            <Link to="/coaches-exec" className="back-link">← Back to Team</Link>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="profile-container">
      <div className="container">
        {isUserProfile ? (
          <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>
        ) : (
          <Link to="/coaches-exec" className="back-link">← Back to Team</Link>
        )}
        
        <div className="profile-content">
          <div className="profile-image-section">
            <img 
              src={editMode ? (editedImage || userProfile.image || '/images/default_profile.png') : (userProfile.image || '/images/default_profile.png')} 
              alt={`${userProfile.name} - ${userProfile.role}`}
              className="profile-image"
              onError={(e) => {
                console.error('❌ Image failed to load:', e.target.src);
                console.log('🔄 Falling back to default profile image');
                e.target.src = '/images/default_profile.png';
              }}
              onLoad={(e) => {
                const currentSrc = e.target.src;
                console.log('✅ Image loaded successfully:', currentSrc);
                if (currentSrc.includes('default_profile.png')) {
                  console.log('🖼️ Displaying default profile image');
                }
              }}
            />
          </div>
          
          <div className="profile-info-section">
            <div className="profile-header">
              <h1 className="profile-name">{userProfile.name}</h1>
              <h2 className="profile-role">{userProfile.role}</h2>
              {isUserProfile && (
                <div className="profile-actions">
                  {editMode ? (
                    <div className="edit-actions">
                      <button 
                        className="btn btn-primary" 
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-edit" 
                      onClick={handleEdit}
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {editMode ? (
              <div className="edit-form">
                <div className="image-upload-section">
                  <label htmlFor="profile-image" className="image-upload-label">
                    <div className="image-preview">
                      <img 
                        src={editedImage || userProfile.image || '/images/default_profile.png'}
                        alt={`${userProfile.name} - ${userProfile.role}`}
                        className="preview-image"
                        onError={(e) => {
                          e.target.src = '/images/default_profile.png';
                        }}
                      />
                      <div className="image-overlay">
                        <span>Click to change image</span>
                      </div>
                    </div>
                  </label>
                  <input
                    id="profile-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        console.log('📁 New image selected:', file.name, file.type, file.size);
                        const imageUrl = URL.createObjectURL(file);
                        setEditedImage(imageUrl);
                        console.log('🖼️ Preview image set to:', imageUrl);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <p className="image-upload-help">
                    Click the image above to upload a new profile picture
                  </p>
                </div>
                
                <div className="profile-edit-section">
                  <div className="form-group">
                    <label htmlFor="name-input" className="form-label">Name:</label>
                    <input
                      id="name-input"
                      type="text"
                      value={editedName}
                      onChange={(e) => {
                        setEditedName(e.target.value);
                        if (error) setError(''); // Clear error when user starts typing
                      }}
                      className="form-input"
                      placeholder="Enter your name..."
                    />
                  </div>
                  
                                    <div className="form-group">
                    <label htmlFor="email-input" className="form-label">Email:</label>
                    <input
                      id="email-input"
                      type="email"
                      value={editedEmail}
                      onChange={(e) => {
                        setEditedEmail(e.target.value);
                        if (error) setError(''); // Clear error when user starts typing
                      }}
                      className="form-input"
                      placeholder="Enter your email..."
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="phone-input" className="form-label">Phone:</label>
                    <input
                      id="phone-input"
                      type="tel"
                      value={editedPhone}
                      onChange={(e) => {
                        setEditedPhone(e.target.value);
                        if (error) setError(''); // Clear error when user starts typing
                      }}
                      className="form-input"
                      placeholder="Enter your phone number..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="bio-input" className="form-label">Bio:</label>
                    <textarea
                      id="bio-input"
                      value={editedBio}
                      onChange={(e) => {
                        setEditedBio(e.target.value);
                        if (error) setError(''); // Clear error when user starts typing
                      }}
                      className="form-input"
                      placeholder="Enter your bio..."
                    />
                  </div>
                  
 
                </div>
              </div>
            ) : (
              <div className="profile-info">
                <div className="info-item">
                  <strong>Email:</strong> {userProfile.email}
                </div>
                {userProfile.phone && (
                  <div className="info-item">
                    <strong>Phone:</strong> {userProfile.phone}
                  </div>
                )}
                {userProfile.bio && (
                  <div className="profile-bio">
                    {userProfile.bio.split('\n\n').map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

