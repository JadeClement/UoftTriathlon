import React from 'react';
import { useAdminContext } from '../../context/AdminContext';

const AdminOrders = () => {
  const {
    currentUser,
    isAdmin,
    orders,
    ordersLoading,
    orderFilter,
    setOrderFilter,
    selectedOrders,
    handleOrderSelect,
    archiveSelectedOrders,
    unarchiveSelectedOrders,
    openNewOrder,
    exportMerchToExcel,
    editOrder,
    deleteOrder,
  } = useAdminContext();

  if (!isAdmin(currentUser)) {
    return null;
  }

  return (
    <div className="admin-main-content" style={{ padding: '2rem' }}>
      <div className="orders-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>Merch Orders</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="not_archived">Not Archived</option>
              <option value="archived">Archived</option>
              <option value="all">All Orders</option>
            </select>
            {selectedOrders.size > 0 &&
              (orderFilter === 'archived' ? (
                <button
                  className="btn btn-primary"
                  onClick={unarchiveSelectedOrders}
                  style={{ backgroundColor: '#10b981' }}
                >
                  Unarchive Selected ({selectedOrders.size})
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={archiveSelectedOrders}
                  style={{ backgroundColor: '#f59e0b' }}
                >
                  Archive Selected ({selectedOrders.size})
                </button>
              ))}
            <button className="btn btn-primary" onClick={openNewOrder}>
              + New Order
            </button>
            <button className="btn btn-primary" onClick={exportMerchToExcel}>
              Export to Excel
            </button>
          </div>
        </div>
        {ordersLoading ? (
          <div className="loading">Loading orders...</div>
        ) : (
          <div className="orders-table">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Email</th>
                  <th>Item</th>
                  <th>Size</th>
                  <th>Gender</th>
                  <th>Qty</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={o.archived ? { opacity: 0.6, backgroundColor: '#f9fafb' } : {}}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(o.id)}
                        onChange={() => handleOrderSelect(o.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>{o.firstName || o.name?.split(' ')[0] || '-'}</td>
                    <td>{o.lastName || o.name?.split(' ').slice(1).join(' ') || '-'}</td>
                    <td>{o.email}</td>
                    <td>{o.item}</td>
                    <td>{o.size || '-'}</td>
                    <td>{o.gender ? (o.gender === 'W' ? 'W' : 'M') : '-'}</td>
                    <td>{o.quantity}</td>
                    <td>{o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}</td>
                    <td>
                      <button className="action-btn small" onClick={() => editOrder(o)}>
                        Edit
                      </button>
                      <button className="action-btn small danger" onClick={() => deleteOrder(o.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: '#6b7280' }}>
                      {orderFilter === 'archived'
                        ? 'No archived orders'
                        : orderFilter === 'not_archived'
                          ? 'No orders yet'
                          : 'No orders found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;
