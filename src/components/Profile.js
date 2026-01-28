import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';
import './Profile.css';
import { Capacitor } from '@capacitor/core';

const Profile = () => {
  const params = useParams();
  const { role, name } = params;
  const navigate = useNavigate();
  const { currentUser, updateUser, isMember } = useAuth();
  const [teamMembers, setTeamMembers] = useState({});
  const [teamLoading, setTeamLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedImage, setEditedImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  
  const [resultsPublic, setResultsPublic] = useState(false); // User's privacy setting for all results
  const [loading, setLoading] = useState(true);
  const isIOS = Capacitor.getPlatform && Capacitor.getPlatform() === 'ios';

  // Swipe-to-go-back gesture for coach/exec bios on iOS
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  
  
  console.log('🔍 All URL params:', params);
  console.log('🔍 Role param:', role);
  console.log('🔍 Name param:', name);
  console.log('👤 Current user:', currentUser);
  console.log('👤 Current user ID:', currentUser?.id);
  console.log('👤 Current user profile_picture_url:', currentUser?.profile_picture_url);

  // Check if this is a user profile page or team member page
  const isUserProfile = React.useMemo(() => {
    const result = !role;
    console.log('🧮 isUserProfile calculated:', { role, result });
    return result;
  }, [role]);

  const handleTouchStart = useCallback((e) => {
    // Only enable swipe back for team/coach/exec bios on iOS
    if (!isIOS || !role) return;
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }, [isIOS, role]);

  const handleTouchEnd = useCallback((e) => {
    if (!isIOS || !role) return;
    if (touchStartXRef.current == null || touchStartYRef.current == null) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    // Reset for next gesture
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Only trigger if swipe starts near left edge and is mostly horizontal
    const EDGE_THRESHOLD = 40; // px from left edge
    const SWIPE_THRESHOLD = 80; // minimum horizontal distance
    const MAX_VERTICAL_DEVIATION = 60; // allow some vertical movement

    if (touch.clientX <= 0) return;

    const startedNearEdge = (touch.clientX - deltaX) <= EDGE_THRESHOLD;
    const isHorizontal = Math.abs(deltaY) < MAX_VERTICAL_DEVIATION;
    const isRightSwipe = deltaX > SWIPE_THRESHOLD;

    if (startedNearEdge && isHorizontal && isRightSwipe) {
      navigate('/coaches-exec');
    }
  }, [isIOS, role, navigate]);

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
  
  // Load user's results_public setting (only for members)
  useEffect(() => {
    if (!isUserProfile || !currentUser?.id || !isMember(currentUser)) return;
    // Check both possible field names (normalized and original)
    const resultsPublicValue = currentUser.results_public || currentUser.resultsPublic || false;
    setResultsPublic(resultsPublicValue);
  }, [isUserProfile, currentUser, isMember]);


  const handlePauseAccount = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        setError('Not authenticated');
        return;
      }
      const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/users/profile/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await resp.json();
      if (resp.ok) {
        localStorage.removeItem('triathlonUser');
        localStorage.removeItem('triathlonToken');
        window.location.href = '/login';
      } else {
        setError(data.error || 'Failed to pause account');
      }
    } catch (err) {
      console.error('Pause account error:', err);
      setError(err.message || 'Failed to pause account');
    } finally {
      setShowPauseConfirm(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        setError('Not authenticated');
        return;
      }
      const resp = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/users/profile`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await resp.json();
      if (resp.ok) {
        localStorage.removeItem('triathlonUser');
        localStorage.removeItem('triathlonToken');
        window.location.href = '/login';
      } else {
        setError(data.error || 'Failed to delete account');
      }
    } catch (err) {
      console.error('Delete account error:', err);
      setError(err.message || 'Failed to delete account');
    } finally {
      setShowDeleteConfirm(false);
    }
  };


  // Phone number formatting functions (same as Login.js)
  const validatePhoneNumber = (phone) => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    // Check if it's 10 digits (North American format)
    return digitsOnly.length === 10;
  };

  const formatPhoneNumber = (phone) => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    return phone; // Return original if not 10 digits
  };

  const handlePhoneNumberChange = (e) => {
    const value = e.target.value;
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    if (digitsOnly.length <= 10) {
      // Format as user types
      let formatted = digitsOnly;
      if (digitsOnly.length >= 6) {
        formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
      } else if (digitsOnly.length >= 3) {
        formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
      } else if (digitsOnly.length > 0) {
        formatted = `(${digitsOnly}`;
      }
      setEditedPhone(formatted);
    }
  };
  
  // If it's a user profile, use current user data
  React.useEffect(() => {
    console.log('🔄 Profile useEffect triggered with:', {
      isUserProfile,
      currentUserId: currentUser?.id,
      role,
      currentUserName: currentUser?.name,
      currentUserProfilePicture: currentUser?.profile_picture_url
    });
    
    if (isUserProfile && currentUser) {
      console.log('👤 Loading user profile for:', currentUser.name);
      console.log('📊 Current user data:', currentUser);
      // Ensure we always have a valid image, defaulting to the default profile image
      let profileImage = '/images/default_profile.png';
      // Check both possible field names (AuthContext normalizes profile_picture_url to profilePictureUrl)
      const profilePictureUrl = currentUser.profile_picture_url || currentUser.profilePictureUrl;
      
      if (profilePictureUrl) {
        // Handle different URL formats
        if (profilePictureUrl.startsWith('/api/')) {
          // URL already includes /api/, just prepend the base URL
          profileImage = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001'}${profilePictureUrl}`;
        } else if (profilePictureUrl.startsWith('/uploads/')) {
          // URL starts with /uploads/, prepend API base URL
          profileImage = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/..${profilePictureUrl}`;
        } else if (profilePictureUrl.startsWith('http')) {
          // Full URL, use as is
          profileImage = profilePictureUrl;
        } else {
          // Fallback to default
          profileImage = '/images/default_profile.png';
        }
      }
      
      console.log('🖼️ Profile image processing:');
      console.log('  - profile_picture_url:', currentUser.profile_picture_url);
      console.log('  - profilePictureUrl:', currentUser.profilePictureUrl);
      console.log('  - Using URL:', profilePictureUrl);
      console.log('  - Final URL:', profileImage);
      
      setUserProfile({
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone_number || currentUser.phone || currentUser.phoneNumber || '',
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
    setShowEditModal(true);
  };

  const handleSave = async () => {
    console.log('🚀 STARTING PROFILE SAVE - DEBUGGING ENABLED');
    setSaving(true);
    console.log('🔄 Saving state set to true');
    
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // First, update the text fields (name, email, phone)
      const profileData = {
        name: editedName,
        email: editedEmail,
        phone_number: formatPhoneNumber(editedPhone), // Format phone number before sending
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
      console.log('🔍 CHECKING FOR NEW IMAGE:');
      console.log('🔍 editedImage:', editedImage);
      console.log('🔍 userProfile.image:', userProfile.image);
      console.log('🔍 editedImage !== userProfile.image:', editedImage !== userProfile.image);
      console.log('🔍 editedImage.startsWith("blob:"):', editedImage && editedImage.startsWith('blob:'));
      
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
          console.log('✅ Profile picture uploaded successfully!');
          console.log('✅ Backend response:', imageResult);
          console.log('✅ profilePictureUrl from backend:', profilePictureUrl);
        } else {
          const errorText = await imageResponse.text();
          console.error('❌ IMAGE UPLOAD FAILED!');
          console.error('❌ Status:', imageResponse.status);
          console.error('❌ Error:', errorText);
        }
      } else {
        console.log('ℹ️ No new image to upload');
      }

      // Update local state with the new image
      let finalImage;
      console.log('🔍 DETERMINING FINAL IMAGE:');
      console.log('🔍 profilePictureUrl:', profilePictureUrl);
      
      if (profilePictureUrl) {
        // If backend returned absolute URL (e.g., S3), use it as-is
        if (/^https?:\/\//i.test(profilePictureUrl)) {
          finalImage = profilePictureUrl;
        } else {
          // Relative path -> prefix with API host once
          const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
          const host = apiBase.replace(/\/?api$/i, '');
          finalImage = `${host}${profilePictureUrl}`;
        }
        console.log('✅ USING NEW IMAGE!');
        console.log('✅ Final constructed URL:', finalImage);
      } else {
        // No new image, keep the current one
        finalImage = userProfile.image;
        console.log('⚠️ KEEPING CURRENT IMAGE (no new upload)');
        console.log('⚠️ Current image:', finalImage);
        console.log('⚠️ No profilePictureUrl received from backend');
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
        phone_number: formatPhoneNumber(editedPhone),  // Format phone number before updating auth context
        bio: editedBio // Include bio in the auth context update
      };
      
      // Always update profile_picture_url with the backend URL (if we got a new one)
      if (profilePictureUrl) {
        authUpdateData.profile_picture_url = profilePictureUrl;
      }
      
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
          newImageUrl: finalImage,
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
      setShowEditModal(false);
      setSaving(false);
      console.log('✅ Saving state set to false - save completed');
      setJustSaved(true);
      setError(''); // Clear any errors on successful save
      
      // Reset the justSaved flag after a short delay
      setTimeout(() => setJustSaved(false), 100);
      
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      setError(error.message);
      setSaving(false);
      console.log('❌ Saving state set to false - save failed');
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setShowEditModal(false);
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
      <div
        className="profile-container"
      >
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
      <div
        className="profile-container"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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
    <div
      className="profile-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
                  <button 
                    className="btn btn-edit" 
                    onClick={handleEdit}
                  >
                    Edit Profile
                  </button>
                </div>
              )}
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
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
          </div>
        </div>

        {showEditModal && (
          <div className="modal-overlay">
            <div className="modal profile-edit-modal">
              <h2>Edit Profile</h2>
              
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
                      onChange={handlePhoneNumberChange}
                      className="form-input"
                      placeholder="(123) 456-7890"
                    />
                    {editedPhone && !validatePhoneNumber(editedPhone) && (
                      <div className="error-message">
                        Please enter a valid 10-digit phone number
                      </div>
                    )}
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
                  
                  <div className="form-group">
                    <label className="form-label">Make results public?</label>
                    <div className="toggle-wrapper">
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={resultsPublic} 
                          onChange={(e) => setResultsPublic(e.target.checked)} 
                        />
                        <span className="toggle-slider"></span>
                      </label>
                      <span className="toggle-label">
                        Allow my race results to be shown publicly on my profile
                      </span>
                    </div>
                  </div>

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

                  <div className="danger-zone">
                    <div className="danger-zone-inner">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setShowPauseConfirm(true)}
                        disabled={saving}
                        style={{ marginBottom: '1rem' }}
                      >
                        Pause Account
                      </button>
                      <p className="danger-help" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        This will move your account to pending status. Your data will be preserved, but you'll need to be approved again to regain access.
                      </p>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={saving}
                      >
                        Delete Account
                      </button>
                      <p className="danger-help">
                        This will permanently remove your account and all associated data. To regain access, you'll need to create a new account.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={showPauseConfirm}
          title="Pause Account"
          message="Are you sure you want to pause your account? Your account will be moved to pending status and you'll need to be approved again to regain access. All your data will be preserved."
          confirmText="Pause Account"
          cancelText="Cancel"
          onConfirm={handlePauseAccount}
          onCancel={() => setShowPauseConfirm(false)}
        />

        {showDeleteConfirm && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <h2>Delete Account</h2>
              <p style={{ marginBottom: '1rem' }}>
                Are you sure you want to permanently delete your account? All details, signups, and associated data will be permanently removed. If you want access again, you'll need to create a new account.
              </p>
              <p style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', color: '#0369a1' }}>
                <strong>💡 Instead of deleting, you can pause your account</strong> to preserve all your progress and data. You'll need to be approved again to regain access, but nothing will be lost.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handlePauseAccount}
                  disabled={saving}
                >
                  Pause Account Instead
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteAccount}
                  disabled={saving}
                >
                  Delete Permanently
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default Profile;

