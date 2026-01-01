import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';
// Simple linkifier for the banner message: escapes HTML, then converts URLs to <a>
function escapeHtml(input) {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function linkify(text) {
  const input = text || '';
  
  // Simple and generalizable: [text](anything) becomes a clickable link
  // Everything between () becomes the href, regardless of format
  let result = input.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    // Clean up the URL - add https:// if it doesn't start with http
    const cleanUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  
  return result;
}

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [banner, setBanner] = useState({ enabled: false, items: [], rotationIntervalMs: 6000 });
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isBannerHovered, setIsBannerHovered] = useState(false);
  const [popupModal, setPopupModal] = useState({ enabled: false, message: '', popupId: null });
  const [showPopupModal, setShowPopupModal] = useState(false);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
  const navigate = useNavigate();
  const { currentUser, isMember, isAdmin, isExec, logout } = useAuth();
  const profileRef = useRef(null);
  const profileMobileRef = useRef(null);
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
    
    // Initialize profile image URL (handle multiple possible fields and URL shapes)
    const profilePictureUrl = currentUser?.profile_picture_url || currentUser?.profilePictureUrl;
    if (profilePictureUrl) {
      const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
      const originBase = apiBase.replace(/\/api\/?$/, '');
      if (profilePictureUrl.startsWith('/api/')) {
        setProfileImageUrl(`${originBase}${profilePictureUrl}`);
      } else if (profilePictureUrl.startsWith('/uploads/')) {
        setProfileImageUrl(`${apiBase}/..${profilePictureUrl}`);
      } else if (/^https?:\/\//i.test(profilePictureUrl)) {
        setProfileImageUrl(profilePictureUrl);
      } else {
        // Unknown shape, fall back to default
        setProfileImageUrl(null);
      }
    }
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [currentUser?.id, currentUser?.profile_picture_url, currentUser?.profilePictureUrl]);

  // Fetch site banner
  useEffect(() => {
    const loadBanner = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/site/banner`);
        if (!resp.ok) return;
        const data = await resp.json();
        const normalized = data.banner || {};
        const items = Array.isArray(normalized.items)
          ? normalized.items.map((it) => (typeof it === 'string' ? { message: it } : { message: String(it?.message || '') }))
          : (normalized.message ? [{ message: String(normalized.message) }] : []);
        setBanner({
          enabled: !!normalized.enabled && items.length > 0,
          items,
          rotationIntervalMs: Number(normalized.rotationIntervalMs) > 0 ? Number(normalized.rotationIntervalMs) : 6000,
        });
        if (data.popup) {
          setPopupModal((prev) => ({
            ...prev,
            enabled: !!data.popup.enabled && !!data.popup.message,
            message: data.popup.message || '',
            popupId: data.popup.popupId || null
          }));
        }
        setActiveBannerIndex(0);
      } catch (_) {}
    };
    loadBanner();
  }, [API_BASE_URL]);

  useEffect(() => {
    if (!currentUser?.id) {
      setShowPopupModal(false);
      return;
    }

    const loadPopupStatus = async () => {
      try {
        const token = localStorage.getItem('triathlonToken');
        if (!token) return;
        const resp = await fetch(`${API_BASE_URL}/site/popup/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.popup && data.popup.shouldShow && data.popup.message) {
          setPopupModal({
            enabled: true,
            message: data.popup.message,
            popupId: data.popup.popupId
          });
          setShowPopupModal(true);
        } else {
          setShowPopupModal(false);
        }
      } catch (_error) {
        // ignore errors
      }
    };

    loadPopupStatus();
  }, [API_BASE_URL, currentUser?.id]);

  // Reflect banner height to CSS variable for page spacing
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    const hasBanner = banner.enabled && (banner.items?.length > 0);
    const offset = hasBanner ? (isMobile ? '24px' : '28px') : '0px';
    document.documentElement.style.setProperty('--banner-offset', offset);
  }, [banner.enabled, banner.items]);

  // Auto-rotate banners
  useEffect(() => {
    if (!banner.enabled || !banner.items || banner.items.length <= 1) return;
    if (isBannerHovered) return; // pause on hover
    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % banner.items.length);
    }, banner.rotationIntervalMs || 6000);
    return () => clearInterval(interval);
  }, [banner.enabled, banner.items, banner.rotationIntervalMs, isBannerHovered]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const acknowledgePopup = async () => {
    if (!popupModal?.popupId) {
      setShowPopupModal(false);
      return;
    }
    try {
      const token = localStorage.getItem('triathlonToken');
      if (token) {
        await fetch(`${API_BASE_URL}/site/popup/seen`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ popupId: popupModal.popupId })
        });
      }
    } catch (_error) {
      // ignore errors; still close popup
    } finally {
      setShowPopupModal(false);
    }
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
      const clickedInsideProfile = 
        (profileRef.current && profileRef.current.contains(event.target)) ||
        (profileMobileRef.current && profileMobileRef.current.contains(event.target));
      
      if (!clickedInsideProfile) {
        setIsProfileOpen(false);
      }
      
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <>
    {showPopupModal && popupModal?.message && (
      <div className="popup-overlay" onClick={acknowledgePopup}>
        <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
          <button className="popup-close" aria-label="Dismiss announcement" onClick={acknowledgePopup}>
            ×
          </button>
          <p className="popup-eyebrow">Club Announcement</p>
          <h3>Heads up!</h3>
          <div
            className="popup-message"
            dangerouslySetInnerHTML={{ __html: linkify(popupModal.message) }}
          />
          <div className="popup-actions">
            <button className="btn btn-primary" onClick={acknowledgePopup}>
              Got it
            </button>
          </div>
        </div>
      </div>
    )}
    {banner.enabled && (banner.items?.length > 0) && (
      <div 
        className="site-banner active"
        role="status"
        aria-live="polite"
        onMouseEnter={() => setIsBannerHovered(true)}
        onMouseLeave={() => setIsBannerHovered(false)}
      >
        <div className="site-banner-rotator">
          {banner.items.map((it, idx) => (
            <div
              key={idx}
              className={`site-banner-item ${idx === activeBannerIndex ? 'visible' : ''}`}
            >
              <strong dangerouslySetInnerHTML={{ __html: linkify(it.message) }} />
            </div>
          ))}
        </div>
      </div>
    )}
    <nav className="navbar" style={{ marginTop: banner.enabled && (banner.items?.length > 0) ? (window.innerWidth <= 768 ? '24px' : '28px') : 0 }}>
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
          
          {currentUser && (isAdmin(currentUser) || isExec(currentUser)) && (
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
            <div className="profile-dropdown" ref={profileRef}>
              <Link 
                to="/login"
                className="profile-picture-nav"
                onClick={closeMenu}
              >
                <img 
                  src="/images/default_profile.png" 
                  alt="Profile" 
                />
              </Link>
            </div>
          )}
        </div>
        
        {/* Profile dropdown visible on mobile (outside navbar-menu) */}
        <div className="profile-dropdown-mobile" ref={profileMobileRef}>
          {currentUser ? (
            <>
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
                    }}
                  >
                    Profile
                  </Link>
                  {currentUser && (isAdmin(currentUser) || isExec(currentUser)) && (
                    <Link
                      to="/admin"
                      className="profile-menu-item"
                      onClick={() => {
                        setIsProfileOpen(false);
                      }}
                    >
                      Admin
                    </Link>
                  )}
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
            </>
          ) : (
            <div 
              className="profile-picture-nav"
              onClick={() => navigate('/login')}
            >
              <img 
                src="/images/default_profile.png" 
                alt="Profile" 
              />
            </div>
          )}
        </div>
        
        <div className="navbar-toggle" onClick={toggleMenu}>
          <span className={`bar ${isOpen ? 'active' : ''}`}></span>
          <span className={`bar ${isOpen ? 'active' : ''}`}></span>
          <span className={`bar ${isOpen ? 'active' : ''}`}></span>
        </div>
      </div>
    </nav>
    </>
  );
};

export default Navbar;
