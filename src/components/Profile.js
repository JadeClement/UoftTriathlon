import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';
import { getApiBaseUrl } from '../utils/apiConfig';
import { validatePhoneNumber, formatPhoneNumber, formatPhoneNumberInput } from '../utils/phoneUtils';
import './Profile.css';

const DEFAULT_PROFILE_IMAGE = '/images/default_profile.png';

const Profile = () => {
  const params = useParams();
  const { role, name } = params;
  const { currentUser, updateUser, isMember, refreshUserData } = useAuth();
  const [teamMembers, setTeamMembers] = useState({});
  const [teamLoading, setTeamLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedJoinedYear, setEditedJoinedYear] = useState('');
  const [editedEndYear, setEditedEndYear] = useState('');
  const [editedImage, setEditedImage] = useState('');
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const profileImageInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Membership + receipt state (own profile only)
  const [membership, setMembership] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [availableTerms, setAvailableTerms] = useState([]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptTermId, setReceiptTermId] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [receiptSuccess, setReceiptSuccess] = useState('');
  const receiptFileInputRef = useRef(null);
  const API_BASE = getApiBaseUrl();
  
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
        const response = await fetch(`${getApiBaseUrl()}/profiles`);
        
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
              ? `${getApiBaseUrl()}/..${image}`
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

  useEffect(() => {
    if (isUserProfile && currentUser?.id) {
      refreshUserData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh once when opening own profile
  }, [isUserProfile, currentUser?.id]);
  
  const handlePauseAccount = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        setError('Not authenticated');
        return;
      }
      const resp = await fetch(`${getApiBaseUrl()}/users/profile/pause`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
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
      const resp = await fetch(`${getApiBaseUrl()}/users/profile`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
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

  const loadMembershipData = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) return;
      const headers = { 'Authorization': `Bearer ${token}` };

      const [profileRes, receiptsRes, termsRes] = await Promise.all([
        fetch(`${API_BASE}/users/profile`, { headers }),
        fetch(`${API_BASE}/users/profile/receipts`, { headers }),
        fetch(`${API_BASE}/users/terms`, { headers }),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setMembership(data.user || null);
      }
      if (receiptsRes.ok) {
        const data = await receiptsRes.json();
        setReceipts(data.receipts || []);
      }
      if (termsRes.ok) {
        const data = await termsRes.json();
        setAvailableTerms(data.terms || []);
      }
    } catch (err) {
      console.error('Error loading membership data:', err);
    }
  }, [API_BASE]);

  useEffect(() => {
    if (isUserProfile && currentUser?.id) {
      loadMembershipData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserProfile, currentUser?.id]);

  const handleReceiptUpload = async () => {
    setReceiptError('');
    setReceiptSuccess('');
    if (!receiptFile) {
      setReceiptError('Please choose a receipt file to upload.');
      return;
    }
    setUploadingReceipt(true);
    try {
      const token = localStorage.getItem('triathlonToken');
      const formData = new FormData();
      formData.append('receipt', receiptFile);
      if (receiptTermId) formData.append('term_id', receiptTermId);

      const resp = await fetch(`${API_BASE}/users/profile/receipt`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();
      if (resp.ok) {
        setReceiptSuccess('Receipt submitted! An exec will review it shortly and activate your membership.');
        setReceiptFile(null);
        setReceiptTermId('');
        if (receiptFileInputRef.current) receiptFileInputRef.current.value = '';
        await loadMembershipData();
        window.dispatchEvent(new Event('receiptsUpdated'));
      } else {
        setReceiptError(data.error || 'Failed to upload receipt');
      }
    } catch (err) {
      console.error('Receipt upload error:', err);
      setReceiptError(err.message || 'Failed to upload receipt');
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Phone number formatting functions (same as Login.js)
  const handlePhoneNumberChange = (e) => {
    const formatted = formatPhoneNumberInput(e.target.value);
    if (formatted !== null) {
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
          profileImage = `${getApiBaseUrl()}/..${profilePictureUrl}`;
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
      
      const calendarYear = new Date().getFullYear();
      const yearFromAccount = currentUser.created_at
        ? new Date(currentUser.created_at).getFullYear()
        : calendarYear;
      const joinedYear = currentUser.joined_year ?? yearFromAccount;
      const endYear = currentUser.end_year ?? calendarYear;

      setUserProfile({
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone_number || currentUser.phone || currentUser.phoneNumber || '',
        image: profileImage,
        role: currentUser.role,
        bio: currentUser.bio || '',
        joined_year: joinedYear,
        end_year: endYear
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
      setEditedBio(userProfile.bio || '');
      const y = new Date().getFullYear();
      setEditedJoinedYear(String(userProfile.joined_year ?? y));
      setEditedEndYear(String(userProfile.end_year ?? y));
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
    setRemoveProfileImage(false);
    setEditedName(userProfile.name || '');
    setEditedEmail(userProfile.email || '');
    setEditedPhone(userProfile.phone || '');
    setEditedBio(userProfile.bio || '');
    const y = new Date().getFullYear();
    setEditedJoinedYear(String(userProfile.joined_year ?? y));
    setEditedEndYear(String(userProfile.end_year ?? y));
    setEditedImage(userProfile.image || DEFAULT_PROFILE_IMAGE);
    setEditMode(true);
    setShowEditModal(true);
  };

  const userHasSavedProfilePhoto = Boolean(
    currentUser?.profile_picture_url || currentUser?.profilePictureUrl
  );

  const showRemovePhotoButton =
    !removeProfileImage &&
    (userHasSavedProfilePhoto || (editedImage && editedImage.startsWith('blob:')));

  const handleRemovePhoto = () => {
    if (editedImage && editedImage.startsWith('blob:')) {
      URL.revokeObjectURL(editedImage);
    }
    if (profileImageInputRef.current) {
      profileImageInputRef.current.value = '';
    }
    setEditedImage(DEFAULT_PROFILE_IMAGE);
    setRemoveProfileImage(userHasSavedProfilePhoto);
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

      const jy = parseInt(editedJoinedYear, 10);
      const ey = parseInt(editedEndYear, 10);
      if (Number.isNaN(jy) || Number.isNaN(ey) || jy < 1990 || jy > 2100 || ey < 1990 || ey > 2100 || jy > ey) {
        setError('Please enter valid years (1990–2100, with joined year on or before end year).');
        setSaving(false);
        return;
      }

      // First, update the text fields (name, email, phone)
      const profileData = {
        name: editedName,
        email: editedEmail,
        phone_number: editedPhone?.trim()
          ? formatPhoneNumber(editedPhone)
          : null,
        bio: editedBio,
        joined_year: jy,
        end_year: ey
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

      const profileResponse = await fetch(`${getApiBaseUrl()}/users/profile`, {
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

      // Then handle profile picture changes
      let profilePictureUrl = null;
      console.log('🔍 CHECKING FOR IMAGE CHANGES:');
      console.log('🔍 editedImage:', editedImage);
      console.log('🔍 removeProfileImage:', removeProfileImage);

      if (removeProfileImage) {
        const deleteResponse = await fetch(`${getApiBaseUrl()}/users/profile-picture`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          throw new Error(errorText || 'Failed to remove profile picture');
        }

        console.log('✅ Profile picture removed successfully');
      } else if (editedImage && editedImage !== userProfile.image && editedImage.startsWith('blob:')) {
        console.log('🖼️ Processing new image for upload...');
        
        // Convert blob URL to file
        const response = await fetch(editedImage);
        const blob = await response.blob();
        const file = new File([blob], 'profile-image.jpg', { type: 'image/jpeg' });
        
        console.log('✅ Image file prepared:', file.name, file.size, file.type);
        
        // Upload image to separate endpoint
        const imageFormData = new FormData();
        imageFormData.append('profilePicture', file);
        
        const imageResponse = await fetch(`${getApiBaseUrl()}/users/profile-picture`, {
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
          throw new Error(errorText || 'Failed to upload profile picture');
        }
      } else {
        console.log('ℹ️ No image changes to apply');
      }

      // Update local state with the new image
      let finalImage;
      console.log('🔍 DETERMINING FINAL IMAGE:');
      console.log('🔍 profilePictureUrl:', profilePictureUrl);
      
      if (removeProfileImage) {
        finalImage = DEFAULT_PROFILE_IMAGE;
        console.log('✅ Using default image after removal');
      } else if (profilePictureUrl) {
        // If backend returned absolute URL (e.g., S3), use it as-is
        if (/^https?:\/\//i.test(profilePictureUrl)) {
          finalImage = profilePictureUrl;
        } else {
          // Relative path -> prefix with API host once
          const apiBase = getApiBaseUrl();
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
        bio: editedBio,
        joined_year: jy,
        end_year: ey
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
        phone_number: editedPhone?.trim()
          ? formatPhoneNumber(editedPhone)
          : null,
        bio: editedBio,
        joined_year: jy,
        end_year: ey
      };
      
      // Always update profile picture fields when changed
      if (removeProfileImage) {
        authUpdateData.profile_picture_url = null;
        authUpdateData.profilePictureUrl = null;
      } else if (profilePictureUrl) {
        authUpdateData.profile_picture_url = profilePictureUrl;
        authUpdateData.profilePictureUrl = profilePictureUrl;
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
      setRemoveProfileImage(false);
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
    setRemoveProfileImage(false);
    if (isUserProfile) {
      setEditedName(userProfile?.name || '');
      setEditedEmail(userProfile?.email || '');
      setEditedPhone(userProfile?.phone || '');
      setEditedBio(userProfile?.bio || '');
      const y = new Date().getFullYear();
      setEditedJoinedYear(String(userProfile?.joined_year ?? y));
      setEditedEndYear(String(userProfile?.end_year ?? y));
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

  const renderProfileToolbar = () => (
    <>
      {currentUser && isMember(currentUser) && (
        <Link to="/results" className="btn btn-secondary">
          View Your Results
        </Link>
      )}
      <button
        type="button"
        className="btn btn-edit btn-edit-icon"
        onClick={handleEdit}
        aria-label="Edit Profile"
      >
        ✏️
      </button>
    </>
  );

  const MEMBERSHIP_STATUS_META = {
    active: { label: 'Active', className: 'active', icon: '✅' },
    expiring_soon: { label: 'Expiring soon', className: 'expiring_soon', icon: '⏳' },
    expired: { label: 'Expired', className: 'expired', icon: '⚠️' },
    pending_review: { label: 'Receipt under review', className: 'pending_review', icon: '🧾' },
    not_member: { label: 'Not an active member', className: 'not_member', icon: '❌' },
  };

  const formatDate = (d) => {
    if (!d) return '';
    try {
      return new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (_) {
      return String(d);
    }
  };

  const renderMembershipCard = () => {
    if (!membership) return null;

    const status = membership.membership_status || 'not_member';
    const meta = MEMBERSHIP_STATUS_META[status] || MEMBERSHIP_STATUS_META.not_member;
    const hasPending = status === 'pending_review';
    // Show the upload widget for anyone not currently in good standing.
    const canUpload = !hasPending && ['not_member', 'expired', 'expiring_soon'].includes(status);

    return (
      <div className="membership-card">
        <div className="membership-card-header">
          <h2>Membership</h2>
          <span className={`membership-status ${meta.className}`}>
            {meta.icon} {meta.label}
          </span>
        </div>

        <div className="membership-details">
          {membership.term_label && (
            <div className="info-item"><strong>{status === 'expired' ? 'Latest Term:' : 'Term:'}</strong> {membership.term_label}</div>
          )}
          {membership.term_end_date && (
            <div className="info-item">
              <strong>{status === 'expired' ? 'Expired on:' : 'Valid until:'}</strong> {formatDate(membership.term_end_date)}
            </div>
          )}
          {status === 'active' && !membership.term_end_date && membership.role !== 'member' && (
            <div className="info-item">Your access does not expire.</div>
          )}
        </div>

        {hasPending && (
          <div className="membership-note membership-note--info">
            🧾 Your payment receipt has been submitted and is awaiting review by an exec. You'll get an email once it's approved.
          </div>
        )}

        {canUpload && (
          <div className="receipt-upload">
            <h3>
              {status === 'expired' ? 'Renew your membership'
                : status === 'expiring_soon' ? 'Renew for the next term'
                : 'Activate your membership'}
            </h3>
            <p className="receipt-upload-help">
              Pay your membership fee, then upload your payment receipt (image or PDF) here. An exec will review it and activate your account—no need to email it.
            </p>

            {receiptError && <div className="error-message">{receiptError}</div>}
            {receiptSuccess && <div className="success-message">{receiptSuccess}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="receipt-term-select">Term you're paying for:</label>
              <select
                id="receipt-term-select"
                className="form-input"
                value={receiptTermId}
                onChange={(e) => setReceiptTermId(e.target.value)}
              >
                <option value="">Select a term…</option>
                {availableTerms.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              {availableTerms.length === 0 && (
                <small>No terms are open yet. You can still upload; an exec will assign the term.</small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="receipt-file-input">Receipt file (image or PDF):</label>
              <input
                id="receipt-file-input"
                ref={receiptFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="form-input"
                onChange={(e) => {
                  setReceiptError('');
                  setReceiptFile(e.target.files[0] || null);
                }}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleReceiptUpload}
              disabled={uploadingReceipt}
            >
              {uploadingReceipt ? 'Uploading…' : 'Submit Receipt'}
            </button>
          </div>
        )}

        {receipts.length > 0 && (
          <div className="receipt-history">
            <h3>Your receipts</h3>
            <ul>
              {receipts.map((r) => (
                <li key={r.id} className="receipt-history-item">
                  <span className={`receipt-status ${r.status}`}>{r.status.replace('_', ' ')}</span>
                  <span className="receipt-history-meta">
                    {r.term_label ? `${r.term_label} · ` : ''}{formatDate(r.uploaded_at)}
                    {' · '}
                    <a href={r.file_url && r.file_url.startsWith('/') ? `${API_BASE.replace(/\/?api$/i, '')}${r.file_url}` : r.file_url} target="_blank" rel="noopener noreferrer">view</a>
                  </span>
                  {r.status === 'rejected' && r.review_notes && (
                    <span className="receipt-history-reason">Reason: {r.review_notes}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="profile-container">
      <div className="container">
        <div className="profile-top-bar">
          {isUserProfile ? (
            <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>
          ) : (
            <Link to="/coaches-exec" className="back-link">← Back to Team</Link>
          )}
        </div>
        
        <div className="profile-content">
          {isUserProfile && (
            <div className="profile-content-toolbar profile-content-toolbar--top">
              {renderProfileToolbar()}
            </div>
          )}
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
              <h2 className="profile-role">
                {isUserProfile ? `status: ${userProfile.role}` : userProfile.role}
              </h2>
              {isUserProfile && userProfile.joined_year != null && userProfile.end_year != null && (
                <p className="profile-years">
                  {userProfile.joined_year}–{userProfile.end_year}
                </p>
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
              {isUserProfile && (
                <div className="profile-content-toolbar profile-content-toolbar--inline">
                  {renderProfileToolbar()}
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

        {isUserProfile && renderMembershipCard()}

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
                    ref={profileImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        console.log('📁 New image selected:', file.name, file.type, file.size);
                        const imageUrl = URL.createObjectURL(file);
                        setRemoveProfileImage(false);
                        setEditedImage(imageUrl);
                        console.log('🖼️ Preview image set to:', imageUrl);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <p className="image-upload-help">
                    Click the image above to upload a new profile picture
                  </p>
                  {showRemovePhotoButton && (
                    <button
                      type="button"
                      className="btn btn-remove-photo"
                      onClick={handleRemovePhoto}
                    >
                      Remove Photo
                    </button>
                  )}
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

                  <div className="profile-years-edit-row">
                    <div className="form-group">
                      <label htmlFor="joined-year-input" className="form-label">Joined year:</label>
                      <input
                        id="joined-year-input"
                        type="number"
                        min={1990}
                        max={2100}
                        value={editedJoinedYear}
                        onChange={(e) => {
                          setEditedJoinedYear(e.target.value);
                          if (error) setError('');
                        }}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="end-year-input" className="form-label">End year:</label>
                      <input
                        id="end-year-input"
                        type="number"
                        min={1990}
                        max={2100}
                        value={editedEndYear}
                        onChange={(e) => {
                          setEditedEndYear(e.target.value);
                          if (error) setError('');
                        }}
                        className="form-input"
                      />
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
                        This will move your account to pending status. Your data will be preserved, but you&apos;ll need to be approved again to regain access.
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
                        This will permanently remove your account and all associated data. To regain access, you&apos;ll need to create a new account.
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
                Are you sure you want to permanently delete your account? All details, signups, and associated data will be permanently removed. If you want access again, you&apos;ll need to create a new account.
              </p>
              <p style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', color: '#0369a1' }}>
                <strong>Instead of deleting, you can pause your account</strong> to preserve all your progress and data. You&apos;ll need to be approved again to regain access, but nothing will be lost.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                <button className="btn btn-secondary" onClick={handlePauseAccount} disabled={saving}>
                  Pause Account Instead
                </button>
                <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={saving}>
                  Delete Permanently
                </button>
                <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={saving}>
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

