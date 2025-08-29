import React from 'react';
import './WorkInProgressBanner.css';

const WorkInProgressBanner = ({ bannerRef }) => {
  const handleRedirect = () => {
    window.open('https://uofttriathlon.com/', '_blank');
  };

  return (
    <div className="work-in-progress-banner" ref={bannerRef}>
      <div className="banner-content">
        <div className="banner-text">
          <span className="banner-icon">🚧</span>
          <span className="banner-message">
            <strong>Work in Progress!</strong> This is a new website under development.
          </span>
        </div>
        <button 
          className="banner-button" 
          onClick={handleRedirect}
        >
          Visit Official Site →
        </button>
      </div>
    </div>
  );
};

export default WorkInProgressBanner;
