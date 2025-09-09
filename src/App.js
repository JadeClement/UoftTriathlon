import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Forum from './components/Forum';
import Schedule from './components/Schedule';
import JoinUs from './components/JoinUs';
import Races from './components/Races';
import CoachesExec from './components/CoachesExec';
import Admin from './components/Admin';
import Login from './components/Login';
import WorkoutDetail from './components/WorkoutDetail';
import EventDetail from './components/EventDetail';
import RaceDetail from './components/RaceDetail';
import Profile from './components/Profile';
import FAQ from './components/FAQ';
import Resources from './components/Resources';
import TeamGear from './components/TeamGear';
import Footer from './components/Footer';
import ResetPassword from './components/ResetPassword';
import { AuthProvider, useAuth } from './context/AuthContext';
import CharterModal from './components/CharterModal';
import RoleChangeNotification from './components/RoleChangeNotification';
import WorkInProgressBanner from './components/WorkInProgressBanner';
import useBannerHeight from './hooks/useBannerHeight';

// Scroll to top on route change
const ScrollToTop = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
};

// Charter agreement prompt
const CharterPrompt = () => {
  const { currentUser, updateUser, isTokenValid, refreshUserData } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [checkingToken, setCheckingToken] = React.useState(true);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

  const charterText = `The University of Toronto Triathlon Club Charter\nIntroduction\nThe University of Toronto Triathlon Club ("UofT Tri Club") is a triathlon club which is open to all individuals which are members of the Athletic Center - please note you have to be 18 years old, unless you are a 17 year old student (see the Athletic Centers guidelines for more information).\n\nThe UofT Tri Club is run by an executive team, which consists of different members who volunteer their time. While the executive team will change, they are best reached by email at info@uofttriathlon.com, additionally you can reach out through social media. Please give them time to answer.\n\nThe Executive Team consists of the following positions: President, Treasurer, Secretary, Webmaster, Social coordinator and Social Media Manager; positions can be filled by one or more individuals.\n\nPositions and titles can be updated to meet current needs. Some workouts have coaches, more details under sections 4-6, their contact details are on the UofT Tri Club website. \n\n This Charter is a living document, changes can be made when deemed appropriate.\n\nRequirements\nWe are open to all beginners, however for safety and cohesion in the pool we do require members who have joined for the full triathlon option to be able to swim 300 meter continuous (turns should not take more than 3 seconds) Front Crawl in under 10 minutes and 30 seconds.\n\nGeneral Conduct\nAt all times members must act with integrity, honesty, fairness, and respect in accordance with the University of Toronto Faculty of Kinesiology & Physical Education Student & Member Code of Conduct, the Code of Student Conduct (if the member is also an enrolled student), and the Policy for Safety in Athletic Facilities.\n\nWhile triathlon is not a contact sport, we understand that inadvertent contact sometimes occurs, try your best to be aware of your surroundings and communicate with others.\n\nSwim Specific Conduct\nRespect and listen to the pool staff, they are there not only for the training but also to ensure our safety while we swim.\nLanes are populated by members on the basis of swim skill, speed, and fitness level - typically increasing in intensity with every subsequent lane. If you are unsure about placement please ask the coach so that they may assist in finding an appropriate lane.\nMembers are expected to be able to circle swim within their lanes, unless it is safe to swim side by side.\nWhen circle swimming, members need to push off the walls at safe distances, usually 10 to 5 seconds unless otherwise specified by the coaches.\nBe on time for the swim workouts, this allows people to start the workout together, avoiding individuals swimming different parts of the workout in the same lane.\nThe coaches will track your punctuality, if you are consistently late, late being defined as more than 10 minutes, you can face a suspension of not being allowed to swim (exceptions are described in section Cii).\nWe understand that life can get in the way, and that the swim times might not work in your favor, if you know you will consistently come X minutes late (for whatever reason) then let the coaches know, additionally it is likely you will swim with similar people so let them know as well.\nIf you are late, first let a coach know you are here, then go to your usual lane and WAIT until all swimmers are stopped or there is a break in the set, let the other swimmers know what you will be doing and then seed yourself accordingly; disregarding this can lead to collisions which poses a safety risk.\nFollow the workouts: the workouts are specifically written for the given training session, if you can't do parts of the workouts or want to modify sections let the coaches and other lane members know.\nIf at any point the coaches feel you do not meet the requirement or are a safety issue, it is up to their discretion to ask you not to come to training, with the backing of the UofT Tri Club executive team, if relevant a refund can be given.\nThe coaches appreciate feedback but ensure this is done in a respectful and constructive manner.\nMembers can leave once they are done, or if they hit a time constraint.\nMake sure to pick up all your items and if you are the last individual leaving your lane, make sure that all printed paper workouts are cleared to avoid clogged gutters.\nIf relevant and able we ask that members help with putting in or taking out lane ropes that way it can be done more efficiently, if you are unsure what to do, ask the pool staff for guidance.\n\nBike Specific Conduct\nIndoor Spins:\nIndoor Spins are lead by members who follow a specific workout.\nSign up: There are limited bikes, you must sign up through the forum in order to reserve a bike.\nShow up: if you don't show up, without canceling 24 hours before, for more than 2 times within a semester, you will be suspended from spins for a week.\nBe on time: after 10 minutes your bike is "given away" if another member is on the waitlist they can then take your spot; coming more than 10 minutes late is viewed as a No Show.\nFollow the workout: this is meant to be a group activity, please follow the workout and listen to the leader.\nIf you have questions, please ask, the leaders would love to answer your questions, also any feedback or playlist suggestions are always welcome!\nOutdoor Rides:\nIn the summer we shift to outdoor rides; the bike leaders will lead specific loops or paths.\nYou need to have your own bike to participate but all speeds are welcome.\nIf you use a tri bike instead of a road bike, please be conscientious of how this will impact your ability to break/shift and do not ride too close to other riders.\nSign up: you still need to sign up that way the bike leads know to look out for you, where you should meet will be specified on the forum.\nBe on time: if you are late, the bike leader can choose to leave without you.\nYou must bring a helmet! While water, nutrition and lights are encouraged you will not be allowed to ride with the group if you do not have a helmet.\nBrick Workouts:\nAll the rules under section 5a apply.\nIf you have an injury and can't run let the leader know in advance.\nWhen running run around the track in the posted directions.\nBe cautious of non-triathlon club members using the track.\n\nRun Specific Conduct\nTrack Runs:\nTrack runs are coached.\nListen to the coach and follow the workout; modifications are always possible, just let the coach know.\nBe on time: this allows us all to work together.\nAll speeds are welcome, usually more than one group forms to ensure everyone gets the right amount of rest.\nGroup Tempo Runs:\nThese runs occur as a social run once a week.\nSpecific routes are picked out, but may be changed due to weather conditions.\nBe on time: the group meets at 6:15 pm, unless otherwise specified, if you are late they might leave without you.\nIf relevant more than one pace group will be created to ensure everyone can participate.\n\nAccommodations\nAccommodations must be requested through the Athletic Center, the club will follow suit and meet all accommodations granted.\n\nSafety and Responsibility\nSafety is always our number one priority.\nIf you do not feel well, let a coach, leader or another member know it is always ok to stop and rest.\nEnsure to follow traffic laws when biking and running outside.\nUse properly functioning equipment.\nBe aware of injuries and let your body rest and recover appropriately.\nIf there are safety procedure (ie a fire drill) during indoor trainings, members are expected to stop their workout and follow the announced safety procedures.\nWe take any type of head collisions very seriously, if you hit your head STOP, let someone know, and monitor for any symptoms of a concussion. A good resource can be found on the UofT website.\n\nInclusivity and Respect\nPromote an inclusive environment free from discrimination, harassment, or bullying.\nRespect individual differences including race, gender, sexual orientation, ability, religion, and age.\nBe welcoming and supportive of new and less experienced members.\n\nAccountability and Discipline\nMembers who breach this Charter may be subject to disciplinary action, which could include warnings, suspension, or expulsion from the club.\nThe UofT Tri Club executive team reserves the right to investigate and address all complaints or concerns confidentially and fairly.\nThe UofT Tri Club executive team reserves the right to suspend or expel any member from the club based off of complaints or investigations.\nIf issues come up you can report them to the executive team or file a report with the Athletic Center, all reporting will be treated on a need to know basis and nothing will be shared without permission.\n\nAgreement\nBy joining the UofT Tri Club, members agree to abide by this Charter and uphold its values throughout their participation.`;

  React.useEffect(() => {
    if (!currentUser) {
      setCheckingToken(false);
      return;
    }
    
    console.log('🔒 Charter: User state changed:', currentUser);
    console.log('🔒 Charter: charterAccepted value:', currentUser.charterAccepted);
    
    // Check if user has already accepted the charter
    // Backend uses 'charter_accepted', frontend was using 'charterAccepted'
    const charterAccepted = currentUser.charter_accepted || currentUser.charterAccepted;
    if (charterAccepted === 1 || charterAccepted === true) {
      console.log('🔒 Charter: User already accepted, closing modal');
      setOpen(false);
      setCheckingToken(false);
      return; // Don't show modal for users who already accepted
    }
    
    // Only show modal for users who haven't accepted
    console.log('🔒 Charter: User needs to accept charter, opening modal');
    setOpen(true);
    setCheckingToken(false);
  }, [currentUser]);

  // Check token validity when component mounts
  React.useEffect(() => {
    const validateToken = async () => {
      if (currentUser) {
        const isValid = await isTokenValid();
        if (!isValid) {
          console.log('🔒 Charter: Token invalid, refreshing user data...');
          const refreshed = await refreshUserData();
          if (!refreshed) {
            console.log('🔒 Charter: Failed to refresh user data, user will need to login again');
          }
        }
      }
      setCheckingToken(false);
    };

    validateToken();
  }, [currentUser, isTokenValid, refreshUserData]);

  const handleAgree = async () => {
    try {
      console.log('🔒 Charter: Button clicked, starting agreement process...');
      console.log('🔒 Charter: Current user state:', currentUser);
      
      const token = localStorage.getItem('triathlonToken');
      console.log('🔒 Charter: Token found:', token ? 'Yes' : 'No');
      console.log('🔒 Charter: Token value:', token);
      
      if (!token) {
        console.error('🔒 Charter: No token found! User needs to log in again.');
        return;
      }
      
      const res = await fetch(`${API_BASE_URL}/users/accept-charter`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔒 Charter: Response status:', res.status);
      
      if (res.ok) {
        console.log('🔒 Charter: Success! Updating user and closing modal...');
        updateUser({ charter_accepted: true });
        setOpen(false);
      } else {
        const errorText = await res.text();
        console.error('🔒 Charter: Server error:', res.status, errorText);
      }
    } catch (e) {
      console.error('🔒 Charter: Network/fetch error:', e);
    }
  };

  // Don't render anything if checking token, no user, or if user already accepted
  const charterAccepted = currentUser?.charter_accepted || currentUser?.charterAccepted;
  if (checkingToken || !currentUser || charterAccepted === true || charterAccepted === 1) {
    return null;
  }

  return (
    <CharterModal open={open} onAgree={handleAgree} charterText={charterText} />
  );
}

function AppContent() {
  const { currentUser } = useAuth();
  
  return (
    <>
      <RoleChangeNotification currentUser={currentUser} />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/forum" element={<Forum />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/join-us" element={<JoinUs />} />
          <Route path="/races" element={<Races />} />
          <Route path="/coaches-exec" element={<CoachesExec />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/team-gear" element={<TeamGear />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:role/:name" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/workout/:id" element={<WorkoutDetail />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/race/:id" element={<RaceDetail />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

function App() {
  const { bannerHeight, bannerRef } = useBannerHeight();
  
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <ScrollToTop />
          <WorkInProgressBanner bannerRef={bannerRef} />
          <Navbar />
          <CharterPrompt />
          <AppContent />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
