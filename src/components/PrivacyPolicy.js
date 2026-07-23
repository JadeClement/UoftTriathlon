import React from 'react';
import './PrivacyPolicy.css';

const PrivacyPolicy = () => {
  return (
    <div className="privacy-policy">
      <div className="privacy-container">
        <h1>Privacy Policy</h1>

        <p className="effective-date">Last updated: July 2026</p>

        <p>
          This policy explains what information we collect through the UofT Triathlon website and app,
          how we use it, and your choices. If you have questions, contact us at{' '}
          <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>.
        </p>

        <h2>Information We Collect</h2>
        <ul>
          <li><strong>Account details:</strong> name, email, phone number, hashed password, role (member/coach/exec), sport preference, membership term info.</li>
          <li><strong>Activity data:</strong> workout/event/race signups, attendance, messages/posts you create.</li>
          <li><strong>Device & security:</strong> login timestamps/IP (for security logs), push notification tokens (for opt-in alerts).</li>
        </ul>

        <h2>How We Use It</h2>
        <ul>
          <li>To create and manage your account and membership status.</li>
          <li>To schedule workouts, races, and send related notifications you opt into.</li>
          <li>To keep the service secure (fraud/abuse prevention, login auditing).</li>
          <li>To improve reliability and user experience.</li>
        </ul>

        <h2>What We Don&rsquo;t Do</h2>
        <ul>
          <li>We don&rsquo;t sell your data.</li>
          <li>We don&rsquo;t use your data for third-party advertising or cross-app tracking.</li>
        </ul>

        <h2>Sharing</h2>
        <p>
          We share data only with service providers who help us run the service (hosting, email,
          push notifications, analytics), under agreements that restrict their use of your data. We
          may disclose information if required by law or to protect safety.
        </p>

        <h2>Data Retention & Security</h2>
        <p>
          Passwords are stored as salted hashes. We keep account and activity data while your account
          is active and as needed for operations and safety. You can request deletion by emailing{' '}
          <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>; some minimal records (e.g., legal/safety logs)
          may remain where required.
        </p>

        <h2>Account &amp; Data Deletion</h2>
        <p>
          You can delete your account or specific data without contacting us first. You can also email{' '}
          <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a> if you need help.
        </p>

        <h3>Delete your account</h3>
        <ol>
          <li>Log in at <a href="https://www.uoft-tri.club/login">uoft-tri.club</a> or in the app.</li>
          <li>Go to <strong>Profile</strong>.</li>
          <li>Tap or click <strong>Edit</strong>.</li>
          <li>Scroll to the bottom and choose <strong>Delete Account</strong>.</li>
        </ol>
        <p>
          This permanently deletes your account and associated data, including profile details, workout and
          race signups, attendance records, forum posts, notification preferences, and push tokens.
          Some minimal security or legal records may be retained where required by law.
        </p>

        <h3>Delete some data without deleting your account</h3>
        <ul>
          <li>Remove your profile photo from <strong>Profile → Edit</strong>.</li>
          <li>Delete forum, workout, or event posts you created.</li>
          <li>Update or remove profile details such as your bio or phone number from <strong>Profile → Edit</strong>.</li>
          <li>Email <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a> to request deletion of other specific data.</li>
        </ul>

        <h2>Your Choices</h2>
        <ul>
          <li>Access or update your profile information.</li>
          <li>Delete your account or specific data using the steps above.</li>
          <li>Control push/email preferences where offered.</li>
        </ul>

        <h2>Children</h2>
        <p>
          This service is intended for adults and eligible students per club policy. We do not knowingly
          collect information from children under applicable age thresholds.
        </p>

        <h2>Contact</h2>
        <p>
          Email: <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

