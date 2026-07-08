import React from 'react';
import { useAdminContext } from '../../context/AdminContext';

const AdminTerms = () => {
  const {
    terms,
    formatTermName,
    openNewTerm,
    openEditTerm,
    deleteTerm,
  } = useAdminContext();

  return (
    <div className="admin-main-content" style={{ padding: '2rem' }}>
      <div className="terms-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2>Membership Terms</h2>
          <button className="btn btn-primary" onClick={openNewTerm}>+ Add Term</button>
        </div>
        <p style={{ color: '#64748b' }}>
          Each term has a season and a year. The end date determines when a member's access expires.
        </p>

        {terms.length === 0 ? (
          <p className="no-pending">No terms yet. Add one so members can select it when uploading a receipt.</p>
        ) : (
          <div className="members-table">
            <table>
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={term.id}>
                    <td><span className="term-badge">{formatTermName(term)}</span></td>
                    <td>{term.start_date ? new Date(`${String(term.start_date).slice(0, 10)}T00:00:00`).toLocaleDateString() : '—'}</td>
                    <td>{term.end_date ? new Date(`${String(term.end_date).slice(0, 10)}T00:00:00`).toLocaleDateString() : '—'}</td>
                    <td>
                      <button className="action-btn small" onClick={() => openEditTerm(term)}>Edit</button>
                      <button className="action-btn small danger" onClick={() => deleteTerm(term.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTerms;
