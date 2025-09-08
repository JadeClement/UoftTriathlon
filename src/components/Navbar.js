import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const navigate = useNavigate();
  const { currentUser, isMember, isAdmin, logout } = useAuth();
  const profileRef = useRef(null);
  const moreRef = useRef(null);
  
  // Listen for profile updates to refresh the navbar profile image
  useEffect(() => {
    const handleProfileUpdate = (event) => {
      console.log('📡 Navbar received profileUpdated event:', event.detail);
      if (event.detail.userId === currentUser?.id) {
        setProfileImageUrl(event.detail.newImageUrl);
        console.log('🔄 Navbar profile image updated to:', event.detail.newImageUrl);
      }
    };
    
    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    // Initialize profile image URL
    if (currentUser?.profile_picture_url) {
      const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
      setProfileImageUrl(`${baseUrl.replace('/api', '')}${currentUser.profile_picture_url}`);
    }
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [currentUser?.id, currentUser?.profile_picture_url]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setIsMoreOpen(false);
  };

  const closeProfileMenu = () => {
    setIsProfileOpen(false);
  };

  const isActive = (path) => {
    return window.location.pathname === path;
  };

  // Handle clicks outside profile and more dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={closeMenu}>
          <img src="/images/icon.png" alt="UofT Triathlon Logo" className="navbar-icon" />
          <span className="logo-text">UofT Triathlon</span>
        </Link>
        
        <div className={`navbar-menu ${isOpen ? 'active' : ''}`}>
          <Link 
            to="/" 
            className={`navbar-link ${isActive('/') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Home
          </Link>
          <Link 
            to="/join-us" 
            className={`navbar-link ${isActive('/join-us') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Join Us
          </Link>

          <Link 
            to="/schedule" 
            className={`navbar-link ${isActive('/schedule') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Schedule
          </Link>

          <Link
            to="/coaches-exec"
            className={`navbar-link ${isActive('/coaches-exec') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Coaches & Exec
          </Link>

          {currentUser && isMember(currentUser) && (
            <Link 
              to="/races" 
              className={`navbar-link ${isActive('/races') ? 'active' : ''}`}
              onClick={closeMenu}
            >
              Races
            </Link>
          )}

          {/* More dropdown for extra pages */}
          <div className="navbar-link more-dropdown" ref={moreRef}>
            <button 
              className={`navbar-link as-button ${isMoreOpen ? 'active' : ''}`}
              onClick={() => setIsMoreOpen(!isMoreOpen)}
            >
              More ▾
            </button>
            {isMoreOpen && (
              <div className="more-menu">
                <Link 
                  to="/faq" 
                  className="more-item"
                  onClick={closeMenu}
                >
                  FAQ
                </Link>
                <Link 
                  to="/resources" 
                  className="more-item"
                  onClick={closeMenu}
                >
                  Resources
                </Link>
                <Link 
                  to="/team-gear" 
                  className="more-item"
                  onClick={closeMenu}
                >
                  Team Gear
                </Link>
              </div>
            )}
          </div>

          
          
          {currentUser && (
            <Link 
              to="/forum" 
              className={`navbar-link ${isActive('/forum') ? 'active' : ''}`}
              onClick={closeMenu}
            >
              Forum
            </Link>
          )}
          
          {currentUser && isAdmin(currentUser) && (
            <Link
              to="/admin"
              className={`navbar-link ${isActive('/admin') ? 'active' : ''}`}
              onClick={closeMenu}
            >
              Admin
            </Link>
          )}
          
          {currentUser ? (
            <div className="profile-dropdown" ref={profileRef}>
              <div 
                className="profile-picture-nav"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              >
                {profileImageUrl ? (
                  <img 
                    src={profileImageUrl} 
                    alt="Profile" 
                    onError={(e) => {
                      console.log('❌ Navbar profile image failed to load, falling back to default');
                      e.target.src = '/images/default_profile.png';
                    }}
                  />
                ) : (
                  <img 
                    src="/images/default_profile.png" 
                    alt="Profile" 
                  />
                )}
              </div>
              
              {isProfileOpen && (
                <div className="profile-menu">
                  <Link 
                    to="/profile" 
                    className="profile-menu-item"
                    onClick={() => {
                      setIsProfileOpen(false);
                      closeMenu();
                    }}
                  >
                    Profile
                  </Link>
                  <button 
                    className="profile-menu-item logout-btn"
                    onClick={() => {
                      logout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link 
              to="/login" 
              className={`navbar-link ${isActive('/login') ? 'active' : ''}`}
              onClick={closeMenu}
            >
              Login
            </Link>
          )}
        </div>
        
        <div className="navbar-toggle" onClick={toggleMenu}>
          <span className={`bar ${isOpen ? 'active' : ''}`}></span>
          <span className={`bar ${isOpen ? 'active' : ''}`}></span>
          <span className={`bar ${isOpen ? 'active' : ''}`}></span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
