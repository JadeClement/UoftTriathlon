import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
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
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [banner, setBanner] = useState({ enabled: false, items: [], rotationIntervalMs: 6000 });
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isBannerHovered, setIsBannerHovered] = useState(false);
  const [popupModal, setPopupModal] = useState({ enabled: false, message: '', popupId: null });
  const [showPopupModal, setShowPopupModal] = useState(false);
  const [itemsInMore, setItemsInMore] = useState(new Set()); // Track which items are in More dropdown
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
  const navigate = useNavigate();
  const { currentUser, isMember, isAdmin, isExec, logout } = useAuth();
  const profileRef = useRef(null);
  const profileMobileRef = useRef(null);
  const moreRef = useRef(null);
  const logoRef = useRef(null);
  const navbarContainerRef = useRef(null);
  const navbarMenuRef = useRef(null);
  
  // Refs for each nav item to measure widths
  const navItemRefs = useRef({});
  
  // Define nav items in order (left to right)
  // Move order (right to left into More): Races → Coaches & Exec → Schedule → Join Us → Admin → Forum
  const getNavItems = () => {
    const items = [
      { key: 'home', path: '/', label: 'Home', alwaysVisible: true, ref: 'home' },
      { key: 'forum', path: '/forum', label: 'Forum', condition: () => currentUser, ref: 'forum' },
      { key: 'joinUs', path: '/join-us', label: 'Join Us', ref: 'joinUs' },
      { key: 'schedule', path: '/schedule', label: 'Schedule', ref: 'schedule' },
      { key: 'coachesExec', path: '/coaches-exec', label: 'Coaches & Exec', ref: 'coachesExec' },
      { key: 'races', path: '/races', label: 'Races', condition: () => currentUser && isMember(currentUser), ref: 'races' },
      { key: 'admin', path: '/admin', label: 'Admin', condition: () => currentUser && (isAdmin(currentUser) || isExec(currentUser)), ref: 'admin' },
    ];
    
    // Filter by conditions
    return items.filter(item => !item.condition || item.condition());
  };
  
  // Move order (right to left): Races → Coaches & Exec → Schedule → Join Us → Admin → Forum
  const moveOrder = ['races', 'coachesExec', 'schedule', 'joinUs', 'admin', 'forum'];
  
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

  // Track mobile state
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Responsive navbar: calculate which items fit and move overflow to More dropdown
  const isCalculatingRef = useRef(false);
  
  useEffect(() => {
    const calculateResponsiveLayout = () => {
      // Prevent re-entrancy
      if (isCalculatingRef.current) {
        return;
      }
      
      // Only run on desktop (not mobile)
      if (isMobile) {
        setItemsInMore(new Set()); // Clear items in More on mobile
        return;
      }
      
      const container = navbarContainerRef.current;
      const menu = navbarMenuRef.current;
      const logo = logoRef.current;
      const profile = profileRef.current;
      const moreButton = moreRef.current;
      
      if (!container || !menu || !logo || !profile || !moreButton) {
        return;
      }
      
      isCalculatingRef.current = true;
      
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        try {
          const containerWidth = container.offsetWidth;
          const logoWidth = logo.offsetWidth;
          // Ensure profile button is always measured - use a minimum width if measurement fails
          const profileWidth = Math.max(profile.offsetWidth || 0, 50); // Minimum 50px for profile button
          const moreButtonWidth = moreButton.offsetWidth;
          
          // Calculate available space for nav items
          // Account for padding (20px on each side = 40px total) and gaps between items
          const containerPadding = 40; // 20px on each side
          const gapBetweenItems = 32; // 2rem gap between nav items (from CSS)
          // Reserve space for profile button + More button + gaps + safety margin
          // Profile button must always be visible, so be very conservative with extra margin
          const reservedSpace = profileWidth + moreButtonWidth + (gapBetweenItems * 3) + 80; // Extra 80px safety margin (very conservative)
          const availableWidth = Math.max(0, containerWidth - logoWidth - reservedSpace - containerPadding);
          
          const navItems = getNavItems();
          const itemWidths = {};
          
          // Measure ALL items' widths (even those currently in More) to get accurate measurements
          navItems.forEach(item => {
            const ref = navItemRefs.current[item.ref];
            if (ref) {
              // Temporarily show the item to measure it accurately
              const wasHidden = ref.style.display === 'none';
              if (wasHidden) {
                ref.style.display = '';
              }
              const width = ref.offsetWidth;
              itemWidths[item.key] = width;
              if (wasHidden) {
                ref.style.display = 'none';
              }
            }
          });
          
          // Calculate which items should be visible
          const newItemsInMore = new Set();
          let currentWidth = 0;
          
          // Start with all items visible, then move to More if needed
          for (const item of navItems) {
            if (item.alwaysVisible) {
              currentWidth += (itemWidths[item.key] || 0) + gapBetweenItems;
              continue;
            }
            
            const itemWidth = (itemWidths[item.key] || 0) + gapBetweenItems;
            const wouldFit = currentWidth + itemWidth <= availableWidth;
            
            if (wouldFit) {
              currentWidth += itemWidth;
            } else {
              // This item doesn't fit, move it to More
              newItemsInMore.add(item.key);
            }
          }
          
          // Only update state if it actually changed
          const currentSet = itemsInMore;
          const setsEqual = currentSet.size === newItemsInMore.size && 
                           Array.from(currentSet).every(key => newItemsInMore.has(key));
          
          if (!setsEqual) {
            setItemsInMore(newItemsInMore);
          }
        } finally {
          isCalculatingRef.current = false;
        }
      });
    };
    
    // Debounce resize events
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculateResponsiveLayout, 150);
    };
    
    // Calculate on mount and resize
    const timeoutId = setTimeout(calculateResponsiveLayout, 100);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
      clearTimeout(resizeTimeout);
    };
  }, [currentUser, isMember, isAdmin, isExec, isMobile]); // Removed itemsInMore from dependencies

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
    setIsHamburgerOpen(false);
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
      
      // Close hamburger menu when clicking outside
      const hamburgerButton = document.querySelector('.navbar-hamburger');
      const hamburgerMenu = document.querySelector('.hamburger-menu');
      if (hamburgerButton && hamburgerMenu && 
          !hamburgerButton.contains(event.target) && 
          !hamburgerMenu.contains(event.target)) {
        setIsHamburgerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const navItems = getNavItems();
  const itemsInMoreArray = Array.from(itemsInMore);
  const itemsInMoreMenu = navItems.filter(item => itemsInMoreArray.includes(item.key));
  const itemsInMainNav = navItems.filter(item => !itemsInMoreArray.includes(item.key));
  
  // Check if in Capacitor app
  const isNativeApp = Capacitor.isNativePlatform();

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
    <nav className={`navbar ${isNativeApp ? 'capacitor-navbar' : ''}`} style={{ marginTop: banner.enabled && (banner.items?.length > 0) ? (window.innerWidth <= 768 ? '24px' : '28px') : 0 }}>
      <div className="navbar-container" ref={navbarContainerRef}>
        <Link to="/" className="navbar-logo" onClick={closeMenu} ref={logoRef}>
          <img src="/images/icon.png" alt="UofT Triathlon Logo" className="navbar-icon" />
          <span className="logo-text">UofT Triathlon</span>
        </Link>
        
        {/* Hamburger menu for mobile */}
        {isMobile && (
          <button 
            className="navbar-hamburger"
            onClick={() => setIsHamburgerOpen(!isHamburgerOpen)}
            aria-label="Menu"
          >
            <span className={`hamburger-bar ${isHamburgerOpen ? 'active' : ''}`}></span>
            <span className={`hamburger-bar ${isHamburgerOpen ? 'active' : ''}`}></span>
            <span className={`hamburger-bar ${isHamburgerOpen ? 'active' : ''}`}></span>
          </button>
        )}
        
        {/* Hamburger menu dropdown for mobile */}
        {isMobile && isHamburgerOpen && (
          <div className="hamburger-menu">
            {navItems.map(item => (
              <Link
                key={item.key}
                to={item.path}
                className={`hamburger-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            ))}
            <Link to="/faq" className={`hamburger-item ${isActive('/faq') ? 'active' : ''}`} onClick={closeMenu}>
              FAQ
            </Link>
            <Link to="/resources" className={`hamburger-item ${isActive('/resources') ? 'active' : ''}`} onClick={closeMenu}>
              Resources
            </Link>
            <Link to="/team-gear" className={`hamburger-item ${isActive('/team-gear') ? 'active' : ''}`} onClick={closeMenu}>
              Team Gear
            </Link>
          </div>
        )}
        
        <div className={`navbar-menu ${isOpen ? 'active' : ''}`} ref={navbarMenuRef}>
          {/* Main nav items */}
          {itemsInMainNav.map(item => (
            <Link
              key={item.key}
              to={item.path}
              ref={el => { if (el) navItemRefs.current[item.ref] = el; }}
              className={`navbar-link ${isActive(item.path) ? 'active' : ''}`}
              onClick={closeMenu}
            >
              {item.label}
            </Link>
          ))}

          {/* More dropdown */}
          <div className="navbar-link more-dropdown" ref={moreRef}>
            <button 
              className={`navbar-link as-button ${isMoreOpen ? 'active' : ''}`}
              onClick={() => setIsMoreOpen(!isMoreOpen)}
            >
              More ▾
            </button>
            {isMoreOpen && (
              <div className="more-menu">
                {/* Items moved from main nav */}
                {itemsInMoreMenu.map(item => (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={`more-item ${isActive(item.path) ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                ))}
                {/* Always in More dropdown */}
                <Link 
                  to="/faq" 
                  className={`more-item ${isActive('/faq') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  FAQ
                </Link>
                <Link 
                  to="/resources" 
                  className={`more-item ${isActive('/resources') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Resources
                </Link>
                <Link 
                  to="/team-gear" 
                  className={`more-item ${isActive('/team-gear') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Team Gear
                </Link>
              </div>
            )}
          </div>
          
          {/* Profile dropdown */}
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
