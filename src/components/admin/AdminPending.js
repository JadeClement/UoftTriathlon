import React from 'react';
import { useAdminContext } from '../../context/AdminContext';

const AdminPending = () => {
  const {
    pendingMembers,
    approveMember,
    rejectMember,
  } = useAdminContext();

  return (
    <div className="admin-main-content" style={{ padding: '2rem' }}>
      <div className="pending-section">
        <h2>Pending Approval</h2>
        {pendingMembers.length === 0 ? (
          <p className="no-pending">No pending members to approve!</p>
        ) : (
          <div className="pending-grid">
            {pendingMembers.map((member) => (
              <div key={member.id} className="pending-card">
                <div className="member-info">
                  <h3>{member.name}</h3>
                  <p><strong>Email:</strong> {member.email}</p>
                  <p><strong>Role:</strong> <span className="role-badge">{member.role}</span></p>
                  <p><strong>Phone Number:</strong> {member.phone_number || 'Not set'}</p>
                  <p><strong>Join Date:</strong> {member.joinDate ? new Date(member.joinDate).toLocaleDateString() : member.join_date ? new Date(member.join_date).toLocaleDateString() : member.created_at ? new Date(member.created_at).toLocaleDateString() : 'Not set'}</p>
                  <p><strong>Term:</strong> {member.term ? (
                    <span className={`term-badge ${member.term.toLowerCase().replace('/', '-')}`}>
                      {member.term.charAt(0).toUpperCase() + member.term.slice(1).replace('/', '/')}
                    </span>
                  ) : (
                    <span className="term-badge no-term">Not set</span>
                  )}</p>
                </div>
                <div className="approval-actions">
                  <button className="approve-btn" onClick={() => approveMember(member)}>
                    ✅ Approve
                  </button>
                  <button className="reject-btn" onClick={() => rejectMember(member.id)}>
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPending;
