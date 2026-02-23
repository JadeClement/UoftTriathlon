import React from 'react';
import { useAdminContext } from '../../context/AdminContext';

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
  } = useAdminContext();

  return (
    <div className="admin-main-content" style={{ padding: '2rem' }}>
      <div className="members-section">
        <h2>All Members</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: '16px' }}>
          <div className="form-group" style={{ maxWidth: 420, display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search by name or email…"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            {memberSearch && (
              <button
                className="btn btn-secondary"
                onClick={() => setMemberSearch('')}
                style={{ padding: '8px 12px', fontSize: '14px' }}
              >
                Clear
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
                  <button className="pagination-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                    First
                  </button>
                  <button className="pagination-btn" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
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
                    className="pagination-btn"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                  <button
                    className="pagination-btn"
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
                          {member.term.charAt(0).toUpperCase() + member.term.slice(1).replace('/', '/')}
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
                      <button className="action-btn small" onClick={() => editMember(member)}>Edit</button>
                      <button className="action-btn small danger" onClick={() => removeMember(member.id)}>Delete</button>
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
                  <button className="pagination-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                    First
                  </button>
                  <button className="pagination-btn" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
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
                    className="pagination-btn"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                  <button
                    className="pagination-btn"
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
    </div>
  );
};

export default AdminMembers;
