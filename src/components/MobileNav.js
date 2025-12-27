/**
 * Mobile Bottom Navigation Component
 * Provides bottom navigation for mobile devices
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hapticSelection } from '../utils/haptics';
import './MobileNav.css';

const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isMember } = useAuth();

  const handleNavClick = (path) => {
    hapticSelection();
    navigate(path);
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Don't show on login/signup pages
  if (!currentUser || location.pathname === '/login' || location.pathname === '/signup') {
    return null;
  }

  return (
    <nav className="mobile-nav" role="navigation" aria-label="Main navigation">
      <button
        className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}
        onClick={() => handleNavClick('/')}
        aria-label="Home"
      >
        <span className="mobile-nav-icon">🏠</span>
        <span className="mobile-nav-label">Home</span>
      </button>

      {isMember(currentUser) && (
        <>
          <button
            className={`mobile-nav-item ${isActive('/forum') ? 'active' : ''}`}
            onClick={() => handleNavClick('/forum')}
            aria-label="Forum"
          >
            <span className="mobile-nav-icon">💬</span>
            <span className="mobile-nav-label">Forum</span>
          </button>

          <button
            className={`mobile-nav-item ${isActive('/schedule') ? 'active' : ''}`}
            onClick={() => handleNavClick('/schedule')}
            aria-label="Schedule"
          >
            <span className="mobile-nav-icon">📅</span>
            <span className="mobile-nav-label">Schedule</span>
          </button>

          <button
            className={`mobile-nav-item ${isActive('/races') ? 'active' : ''}`}
            onClick={() => handleNavClick('/races')}
            aria-label="Races"
          >
            <span className="mobile-nav-icon">🏃</span>
            <span className="mobile-nav-label">Races</span>
          </button>
        </>
      )}

      <button
        className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}
        onClick={() => handleNavClick('/profile')}
        aria-label="Profile"
      >
        <span className="mobile-nav-icon">👤</span>
        <span className="mobile-nav-label">Profile</span>
      </button>
    </nav>
  );
};

export default MobileNav;

