import React from 'react';
import './PrivacyPolicy.css';

const PrivacyPolicy = () => {
  return (
    <div className="privacy-policy">
      <div className="privacy-container">
        <h1>Privacy Policy</h1>

        <p className="effective-date">Last updated: January 2026</p>

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
          We share data only with service providers who help us run the service (hosting, email/SMS,
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

        <h2>Your Choices</h2>
        <ul>
          <li>Access or update your profile information.</li>
          <li>Request account deletion.</li>
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
import React from 'react';
import './PrivacyPolicy.css';

const PrivacyPolicy = () => {
  return (
    <div className="privacy-container">
      <div className="privacy-content">
        <h1>Privacy Policy</h1>
        <p>Last updated: January 2026</p>

        <h2>What We Collect (Data Linked to You)</h2>
        <ul>
          <li>Account & membership: name, email, phone number, hashed password, role/member status, term/expiry, and membership receipt status.</li>
          <li>Activity: forum/workout/event/race signups, attendance, and related preferences.</li>
          <li>Device/usage: app/server logs (IP, device/browser info) to operate, secure, and debug the service.</li>
          <li>Support/communications: messages you send us (e.g., email, contact requests).</li>
        </ul>

        <h2>How We Use It</h2>
        <ul>
          <li>Provide and manage your account, membership access, and eligibility (e.g., forum, workouts, races).</li>
          <li>Send essential notifications (e.g., role changes, receipts, waitlist promotions); optional marketing only with consent.</li>
          <li>Maintain security, prevent abuse/fraud, troubleshoot issues, and improve reliability.</li>
        </ul>

        <h2>Sharing</h2>
        <ul>
          <li>We do not sell your data.</li>
          <li>We share only with service providers needed to run the app (e.g., hosting, email/push/SMS), under confidentiality and security obligations.</li>
          <li>We may disclose if required by law or to protect the safety, rights, or integrity of users and the service.</li>
        </ul>

        <h2>Data Retention & Security</h2>
        <ul>
          <li>Passwords are hashed; data is transmitted over HTTPS.</li>
          <li>We keep account/membership records while your account is active or as needed for club operations, legal, or security purposes. We delete or de-identify when no longer needed.</li>
        </ul>

        <h2>Your Choices</h2>
        <ul>
          <li>You can request to update or delete your account data (subject to operational/legal needs).</li>
          <li>You can opt out of non-essential communications; essential service emails may still be sent.</li>
        </ul>

        <h2>Children</h2>
        <p>The service is intended for adults and older teens. If you believe a minor’s data was provided without consent, contact us to review or remove it.</p>

        <h2>Changes</h2>
        <p>We may update this policy and will post the latest version here with the effective date.</p>

        <h2>Contact</h2>
        <p>Questions or privacy requests: <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>.</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

