import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AdminGuide = () => {
  const { currentUser } = useAuth();
  const isAdministrator = currentUser?.role === 'administrator';
  const roleLabel = isAdministrator ? 'Administrator' : 'Executive';

  return (
    <div className="admin-main-content">
      <div className="admin-guide admin-section">
        <div className="admin-page-header">
          <h2>Admin Guide</h2>
        </div>

        <p className="admin-guide-intro">
          Welcome! This page explains how the admin dashboard works, what you can do as a{' '}
          <strong>{roleLabel}</strong>, and how to handle the most common club tasks.
        </p>

        <nav className="admin-guide-toc" aria-label="Guide sections">
          <a href="#roles">Roles & permissions</a>
          <a href="#membership">Membership & receipts</a>
          <a href="#members">Managing members</a>
          <a href="#members-table">All Members table</a>
          <a href="#terms">Terms</a>
          <a href="#communication">Email & banner</a>
          <a href="#other">Other tools</a>
          <a href="#tips">Quick tips</a>
        </nav>

        <section id="roles" className="admin-guide-section">
          <h3>Roles & permissions</h3>
          <p>
            The site uses a role hierarchy. Higher roles include everything below them for
            general member access, but admin permissions are split between executives and
            administrators.
          </p>

          <div className="admin-guide-roles">
            <div className="admin-guide-role-card">
              <h4>Executive</h4>
              <ul>
                <li>View all members and membership status</li>
                <li>View the receipt queue (cannot approve or reject)</li>
                <li>Send club emails and manage the site banner</li>
                <li>View and export attendance</li>
                <li>Manage interval results (if also a coach)</li>
              </ul>
            </div>
            <div className="admin-guide-role-card admin-guide-role-card-highlight">
              <h4>Administrator</h4>
              <p className="admin-guide-role-note">Everything executives can do, plus:</p>
              <ul>
                <li><strong>Approve or reject</strong> membership receipts</li>
                <li>Edit member roles, terms, and profile details</li>
                <li>Create and manage membership terms</li>
                <li>Manage merch orders</li>
                <li>Delete members and other sensitive actions</li>
              </ul>
            </div>
          </div>

          <p className="admin-guide-callout">
            You are signed in as a <strong>{roleLabel}</strong>.
            {isAdministrator
              ? ' You can approve receipts and make full membership changes.'
              : ' If a receipt needs approval, ask an administrator — only they can activate members.'}
          </p>
        </section>

        <section id="membership" className="admin-guide-section">
          <h3>Membership & receipts</h3>
          <p>
            Members no longer email receipts manually. They upload proof of payment from their{' '}
            <NavLink to="/profile">Profile</NavLink> page under <strong>Activate your membership</strong>.
          </p>

          <ol className="admin-guide-steps">
            <li>Member pays the club fee (outside the website).</li>
            <li>Member uploads a receipt image or PDF and selects the term they paid for.</li>
            <li>The receipt appears in <NavLink to="/admin/receipts">Receipts</NavLink> with status <em>pending review</em>.</li>
            <li>An <strong>administrator</strong> reviews the receipt and approves or rejects it.</li>
            <li>On approval, the member is activated, assigned their term, and notified by email.</li>
          </ol>

          <div className="admin-guide-subsection">
            <h4>Receipt statuses</h4>
            <ul>
              <li><span className="receipt-status pending_review">pending review</span> — waiting for an administrator</li>
              <li><span className="receipt-status approved">approved</span> — member activated for the selected term</li>
              <li><span className="receipt-status rejected">rejected</span> — member notified; they can upload a new receipt</li>
            </ul>
          </div>

          <div className="admin-guide-subsection">
            <h4>Membership status (Status column)</h4>
            <p>
              The <strong>Status</strong> column reflects whether someone currently has valid membership
              access. See the <a href="#members-table">All Members table</a> section for every column explained.
            </p>
            <ul>
              <li><span className="membership-status active">Active</span> — valid membership for their assigned term</li>
              <li><span className="membership-status expiring_soon">Expiring soon</span> — term ends within 7 days; they should renew</li>
              <li><span className="membership-status expired">Expired</span> — term has ended; forum and member features are locked until they renew</li>
              <li><span className="membership-status pending_review">Under review</span> — they uploaded a receipt that is waiting for administrator approval</li>
              <li><span className="membership-status not_member">Not a member</span> — account is still pending registration, or they have no active membership</li>
            </ul>
            <p>
              Coaches, executives, and administrators always show as active — their access does not expire with terms.
            </p>
          </div>

          {isAdministrator && (
            <p className="admin-guide-callout admin-guide-callout-info">
              When you have pending receipts, a red count appears next to <strong>Receipts</strong> in
              this sidebar and on your profile avatar when you are outside the admin area.
            </p>
          )}
        </section>

        <section id="members" className="admin-guide-section">
          <h3>Managing members</h3>
          <p>
            <NavLink to="/admin/members">All Members</NavLink> lists everyone on the site. Use search to
            find someone by name or email.
          </p>

          {isAdministrator ? (
            <>
              <p>Click <strong>Edit</strong> on a member to change:</p>
              <ul>
                <li><strong>Role</strong> — pending, member, coach, executive, or administrator</li>
                <li><strong>Term</strong> — controls when their membership expires (shown with season + year, e.g. Fall/Winter 2025–26)</li>
                <li><strong>Sport</strong> — triathlon, duathlon, run only, or swim only</li>
                <li><strong>Charter accepted</strong> — whether they agreed to the team charter</li>
              </ul>
              <p>
                For renewals, members should upload a receipt. You can also manually assign a term
                when editing a member if needed.
              </p>
            </>
          ) : (
            <p>
              As an executive, you can view the member list and statuses but cannot edit members.
              Contact an administrator for role or term changes.
            </p>
          )}

          <div id="members-table" className="admin-guide-subsection admin-guide-columns-section">
            <h4>All Members table — column guide</h4>
            <p>
              Every column on the <NavLink to="/admin/members">All Members</NavLink> page, and what it means:
            </p>

            <dl className="admin-guide-columns">
              <div className="admin-guide-column-item">
                <dt>Name</dt>
                <dd>The member's display name on the site.</dd>
              </div>
              <div className="admin-guide-column-item">
                <dt>Email</dt>
                <dd>Their login email and where system notifications are sent.</dd>
              </div>
              <div className="admin-guide-column-item">
                <dt>Role</dt>
                <dd>
                  Their permission level on the site — separate from membership Status:
                  <ul>
                    <li><span className="role-badge pending">pending</span> — registered but not yet activated</li>
                    <li><span className="role-badge member">member</span> — regular club member; access can expire by term</li>
                    <li><span className="role-badge coach">coach</span> — can post workouts, take attendance, and manage interval results</li>
                    <li><span className="role-badge exec">exec</span> — executive; can access most admin tools (view-only for some actions)</li>
                    <li><span className="role-badge administrator">administrator</span> — full admin, including approving receipts and editing members</li>
                  </ul>
                </dd>
              </div>
              <div className="admin-guide-column-item">
                <dt>Status</dt>
                <dd>
                  Whether their <em>membership</em> is currently valid (see badges above). A person can
                  have role <strong>member</strong> but status <strong>Expired</strong> if their term ended.
                </dd>
              </div>
              <div className="admin-guide-column-item">
                <dt>Sport</dt>
                <dd>
                  Which workouts they see and can sign up for:
                  Triathlon, Duathlon, Run Only, or Swim Only. Swim-only members only see swim workouts
                  in the forum; coaches can change this when editing a member.
                </dd>
              </div>
              <div className="admin-guide-column-item">
                <dt>Phone Number</dt>
                <dd>Optional contact number the member added to their profile. Shows "Not set" if blank.</dd>
              </div>
              <div className="admin-guide-column-item">
                <dt>Join Date</dt>
                <dd>
                  The date they were first activated as a member — usually set automatically when a
                  receipt is approved. Shows "Not set" for accounts that have never been activated.
                </dd>
              </div>
              <div className="admin-guide-column-item">
                <dt>Term</dt>
                <dd>
                  The membership season they are assigned to (e.g. Fall/Winter 2025–26). The term's
                  end date controls when their access expires. Shows "Not set" if no term is assigned.
                </dd>
              </div>
              <div className="admin-guide-column-item">
                <dt>Absences</dt>
                <dd>
                  Running count of times they signed up for a workout but were marked absent when
                  attendance was submitted. Used to track no-shows — not automatically reset each term.
                </dd>
              </div>
              <div className="admin-guide-column-item">
                <dt>Charter Accepted</dt>
                <dd>
                  Whether the member has accepted the team charter (✅ Yes / ❌ No). Members may be
                  prompted to accept it when they log in if they haven't yet.
                </dd>
              </div>
              <div className="admin-guide-column-item">
                <dt>Actions</dt>
                <dd>
                  {isAdministrator ? (
                    <>
                      <strong>Edit</strong> opens the member editor (role, term, sport, charter).{' '}
                      <strong>Delete</strong> permanently removes the user and all their data — this
                      cannot be undone.
                    </>
                  ) : (
                    <>Edit and Delete are only available to administrators.</>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="terms" className="admin-guide-section">
          <h3>Membership terms</h3>
          <p>
            Terms define membership seasons and when access expires. Each term has a <strong>year</strong>
            so seasons stay unambiguous across years.
          </p>
          <p>
            The six signup options — <strong>Fall/Winter</strong>, <strong>Fall</strong>, <strong>Winter</strong>,
            <strong> Spring</strong>, <strong>Spring/Summer</strong>, and <strong>Summer</strong> — are
            created automatically for the current and next academic year when the server starts.
            Admins only need to use the Terms page to adjust dates or add one-off terms.
          </p>
          {isAdministrator ? (
            <>
              <p>
                On the <NavLink to="/admin/terms">Terms</NavLink> page you can edit dates or add extra terms:
              </p>
              <ul>
                <li>Fall/Winter spans two calendar years and shows as 2025–26</li>
                <li>The <strong>end date</strong> is when member access expires</li>
                <li>Spring/Summer and Summer may overlap — that is expected</li>
                <li>Auto-created terms are never overwritten; edits you save persist</li>
              </ul>
              <p>You cannot delete a term that still has members assigned to it.</p>
            </>
          ) : (
            <p>
              Only administrators can create or edit terms. You can view existing terms on the{' '}
              <NavLink to="/admin/terms">Terms</NavLink> page.
            </p>
          )}
        </section>

        <section id="communication" className="admin-guide-section">
          <h3>Email & site banner</h3>

          <div className="admin-guide-subsection">
            <h4><NavLink to="/admin/email">Send Email</NavLink></h4>
            <p>
              Send emails to the club mailing list or selected groups. You can attach files.
              Use this for announcements, reminders, and event updates.
            </p>
          </div>

          <div className="admin-guide-subsection">
            <h4><NavLink to="/admin/banner">Site Banner</NavLink></h4>
            <p>
              The rotating banner at the top of the site is for short, timely announcements
              (practice changes, registration deadlines, etc.). Keep messages brief — members see
              them on every page.
            </p>
          </div>
        </section>

        <section id="other" className="admin-guide-section">
          <h3>Other admin tools</h3>

          <ul className="admin-guide-tool-list">
            <li>
              <NavLink to="/admin/attendance">Attendance</NavLink> — view workout sign-ups and
              attendance records; filter by date range and workout type.
            </li>
            {isAdministrator && (
              <li>
                <NavLink to="/admin/orders">Merch Orders</NavLink> — view and manage team gear
                orders (administrators only).
              </li>
            )}
            <li>
              <NavLink to="/admin/interval-results">Interval Results</NavLink> — enter and review
              workout interval times (coaches, executives, and administrators).
            </li>
          </ul>
        </section>

        <section id="tips" className="admin-guide-section">
          <h3>Quick tips</h3>
          <ul>
            <li>
              <strong>New member stuck on pending?</strong> Check{' '}
              <NavLink to="/admin/receipts">Receipts</NavLink> — they may have uploaded payment proof
              that still needs approval.
            </li>
            <li>
              <strong>Member says forum is locked?</strong> Their term may have expired. They need
              to renew and upload a new receipt, or an administrator can assign a current term.
            </li>
            <li>
              <strong>Wrong term on a receipt?</strong> Administrators can reject with a reason;
              the member will be emailed and can re-upload.
            </li>
            <li>
              <strong>Questions or bugs?</strong> Email{' '}
              <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default AdminGuide;
