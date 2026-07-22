import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { showError, showSuccess } from './SimpleNotification';
import './CoachesExec.css';
import { getApiBaseUrl } from '../utils/apiConfig';

const API_BASE = getApiBaseUrl();

const normalizeImageUrl = (image) => {
  let normalized = image;
  if (!normalized || (typeof normalized === 'string' && normalized.trim() === '')) {
    normalized = '/images/icon.png';
  }
  if (normalized && normalized.startsWith('/uploads/')) {
    normalized = `${API_BASE}/..${normalized}`;
  }
  return normalized;
};

const membersArrayToObject = (members) => {
  const membersObject = {};
  if (Array.isArray(members)) {
    members.forEach((member) => {
      membersObject[member.id] = {
        ...member,
        image: normalizeImageUrl(member.image)
      };
    });
  }
  return membersObject;
};

const getMembersByCategory = (members, category) =>
  Object.values(members)
    .filter((member) => member.category === category)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

const getCardTitle = (member) =>
  member.category === 'past-president'
    ? (member.profileLabel || member.role)
    : member.role;

const CoachesExec = () => {
  const location = useLocation();
  const { currentUser, isAdmin, isExec, isCoach } = useAuth();
  const isCoachOrExec = currentUser && (isAdmin(currentUser) || isExec(currentUser) || isCoach(currentUser));
  const canEditProfiles = currentUser && (isAdmin(currentUser) || isExec(currentUser));
  const canManagePositions = currentUser && isAdmin(currentUser);

  const [teamMembers, setTeamMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    bio: '',
    image: '',
    email: '',
    profileLabel: ''
  });
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [addForm, setAddForm] = useState({
    role: '',
    category: 'exec',
    emoji: '',
    name: '',
    email: '',
    profileLabel: ''
  });
  const [addingPosition, setAddingPosition] = useState(false);

  const coaches = useMemo(() => getMembersByCategory(teamMembers, 'coach'), [teamMembers]);
  const execMembers = useMemo(() => getMembersByCategory(teamMembers, 'exec'), [teamMembers]);
  const pastPresidents = useMemo(() => getMembersByCategory(teamMembers, 'past-president'), [teamMembers]);

  const loadTeamMembers = async () => {
    const response = await fetch(`${API_BASE}/profiles`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }).catch((networkError) => {
      throw new Error(`Network error: ${networkError.message || 'Failed to connect to server'}`);
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch team members: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return membersArrayToObject(data.teamMembers);
  };

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        setTeamMembers(await loadTeamMembers());
        setError(null);
      } catch (fetchError) {
        console.error('Error loading team members:', fetchError);
        setError(`Failed to load team members: ${fetchError.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadTeamMembers()
        .then(setTeamMembers)
        .catch((refreshError) => console.error('Error refreshing team members:', refreshError));
    }
  }, [location.pathname, loading]);

  const handleEditClick = (memberId) => {
    const member = teamMembers[memberId];
    if (member) {
      setEditingMember(memberId);
      setEditForm({
        name: member.name || '',
        role: member.role || '',
        bio: member.bio || '',
        image: member.image || '',
        email: member.email || '',
        profileLabel: member.profileLabel || ''
      });
      setImagePreview(member.image || '');
      setImageFile(null);
    }
  };

  const handleCloseEdit = () => {
    setEditingMember(null);
    setEditForm({ name: '', role: '', bio: '', image: '', email: '', profileLabel: '' });
    setImagePreview('');
    setImageFile(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;

    try {
      setSaving(true);
      const token = localStorage.getItem('triathlonToken');
      const formData = new FormData();
      formData.append('name', editForm.name || '');
      formData.append('bio', editForm.bio || '');
      formData.append('email', editForm.email || '');

      if (canManagePositions) {
        formData.append('role', editForm.role || '');
        if (teamMembers[editingMember]?.category === 'past-president') {
          formData.append('profileLabel', editForm.profileLabel || '');
        }
      }

      if (imageFile) {
        formData.append('image', imageFile);
      } else if (editForm.image && typeof editForm.image === 'string') {
        formData.append('image', editForm.image);
      }

      const response = await fetch(`${API_BASE}/profiles/${editingMember}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Unknown error');
      }

      const result = await response.json();
      const updatedFromServer = result.member || {};
      let normalizedImage = updatedFromServer.image;
      if (normalizedImage && normalizedImage.startsWith('/uploads/')) {
        normalizedImage = `${API_BASE}/..${normalizedImage}`;
      }

      setTeamMembers((prev) => ({
        ...prev,
        [editingMember]: {
          ...prev[editingMember],
          name: updatedFromServer.name ?? editForm.name,
          role: updatedFromServer.role ?? editForm.role,
          email: updatedFromServer.email ?? editForm.email,
          bio: updatedFromServer.bio ?? editForm.bio,
          profileLabel: updatedFromServer.profileLabel ?? editForm.profileLabel,
          image: normalizedImage || editForm.image || prev[editingMember]?.image
        }
      }));

      showSuccess('Profile updated successfully.');
      handleCloseEdit();
    } catch (saveError) {
      console.error('Error updating profile:', saveError);
      showError(saveError.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openAddPosition = (category = 'exec') => {
    setAddForm({
      role: '',
      category,
      emoji: '',
      name: '',
      email: '',
      profileLabel: ''
    });
    setShowAddPosition(true);
  };

  const handleAddPosition = async () => {
    if (!addForm.role.trim()) {
      showError('Position title is required.');
      return;
    }

    if (!addForm.name.trim()) {
      showError('Person name is required.');
      return;
    }

    try {
      setAddingPosition(true);
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE}/profiles`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(addForm)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create position');
      }

      const result = await response.json();
      const newMember = {
        ...result.member,
        image: normalizeImageUrl(result.member?.image)
      };

      setTeamMembers((prev) => ({
        ...prev,
        [newMember.id]: newMember
      }));

      showSuccess('Position added successfully.');
      setShowAddPosition(false);
      setAddForm({
        role: '',
        category: 'exec',
        emoji: '',
        name: '',
        email: '',
        profileLabel: ''
      });
    } catch (createError) {
      console.error('Error creating position:', createError);
      showError(createError.message || 'Failed to add position. Please try again.');
    } finally {
      setAddingPosition(false);
    }
  };

  const getBioPreview = (memberId) => {
    const member = teamMembers[memberId];
    if (member && member.bio) {
      return member.bio.length > 120 ? `${member.bio.substring(0, 120)}...` : member.bio;
    }
    return 'Bio coming soon...';
  };

  const renderCoachCard = (member) => (
    <div key={member.id} className="coach-card-container">
      {canEditProfiles && (
        <button
          className="edit-button"
          onClick={() => handleEditClick(member.id)}
          title="Edit profile"
        >
          ✏️
        </button>
      )}
      <Link to={`/profile/${member.id}/${member.slug || member.id}`} className="coach-card-link">
        <div className="coach-card">
          <div className="coach-avatar">
            <div className="coach-photo">
              <img
                src={member.image || '/images/icon.png'}
                alt={`${member.name || member.role} - ${member.role}`}
              />
            </div>
            <span className="coach-emoji">{member.emoji || '🏊‍♂️'}</span>
          </div>
          <h3>{member.role}</h3>
          <p className="coach-name">{member.name || member.role}</p>
          {member.email && <p className="coach-email">{member.email}</p>}
          <p className="coach-bio">{getBioPreview(member.id)}</p>
          <div className="coach-contact">
            <p><strong>Contact:</strong> {member.email || 'Email not available'}</p>
          </div>
        </div>
      </Link>
    </div>
  );

  const renderExecCard = (member) => (
    <div key={member.id} className="exec-card-container">
      {canEditProfiles && (
        <button
          className="edit-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleEditClick(member.id);
          }}
          title="Edit profile"
        >
          ✏️
        </button>
      )}
      <Link to={`/profile/${member.id}/${member.slug || member.id}`} className="exec-card-link">
        <div className="exec-card">
          <div className="exec-avatar">
            <div className="exec-photo">
              <img
                src={member.image || '/images/icon.png'}
                alt={`${member.name || member.role} - ${getCardTitle(member)}`}
              />
            </div>
            <span className="exec-emoji">{member.emoji || '👤'}</span>
          </div>
          <h3>{getCardTitle(member)}</h3>
          <p className="exec-name">{member.name || member.role}</p>
          <p className="exec-email">{member.email || '\u00A0'}</p>
          <p className="exec-bio">{getBioPreview(member.id)}</p>
        </div>
      </Link>
    </div>
  );

  const renderSectionHeader = (title, category, { secondary = false } = {}) => (
    <div className="section-header-row">
      <h2 className="section-subtitle">
        {title}
        {canManagePositions && (
          <button
            className={`add-position-button${secondary ? ' add-position-button-secondary' : ''}`}
            onClick={() => openAddPosition(category)}
            type="button"
            title={`Add ${title.toLowerCase()}`}
            aria-label={`Add ${title.toLowerCase()}`}
          >
            +
          </button>
        )}
      </h2>
    </div>
  );

  if (loading) {
    return (
      <div className="coaches-exec-container">
        <div className="container">
          <div className="loading-state">
            <h2>Loading team members...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isOffline = !navigator.onLine || /network error|load failed|failed to fetch|failed to connect/i.test(error);
    if (isCoachOrExec && isOffline) {
      return (
        <div className="coaches-exec-container">
          <div className="container">
            <div className="offline-state" style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📴</div>
              <h2 style={{ color: '#374151', marginBottom: '0.75rem' }}>You&apos;re Offline</h2>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                The Team page needs an internet connection to load. Check your connection and try again when you&apos;re back online.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => window.location.reload()}
                disabled={!navigator.onLine}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="coaches-exec-container">
        <div className="container">
          <div className="error-state">
            <h2>Error loading team members</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="coaches-exec-container">
      <div className="container">
        <h1 className="section-title">Coaches & Executive Team</h1>

        <div className="coaches-section">
          {renderSectionHeader('Our Coaches', 'coach')}
          <div className="coaches-grid">
            {coaches.map(renderCoachCard)}
          </div>
        </div>

        <div className="exec-team-section">
          {renderSectionHeader('Executive Team', 'exec')}
          <div className="exec-grid">
            {execMembers.map(renderExecCard)}
          </div>
        </div>

        {pastPresidents.length > 0 && (
          <div className="exec-team-section">
            {renderSectionHeader('Past Presidents', 'past-president', { secondary: true })}
            <div className="exec-grid">
              {pastPresidents.map(renderExecCard)}
            </div>
          </div>
        )}

        <div className="contact-section">
          <h2 className="section-subtitle">Get in Touch</h2>
          <p className="contact-info">
            For general inquiries about the club, please email <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>.
          </p>
        </div>
      </div>

      {editingMember && canEditProfiles && (
        <div className="edit-modal-overlay" onClick={handleCloseEdit}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>Edit Profile</h3>
              <button className="close-button" onClick={handleCloseEdit}>×</button>
            </div>
            <div className="edit-modal-body">
              {canManagePositions && (
                <div className="form-group">
                  <label htmlFor="role">Position Title:</label>
                  <input
                    type="text"
                    id="role"
                    name="role"
                    value={editForm.role}
                    onChange={handleEditChange}
                    placeholder="e.g. Co-President, Treasurer"
                  />
                </div>
              )}
              {canManagePositions && teamMembers[editingMember]?.category === 'past-president' && (
                <div className="form-group">
                  <label htmlFor="profileLabel">Years Label:</label>
                  <input
                    type="text"
                    id="profileLabel"
                    name="profileLabel"
                    value={editForm.profileLabel}
                    onChange={handleEditChange}
                    placeholder="e.g. 2025-26"
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="name">Name:</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  placeholder="Enter name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email:</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  placeholder="Enter email address"
                />
              </div>
              <div className="form-group">
                <label htmlFor="bio">Bio:</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={editForm.bio}
                  onChange={handleEditChange}
                  placeholder="Enter bio"
                  rows="4"
                />
              </div>
              <div className="form-group">
                <label>Photo:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                      src={imagePreview || editForm.image || '/images/default_profile.png'}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.src = '/images/default_profile.png'; }}
                    />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0];
                      if (file) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                        setEditForm((prev) => ({ ...prev, image: '' }));
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="edit-modal-footer">
              <button className="cancel-button" onClick={handleCloseEdit}>
                Cancel
              </button>
              <button
                className="save-button"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddPosition && canManagePositions && (
        <div className="edit-modal-overlay" onClick={() => setShowAddPosition(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>Add Position</h3>
              <button className="close-button" onClick={() => setShowAddPosition(false)}>×</button>
            </div>
            <div className="edit-modal-body">
              <div className="form-group">
                <label htmlFor="add-role">Position Title:</label>
                <input
                  type="text"
                  id="add-role"
                  name="role"
                  value={addForm.role}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g. Vice President, Equipment Manager"
                />
              </div>
              <div className="form-group">
                <label htmlFor="add-category">Section:</label>
                <select
                  id="add-category"
                  name="category"
                  value={addForm.category}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  <option value="exec">Executive Team</option>
                  <option value="coach">Coaches</option>
                  <option value="past-president">Past Presidents</option>
                </select>
              </div>
              {addForm.category === 'past-president' && (
                <div className="form-group">
                  <label htmlFor="add-profileLabel">Years Label:</label>
                  <input
                    type="text"
                    id="add-profileLabel"
                    name="profileLabel"
                    value={addForm.profileLabel}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, profileLabel: e.target.value }))}
                    placeholder="e.g. 2024-25"
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="add-emoji">Emoji (optional):</label>
                <input
                  type="text"
                  id="add-emoji"
                  name="emoji"
                  value={addForm.emoji}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, emoji: e.target.value }))}
                  placeholder="e.g. 👑"
                />
              </div>
              <div className="form-group">
                <label htmlFor="add-name">Person Name:</label>
                <input
                  type="text"
                  id="add-name"
                  name="name"
                  value={addForm.name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="add-email">Email (optional):</label>
                <input
                  type="email"
                  id="add-email"
                  name="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </div>
            </div>
            <div className="edit-modal-footer">
              <button className="cancel-button" onClick={() => setShowAddPosition(false)}>
                Cancel
              </button>
              <button
                className="save-button"
                onClick={handleAddPosition}
                disabled={addingPosition}
              >
                {addingPosition ? 'Adding...' : 'Add Position'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachesExec;
