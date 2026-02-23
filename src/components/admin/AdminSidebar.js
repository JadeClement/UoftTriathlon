import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: 'members', label: 'All Members', icon: '👥', adminOnly: false },
  { path: 'pending', label: 'Pending Approval', icon: '⏳', adminOnly: false },
  { path: 'email', label: 'Send Email', icon: '✉️', adminOnly: false },
  { path: 'banner', label: 'Site Banner', icon: '📢', adminOnly: false },
  { path: 'attendance', label: 'Attendance', icon: '📋', adminOnly: false },
  { path: 'orders', label: 'Merch Orders', icon: '🛒', adminOnly: true },
  { path: 'interval-results', label: 'Interval Results', icon: '⏱️', coachOrExec: true },
];

const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { currentUser, isAdmin, isCoach, isExec } = useAuth();

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
          >
            <span className="admin-sidebar-icon">{icon}</span>
            {!collapsed && <span className="admin-sidebar-label">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
