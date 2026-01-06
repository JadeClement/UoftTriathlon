import React from 'react';
import './PrivacyPolicy.css';

const PrivacyPolicy = () => {
  return (
    <div className="privacy-container">
      <div className="privacy-content">
        <h1>Privacy Policy</h1>
        <p>Last updated: January 2026</p>

        <h2>What We Collect</h2>
        <ul>
          <li>Account info: name, email, phone number, password (hashed), role/member status.</li>
          <li>Membership/term info and workout/race signups.</li>
          <li>Device and app telemetry (basic logs/requests) to operate the service.</li>
        </ul>

        <h2>How We Use It</h2>
        <ul>
          <li>To create and manage your account and membership access.</li>
          <li>To enable forum, schedule, workouts, races, notifications, and support.</li>
          <li>To maintain security, prevent abuse, and improve reliability.</li>
        </ul>

        <h2>Sharing</h2>
        <ul>
          <li>We do not sell your data.</li>
          <li>We share only with service providers needed to run the app (e.g., hosting, email/push), under confidentiality and security obligations.</li>
        </ul>

        <h2>Retention & Security</h2>
        <ul>
          <li>Passwords are stored hashed; data is transmitted over HTTPS.</li>
          <li>We retain account data while your account is active or as needed to operate the club and meet legal requirements.</li>
        </ul>

        <h2>Your Choices</h2>
        <ul>
          <li>You can request updates or deletion of your account data (subject to club or legal needs).</li>
          <li>You can adjust notification preferences in the app where available.</li>
        </ul>

        <h2>Contact</h2>
        <p>If you have questions or requests about privacy, contact us at <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>.</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

