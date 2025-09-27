import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './CoachesExec.css';

const CoachesExec = () => {
  const location = useLocation();
  const { currentUser, isAdmin, isExec } = useAuth();
  const [teamMembers, setTeamMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    bio: '',
    image: '',
    email: ''
  });
  const [saving, setSaving] = useState(false);

  // Load team members from backend API
  useEffect(() => {
    const loadTeamMembers = async () => {
      try {
        setLoading(true);
        console.log('🔄 Loading team members from:', `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/profiles`);
        
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/profiles`);
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);
        
        if (!response.ok) {
          throw new Error('Failed to fetch team members');
        }
        
        const data = await response.json();
        console.log('📊 Received data:', data);
        
        // Convert array to object with id as key
        const membersObject = {};
        if (Array.isArray(data.teamMembers)) {
          data.teamMembers.forEach(member => {
            // Normalize image: use default if missing/blank; expand relative upload paths
            let image = member.image;
            if (!image || (typeof image === 'string' && image.trim() === '')) {
              image = '/images/icon.png';
            }
            const normalizedImage = image && image.startsWith('/uploads/')
              ? `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/..${image}`
              : image;

            membersObject[member.id] = {
              ...member,
              image: normalizedImage
            };
          });
          console.log('✅ Converted', data.teamMembers.length, 'team members to object');
          console.log('🔑 Member IDs:', Object.keys(membersObject));
        } else {
          console.error('❌ Expected array but got:', typeof data.teamMembers, data.teamMembers);
        }
        
        setTeamMembers(membersObject);
        setError(null);
      } catch (error) {
        console.error('❌ Error loading team members:', error);
        setError('Failed to load team members');
      } finally {
        setLoading(false);
      }
    };

    loadTeamMembers();
  }, []);

  // Handle opening edit modal
  const handleEditClick = (memberId) => {
    const member = teamMembers[memberId];
    if (member) {
      setEditingMember(memberId);
      setEditForm({
        name: member.name || '',
        bio: member.bio || '',
        image: member.image || '',
        email: member.email || ''
      });
    }
  };

  // Handle closing edit modal
  const handleCloseEdit = () => {
    setEditingMember(null);
    setEditForm({ name: '', bio: '', image: '', email: '' });
  };

  // Handle form input changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle saving edits
  const handleSaveEdit = async () => {
    if (!editingMember) return;

    try {
      setSaving(true);
      const token = localStorage.getItem('triathlonToken');
      
      console.log('📤 Sending edit form data:', editForm);
      
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/profiles/${editingMember}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Server error:', errorData);
        throw new Error(`Failed to update profile: ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log('✅ Profile updated successfully:', result);

      // Update local state
      setTeamMembers(prev => ({
        ...prev,
        [editingMember]: {
          ...prev[editingMember],
          ...editForm
        }
      }));

      handleCloseEdit();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Refresh team members when location changes (when navigating back to this page)
  useEffect(() => {
    if (!loading) {
      const refreshTeamMembers = async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/profiles`);
          
          if (response.ok) {
            const data = await response.json();
            
            // Convert array to object with id as key
            const membersObject = {};
            if (Array.isArray(data.teamMembers)) {
              data.teamMembers.forEach(member => {
                let image = member.image;
                if (!image || (typeof image === 'string' && image.trim() === '')) {
                  image = '/images/icon.png';
                }
                const normalizedImage = image && image.startsWith('/uploads/')
                  ? `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/..${image}`
                  : image;
                membersObject[member.id] = {
                  ...member,
                  image: normalizedImage
                };
              });
            }
            
            setTeamMembers(membersObject);
          }
        } catch (error) {
          console.error('Error refreshing team members:', error);
        }
      };

      refreshTeamMembers();
    }
  }, [location.pathname, loading]);

  // Helper function to get bio preview
  const getBioPreview = (memberId) => {
    const member = teamMembers[memberId];
    if (member && member.bio) {
      // Get first 120 characters and add ellipsis if longer
      return member.bio.length > 120 ? member.bio.substring(0, 120) + '...' : member.bio;
    }
    return 'Bio coming soon...';
  };

  // Note: Removed periodic refresh as it was causing profile edits to revert
  // The data is now only refreshed on component mount and location changes

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
        
        {/* Coaches Section */}
        <div className="coaches-section">
          <h2 className="section-subtitle">Our Coaches</h2>
          <div className="coaches-grid">
            <div className="coach-card-container">
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button 
                  className="edit-button"
                  onClick={() => handleEditClick('swim-coach')}
                  title="Edit profile"
                >
                  ✏️
                </button>
              )}
              <Link to="/profile/swim-coach/justin-konik" className="coach-card-link">
                <div className="coach-card">
                  <div className="coach-avatar">
                    <div className="coach-photo">
                      <img 
                        src={teamMembers['swim-coach']?.image || "/images/icon.png"} 
                        alt={`${teamMembers['swim-coach']?.name || 'Coach Name'} - Swim Coach`}
                      />
                    </div>
                    <span className="coach-emoji">🏊‍♂️</span>
                  </div>
                  <h3>Swim Coach</h3>
                  <p className="coach-name">{teamMembers['swim-coach']?.name || 'Coach Name'}</p>
                  {teamMembers['swim-coach']?.email && (
                    <p className="coach-email">{teamMembers['swim-coach']?.email}</p>
                  )}
                  <p className="coach-bio">
                    {getBioPreview('swim-coach')}
                  </p>
                  <div className="coach-contact">
                    <p><strong>Contact:</strong> {teamMembers['swim-coach']?.email || 'Email not available'}</p>
                  </div>
                </div>
              </Link>
            </div>

            <div className="coach-card-container">
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button 
                  className="edit-button"
                  onClick={() => handleEditClick('run-coach')}
                  title="Edit profile"
                >
                  ✏️
                </button>
              )}
              <Link to="/profile/run-coach/run-coach" className="coach-card-link">
                <div className="coach-card">
                  <div className="coach-avatar">
                    <div className="coach-photo">
                      <img 
                        src={teamMembers['run-coach']?.image || "/images/icon.png"}
                        alt={`${teamMembers['run-coach']?.name || 'Coach Name'} - Run Coach`}
                      />
                    </div>
                    <span className="coach-emoji">🏃‍♂️</span>
                  </div>
                  <h3>Run Coach</h3>
                  <p className="coach-name">{teamMembers['run-coach']?.name || 'Coach Name'}</p>
                  {teamMembers['run-coach']?.email && (
                    <p className="coach-email">{teamMembers['run-coach']?.email}</p>
                  )}
                  <p className="coach-bio">
                    {getBioPreview('run-coach')}
                  </p>
                  <div className="coach-contact">
                    <p><strong>Contact:</strong> {teamMembers['run-coach']?.email || 'Email not available'}</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Executive Team Section */}
        <div className="exec-team-section">
          <h2 className="section-subtitle">Executive Team</h2>
          <div className="exec-grid">
            <div className="exec-card-container">
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button 
                  className="edit-button"
                  onClick={() => handleEditClick('co-president')}
                  title="Edit profile"
                >
                  ✏️
                </button>
              )}
              <Link to="/profile/co-president/jade-clement" className="exec-card-link">
                <div className="exec-card">
                  <div className="exec-avatar">
                    <div className="exec-photo">
                      <img 
                        src={teamMembers['co-president']?.image || "/images/icon.png"} 
                        alt={`${teamMembers['co-president']?.name || 'Co-President'} - Co-President`}
                      />
                    </div>
                    <span className="exec-emoji">👑</span>
                  </div>
                  <h3>Co-President</h3>
                  <p className="exec-name">{teamMembers['co-president']?.name || 'Co-President'}</p>
                  {teamMembers['co-president']?.email && (
                    <p className="exec-email">{teamMembers['co-president']?.email}</p>
                  )}
                  <p className="exec-bio">
                    {getBioPreview('co-president')}
                  </p>
                </div>
              </Link>
            </div>

            <div className="exec-card-container">
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button 
                  className="edit-button"
                  onClick={() => handleEditClick('co-president-2')}
                  title="Edit profile"
                >
                  ✏️
                </button>
              )}
              <Link to="/profile/co-president-2/marlene-garijo" className="exec-card-link">
                <div className="exec-card">
                  <div className="exec-avatar">
                    <div className="exec-photo">
                      <img 
                        src={teamMembers['co-president-2']?.image || "/images/icon.png"} 
                        alt={`${teamMembers['co-president-2']?.name || 'Co-President'} - Co-President`}
                      />
                    </div>
                    <span className="exec-emoji">👑</span>
                  </div>
                  <h3>Co-President</h3>
                  <p className="exec-name">{teamMembers['co-president-2']?.name || 'Co-President'}</p>
                  {teamMembers['co-president-2']?.email && (
                    <p className="exec-email">{teamMembers['co-president-2']?.email}</p>
                  )}
                  <p className="exec-bio">
                    {getBioPreview('co-president-2')}
                  </p>
                </div>
              </Link>
            </div>

            <div className="exec-card-container">
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button 
                  className="edit-button"
                  onClick={() => handleEditClick('treasurer')}
                  title="Edit profile"
                >
                  ✏️
                </button>
              )}
              <Link to="/profile/treasurer/edward-ing" className="exec-card-link">
                <div className="exec-card">
                  <div className="exec-avatar">
                    <div className="exec-photo">
                      <img 
                        src={teamMembers['treasurer']?.image || "/images/icon.png"} 
                        alt={`${teamMembers['treasurer']?.name || 'Treasurer'} - Treasurer`}
                      />
                    </div>
                    <span className="exec-emoji">💰</span>
                  </div>
                  <h3>Treasurer</h3>
                  <p className="exec-name">{teamMembers['treasurer']?.name || 'Treasurer'}</p>
                  {teamMembers['treasurer']?.email && (
                    <p className="exec-email">{teamMembers['treasurer']?.email}</p>
                  )}
                  <p className="exec-bio">
                    {getBioPreview('treasurer')}
                  </p>
                </div>
              </Link>
            </div>

            <div className="exec-card-container">
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button 
                  className="edit-button"
                  onClick={() => handleEditClick('secretary')}
                  title="Edit profile"
                >
                  ✏️
                </button>
              )}
              <Link to="/profile/secretary/lauren-williams" className="exec-card-link">
                <div className="exec-card">
                  <div className="exec-avatar">
                    <div className="exec-photo">
                      <img 
                        src={teamMembers['secretary']?.image || "/images/icon.png"} 
                        alt={`${teamMembers['secretary']?.name || 'Secretary'} - Secretary`}
                      />
                    </div>
                    <span className="exec-emoji">📝</span>
                  </div>
                  <h3>Secretary</h3>
                  <p className="exec-name">{teamMembers['secretary']?.name || 'Secretary'}</p>
                  {teamMembers['secretary']?.email && (
                    <p className="exec-email">{teamMembers['secretary']?.email}</p>
                  )}
                  <p className="exec-bio">
                    {getBioPreview('secretary')}
                  </p>
                </div>
              </Link>
            </div>

            <div className="exec-card-container">
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button 
                  className="edit-button"
                  onClick={() => handleEditClick('social-coordinator')}
                  title="Edit profile"
                >
                  ✏️
                </button>
              )}
              <Link to="/profile/social-coordinator/katy-tiper" className="exec-card-link">
                <div className="exec-card">
                  <div className="exec-avatar">
                    <div className="exec-photo">
                      <img 
                        src={teamMembers['social-coordinator']?.image || "/images/icon.png"} 
                        alt={`${teamMembers['social-coordinator']?.name || 'Social Coordinator'} - Social Coordinator/Recruitment`}
                      />
                    </div>
                    <span className="exec-emoji">🎉</span>
                  </div>
                  <h3>Social Coordinator/Recruitment</h3>
                  <p className="exec-name">{teamMembers['social-coordinator']?.name || 'Social Coordinator'}</p>
                  {teamMembers['social-coordinator']?.email && (
                    <p className="exec-email">{teamMembers['social-coordinator']?.email}</p>
                  )}
                  <p className="exec-bio">
                    {getBioPreview('social-coordinator')}
                  </p>
                </div>
              </Link>
            </div>

            <div className="exec-card-container">
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button 
                  className="edit-button"
                  onClick={() => handleEditClick('social-media')}
                  title="Edit profile"
                >
                  ✏️
                </button>
              )}
              <Link to="/profile/social-media/paulette-dalton" className="exec-card-link">
                <div className="exec-card">
                  <div className="exec-avatar">
                    <div className="exec-photo">
                      <img 
                        src={teamMembers['social-media']?.image || "/images/icon.png"} 
                        alt={`${teamMembers['social-media']?.name || 'Social Media Manager'} - Social Media Manager`}
                      />
                    </div>
                    <span className="exec-emoji">📱</span>
                  </div>
                  <h3>Social Media Manager</h3>
                  <p className="exec-name">{teamMembers['social-media']?.name || 'Social Media Manager'}</p>
                  {teamMembers['social-media']?.email && (
                    <p className="exec-email">{teamMembers['social-media']?.email}</p>
                  )}
                  <p className="exec-bio">
                    {getBioPreview('social-media')}
                  </p>
                </div>
              </Link>
            </div>

            <div className="exec-card-container">
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button 
                  className="edit-button"
                  onClick={() => handleEditClick('webmaster')}
                  title="Edit profile"
                >
                  ✏️
                </button>
              )}
              <Link to="/profile/webmaster/ilan-gofman" className="exec-card-link">
                <div className="exec-card">
                  <div className="exec-avatar">
                    <div className="exec-photo">
                      <img 
                        src={teamMembers['webmaster']?.image || "/images/icon.png"} 
                        alt={`${teamMembers['webmaster']?.name || 'Webmaster'} - Webmaster`}
                      />
                    </div>
                    <span className="exec-emoji">💻</span>
                  </div>
                  <h3>Webmaster</h3>
                  <p className="exec-name">{teamMembers['webmaster']?.name || 'Webmaster'}</p>
                  {teamMembers['webmaster']?.email && (
                    <p className="exec-email">{teamMembers['webmaster']?.email}</p>
                  )}
                  <p className="exec-bio">
                    {getBioPreview('webmaster')}
                  </p>
                </div>
              </Link>
            </div>

            <div className="exec-card-container">
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button 
                  className="edit-button"
                  onClick={() => handleEditClick('workout-coordinator')}
                  title="Edit profile"
                >
                  ✏️
                </button>
              )}
              <Link to="/profile/workout-coordinator/workout-coordinator" className="exec-card-link">
                <div className="exec-card">
                  <div className="exec-avatar">
                    <div className="exec-photo">
                      <img 
                        src={teamMembers['workout-coordinator']?.image || "/images/icon.png"} 
                        alt={`${teamMembers['workout-coordinator']?.name || 'Workout/Race Coordinator'} - Workout/Race Coordinator`}
                      />
                    </div>
                    <span className="exec-emoji">🏃‍♂️</span>
                  </div>
                  <h3>Workout/Race Coordinator</h3>
                  <p className="exec-name">{teamMembers['workout-coordinator']?.name || 'TBD'}</p>
                  {teamMembers['workout-coordinator']?.email && (
                    <p className="exec-email">{teamMembers['workout-coordinator']?.email}</p>
                  )}
                  <p className="exec-bio">
                    {getBioPreview('workout-coordinator')}
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="contact-section">
          <h2 className="section-subtitle">Get in Touch</h2>
          <p className="contact-info">
            For general inquiries about the club, please email <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>.
          </p>
         
        </div>
      </div>

      {/* Edit Modal */}
      {editingMember && (isAdmin(currentUser) || isExec(currentUser)) && (
        <div className="edit-modal-overlay" onClick={handleCloseEdit}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>Edit Profile</h3>
              <button className="close-button" onClick={handleCloseEdit}>×</button>
            </div>
            <div className="edit-modal-body">
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
                <label htmlFor="image">Image URL:</label>
                <input
                  type="url"
                  id="image"
                  name="image"
                  value={editForm.image}
                  onChange={handleEditChange}
                  placeholder="Enter image URL"
                />
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
    </div>
  );
};

export default CoachesExec;

