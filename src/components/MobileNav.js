/**
 * Mobile Bottom Navigation Component
 * Provides bottom navigation for mobile devices
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hapticSelection } from '../utils/haptics';
import { Capacitor } from '@capacitor/core';
import './MobileNav.css';

const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isMember, isAdmin, isExec } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef(null);
  
  // Only show in native Capacitor apps (iOS/Android), not in browsers
  // Use Capacitor.isNativePlatform() to properly detect native app vs browser
  const isNativeApp = Capacitor.isNativePlatform();

  const handleNavClick = (path) => {
    hapticSelection();
    setIsMoreOpen(false);
    navigate(path);
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Check if any "More" menu item is active
  const isMoreActive = () => {
    return isActive('/faq') || isActive('/resources') || isActive('/team-gear') || isActive('/races') || isActive('/admin');
  };

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
    };

    if (isMoreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMoreOpen]);

  // Only show in native Capacitor apps (iOS/Android), not in browsers
  if (!isNativeApp) {
    return null;
  }

  return (
    <>
      <nav 
        className="mobile-nav capacitor-nav mobile-nav-visible"
        role="navigation" 
        aria-label="Main navigation"
      >
        <button
          className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}
          onClick={() => handleNavClick('/')}
          aria-label="Home"
        >
          <span className="mobile-nav-icon">🏠</span>
          <span className="mobile-nav-label">Home</span>
        </button>

        <button
          className={`mobile-nav-item ${isActive('/join-us') ? 'active' : ''}`}
          onClick={() => handleNavClick('/join-us')}
          aria-label="Join Us"
        >
          <span className="mobile-nav-icon">👋</span>
          <span className="mobile-nav-label">Join Us</span>
        </button>

        {/* Show Forum to everyone - non-members will see a message */}
        <button
          className={`mobile-nav-item ${isActive('/forum') ? 'active' : ''}`}
          onClick={() => handleNavClick('/forum')}
          aria-label="Forum"
        >
          <span className="mobile-nav-icon">💬</span>
          <span className="mobile-nav-label">Forum</span>
        </button>

        <button
          className={`mobile-nav-item ${isActive('/coaches-exec') ? 'active' : ''}`}
          onClick={() => handleNavClick('/coaches-exec')}
          aria-label="Team"
        >
          <span className="mobile-nav-icon">👥</span>
          <span className="mobile-nav-label">Team</span>
        </button>

        <div className="mobile-nav-more-container" ref={moreMenuRef}>
          <button
            className={`mobile-nav-item mobile-nav-more ${isMoreActive() ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              hapticSelection();
              setIsMoreOpen(!isMoreOpen);
            }}
            aria-label="More"
            aria-expanded={isMoreOpen}
          >
            <span className="mobile-nav-icon">⋯</span>
            <span className="mobile-nav-label">More</span>
          </button>

          {isMoreOpen && (
            <div className="mobile-nav-more-menu">
              <button
                className={`mobile-nav-more-item ${isActive('/faq') ? 'active' : ''}`}
                onClick={() => handleNavClick('/faq')}
              >
                FAQ
              </button>
              <button
                className={`mobile-nav-more-item ${isActive('/resources') ? 'active' : ''}`}
                onClick={() => handleNavClick('/resources')}
              >
                Resources
              </button>
              <button
                className={`mobile-nav-more-item ${isActive('/team-gear') ? 'active' : ''}`}
                onClick={() => handleNavClick('/team-gear')}
              >
                Gear
              </button>
              {/* Show Races to everyone - non-members will see appropriate message */}
              <button
                className={`mobile-nav-more-item ${isActive('/races') ? 'active' : ''}`}
                onClick={() => handleNavClick('/races')}
              >
                Races
              </button>
              {/* Show Admin to execs and admins */}
              {(isAdmin(currentUser) || isExec(currentUser)) && (
                <button
                  className={`mobile-nav-more-item ${isActive('/admin') ? 'active' : ''}`}
                  onClick={() => handleNavClick('/admin')}
                >
                  Admin
                </button>
              )}
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default MobileNav;

