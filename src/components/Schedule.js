import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Schedule.css';

const Schedule = () => {
  const { currentUser } = useAuth();
  const [activeSeason, setActiveSeason] = useState('Spring');




  return (
    <div className="schedule-container">
      <div className="container">
        <h1 className="section-title">Workout Schedule</h1>
   
        
        {/* Season Tabs */}
        <div className="season-tabs">
          <button
            className={`season-tab ${activeSeason === 'Spring' ? 'active' : ''}`}
            onClick={() => setActiveSeason('Spring')}
          >
            Spring
          </button>
          <button
            className={`season-tab ${activeSeason === 'Summer' ? 'active' : ''}`}
            onClick={() => setActiveSeason('Summer')}
          >
            Summer
          </button>
          <button
            className={`season-tab ${activeSeason === 'Fall/Winter' ? 'active' : ''}`}
            onClick={() => setActiveSeason('Fall/Winter')}
          >
            Fall/Winter
          </button>
        </div>
        

        {/* Sample Workouts for Demo */}
        <div className="demo-workouts">
          
          {activeSeason === 'Spring' && (
            <div className="season-schedule">
              <h4>Weekly Spring Schedule</h4>
              <p className="season-dates">April 29 - June 25</p>
              <div className="schedule-grid">
                <div className="schedule-day">
                  <h5>Monday</h5>
                  <div className="workout-item bike">Outdoor Ride 6:15-7:30am</div>
                </div>
                <div className="schedule-day">
                  <h5>Tuesday</h5>
                  <div className="workout-item swim">Swim 8:30-10:30am</div>
                  <div className="workout-item run">Track Run 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h5>Wednesday</h5>
                  <div className="workout-item bike">Outdoor Ride 6:15-7:30pm</div>
                </div>
                <div className="schedule-day">
                  <h5>Thursday</h5>
                  <div className="workout-item swim">Swim 8:30-10:30am</div>
                  <div className="workout-item run">Tempo Run 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h5>Friday</h5>
                  <div className="workout-item brick">Brick 6:30-8pm</div>
                </div>
                <div className="schedule-day">
                  <h5>Saturday</h5>
                  <div className="workout-item long">Group Ride?</div>
                </div>
                <div className="schedule-day">
                  <h5>Sunday</h5>
                  <div className="workout-item swim">Swim 10:00-12:00pm</div>
                </div>
              </div>
            </div>
          )}
          
          {activeSeason === 'Summer' && (
            <div className="season-schedule">
              <h4>Weekly Summer Schedule</h4>
              <p className="season-dates">June 25 - August 20</p>
              <div className="schedule-grid">
                <div className="schedule-day">
                  <h5>Monday</h5>
                  <div className="workout-item bike">Outdoor Ride 6:30-7:30am</div>
                  <div className="workout-note">Check forum for exact times and location.</div>
                </div>
                <div className="schedule-day">
                  <h5>Tuesday</h5>
                  <div className="workout-item swim">Swim 7:00-9:00am</div>
                  <div className="workout-item run">Track Run 6:15pm</div>
                  <div className="workout-item swim">Swim 7:00-9:00pm</div>
                </div>
                <div className="schedule-day">
                  <h5>Wednesday</h5>
                  <div className="workout-item bike">Outdoor Ride 6:15-7:30pm</div>
                  <div className="workout-note">Check forum for exact times and location.</div>
                </div>
                <div className="schedule-day">
                  <h5>Thursday</h5>
                  <div className="workout-item swim">Swim 7:00-9:00am</div>
                  <div className="workout-item run">Tempo Run 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h5>Friday</h5>
                </div>
                <div className="schedule-day">
                  <h5>Saturday</h5>
                  <div className="workout-item recovery">Group Ride?</div>
                </div>
                <div className="schedule-day">
                  <h5>Sunday</h5>
                  <div className="workout-item swim">Swim 10:00-12:00pm</div>
                </div>
              </div>
            </div>
          )}
          
          {activeSeason === 'Fall/Winter' && (
            <div className="season-schedule">
              <h4>Weekly Winter Schedule</h4>
              <p className="season-dates">September 1 - April 29</p>
              <div className="schedule-grid">
                <div className="schedule-day">
                  <h5>Monday</h5>
                  <div className="workout-item bike">Spin 7-8am</div>
                </div>
                <div className="schedule-day">
                  <h5>Tuesday</h5>
                  <div className="workout-item swim">Swim 8:30-10:30am</div>
                  <div className="workout-item run">Track 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h5>Wednesday</h5>
                  <div className="workout-item bike">Spin 7-8am</div>
                </div>
                <div className="schedule-day">
                  <h5>Thursday</h5>
                  <div className="workout-item swim">Swim 8:30-10:30am</div>
                  <div className="workout-item run">Tempo Run 6:15pm</div>
                </div>
                <div className="schedule-day">
                  <h5>Friday</h5>
                  <div className="workout-item brick">Brick 6:30-8pm</div>
                </div>
                <div className="schedule-day">
                  <h5>Saturday</h5>
                </div>
                <div className="schedule-day">
                  <h5>Sunday</h5>
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
              <h4>🏊 Swims 🏊</h4>
              <p><strong>Where:</strong> Varsity Pool, UofT Athletic Centre, 55 Harbord St, Toronto, ON M5S 2W6</p>
              <p><strong>Note:</strong> Please show up on time.</p>
            </div>

            <div className="workout-type">
              <h4>🚴 Spins 🚴</h4>
              <p><strong>Where:</strong> Field House – Court 4 (West side), UofT Athletic Centre, 55 Harbord St, Toronto, ON M5S 2W6</p>
              <p><strong>Note:</strong> Sign up for Spins on the Forum.</p>
            </div>

            <div className="workout-type">
              <h4>🚴 🏃 Bricks (Spin & Run) 🚴🏃</h4>
              <p><strong>Where:</strong> Field House – Court 4 (West side), UofT Athletics Centre, 55 Harbord St, Toronto, ON M5S 2W6</p>
              <p><strong>Note:</strong> Sign up for Bricks on the Forum.</p>
            </div>

            <div className="workout-type">
              <h4>🏃 Runs 🏃</h4>
              <div className="run-details">
                <div className="run-type">
                  <h5>Tuesday Track</h5>
                  <p><strong>Where:</strong> Central Tech Track, 725 Bathurst St, Toronto, ON M5S 2R5</p>
                  <p><strong>Note:</strong> Track location may change due to snow or Ice – change of location will be communicated via email and our social media</p>
                </div>
                <div className="run-type">
                  <h5>Thursday Tempo</h5>
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
