// Centralized membership status logic so the backend and (via API) the frontend
// all agree on what "active" / "expired" means.

const MEMBER_ROLES = ['member', 'coach', 'exec', 'administrator'];

// Number of days before term end where we start warning the user to renew.
const DEFAULT_EXPIRING_SOON_DAYS = 14;

/**
 * Derive a single membership status from the pieces of state we track.
 *
 * Possible values:
 *  - 'not_member'      role is pending / no membership
 *  - 'pending_review'  a receipt has been submitted and is awaiting admin review
 *  - 'active'          approved member (or coach/exec/admin) with a valid term
 *  - 'expiring_soon'   active but the assigned term ends within N days
 *  - 'expired'         approved member whose assigned term has ended
 *
 * @param {Object} opts
 * @param {string} opts.role                 user role
 * @param {string|Date|null} opts.termEndDate assigned term end_date (or null)
 * @param {boolean} opts.hasPendingReceipt   whether a pending_review receipt exists
 * @param {number} [opts.expiringSoonDays]
 * @returns {string}
 */
function computeMembershipStatus({ role, termEndDate, hasPendingReceipt = false, expiringSoonDays = DEFAULT_EXPIRING_SOON_DAYS }) {
  const isMemberish = MEMBER_ROLES.includes(role);

  // Determine the "base" status ignoring any pending receipt.
  let base;
  if (!isMemberish) {
    base = 'not_member';
  } else if (role !== 'member') {
    // Coaches, execs, and admins never expire.
    base = 'active';
  } else if (!termEndDate) {
    // A plain member with no term assigned is treated as active (matches the
    // access middleware, which only blocks members whose assigned term ended).
    base = 'active';
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(termEndDate);
    end.setHours(0, 0, 0, 0);

    if (end < today) {
      base = 'expired';
    } else {
      const soon = new Date(today);
      soon.setDate(soon.getDate() + expiringSoonDays);
      base = end <= soon ? 'expiring_soon' : 'active';
    }
  }

  // A pending receipt only changes the picture for people who aren't currently
  // in good standing (renewing early shouldn't hide an active badge).
  if (hasPendingReceipt && (base === 'not_member' || base === 'expired')) {
    return 'pending_review';
  }

  return base;
}

const STATUS_LABELS = {
  not_member: 'Not a member',
  pending_review: 'Receipt under review',
  active: 'Active',
  expiring_soon: 'Expiring soon',
  expired: 'Expired'
};

function membershipStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

/**
 * Human-friendly term label, e.g. "Fall 2025" or "Fall/Winter 2025–26".
 * Uses the stored year (starting academic year). Falls back to dates if needed.
 */
function formatTermLabel(term) {
  if (!term || !term.term) return '';
  const seasonRaw = String(term.term);
  const season = seasonRaw
    .split('/')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('/');

  let startYear = term.year != null ? parseInt(term.year, 10) : null;
  if (startYear == null && term.start_date) {
    const d = new Date(`${term.start_date}T00:00:00`);
    if (!Number.isNaN(d.getFullYear())) startYear = d.getFullYear();
  }
  if (startYear == null) return season;

  // Only fall/winter actually crosses a calendar-year boundary, so only it shows
  // a year range (e.g. "Fall/Winter 2025–26"). Spring/summer stays within one year.
  const spans = seasonRaw.toLowerCase() === 'fall/winter';
  if (spans) {
    const nextTwo = String((startYear + 1) % 100).padStart(2, '0');
    return `${season} ${startYear}\u2013${nextTwo}`;
  }
  return `${season} ${startYear}`;
}

module.exports = {
  MEMBER_ROLES,
  DEFAULT_EXPIRING_SOON_DAYS,
  computeMembershipStatus,
  membershipStatusLabel,
  formatTermLabel
};
