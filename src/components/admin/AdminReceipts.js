import React, { useEffect } from 'react';
import { useAdminContext } from '../../context/AdminContext';

const STATUS_TABS = [
  { value: 'pending_review', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const isPdf = (receipt) =>
  receipt.file_type === 'application/pdf' ||
  (receipt.file_url || '').toLowerCase().endsWith('.pdf');

const AdminReceipts = () => {
  const {
    receipts,
    receiptsLoading,
    receiptStatusFilter,
    setReceiptStatusFilter,
    loadReceipts,
    approveReceipt,
    openRejectReceipt,
    API_BASE_URL,
  } = useAdminContext();

  // Backend stores relative /uploads/... paths when S3 isn't configured (local dev).
  const host = (API_BASE_URL || '').replace(/\/?api$/i, '');
  const resolveUrl = (url) => (url && url.startsWith('/') ? `${host}${url}` : url);

  useEffect(() => {
    loadReceipts(receiptStatusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptStatusFilter]);

  return (
    <div className="admin-main-content">
      <div className="receipts-section admin-section">
        <h2>Membership Receipts</h2>
        <p style={{ color: '#64748b', marginTop: '-4px' }}>
          Review payment receipts uploaded by members. Approving activates the member and assigns the paid term.
        </p>

        <div className="receipts-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              className={`btn ${receiptStatusFilter === tab.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setReceiptStatusFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {receiptsLoading ? (
          <p>Loading receipts…</p>
        ) : receipts.length === 0 ? (
          <p className="no-pending">No receipts to show.</p>
        ) : (
          <div className="receipts-grid">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="receipt-card" style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
                <a
                  href={resolveUrl(receipt.file_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', background: '#f1f5f9', height: '180px', textAlign: 'center' }}
                >
                  {isPdf(receipt) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569' }}>
                      <span style={{ fontSize: '48px' }}>📄</span>
                      <span>View PDF receipt</span>
                    </div>
                  ) : (
                    <img
                      src={resolveUrl(receipt.file_url)}
                      alt={`Receipt from ${receipt.user_name}`}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  )}
                </a>
                <div style={{ padding: '14px' }}>
                  <h3 style={{ margin: '0 0 6px 0' }}>{receipt.user_name}</h3>
                  <p style={{ margin: '2px 0', color: '#64748b', fontSize: '14px' }}>{receipt.user_email}</p>
                  <p style={{ margin: '6px 0', fontSize: '14px' }}>
                    <strong>Term:</strong>{' '}
                    {receipt.term_label ? (
                      <span className="term-badge">{receipt.term_label}</span>
                    ) : (
                      <span className="term-badge no-term">Not specified</span>
                    )}
                  </p>
                  <p style={{ margin: '6px 0', fontSize: '13px', color: '#94a3b8' }}>
                    Uploaded {new Date(receipt.uploaded_at).toLocaleString()}
                  </p>
                  <p style={{ margin: '6px 0' }}>
                    <span className={`receipt-status ${receipt.status}`}>{receipt.status.replace('_', ' ')}</span>
                  </p>
                  {receipt.status === 'rejected' && receipt.review_notes && (
                    <p style={{ margin: '6px 0', fontSize: '13px', color: '#b91c1c' }}>
                      Reason: {receipt.review_notes}
                    </p>
                  )}
                  {receipt.reviewer_name && receipt.status !== 'pending_review' && (
                    <p style={{ margin: '6px 0', fontSize: '12px', color: '#94a3b8' }}>
                      Reviewed by {receipt.reviewer_name}
                    </p>
                  )}

                  {receipt.status === 'pending_review' && (
                    <div className="approval-actions" style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button className="approve-btn" onClick={() => approveReceipt(receipt)}>✅ Approve</button>
                      <button className="reject-btn" onClick={() => openRejectReceipt(receipt)}>❌ Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReceipts;
