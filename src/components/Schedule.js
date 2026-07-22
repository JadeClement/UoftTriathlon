import React, { useState, useRef } from 'react';
import './Schedule.css';

const SEASONS = ['Spring', 'Summer', 'Fall/Winter'];

const Schedule = () => {
  const [activeSeason, setActiveSeason] = useState('Spring');
  const seasonTabRefs = useRef({});

  const focusSeasonTab = (season) => {
    seasonTabRefs.current[season]?.focus();
  };

  const handleSeasonKeyDown = (event, season) => {
    const index = SEASONS.indexOf(season);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = SEASONS[(index + 1) % SEASONS.length];
      setActiveSeason(next);
      focusSeasonTab(next);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prev = SEASONS[(index - 1 + SEASONS.length) % SEASONS.length];
      setActiveSeason(prev);
      focusSeasonTab(prev);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveSeason(SEASONS[0]);
      focusSeasonTab(SEASONS[0]);
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = SEASONS[SEASONS.length - 1];
      setActiveSeason(last);
      focusSeasonTab(last);
    }
  };




  return (
    <div className="schedule-container">
      <div className="container">
        <h1 className="section-title">Workout Schedule</h1>
   
        
        {/* Season Tabs */}
        <div className="season-tabs" role="tablist" aria-label="Season">
          {SEASONS.map((season) => (
            <button
              key={season}
              ref={(el) => { seasonTabRefs.current[season] = el; }}
              type="button"
              role="tab"
              id={`season-tab-${season.replace('/', '-')}`}
              aria-selected={activeSeason === season}
              aria-controls={`season-panel-${season.replace('/', '-')}`}
              tabIndex={activeSeason === season ? 0 : -1}
              className={`season-tab ${activeSeason === season ? 'active' : ''}`}
              onClick={() => setActiveSeason(season)}
              onKeyDown={(event) => handleSeasonKeyDown(event, season)}
            >
              {season}
            </button>
          ))}
        </div>
        

        {/* Sample Workouts for Demo */}
        <div className="demo-workouts">
          
          {activeSeason === 'Spring' && (
            <div
              className="season-schedule"
              role="tabpanel"
              id="season-panel-Spring"
              aria-labelledby="season-tab-Spring"
            >
              <h2>Weekly Spring Schedule</h2>
              <p className="season-dates">April 29 - June 25</p>
              <div className="schedule-grid">
                <div className="schedule-day">
                  <h3>Monday</h3>
                  <div className="workout-item bike">Outdoor Ride 6:15-7:30am</div>
                </div>
                <div className="schedule-day">
                  <h3>Tuesday</h3>
                  <div className="workout-item swim">Swim 8:30-10:30am</div>
                  <div className="workout-item run">Track Run 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h3>Wednesday</h3>
                  <div className="workout-item bike">Outdoor Ride 6:15-7:30pm</div>
                </div>
                <div className="schedule-day">
                  <h3>Thursday</h3>
                  <div className="workout-item swim">Swim 8:30-10:30am</div>
                  <div className="workout-item run">Tempo Run 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h3>Friday</h3>
                </div>
                <div className="schedule-day">
                  <h3>Saturday</h3>
                  <div className="workout-item long">Group Ride?</div>
                </div>
                <div className="schedule-day">
                  <h3>Sunday</h3>
                  <div className="workout-item swim">Swim 10:00-12:00pm</div>
                </div>
              </div>
            </div>
          )}
          
          {activeSeason === 'Summer' && (
            <div
              className="season-schedule"
              role="tabpanel"
              id="season-panel-Summer"
              aria-labelledby="season-tab-Summer"
            >
              <h2>Weekly Summer Schedule</h2>
              <p className="season-dates">June 25 - August 20</p>
              <div className="schedule-grid">
                <div className="schedule-day">
                  <h3>Monday</h3>
                  <div className="workout-item bike">Outdoor Ride 6:30-7:30am</div>
                  <div className="workout-note">Check forum for exact times and location.</div>
                </div>
                <div className="schedule-day">
                  <h3>Tuesday</h3>
                  <div className="workout-item swim">Swim 7:00-9:00am</div>
                  <div className="workout-item run">Track Run 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h3>Wednesday</h3>
                  <div className="workout-item bike">Outdoor Ride 6:15-7:30pm</div>
                  <div className="workout-note">Check forum for exact times and location.</div>
                </div>
                <div className="schedule-day">
                  <h3>Thursday</h3>
                  <div className="workout-item swim">Swim 7:00-9:00am</div>
                  <div className="workout-item run">Tempo Run 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h3>Friday</h3>
                </div>
                <div className="schedule-day">
                  <h3>Saturday</h3>
                  <div className="workout-item recovery">Group Ride?</div>
                </div>
                <div className="schedule-day">
                  <h3>Sunday</h3>
                  <div className="workout-item swim">Swim 10:00-12:00pm</div>
                </div>
              </div>
            </div>
          )}
          
          {activeSeason === 'Fall/Winter' && (
            <div
              className="season-schedule"
              role="tabpanel"
              id="season-panel-Fall-Winter"
              aria-labelledby="season-tab-Fall-Winter"
            >
              <h2>Weekly Winter Schedule</h2>
              <p className="season-dates">September 1 - April 29</p>
              <div className="schedule-grid">
                <div className="schedule-day">
                  <h3>Monday</h3>
                  <div className="workout-item bike">Spin 7-8am</div>
                </div>
                <div className="schedule-day">
                  <h3>Tuesday</h3>
                  <div className="workout-item swim">Swim 8:30-10:30am</div>
                  <div className="workout-item run">Track 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h3>Wednesday</h3>
                  <div className="workout-item bike">Spin 7-8am</div>
                </div>
                <div className="schedule-day">
                  <h3>Thursday</h3>
                  <div className="workout-item swim">Swim 8:30-10:30am</div>
                  <div className="workout-item run">Tempo Run 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h3>Friday</h3>
                  <div className="workout-item brick">Brick 6:30-8pm</div>
                </div>
                <div className="schedule-day">
                  <h3>Saturday</h3>
                </div>
                <div className="schedule-day">
                  <h3>Sunday</h3>
                  <div className="workout-item recovery">Swim 10:00-12:00pm</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Welcome to the Club Section */}
        <div className="welcome-section">
          
          <div className="workout-overview">
            
            <div className="workout-type">
              <h2>🏊 Swims 🏊</h2>
              <p><strong>Where:</strong> Varsity Pool, UofT Athletic Centre, 55 Harbord St, Toronto, ON M5S 2W6</p>
              <p><strong>Note:</strong> Please show up on time.</p>
            </div>

            <div className="workout-type">
              <h2>🚴 Spins 🚴</h2>
              <p><strong>Where:</strong> Field House – Court 4 (West side), UofT Athletic Centre, 55 Harbord St, Toronto, ON M5S 2W6</p>
              <p><strong>Note:</strong> Sign up for Spins on the Forum.</p>
            </div>

            <div className="workout-type">
              <h2>🚴 🏃 Bricks (Spin & Run) 🚴🏃</h2>
              <p><strong>Where:</strong> Field House – Court 4 (West side), UofT Athletics Centre, 55 Harbord St, Toronto, ON M5S 2W6</p>
              <p><strong>Note:</strong> Sign up for Bricks on the Forum.</p>
            </div>

            <div className="workout-type">
              <h2>🏃 Runs 🏃</h2>
              <div className="run-details">
                <div className="run-type">
                  <h3>Tuesday Track</h3>
                  <p><strong>Where:</strong> Central Tech Track, 725 Bathurst St, Toronto, ON M5S 2R5</p>
                  <p><strong>Note:</strong> Track location may change due to snow or Ice – change of location will be communicated via email and our social media</p>
                </div>
                <div className="run-type">
                  <h3>Thursday Tempo</h3>
                  <p><strong>Where:</strong> Meet in the lobby of the Athletic Centre.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
