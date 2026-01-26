import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const Home = () => {
  const { currentUser, isAdmin, promoteToAdmin } = useAuth();
  const [currentSlide, setCurrentSlide] = React.useState(0);



  const changeSlide = (direction) => {
    setCurrentSlide(prev => {
      if (direction === 1) {
        return prev === 2 ? 0 : prev + 1;
      } else {
        return prev === 0 ? 2 : prev - 1;
      }
    });
  };

  const goToSlide = (slideIndex) => {
    setCurrentSlide(slideIndex);
  };

  React.useEffect(() => {
    const timer = setInterval(() => {
      changeSlide(1);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="home">
      {/* Split Screen Hero - 60% Image, 40% Text */}
      <section className="split-hero">
        {/* Left Side - Image Slideshow (60%) */}
        <div className="hero-image-section">
          <div className="slideshow-container">
            <div className="slideshow">
              <div className={`slide ${currentSlide === 0 ? 'active' : ''}`}>
                <img 
                  src="/images/team-photo1.jpeg" 
                  alt="UofT Triathlon Team - Photo 1"
                />
              </div>
              <div className={`slide ${currentSlide === 1 ? 'active' : ''}`}>
                <img 
                  src="/images/team-photo2.jpeg" 
                  alt="UofT Triathlon Team - Photo 2"
                />
              </div>
              <div className={`slide ${currentSlide === 2 ? 'active' : ''}`}>
                <img 
                  src="/images/team-photo3.jpeg" 
                  alt="UofT Triathlon Team - Photo 3"
                />
              </div>
            </div>
            <div className="slideshow-controls">
              <button className="control-btn prev" onClick={() => changeSlide(-1)}>‹</button>
              <div className="slide-indicators">
                <span className={`indicator ${currentSlide === 0 ? 'active' : ''}`} onClick={() => goToSlide(0)}></span>
                <span className={`indicator ${currentSlide === 1 ? 'active' : ''}`} onClick={() => goToSlide(1)}></span>
                <span className={`indicator ${currentSlide === 2 ? 'active' : ''}`} onClick={() => goToSlide(2)}></span>
              </div>
              <button className="control-btn next" onClick={() => changeSlide(1)}>›</button>
            </div>
          </div>
        </div>

        {/* Right Side - Text Content (40%) */}
        <div className="hero-text-section">
          <div className="hero-content">
            <h1 className="hero-title">
              Welcome to <span className="highlight">UofT Triathlon</span>
            </h1>
            <p className="hero-subtitle">
              We swim, bike and run.
            </p>
            <p className="hero-description">
              Join our community of dedicated athletes.
            </p>
            <div className="hero-buttons">
              <Link to="/coaches-exec" className="btn btn-primary">Meet the Team</Link>
              <Link to="/join-us" className="btn btn-secondary">Join Us</Link>
            </div>
          </div>
        </div>
      </section>



      {/* About Section */}
      <section className="about section">
        <div className="container">
          <div className="about-content">
            <div className="about-text">
              <h2 className="section-title">About Our Team</h2>
              <p>
              Our U of T triathlon team brings together students, alumni, and community members to swim, bike, and run.
              </p>
              <p>
                Our team consists of athletes from all backgrounds and experience levels, from beginners 
                to elite competitors. Whether you're training for fun or chasing speed, you'll find coached practices, supportive teammates, and year-round motivation!
              </p>
              <Link to="/join-us" className="btn btn-primary">Join Us</Link>
            </div>
            <div className="about-image">
              <img 
                src="/images/icon.png" 
                alt="UofT Triathlon Team Icon"
                className="team-icon"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sponsors Section */}
      <section className="sponsors section">
        <div className="container">
          <h2 className="section-title">Our Sponsors</h2>
          <div className="sponsors-content">
            <div className="sponsor-image">
              <img 
                src="/images/enduro.png" 
                alt="Enduro Sponsor"
                className="sponsor-logo"
              />
            </div>
            <div className="sponsor-image">
              <img 
                src="/images/blacksmith.png" 
                alt="Blacksmith Sponsor"
                className="sponsor-logo"
              />
            </div>
          </div>
        </div>
      </section>

      
    </div>
  );
};

export default Home;
