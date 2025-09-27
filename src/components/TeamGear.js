import React, { useState } from 'react';
import './TeamGear.css';

const TeamGear = () => {
  const [gearItems, setGearItems] = useState([
    {
      id: 1,
      title: "UofT Tri Club Swim Suit",
      price: "X",
      image: "/images/team-gear/swim-suit.jpg",
      description: "High-performance swimsuit with club colors and logo"
    },
    {
      id: 2,
      title: "Tri Suit",
      price: "X",
      image: "/images/team-gear/tri-suit.jpg",
      description: "One-piece triathlon suit for swim, bike, and run"
    },
    {
      id: 3,
      title: "Bike Jersey",
      price: "X",
      image: "/images/team-gear/bike-jersey.jpg",
      description: "Aerodynamic cycling jersey with club branding"
    },
    {
      id: 4,
      title: "Bike Bib Shorts",
      price: "X",
      image: "/images/team-gear/bike-bib-shorts.jpg",
      description: "Professional cycling bib shorts with chamois padding"
    },
    {
      id: 5,
      title: "Team Backpack",
      price: "X",
      image: "/images/team-gear/backpack.jpg",
      description: "Durable backpack perfect for training and travel"
    },
    {
      id: 6,
      title: "Swim Cap",
      price: "X",
      image: "/images/team-gear/swim-cap.jpg",
      description: "Silicone swim cap with UofT Tri Club logo"
    }
  ]);

  return (
    <div className="page-container teamgear-page">
      <h1>Team Gear</h1>
      <p className="page-description">
        Show your UofT Tri Club pride with our official team gear! This page is under construction, please check back soon for more information.
      </p>
      
      <div className="gear-grid">
        {gearItems.map(item => (
          <div key={item.id} className="gear-item">
            <div className="gear-image-container">
              <img 
                src={item.image} 
                alt={item.title}
                className="gear-image"
                onError={(e) => {
                  e.target.src = '/images/placeholder-gear.svg';
                }}
              />
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
          <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a> with:
        </p>
        <ul>
          <li>Item name and size</li>
          <li>Quantity needed</li>
        </ul>
      </div>
    </div>
  );
};

export default TeamGear;


