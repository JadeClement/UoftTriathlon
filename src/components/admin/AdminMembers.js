import React, { useState } from 'react';
import { useAdminContext } from '../../context/AdminContext';

const MEMBERSHIP_STATUS_LABELS = {
  not_member: 'Not a member',
  pending_review: 'Under review',
  active: 'Active',
  expiring_soon: 'Expiring soon',
  expired: 'Expired',
};

const AdminMembers = () => {
  const {
    members,
    memberSearch,
    setMemberSearch,
    currentPage,
    setCurrentPage,
    membersPerPage,
    editMember,
    removeMember,
    currentUser,
    API_BASE_URL,
    showError,
    showSuccess,
  } = useAdminContext();
  const isAdministrator = currentUser?.role === 'administrator';
  const [resetTarget, setResetTarget] = useState(null);
  const [resetLink, setResetLink] = useState('');
  const [resetExpiresAt, setResetExpiresAt] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const closeResetModal = () => {
    setResetTarget(null);
    setResetLink('');
    setResetExpiresAt(null);
    setCopied(false);
  };

  const generateResetLink = async () => {
    if (!resetTarget) return;
    setResetLoading(true);
    setCopied(false);
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/admin/members/${resetTarget.id}/reset-link`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create reset link');
      }
      setResetLink(data.resetLink || '');
      setResetExpiresAt(data.expiresAt || null);
    } catch (error) {
      showError(error.message || 'Failed to create reset link');
      closeResetModal();
    } finally {
      setResetLoading(false);
    }
  };

  const copyResetLink = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink);
      setCopied(true);
      showSuccess('Reset link copied');
    } catch (_err) {
      const input = document.getElementById('admin-reset-link-input');
      if (input) {
        input.focus();
        input.select();
      }
      showError('Could not copy automatically — select the link and copy it.');
    }
  };

  return (
    <div className="admin-main-content">
      <div className="members-section admin-section">
        <h2>All Members</h2>
        <div className="admin-page-header">
          <div className="form-group member-search" style={{ maxWidth: 420, flex: '1 1 100%' }}>
            <label htmlFor="admin-member-search" className="sr-only">
              Search members by name or email
            </label>
            <input
              id="admin-member-search"
              type="search"
              className="member-search-input"
              placeholder="Search by name or email…"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              aria-label="Search members by name or email"
            />
            {memberSearch && (
              <button
                type="button"
                className="member-search-clear"
                onClick={() => setMemberSearch('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Top Pagination Controls */}
          {(() => {
            const filteredMembers = members.filter((member) => {
              const q = memberSearch.trim().toLowerCase();
              if (!q) return true;
              return (
                String(member.name || '').toLowerCase().includes(q) ||
                String(member.email || '').toLowerCase().includes(q)
              );
            });

            const totalPages = Math.ceil(filteredMembers.length / membersPerPage);
            const startIndex = (currentPage - 1) * membersPerPage;
            const endIndex = Math.min(startIndex + membersPerPage, filteredMembers.length);

            if (totalPages <= 1) return null;

            return (
              <div className="pagination-controls-top">
                <div className="pagination-info">
                  {memberSearch ? (
                    <>Showing {startIndex + 1}-{endIndex} of {filteredMembers.length} members (filtered from {members.length} total)</>
                  ) : (
                    <>Showing {startIndex + 1}-{endIndex} of {filteredMembers.length} members</>
                  )}
                </div>
                <div className="pagination-buttons">
                  <button className="pagination-btn pagination-nav-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                    First
                  </button>
                  <button className="pagination-btn pagination-nav-btn" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    const shouldShow =
                      pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 2;

                    if (!shouldShow) {
                      if (pageNum === 2 && currentPage > 4) {
                        return <span key={`ellipsis-${pageNum}`} className="pagination-ellipsis">...</span>;
                      }
                      if (pageNum === totalPages - 1 && currentPage < totalPages - 3) {
                        return <span key={`ellipsis-${pageNum}`} className="pagination-ellipsis">...</span>;
                      }
                      return null;
                    }

                    return (
                      <button
                        key={pageNum}
                        className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className="pagination-btn pagination-nav-btn"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                  <button
                    className="pagination-btn pagination-nav-btn"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Last
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
        <div className="admin-warning">
          <p><strong>⚠️ Important:</strong> The "Delete" button will permanently remove users and all their data. This action cannot be undone.</p>
        </div>
        <div className="members-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Sport</th>
                <th>Phone Number</th>
                <th>Join Date</th>
                <th>Term</th>
                <th>Absences</th>
                <th>Charter Accepted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filteredMembers = members.filter((member) => {
                  const q = memberSearch.trim().toLowerCase();
                  if (!q) return true;
                  const nameMatch = String(member.name || '').toLowerCase().includes(q);
                  const emailMatch = String(member.email || '').toLowerCase().includes(q);
                  return nameMatch || emailMatch;
                });

                const startIndex = (currentPage - 1) * membersPerPage;
                const endIndex = startIndex + membersPerPage;
                const currentMembers = filteredMembers.slice(startIndex, endIndex);

                return currentMembers.map((member) => (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>{member.email}</td>
                    <td><span className={`role-badge ${member.role}`}>{member.role}</span></td>
                    <td>
                      {member.membership_status ? (
                        <span className={`membership-status ${member.membership_status}`}>
                          {MEMBERSHIP_STATUS_LABELS[member.membership_status] || member.membership_status}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`sport-badge ${member.sport || 'triathlon'}`}>
                        {member.sport === 'run_only' ? 'Run Only' :
                         member.sport === 'swim_only' ? 'Swim Only' :
                         member.sport === 'duathlon' ? 'Duathlon' :
                         member.sport === 'triathlon' ? 'Triathlon' : 'Triathlon'}
                      </span>
                    </td>
                    <td>{member.phone_number || 'Not set'}</td>
                    <td>{member.joinDate ? new Date(member.joinDate).toLocaleDateString() : member.join_date ? new Date(member.join_date).toLocaleDateString() : 'Not set'}</td>
                    <td>
                      {member.term ? (
                        <span className={`term-badge ${member.term.toLowerCase().replace('/', '-')}`}>
                          {member.term_label || (member.term.charAt(0).toUpperCase() + member.term.slice(1))}
                        </span>
                      ) : (
                        <span className="term-badge no-term">Not set</span>
                      )}
                    </td>
                    <td>
                      <span className={`absence-count ${member.absences > 0 ? 'has-absences' : 'no-absences'}`}>
                        {member.absences || 0}
                      </span>
                    </td>
                    <td>
                      <span className={`charter-status ${member.charterAccepted ? 'accepted' : 'not-accepted'}`}>
                        {member.charterAccepted ? '✅ Yes' : '❌ No'}
                      </span>
                    </td>
                    <td>
                      <div className="member-actions">
                        {isAdministrator &&
                          (member.role !== 'administrator' ||
                            String(member.id) === String(currentUser?.id)) && (
                          <button
                            type="button"
                            className="action-btn small"
                            onClick={() => {
                              setResetLink('');
                              setResetExpiresAt(null);
                              setCopied(false);
                              setResetTarget(member);
                            }}
                          >
                            Reset password
                          </button>
                        )}
                        <button type="button" className="action-btn small" onClick={() => editMember(member)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="action-btn small danger"
                          onClick={() => removeMember(member.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {(() => {
            const filteredMembers = members.filter((member) => {
              const q = memberSearch.trim().toLowerCase();
              if (!q) return true;
              return (
                String(member.name || '').toLowerCase().includes(q) ||
                String(member.email || '').toLowerCase().includes(q)
              );
            });

            const totalPages = Math.ceil(filteredMembers.length / membersPerPage);
            const startIndex = (currentPage - 1) * membersPerPage;
            const endIndex = Math.min(startIndex + membersPerPage, filteredMembers.length);
            const shouldShowPagination = members.length > 0 && totalPages > 1;

            if (!shouldShowPagination) {
              return (
                <div className="pagination-controls">
                  <div className="pagination-info">
                    {memberSearch ? (
                      <>Showing {filteredMembers.length} members (filtered from {members.length} total)</>
                    ) : (
                      <>Showing all {filteredMembers.length} members</>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div className="pagination-controls">
                <div className="pagination-info">
                  {memberSearch ? (
                    <>Showing {startIndex + 1}-{endIndex} of {filteredMembers.length} members (filtered from {members.length} total)</>
                  ) : (
                    <>Showing {startIndex + 1}-{endIndex} of {filteredMembers.length} members</>
                  )}
                </div>
                <div className="pagination-buttons">
                  <button className="pagination-btn pagination-nav-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                    First
                  </button>
                  <button className="pagination-btn pagination-nav-btn" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    const shouldShow =
                      pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 2;

                    if (!shouldShow) {
                      if (pageNum === 2 && currentPage > 4) {
                        return <span key={`ellipsis-${pageNum}`} className="pagination-ellipsis">...</span>;
                      }
                      if (pageNum === totalPages - 1 && currentPage < totalPages - 3) {
                        return <span key={`ellipsis-${pageNum}`} className="pagination-ellipsis">...</span>;
                      }
                      return null;
                    }

                    return (
                      <button
                        key={pageNum}
                        className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className="pagination-btn pagination-nav-btn"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                  <button
                    className="pagination-btn pagination-nav-btn"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Last
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {resetTarget && (
        <div className="modal-overlay" onClick={resetLoading ? undefined : closeResetModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reset-password-title"
          >
            <h2 id="admin-reset-password-title">Reset password</h2>
            {!resetLink ? (
              <>
                <p>
                  Create a one-time reset link for <strong>{resetTarget.name}</strong> ({resetTarget.email})?
                </p>
                <p className="admin-reset-note">
                  This is not emailed. Copy the link and send it yourself (text, iMessage, etc.). Any unused
                  link from a previous reset will stop working. It expires in 1 hour.
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeResetModal}
                    disabled={resetLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={generateResetLink}
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Creating…' : 'Create link'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  Share this link with <strong>{resetTarget.name}</strong>. It works once and expires
                  {resetExpiresAt
                    ? ` ${new Date(resetExpiresAt).toLocaleString()}.`
                    : ' in 1 hour.'}
                </p>
                <label htmlFor="admin-reset-link-input" className="sr-only">
                  Password reset link
                </label>
                <input
                  id="admin-reset-link-input"
                  className="admin-reset-link-input"
                  type="text"
                  readOnly
                  value={resetLink}
                  onFocus={(e) => e.target.select()}
                />
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={closeResetModal}>
                    Done
                  </button>
                  <button type="button" className="btn btn-primary" onClick={copyResetLink}>
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMembers;
