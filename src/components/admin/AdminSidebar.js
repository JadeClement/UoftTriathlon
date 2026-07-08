import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePendingReceipts } from '../../context/PendingReceiptsContext';

const navItems = [
  { path: 'guide', label: 'Admin Guide', icon: '📖', adminOnly: false },
  { path: 'members', label: 'All Members', icon: '👥', adminOnly: false },
  { path: 'receipts', label: 'Receipts', icon: '🧾', adminOnly: false },
  { path: 'terms', label: 'Terms', icon: '📅', adminOnly: true },
  { path: 'email', label: 'Send Email', icon: '✉️', adminOnly: false },
  { path: 'banner', label: 'Site Banner', icon: '📢', adminOnly: false },
  { path: 'attendance', label: 'Attendance', icon: '📋', adminOnly: false },
  { path: 'orders', label: 'Merch Orders', icon: '🛒', adminOnly: true },
  { path: 'interval-results', label: 'Interval Results', icon: '⏱️', coachOrExec: true },
];

const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { currentUser, isAdmin, isCoach, isExec } = useAuth();
  const { pendingReceiptsCount } = usePendingReceipts();

  const receiptBadgeLabel = pendingReceiptsCount > 99 ? '99+' : pendingReceiptsCount;

  const visibleItems = navItems.filter(item => {
    if (item.adminOnly) return isAdmin(currentUser);
    if (item.coachOrExec) return isCoach(currentUser) || isExec(currentUser) || isAdmin(currentUser);
    return true;
  });

  return (
    <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button
        type="button"
        className="admin-sidebar-toggle"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '→' : '←'}
      </button>
      <nav className="admin-sidebar-nav">
        {visibleItems.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === 'members'}
            className={({ isActive }) =>
              `admin-sidebar-link ${isActive ? 'active' : ''}`
            }
            title={collapsed ? label : undefined}
            aria-label={
              path === 'receipts' && pendingReceiptsCount > 0
                ? `${label}, ${pendingReceiptsCount} awaiting review`
                : label
            }
          >
            <span className="admin-sidebar-icon">{icon}</span>
            {!collapsed && (
              <span className="admin-sidebar-label">
                {label}
                {path === 'receipts' && pendingReceiptsCount > 0 && (
                  <span className="admin-receipt-badge admin-receipt-badge-label" aria-label={`${pendingReceiptsCount} receipt(s) awaiting review`}>
                    {receiptBadgeLabel}
                  </span>
                )}
              </span>
            )}
            {path === 'receipts' && pendingReceiptsCount > 0 && (
              <span className="admin-receipt-badge admin-receipt-badge-icon" aria-label={`${pendingReceiptsCount} receipt(s) awaiting review`}>
                {receiptBadgeLabel}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
