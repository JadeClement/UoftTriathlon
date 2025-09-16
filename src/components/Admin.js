import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import './Admin.css';

const Admin = () => {
  const { currentUser, isAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('members');
  const [bannerForm, setBannerForm] = useState({ enabled: false, message: '' });
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', message: '' });
  const [template, setTemplate] = useState({ bannerTitle: '', title: '', intro: '', bullets: [''], body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    expiryDate: '',
    phoneNumber: '',
    charterAccepted: false
  });
  const [approvingMember, setApprovingMember] = useState(null);
  const [approvalForm, setApprovalForm] = useState({
    role: 'member',
    expiryDate: ''
  });


  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';


  // Phone number formatting functions (same as Login.js and Profile.js)
  const validatePhoneNumber = (phone) => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    // Check if it's 10 digits (North American format)
    return digitsOnly.length === 10;
  };

  const formatPhoneNumber = (phone) => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    return phone; // Return original if not 10 digits
  };

  const handlePhoneNumberChange = (e) => {
    const value = e.target.value;
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    if (digitsOnly.length <= 10) {
      // Format as user types
      let formatted = digitsOnly;
      if (digitsOnly.length >= 6) {
        formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
      } else if (digitsOnly.length >= 3) {
        formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
      } else if (digitsOnly.length > 0) {
        formatted = `(${digitsOnly}`;
      }
      setEditForm({...editForm, phoneNumber: formatted});
    }
  };

  // Load data from backend API
  useEffect(() => {
    if (!currentUser || !isAdmin(currentUser)) {
      return;
    }

    loadAdminData();
  }, [currentUser, isAdmin]);

  const loadBannerData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/site/banner`);
      if (response.ok) {
        const data = await response.json();
        setBannerForm({
          enabled: data.banner?.enabled || false,
          message: data.banner?.message || ''
        });
      }
    } catch (error) {
      console.error('Error loading banner data:', error);
    }
  };

  const loadAdminData = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Load banner data
      await loadBannerData();

      // Load all members
      const membersResponse = await fetch(`${API_BASE_URL}/admin/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        console.log('📊 Members data received:', membersData.members);
        
        // Transform backend data to frontend format (snake_case to camelCase)
        const transformedMembers = membersData.members.map(member => ({
          ...member,
          joinDate: member.join_date,
          expiryDate: member.expiry_date,
          absences: member.absences || 0,
          charterAccepted: member.charter_accepted || 0
        }));
        
        console.log('🔄 Transformed members data:', transformedMembers);
        console.log('📊 Raw backend data:', membersData.members);
        console.log('🔍 Sample member with absences:', transformedMembers.find(m => m.id)?.absences);
        console.log('🔍 Sample member with charter:', transformedMembers.find(m => m.id)?.charterAccepted);
        console.log('🔍 Raw charter_accepted values:', membersData.members.map(m => ({ id: m.id, charter_accepted: m.charter_accepted })));
        console.log('🔍 Full transformed members:', JSON.stringify(transformedMembers, null, 2));
        setMembers(transformedMembers);
        
        // Filter pending members
        const pending = transformedMembers.filter(m => m.role === 'pending');
        setPendingMembers(pending);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const approveMember = (member) => {
    setApprovingMember(member);
    setApprovalForm({
      role: 'member',
      expiryDate: ''
    });
  };

  const handleApprovalSubmit = async () => {
    if (!approvingMember || !approvalForm.expiryDate) {
      alert('Please set an expiry date before approving the member.');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/admin/members/${approvingMember.id}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          role: approvalForm.role,
          expiryDate: approvalForm.expiryDate
        })
      });

      if (response.ok) {
        // Reload data to get updated information
        await loadAdminData();
        setApprovingMember(null);
        setApprovalForm({ role: 'member', expiryDate: '' });
      } else {
        console.error('Failed to approve member');
      }
    } catch (error) {
      console.error('Error approving member:', error);
    }
  };

  const cancelApproval = () => {
    setApprovingMember(null);
    setApprovalForm({ role: 'member', expiryDate: '' });
  };



  const removeMember = async (memberId) => {
    const confirmed = window.confirm('⚠️ WARNING: This will PERMANENTLY DELETE this user and all their data!\n\nThis action cannot be undone. Are you sure you want to continue?');
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/admin/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('✅ User deleted successfully');
        await loadAdminData();
      } else {
        console.error('Failed to delete user');
        const err = await response.json().catch(() => ({}));
        alert(`Failed to delete user${err.error ? `: ${err.error}` : ''}`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`Error deleting user: ${error.message}`);
    }
  };

  const rejectMember = async (memberId) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/admin/members/${memberId}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'rejected' })
      });

      if (response.ok) {
        // Reload data to get updated information
        loadAdminData();
      } else {
        console.error('Failed to reject member');
      }
    } catch (error) {
      console.error('Error rejecting member:', error);
    }
  };

  const editMember = (member) => {
    console.log('🔄 Editing member:', member);
    console.log('🔍 Member charterAccepted value:', member.charterAccepted);
    
    const initialCharterAccepted = member.charterAccepted || false;
    console.log('🔍 Initial charterAccepted value:', initialCharterAccepted);
    
    setEditingMember(member);
    setEditForm({
      name: member.name,
      email: member.email,
      role: member.role,
      expiryDate: member.expiryDate || '',
      phoneNumber: member.phone_number || '',
      charterAccepted: initialCharterAccepted
    });
    console.log('📝 Edit form set to:', {
      name: member.name,
      email: member.email,
      role: member.role,
      expiryDate: member.expiryDate || '',
      phoneNumber: member.phone_number || '',
      charterAccepted: initialCharterAccepted
    });
  };

  const saveMemberEdit = async () => {
    console.log('🚨 saveMemberEdit function called!');
    if (!editingMember) {
      console.log('❌ No editingMember, returning early');
      return;
    }
    
    console.log('🔄 Saving member edit for:', editingMember.id);
    console.log('📝 Form data:', editForm);
    
    // Clean up the form data - convert empty strings to null for optional fields
    const cleanFormData = {
      ...editForm,
      phoneNumber: formatPhoneNumber(editForm.phoneNumber), // Format phone number before sending
      expiryDate: editForm.expiryDate || null,
      charterAccepted: editForm.charterAccepted ? 1 : 0
    };
    
    console.log('🧹 Cleaned form data:', cleanFormData);
    console.log('🔍 Charter accepted value being sent:', editForm.charterAccepted, '→', cleanFormData.charterAccepted);
    
    try {
      const token = localStorage.getItem('triathlonToken');
      console.log('🔑 Token:', token ? 'Present' : 'Missing');
      
      const response = await fetch(`${API_BASE_URL}/admin/members/${editingMember.id}/update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanFormData)
      });

      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Update successful:', result);
        
        // Check if role was changed and notify the user
        if (editForm.role !== editingMember.role) {
          console.log('🔄 Role changed from', editingMember.role, 'to', editForm.role);
          
          // Send notification to the user about role change
          try {
            const notifyResponse = await fetch(`${API_BASE_URL}/admin/notify-role-change`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                userId: editingMember.id,
                oldRole: editingMember.role,
                newRole: editForm.role
              })
            });
            
            if (notifyResponse.ok) {
              console.log('✅ Role change notification sent');
            } else {
              console.log('⚠️ Failed to send role change notification');
            }
          } catch (error) {
            console.log('⚠️ Error sending role change notification:', error);
          }
        }
        
        console.log('🔄 Reloading admin data...');
        
        // Reload data to get updated information
        await loadAdminData();
        console.log('✅ Admin data reloaded');
        
        setEditingMember(null);
        setEditForm({
          name: '',
          email: '',
          role: '',
          expiryDate: '',
          phoneNumber: '',
          charterAccepted: false
        });
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to update member:', errorData);
        alert(`Failed to update member: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error updating member:', error);
      alert(`Error updating member: ${error.message}`);
    }
  };

  const cancelEdit = () => {
    setEditingMember(null);
    setEditForm({
      name: '',
      email: '',
      role: '',
      expiryDate: '',
      phoneNumber: '',
      charterAccepted: false
    });
  };



  // Debug: Log current user info
  console.log('Current user:', currentUser);
  console.log('Is admin check:', isAdmin(currentUser));

  // Check if current user is admin
  if (!currentUser || !isAdmin(currentUser)) {
    return (
      <div className="admin-container">
        <div className="admin-access-denied">
          <h2>Access Denied</h2>
          <p>You don't have permission to access the admin panel.</p>
          <p>Current user: {currentUser ? currentUser.email : 'None'}</p>
          <p>User role: {currentUser ? currentUser.role : 'None'}</p>
          <p>Please contact the club administrators if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
              <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <p>Manage club members and monitor activity</p>

        </div>

      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          All Members
        </button>
        <button 
          className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Approval
        </button>
        <button 
          className={`tab-button ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          Send Email
        </button>
        <button 
          className={`tab-button ${activeTab === 'banner' ? 'active' : ''}`}
          onClick={() => setActiveTab('banner')}
        >
          Site Banner
        </button>
      </div>

      <div className="admin-content">


        {activeTab === 'members' && (
                      <div className="members-section">
              <h2>All Members</h2>
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
                    <th>Phone Number</th>
                    <th>Join Date</th>
                    <th>Expiry Date</th>
                    <th>Absences</th>
                    <th>Charter Accepted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td>{member.email}</td>
                      <td><span className={`role-badge ${member.role}`}>{member.role}</span></td>
                      <td>{member.phone_number || 'Not set'}</td>
                      <td>{member.joinDate}</td>
                      <td>{member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'Not set'}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="pending-section">
            <h2>Pending Approval</h2>
            {pendingMembers.length === 0 ? (
              <p className="no-pending">No pending members to approve!</p>
            ) : (
              <div className="pending-grid">
                {pendingMembers.map(member => (
                  <div key={member.id} className="pending-card">
                    <div className="member-info">
                      <h3>{member.name}</h3>
                      <p><strong>Email:</strong> {member.email}</p>
                      <p><strong>Role:</strong> <span className="role-badge">{member.role}</span></p>
                      <p><strong>Phone Number:</strong> {member.phone_number || 'Not set'}</p>
                      <p><strong>Join Date:</strong> {member.joinDate}</p>
                      <p><strong>Expiry Date:</strong> {member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'Not set'}</p>
      
                    </div>
                    <div className="approval-actions">
                                              <button 
                          className="approve-btn"
                          onClick={() => approveMember(member)}
                        >
                          ✅ Approve
                        </button>
                      <button 
                        className="reject-btn"
                        onClick={() => rejectMember(member.id)}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'banner' && (
          <div className="email-section">
            <h2>Site Banner</h2>
            <p>Toggle a banner at the top of the site with a message.</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const token = localStorage.getItem('triathlonToken');
                const resp = await fetch(`${API_BASE_URL}/site/banner`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify(bannerForm)
                });
                if (!resp.ok) {
                  const err = await resp.json().catch(() => ({}));
                  throw new Error(err.error || 'Failed to update banner');
                }
                alert('Banner updated');
              } catch (err) {
                alert(err.message);
              }
            }}>
              <div className="form-group" style={{display:'flex', alignItems:'center', gap:'12px'}}>
                <label className="toggle-switch">
                  <input type="checkbox" checked={!!bannerForm.enabled} onChange={(e)=> setBannerForm({ ...bannerForm, enabled: e.target.checked })} />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">{bannerForm.enabled ? 'On' : 'Off'}</span>
              </div>
              <div className="form-group">
                <label>Message</label>
                <input type="text" value={bannerForm.message} onChange={(e)=> setBannerForm({ ...bannerForm, message: e.target.value })} placeholder="Work in progress…" />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Save Banner</button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="email-section">
            <h2>Send Individual Email</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setEmailStatus(null);
              if (!emailForm.to || !emailForm.subject) {
                setEmailStatus({ type: 'error', text: 'Please provide recipient and subject.' });
                return;
              }
              const hasTemplate = (template.title || template.intro || (template.bullets||[]).some(Boolean) || template.body);
              if (!emailForm.message && !hasTemplate) {
                setEmailStatus({ type: 'error', text: 'Provide either Message or Template content.' });
                return;
              }
              try {
                setSendingEmail(true);
                const token = localStorage.getItem('triathlonToken');
                const resp = await fetch(`${API_BASE_URL}/admin/send-email`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ ...emailForm, template })
                });
                if (!resp.ok) {
                  const err = await resp.json().catch(() => ({}));
                  throw new Error(err.error || 'Failed to send email');
                }
                setEmailStatus({ type: 'success', text: 'Email sent successfully.' });
                setEmailForm({ to: '', subject: '', message: '' });
                setTemplate({ bannerTitle: '', title: '', intro: '', bullets: [''], body: '' });
              } catch (err) {
                setEmailStatus({ type: 'error', text: err.message });
              } finally {
                setSendingEmail(false);
              }
            }}>
              <div className="form-group">
                <label>To</label>
                <input type="email" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input type="text" value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Message (optional if using template)</label>
                <textarea rows="6" value={emailForm.message} onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} />
              </div>

              <div className="card" style={{padding:'16px', border:'1px solid #eee', borderRadius:6, marginBottom:16}}>
                <h3 style={{marginTop:0}}>Optional Template</h3>
                <div className="form-group">
                  <label>Banner Title</label>
                  <input type="text" value={template.bannerTitle} onChange={(e)=>setTemplate({...template, bannerTitle:e.target.value})} placeholder={`UofT Tri Club – ${new Date().toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}`} />
                </div>
                <div className="form-group">
                  <label>Title</label>
                  <input type="text" value={template.title} onChange={(e)=>setTemplate({...template, title:e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Intro</label>
                  <textarea rows="3" value={template.intro} onChange={(e)=>setTemplate({...template, intro:e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Bullets</label>
                  {(template.bullets||[]).map((b, idx)=> (
                    <div key={idx} style={{display:'flex', gap:8, marginBottom:8}}>
                      <input type="text" value={b} onChange={(e)=>{ const copy=[...template.bullets]; copy[idx]=e.target.value; setTemplate({...template, bullets:copy}); }} />
                      <button type="button" className="action-btn small danger" onClick={()=>{ const copy=[...template.bullets]; copy.splice(idx,1); if(copy.length===0) copy.push(''); setTemplate({...template, bullets:copy}); }}>Remove</button>
                    </div>
                  ))}
                  <button type="button" className="action-btn small" onClick={()=> setTemplate({...template, bullets:[...template.bullets, '']})}>Add bullet</button>
                </div>
                <div className="form-group">
                  <label>Body</label>
                  <textarea rows="6" value={template.body} onChange={(e)=>setTemplate({...template, body:e.target.value})} />
                </div>
              </div>

              <div className="card" style={{padding:'16px', border:'1px solid #eee', borderRadius:6, marginBottom:16}}>
                <h3 style={{marginTop:0}}>Preview</h3>
                <div style={{background:'#dc2626', color:'#fff', padding:'12px', borderRadius:8, textAlign:'center', marginBottom:12}}>
                  <strong>{template.bannerTitle || `UofT Tri Club – ${new Date().toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}`}</strong>
                </div>
                {template.title && <h4>{template.title}</h4>}
                {template.intro && <p>{template.intro}</p>}
                {(template.bullets||[]).filter(Boolean).length>0 && (
                  <ul>
                    {template.bullets.filter(Boolean).map((b, i)=> <li key={i}>{b}</li>)}
                  </ul>
                )}
                {(template.body || emailForm.message) && <p style={{whiteSpace:'pre-wrap'}}>{template.body || emailForm.message}</p>}
              </div>

              {emailStatus && (
                <div className={`notice ${emailStatus.type}`}>{emailStatus.text}</div>
              )}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={sendingEmail}>
                  {sendingEmail ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </form>
          </div>
        )}


      </div>

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Edit Member: {editingMember.name}</h2>
            {console.log('🔍 Modal rendering with editForm:', editForm)}
            <form onSubmit={(e) => { e.preventDefault(); saveMemberEdit(); }}>
              <div className="form-group">
                <label>Name:</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role:</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  required
                >
                  <option value="pending">Pending</option>
                  <option value="member">Member</option>
                  <option value="exec">Executive</option>
                  <option value="administrator">Administrator</option>
                </select>
              </div>

              <div className="form-group">
                <label>Expiry Date:</label>
                <input
                  type="date"
                  value={editForm.expiryDate}
                  onChange={(e) => setEditForm({...editForm, expiryDate: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Phone Number:</label>
                <input
                  type="tel"
                  value={editForm.phoneNumber}
                  onChange={handlePhoneNumberChange}
                  placeholder="(123) 456-7890"
                />
                {editForm.phoneNumber && !validatePhoneNumber(editForm.phoneNumber) && (
                  <div className="error-message">
                    Please enter a valid 10-digit phone number
                  </div>
                )}
                <small>For SMS notifications when promoted from waitlists</small>
              </div>
              
              <div className="form-group">
                <label>Charter Accepted:</label>
                <select
                  value={editForm.charterAccepted ? '1' : '0'}
                  onChange={(e) => {
                    const newValue = e.target.value === '1';
                    console.log('🔍 Charter dropdown changed:', e.target.value, '→', newValue);
                    setEditForm({...editForm, charterAccepted: newValue});
                  }}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
                <small>Whether the member has accepted the team charter</small>
                <div style={{fontSize: '0.8em', color: '#666', marginTop: '4px'}}>
                  Current value: {editForm.charterAccepted ? 'Yes (1)' : 'No (0)'}
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Save Changes</button>
                <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvingMember && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Approve Member: {approvingMember.name}</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleApprovalSubmit(); }}>
              <div className="form-group">
                <label>Role:</label>
                <select
                  value={approvalForm.role}
                  onChange={(e) => setApprovalForm({...approvalForm, role: e.target.value})}
                  required
                >
                  <option value="member">Member</option>
                  <option value="exec">Executive</option>
                  <option value="administrator">Administrator</option>
                </select>
              </div>

              <div className="form-group">
                <label>Expiry Date:</label>
                <input
                  type="date"
                  value={approvalForm.expiryDate}
                  onChange={(e) => setApprovalForm({...approvalForm, expiryDate: e.target.value})}
                  required
                />
                <small>Membership will expire on this date</small>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Approve Member</button>
                <button type="button" className="btn btn-secondary" onClick={cancelApproval}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
