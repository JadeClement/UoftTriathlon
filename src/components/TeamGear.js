import React, { useState } from 'react';
import './TeamGear.css';

const TeamGear = () => {
  const [gearItems, setGearItems] = useState([
    {
      id: 1,
      title: "UofT Tri Club Swim Suit",
      price: "X",
      images: [
        "/images/team-gear/swim-suit-1.jpg",
        "/images/team-gear/swim-suit-2.jpg",
        "/images/team-gear/swim-suit-3.jpg"
      ],
      description: "High-performance swimsuit with club colors and logo"
    },
    {
      id: 2,
      title: "Tri Suit",
      price: "X",
      images: [
        "/images/team-gear/tri-suit-1.jpg",
        "/images/team-gear/tri-suit-2.jpg"
      ],
      description: "One-piece triathlon suit for swim, bike, and run"
    },
    {
      id: 3,
      title: "Bike Jersey",
      price: "X",
      images: [
        "/images/team-gear/bike-jersey-1.jpg",
        "/images/team-gear/bike-jersey-2.jpg",
        "/images/team-gear/bike-jersey-3.jpg",
        "/images/team-gear/bike-jersey-4.jpg"
      ],
      description: "Aerodynamic cycling jersey with club branding"
    },
    {
      id: 4,
      title: "Bike Bib Shorts",
      price: "X",
      images: [
        "/images/team-gear/bike-bib-shorts-1.jpg",
        "/images/team-gear/bike-bib-shorts-2.jpg"
      ],
      description: "Professional cycling bib shorts with chamois padding"
    },
    {
      id: 5,
      title: "Team Backpack",
      price: "X",
      images: [
        "/images/team-gear/backpack-1.jpg",
        "/images/team-gear/backpack-2.jpg",
        "/images/team-gear/backpack-3.jpg"
      ],
      description: "Durable backpack perfect for training and travel"
    },
    {
      id: 6,
      title: "Swim Cap",
      price: "X",
      images: [
        "/images/team-gear/swim-cap-1.jpg",
        "/images/team-gear/swim-cap-2.jpg"
      ],
      description: "Silicone swim cap with UofT Tri Club logo"
    }
  ]);

  // State to track current image index for each gear item
  const [currentImageIndex, setCurrentImageIndex] = useState({});

  // Navigation functions
  const goToPreviousImage = (itemId) => {
    const currentIndex = currentImageIndex[itemId] || 0;
    const item = gearItems.find(item => item.id === itemId);
    if (item && item.images.length > 0) {
      const newIndex = currentIndex === 0 ? item.images.length - 1 : currentIndex - 1;
      setCurrentImageIndex(prev => ({
        ...prev,
        [itemId]: newIndex
      }));
    }
  };

  const goToNextImage = (itemId) => {
    const currentIndex = currentImageIndex[itemId] || 0;
    const item = gearItems.find(item => item.id === itemId);
    if (item && item.images.length > 0) {
      const newIndex = currentIndex === item.images.length - 1 ? 0 : currentIndex + 1;
      setCurrentImageIndex(prev => ({
        ...prev,
        [itemId]: newIndex
      }));
    }
  };

  // Get current image for an item
  const getCurrentImage = (item) => {
    const currentIndex = currentImageIndex[item.id] || 0;
    return item.images[currentIndex] || item.images[0] || '/images/placeholder-gear.svg';
  };

  return (
    <div className="page-container teamgear-page">
      <h1>Team Gear</h1>
      <p className="page-description">
        Show your UofT Tri Club pride with our official team gear! This page is under construction, please check back soon for more information.
      </p>
      <p>
      The clothing pieces are from Champion Systems. The main reference for triathlon is here
      https://www.champ-sys.ca/pages/triathlon, but you may look at cycling and running items
      </p>
      
      <div className="gear-grid">
        {gearItems.map(item => (
          <div key={item.id} className="gear-item">
            <div className="gear-image-container">
              <img 
                src={getCurrentImage(item)} 
                alt={item.title}
                className="gear-image"
                onError={(e) => {
                  e.target.src = '/images/placeholder-gear.svg';
                }}
              />
              {item.images.length > 1 && (
                <>
                  <button 
                    className="gear-nav-button gear-nav-left"
                    onClick={() => goToPreviousImage(item.id)}
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button 
                    className="gear-nav-button gear-nav-right"
                    onClick={() => goToNextImage(item.id)}
                    aria-label="Next image"
                  >
                    ›
                  </button>
                  <div className="gear-image-indicators">
                    {item.images.map((_, index) => (
                      <button
                        key={index}
                        className={`gear-indicator ${(currentImageIndex[item.id] || 0) === index ? 'active' : ''}`}
                        onClick={() => setCurrentImageIndex(prev => ({
                          ...prev,
                          [item.id]: index
                        }))}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="gear-content">
              <h3 className="gear-title">{item.title}</h3>
              <p className="gear-description">{item.description}</p>
              <div className="gear-price">${item.price}</div>
              <button className="gear-button">
                Order Now
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="gear-info">
        <h2>Ordering Information</h2>
        <p>
          To place an order for team gear, please contact us at{' '}
          <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>:
        </p>
      </div>
    </div>
  );
};

export default TeamGear;


