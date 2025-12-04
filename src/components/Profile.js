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
  
  // Results section state
  const [userRecords, setUserRecords] = useState([]);
  const [testEvents, setTestEvents] = useState([]);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [recordForm, setRecordForm] = useState({
    test_event_id: '',
    result: '',
    description: ''
  });
  const [resultsPublic, setResultsPublic] = useState(false); // User's privacy setting for all results
  const [loading, setLoading] = useState(true);
  
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

  // Load user's results_public setting
  useEffect(() => {
    if (!isUserProfile || !currentUser?.id) return;
    // Check both possible field names (normalized and original)
    const resultsPublicValue = currentUser.results_public || currentUser.resultsPublic || false;
    setResultsPublic(resultsPublicValue);
  }, [isUserProfile, currentUser]);

  // Load user records (only for user's own profile)
  useEffect(() => {
    const loadUserRecords = async () => {
      if (!isUserProfile || !currentUser?.id) return;
      
      try {
        const token = localStorage.getItem('triathlonToken');
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records?user_id=${currentUser.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUserRecords(data.records || []);
        }
      } catch (error) {
        console.error('Error loading user records:', error);
      }
    };

    loadUserRecords();
  }, [isUserProfile, currentUser?.id]);

  // Load test events for dropdown
  useEffect(() => {
    const loadTestEvents = async () => {
      if (!showRecordModal) return;
      
      try {
        const token = localStorage.getItem('triathlonToken');
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/test-events`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setTestEvents(data.testEvents || []);
        }
      } catch (error) {
        console.error('Error loading test events:', error);
      }
    };

    loadTestEvents();
  }, [showRecordModal]);

  // Create new record
  const createRecord = async () => {
    if (!recordForm.test_event_id) {
      setError('Please select a test event');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const selectedTestEvent = testEvents.find(te => te.id === parseInt(recordForm.test_event_id));
      
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          test_event_id: parseInt(recordForm.test_event_id),
          title: selectedTestEvent?.title || '',
          result: recordForm.result,
          notes: recordForm.description
        })
      });
      
      if (response.ok) {
        // Reload records
        const recordsResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records?user_id=${currentUser.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (recordsResponse.ok) {
          const data = await recordsResponse.json();
          setUserRecords(data.records || []);
        }
        setShowRecordModal(false);
        setEditingRecordId(null);
        setRecordForm({ test_event_id: '', result: '', description: '' });
        setError('');
      } else {
        const errorData = await response.json();
        // Check for duplicate record error
        if (errorData.error === 'duplicate_record') {
          setError(errorData.message || 'Whoops! You already have a result for this test event. Please edit that one instead.');
        } else {
          setError(errorData.error || 'Failed to create record');
        }
      }
    } catch (error) {
      console.error('Error creating record:', error);
      setError(error.message || 'Error creating record');
    }
  };

  // Update existing record
  const updateRecord = async () => {
    if (!editingRecordId) return;

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records/${editingRecordId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          result: recordForm.result,
          notes: recordForm.description
        })
      });

      if (response.ok) {
        // Reload records
        const recordsResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records?user_id=${currentUser.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (recordsResponse.ok) {
          const data = await recordsResponse.json();
          setUserRecords(data.records || []);
        }
        setShowRecordModal(false);
        setEditingRecordId(null);
        setRecordForm({ test_event_id: '', result: '', description: '' });
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update record');
      }
    } catch (error) {
      console.error('Error updating record:', error);
      setError('Error updating record');
    }
  };

  // Handle edit button click
  const handleEditRecord = (record) => {
    setEditingRecordId(record.id);
    setRecordForm({
      test_event_id: record.test_event_id.toString(),
      result: record.result || '',
      description: record.notes || record.description || ''
    });
    setShowRecordModal(true);
    setError('');
  };

  // Delete record
  const deleteRecord = async () => {
    if (!editingRecordId) return;

    if (!window.confirm('Are you sure you want to delete this result? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records/${editingRecordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Reload records
        const recordsResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records?user_id=${currentUser.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (recordsResponse.ok) {
          const data = await recordsResponse.json();
          setUserRecords(data.records || []);
        }
        setShowRecordModal(false);
        setEditingRecordId(null);
        setRecordForm({ test_event_id: '', result: '', description: '' });
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete record');
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      setError('Error deleting record');
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

        {/* Results Section - Only show for user's own profile */}
        {isUserProfile && (
          <div style={{ marginTop: '2rem', background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: '#374151' }}>Results</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={resultsPublic}
                      onChange={async (e) => {
                        const newValue = e.target.checked;
                        setResultsPublic(newValue);
                        // Save to backend
                        try {
                          const token = localStorage.getItem('triathlonToken');
                          const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/users/profile`, {
                            method: 'PUT',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              name: currentUser.name,
                              email: currentUser.email,
                              phone_number: currentUser.phone_number || currentUser.phoneNumber,
                              bio: currentUser.bio,
                              results_public: newValue
                            })
                          });
                          if (response.ok) {
                            // Update currentUser in AuthContext to persist the change
                            const updatedUser = { ...currentUser, results_public: newValue, resultsPublic: newValue };
                            updateUser(updatedUser);
                          } else {
                            // Revert on error
                            setResultsPublic(!newValue);
                            setError('Failed to update privacy setting');
                          }
                        } catch (error) {
                          console.error('Error updating privacy setting:', error);
                          setResultsPublic(!newValue);
                          setError('Error updating privacy setting');
                        }
                      }}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-label" style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {resultsPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setShowRecordModal(true);
                    setRecordForm({ test_event_id: '', result: '', description: '' });
                    setError('');
                  }}
                >
                  + New
                </button>
              </div>
            </div>
            
            {userRecords.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Title</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Sport</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Workout</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Result</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Notes</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRecords.map(record => (
                      <tr key={record.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>{record.test_event_title || record.title}</td>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                          <span className={`sport-badge ${record.test_event_sport || record.sport}`}>
                            {record.test_event_sport || record.sport}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                          {record.test_event_date ? new Date(record.test_event_date).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>{record.test_event_workout || '-'}</td>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>{record.result || '-'}</td>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>{record.notes || record.description || '-'}</td>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                          <button
                            onClick={() => handleEditRecord(record)}
                            style={{
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              padding: '0.375rem 0.75rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: 500
                            }}
                          >
                            ✏️ Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>No results yet. Click "+ New" to add your first result!</p>
            )}
          </div>
        )}

        {/* Record Modal */}
        {showRecordModal && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="modal" style={{ background: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ marginTop: 0 }}>{editingRecordId ? 'Edit Result' : 'New Result'}</h2>
              {error && (
                <div style={{ color: '#dc2626', marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', borderRadius: '4px' }}>
                  {error}
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); editingRecordId ? updateRecord() : createRecord(); }}>
                <div className="form-group">
                  <label className="form-label">Test Event:</label>
                  <select
                    value={recordForm.test_event_id}
                    onChange={(e) => {
                      setRecordForm({ ...recordForm, test_event_id: e.target.value });
                      setError('');
                    }}
                    className="form-input"
                    required
                    disabled={!!editingRecordId}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', opacity: editingRecordId ? 0.6 : 1 }}
                  >
                    <option value="">Select a test event...</option>
                    {testEvents.map(te => (
                      <option key={te.id} value={te.id}>
                        {te.title} - {te.sport} ({new Date(te.date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                  {editingRecordId && <small style={{ color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>Test event cannot be changed when editing</small>}
                </div>
                <div className="form-group">
                  <label className="form-label">Result:</label>
                  <textarea
                    value={recordForm.result}
                    onChange={(e) => {
                      setRecordForm({ ...recordForm, result: e.target.value });
                      setError('');
                    }}
                    className="form-input"
                    placeholder="e.g., 1:20, 1:18, 1:19, 1:17, 1:16"
                    rows="3"
                  />
                  <small style={{ color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>Text description of times/results</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (optional):</label>
                  <textarea
                    value={recordForm.description}
                    onChange={(e) => {
                      setRecordForm({ ...recordForm, description: e.target.value });
                      setError('');
                    }}
                    className="form-input"
                    placeholder="Additional notes..."
                    rows="3"
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                  <div>
                    {editingRecordId && (
                      <button 
                        type="button" 
                        onClick={deleteRecord}
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 500
                        }}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                    onClick={() => {
                      setShowRecordModal(false);
                      setEditingRecordId(null);
                      setRecordForm({ test_event_id: '', result: '', description: '' });
                      setError('');
                    }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingRecordId ? 'Update Result' : 'Create Result'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;

