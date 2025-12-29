import React, { useState, useEffect, useRef } from 'react';
import './JoinUs.css';

const JoinUs = () => {
  const [isSticky, setIsSticky] = useState(false);
  const navRef = useRef(null);
  const navInitialTopRef = useRef(null);
  const titleRefs = useRef({});

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Store initial position
    if (navInitialTopRef.current === null) {
      navInitialTopRef.current = nav.offsetTop;
    }


    const handleScroll = () => {
      if (!nav) return;
      
      // Account for mobile navbar height
      const navbarHeight = window.innerWidth <= 768 ? 100 : 70;
      
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY;
      const shouldBeSticky = scrollY >= navInitialTopRef.current - navbarHeight;
      
      setIsSticky(shouldBeSticky);
    };

    // Use multiple event types for better iOS WebView support
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    
    // Use requestAnimationFrame for smoother updates
    let rafId = null;
    const rafHandleScroll = () => {
      handleScroll();
      rafId = requestAnimationFrame(rafHandleScroll);
    };
    rafId = requestAnimationFrame(rafHandleScroll);
    
    // Initial check
    handleScroll();
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="join-us-container">
      <div className="container">
        <h1 className="section-title">Join Us!</h1>
        
        <div ref={navRef} className={`section-navigation ${isSticky ? 'sticky' : ''}`}>
          <a href="#goal" className="nav-link">Goal</a>
          <a href="#who-can-join" className="nav-link">Who Can Join</a>
          <a href="#how-to-join" className="nav-link">How to Join</a>
          <a href="#team-charter" className="nav-link">Team Charter</a>
        </div>
        
        <div id="goal" className="goal-section">
          <h2 className="goal-title">Our Goal</h2>
          <p className="goal-text">
            To promote triathlon to the University of Toronto community through swim, bike, and run workouts which are both fun and challenging.
          </p>
        </div>

        <div id="who-can-join" className="who-can-join-section">
          <h2 className="section-subtitle">Who Can Join?</h2>
          <div className="membership-info">
            <p>
              The University of Toronto Triathlon Club is open to students, alumni, faculty, and community members of the U of T Athletic Centre who are 18 years and older (exceptions are made for current U of T students who are 17.) We welcome athletes of all abilities from experienced triathletes to those new to the sport. The club operates year round, offering professionally coached swim and run workouts and member-led bike/spin workouts.
            </p>
          </div>

          <div className="athlete-types">
            <h3>Athlete Types</h3>
            <p>The U of T Tri Club is suitable for a range of current and aspiring triathletes (18yrs+) which include:</p>
            
            <div className="athlete-category">
              <h4>🏃‍♂️ Recreational Athletes</h4>
              <p>Those who are new to endurance sports and are primarily interested in triathlon training to get back in shape.</p>
            </div>

            <div className="athlete-category">
              <h4>🏊‍♂️ Short Course Athletes</h4>
              <p>Those who have some experience in endurance sports and are primarily interested in competing in Sprint and Olympic distance triathlons/duathlons or 5k/10k running races.</p>
            </div>

            <div className="athlete-category">
              <h4>🚴‍♂️ Long Course Athletes</h4>
              <p>Those who have some experience in endurance sports and are primarily interested in competing in Long Course to Ironman distance triathlons or half-marathon/marathon running races.</p>
            </div>

            <div className="beginner-note">
              <h4>⚠️ Beginners Please Note</h4>
              <p>You must be able to swim 300m continuous before you attend the swim workouts. If you are new to swimming, the AC offers various swim classes to get you started.</p>
            </div>
          </div>
        </div>



        <div id="how-to-join" className="joining-instructions-section">
          <h2 className="section-subtitle">Joining: Step-by-step Instructions</h2>
          
          <div className="step-container">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Try Us Out</h3>
                <p>Attend any one of our workouts to meet us and try it out! For indoor spin workouts, email <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a> to make sure there is a bike reserved for you.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Join the U of T Athletics Centre (AC)</h3>
                <p>You must be an AC-member to join the Tri Club (provides access to training facilities, including pool). U of T students are automatically AC-members during the Fall and Winter terms. Otherwise, AC-membership can be purchased at the AC Main Office.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Join the Tri Club</h3>
                <p>To register for the Tri Club go to <a href="https://recreation.utoronto.ca" target="_blank" rel="noopener noreferrer">recreation.utoronto.ca</a> or register in person at the AC Main Office.</p>
                
                <div className="packages-info">
                  <h4>There are 3 packages available:</h4>
                  <ul>
                    <li><strong>Triathlon</strong> (Swim, Run + Spin Workouts)</li>
                    <li><strong>Duathlon</strong> (Run + Spin Workouts)</li>
                    <li><strong>Run only</strong></li>
                  </ul>
                  
                  <div className="fees-section">
                    <h4>Fees:</h4>
                    <p><em>*Half = Fall or Winter only | Full = Both Fall and Winter</em></p>
                    <div className="fee-grid">
                      <div className="fee-item">
                        <span className="fee-name">Full Tri:</span>
                        <span className="fee-amount">$256 + HST</span>
                      </div>
                      <div className="fee-item">
                        <span className="fee-name">Half Tri:</span>
                        <span className="fee-amount">$136 + HST</span>
                      </div>
                      <div className="fee-item">
                        <span className="fee-name">Full Du:</span>
                        <span className="fee-amount">$213 + HST</span>
                      </div>
                      <div className="fee-item">
                        <span className="fee-name">Half Du:</span>
                        <span className="fee-amount">$122 + HST</span>
                      </div>
                      <div className="fee-item">
                        <span className="fee-name">Full Run:</span>
                        <span className="fee-amount">$182 + HST</span>
                      </div>
                      <div className="fee-item">
                        <span className="fee-name">Half Run:</span>
                        <span className="fee-amount">$101 + HST</span>
                      </div>
                    </div>
                  </div>

                  <div className="registration-info">
                    <h4>Current 2025/26 Registration Links:</h4>
                    <p><a href="https://recreation.utoronto.ca" target="_blank" rel="noopener noreferrer">Register here</a>. "Club Sports: Triathlon Club" You must have a AC membership to join the Triathlon Club.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>Join the Forum, Facebook Page and Google Groups</h3>
                <p>The Forum is where the workouts, including locations, are posted, and where members sign up for indoor spin. For Forum access, please email <a href="mailto:info@uoft-triathlon.com">info@uoft-tri.club</a> with your registration receipt.</p>
                <p>Joining the Google Group subscribes you to the weekly bulletin of updates and news about the club. You can find the group by searching "University of Toronto Triathlon" in the Google Groups function.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">5</div>
              <div className="step-content">
                <h3>Come to the workouts!</h3>
                <p>For all other inquiries or questions please email <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a></p>
              </div>
            </div>
          </div>
        </div>



        <div id="team-charter" className="charter-section">
          <h2 className="section-subtitle">Team Charter</h2>
          <div className="charter-notice">
            <p><strong>⚠️ Important:</strong> All members must agree to this charter before signing up.</p>
          </div>
          
          <div className="charter-content">
            <h3>The University of Toronto Triathlon Club Charter</h3>
            
            <h4>Introduction</h4>
            <p>The University of Toronto Triathlon Club ("UofT Tri Club") is a triathlon club which is open to all individuals which are members of the Athletic Center - please note you have to be 18 years old, unless you are a 17 year old student (see the Athletic Centers guidelines for more information).</p>
            
            <p>The UofT Tri Club is run by an executive team, which consists of different members who volunteer their time. While the executive team will change, they are best reached by email at <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>, additionally you can reach out through social media. Please give them time to answer.</p>
            
            <p>The Executive Team consists of the following positions: President, Treasurer, Secretary, Webmaster, Social coordinator and Social Media Manager; positions can be filled by one or more individuals.</p>
            
            <p>Positions and titles can be updated to meet current needs. Some workouts have coaches, more details under sections 4-6, their contact details are on the UofT Tri Club website. This Charter is a living document, changes can be made when deemed appropriate.</p>

            <h4>Requirements</h4>
            <p>We are open to all beginners, however for safety and cohesion in the pool we do require members who have joined for the full triathlon option to be able to swim 300 meter continuous (turns should not take more than 3 seconds) Front Crawl in under 10 minutes and 30 seconds.</p>

            <h4>General Conduct</h4>
            <p>At all times members must act with integrity, honesty, fairness, and respect in accordance with the University of Toronto Faculty of Kinesiology & Physical Education Student & Member Code of Conduct, the Code of Student Conduct (if the member is also an enrolled student), and the Policy for Safety in Athletic Facilities.</p>
            
            <p>While triathlon is not a contact sport, we understand that inadvertent contact sometimes occurs, try your best to be aware of your surroundings and communicate with others.</p>

            <h4>Swim Specific Conduct</h4>
            <ul>
              <li>Respect and listen to the pool staff, they are there not only for the training but also to ensure our safety while we swim.</li>
              <li>Lanes are populated by members on the basis of swim skill, speed, and fitness level - typically increasing in intensity with every subsequent lane. If you are unsure about placement please ask the coach so that they may assist in finding an appropriate lane.</li>
              <li>Members are expected to be able to circle swim within their lanes, unless it is safe to swim side by side.</li>
              <li>When circle swimming, members need to push off the walls at safe distances, usually 10 to 5 seconds unless otherwise specified by the coaches.</li>
              <li>Be on time for the swim workouts, this allows people to start the workout together, avoiding individuals swimming different parts of the workout in the same lane.</li>
              <li>The coaches will track your punctuality, if you are consistently late, late being defined as more than 10 minutes, you can face a suspension of not being allowed to swim (exceptions are described in section Cii).</li>
              <li>We understand that life can get in the way, and that the swim times might not work in your favor, if you know you will consistently come X minutes late (for whatever reason) then let the coaches know, additionally it is likely you will swim with similar people so let them know as well.</li>
              <li>If you are late, first let a coach know you are here, then go to your usual lane and WAIT until all swimmers are stopped or there is a break in the set, let the other swimmers know what you will be doing and then seed yourself accordingly; disregarding this can lead to collisions which poses a safety risk.</li>
              <li>Follow the workouts: the workouts are specifically written for the given training session, if you can't do parts of the workouts or want to modify sections let the coaches and other lane members know.</li>
              <li>If at any point the coaches feel you do not meet the requirement or are a safety issue, it is up to their discretion to ask you not to come to training, with the backing of the UofT Tri Club executive team, if relevant a refund can be given.</li>
              <li>The coaches appreciate feedback but ensure this is done in a respectful and constructive manner.</li>
              <li>Members can leave once they are done, or if they hit a time constraint.</li>
              <li>Make sure to pick up all your items and if you are the last individual leaving your lane, make sure that all printed paper workouts are cleared to avoid clogged gutters.</li>
              <li>If relevant and able we ask that members help with putting in or taking out lane ropes that way it can be done more efficiently, if you are unsure what to do, ask the pool staff for guidance.</li>
            </ul>

            <h4>Bike Specific Conduct</h4>
            <h5>Indoor Spins:</h5>
            <ul>
              <li>Indoor Spins are lead by members who follow a specific workout.</li>
              <li>Sign up: There are limited bikes, you must sign up through the forum in order to reserve a bike.</li>
              <li>Show up: if you don't show up, without canceling 12 hours before, for more than 2 times within a semester, you will be suspended from spins for a week.</li>
              <li>Be on time: after 10 minutes your bike is "given away" if another member is on the waitlist they can then take your spot; coming more than 10 minutes late is viewed as a No Show.</li>
              <li>Follow the workout: this is meant to be a group activity, please follow the workout and listen to the leader.</li>
              <li>If you have questions, please ask, the leaders would love to answer your questions, also any feedback or playlist suggestions are always welcome!</li>
            </ul>

            <h5>Outdoor Rides:</h5>
            <ul>
              <li>In the summer we shift to outdoor rides; the bike leaders will lead specific loops or paths.</li>
              <li>You need to have your own bike to participate but all speeds are welcome.</li>
              <li>If you use a tri bike instead of a road bike, please be conscientious of how this will impact your ability to break/shift and do not ride too close to other riders.</li>
              <li>Sign up: you still need to sign up that way the bike leads know to look out for you, where you should meet will be specified on the forum.</li>
              <li>Be on time: if you are late, the bike leader can choose to leave without you.</li>
              <li>You must bring a helmet! While water, nutrition and lights are encouraged you will not be allowed to ride with the group if you do not have a helmet.</li>
            </ul>

            <h5>Brick Workouts:</h5>
            <ul>
              <li>All the rules under section 5a apply.</li>
              <li>If you have an injury and can't run let the leader know in advance.</li>
              <li>When running run around the track in the posted directions.</li>
              <li>Be cautious of non-triathlon club members using the track.</li>
            </ul>

            <h4>Run Specific Conduct</h4>
            <h5>Track Runs:</h5>
            <ul>
              <li>Track runs are coached.</li>
              <li>Listen to the coach and follow the workout; modifications are always possible, just let the coach know.</li>
              <li>Be on time: this allows us all to work together.</li>
              <li>All speeds are welcome, usually more than one group forms to ensure everyone gets the right amount of rest.</li>
            </ul>

            <h5>Group Tempo Runs:</h5>
            <ul>
              <li>These runs occur as a social run once a week.</li>
              <li>Specific routes are picked out, but may be changed due to weather conditions.</li>
              <li>Be on time: the group meets at 6:15 pm, unless otherwise specified, if you are late they might leave without you.</li>
              <li>If relevant more than one pace group will be created to ensure everyone can participate.</li>
            </ul>

            <h4>Accommodations</h4>
            <p>Accommodations must be requested through the Athletic Center, the club will follow suit and meet all accommodations granted.</p>

            <h4>Safety and Responsibility</h4>
            <ul>
              <li>Safety is always our number one priority.</li>
              <li>If you do not feel well, let a coach, leader or another member know it is always ok to stop and rest.</li>
              <li>Ensure to follow traffic laws when biking and running outside.</li>
              <li>Use properly functioning equipment.</li>
              <li>Be aware of injuries and let your body rest and recover appropriately.</li>
              <li>If there are safety procedure (ie a fire drill) during indoor trainings, members are expected to stop their workout and follow the announced safety procedures.</li>
              <li>We take any type of head collisions very seriously, if you hit your head STOP, let someone know, and monitor for any symptoms of a concussion. A good resource can be found on the UofT website.</li>
            </ul>

            <h4>Inclusivity and Respect</h4>
            <ul>
              <li>Promote an inclusive environment free from discrimination, harassment, or bullying.</li>
              <li>Respect individual differences including race, gender, sexual orientation, ability, religion, and age.</li>
              <li>Be welcoming and supportive of new and less experienced members.</li>
            </ul>

            <h4>Accountability and Discipline</h4>
            <ul>
              <li>Members who breach this Charter may be subject to disciplinary action, which could include warnings, suspension, or expulsion from the club.</li>
              <li>The UofT Tri Club executive team reserves the right to investigate and address all complaints or concerns confidentially and fairly.</li>
              <li>The UofT Tri Club executive team reserves the right to suspend or expel any member from the club based off of complaints or investigations.</li>
              <li>If issues come up you can report them to the executive team or file a report with the Athletic Center, all reporting will be treated on a need to know basis and nothing will be shared without permission.</li>
            </ul>

            <h4>Agreement</h4>
            <p>By joining the UofT Tri Club, members agree to abide by this Charter and uphold its values throughout their participation.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinUs;
