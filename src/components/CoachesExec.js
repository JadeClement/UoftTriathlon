import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './CoachesExec.css';

const CoachesExec = () => {
  const location = useLocation();
  const [teamMembers, setTeamMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Add periodic refresh to keep data in sync
  useEffect(() => {
    if (!loading) {
      const interval = setInterval(async () => {
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
            
            // Only update if data has actually changed
            setTeamMembers(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(membersObject)) {
                console.log('🔄 Team members data updated, refreshing display');
                return membersObject;
              }
              return prev;
            });
          }
        } catch (error) {
          console.error('Error during periodic refresh:', error);
        }
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [loading]);

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
                <p className="coach-name">Justin Konik</p>
                <p className="coach-bio">
                  {getBioPreview('swim-coach')}
                </p>
                <div className="coach-contact">
                  <p><strong>Contact:</strong> {teamMembers['swim-coach']?.email || 'Email not available'}</p>
                </div>
              </div>
            </Link>

            <Link to="/profile/run-coach/run-coach" className="coach-card-link">
              <div className="coach-card">
                <div className="coach-avatar">
                  <div className="coach-photo">
                    <img 
                      src={teamMembers['run-coach']?.image || "/images/icon.png"}
                      alt="Run Coach"
                    />
                  </div>
                  <span className="coach-emoji">🚴‍♂️</span>
                </div>
                <h3>Run Coach</h3>
                <p className="coach-name">{teamMembers['run-coach']?.name || 'Coach Name'}</p>
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

        {/* Executive Team Section */}
        <div className="exec-team-section">
          <h2 className="section-subtitle">Executive Team</h2>
          <div className="exec-grid">
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
                <p className="exec-name">Jade Clement</p>
                <p className="exec-bio">
                  {getBioPreview('co-president')}
                </p>
              </div>
            </Link>

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
                <p className="exec-name">Marlene Garijo</p>
                <p className="exec-bio">
                  {getBioPreview('co-president-2')}
                </p>
              </div>
            </Link>

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
                <p className="exec-name">Edward Ing</p>
                <p className="exec-bio">
                  {getBioPreview('treasurer')}
                </p>
              </div>
            </Link>

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
                <p className="exec-name">Lauren Williams</p>
                <p className="exec-bio">
                  {getBioPreview('secretary')}
                </p>
              </div>
            </Link>

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
                <p className="exec-name">Katy Tiper</p>
                <p className="exec-bio">
                  {getBioPreview('social-coordinator')}
                </p>
              </div>
            </Link>

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
                <p className="exec-name">Paulette Dalton</p>
                <p className="exec-bio">
                  {getBioPreview('social-media')}
                </p>
              </div>
            </Link>

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
                <p className="exec-name">Ilan Gofman</p>
                <p className="exec-bio">
                  {getBioPreview('webmaster')}
                </p>
              </div>
            </Link>

            <Link to="/profile/workout-coordinator/workout-coordinator" className="exec-card-link">
              <div className="exec-card">
                <div className="exec-avatar">
                  <div className="exec-photo">
                    <img 
                      src={teamMembers['workout-coordinator']?.image || "/images/icon.png"} 
                      alt="Workout/Race Coordinator"
                    />
                  </div>
                  <span className="exec-emoji">🏃‍♂️</span>
                </div>
                <h3>Workout/Race Coordinator</h3>
                <p className="exec-name">{teamMembers['workout-coordinator']?.name || 'TBD'}</p>
                <p className="exec-bio">
                  {getBioPreview('workout-coordinator')}
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Contact Section */}
        <div className="contact-section">
          <h2 className="section-subtitle">Get in Touch</h2>
          <p className="contact-info">
            For general inquiries about the club, please email <a href="mailto:info@uofttriathlon.com">info@uofttriathlon.com</a>.
          </p>
         
        </div>
      </div>
    </div>
  );
};

export default CoachesExec;

