import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import './Admin.css';

const Admin = () => {
  const { currentUser, isAdmin, isExec, isLeader } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('members');
  const [bannerForm, setBannerForm] = useState({ enabled: false, message: '' });
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', message: '' });
  const [template, setTemplate] = useState({ bannerTitle: '', title: '', intro: '', bullets: [''], body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  const [bulkEmailStatus, setBulkEmailStatus] = useState(null);
  const [emailType, setEmailType] = useState('individual'); // 'individual' or 'everyone'
  
  // Individual email recipient selection
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  // Attendance dashboard state
  const [attendanceWorkouts, setAttendanceWorkouts] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceFilters, setAttendanceFilters] = useState({
    type: 'all',
    status: 'all',
    page: 1
  });
  const [attendancePagination, setAttendancePagination] = useState({});
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [attendanceDetails, setAttendanceDetails] = useState(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    expiryDate: '',
    phoneNumber: '',
    charterAccepted: false,
    sport: 'triathlon'
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
    // Allow admins and execs (exec implies admin via role hierarchy)
    if (!currentUser || !isExec(currentUser)) {
      return;
    }

    loadAdminData();
  }, [currentUser, isExec]);

  // Load attendance data when filters change
  useEffect(() => {
    if (!currentUser || (!isAdmin(currentUser) && !isExec(currentUser) && !isLeader(currentUser))) {
      return;
    }

    loadAttendanceData();
  }, [attendanceFilters, currentUser, isAdmin, isExec, isLeader]);

  // Close recipient dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showRecipientDropdown && !event.target.closest('.recipient-selection')) {
        setShowRecipientDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRecipientDropdown]);

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

  // Handle recipient selection
  const addRecipient = (member) => {
    if (!selectedRecipients.find(r => r.id === member.id)) {
      setSelectedRecipients([...selectedRecipients, member]);
    }
    setRecipientSearch('');
    setShowRecipientDropdown(false);
  };

  const removeRecipient = (memberId) => {
    setSelectedRecipients(selectedRecipients.filter(r => r.id !== memberId));
  };

  const filteredMembers = members.filter(member => 
    member.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
    member.email.toLowerCase().includes(recipientSearch.toLowerCase())
  );

  const handleSendEmail = async () => {
    setEmailStatus(null);
    setBulkEmailStatus(null);
    
    if (emailType === 'individual' && selectedRecipients.length === 0) {
      setEmailStatus({ type: 'error', text: 'Please select at least one recipient.' });
      return;
    }
    
    // Only require template content for bulk emails
    if (emailType === 'everyone') {
      const hasTemplateContent = (template.title || template.intro || (template.bullets && template.bullets.some(b => (b || '').trim())) || template.body);
      if (!hasTemplateContent) {
        setBulkEmailStatus({ type: 'error', text: 'Please provide template content.' });
        return;
      }
    }
    
    try {
      if (emailType === 'individual') {
        setSendingEmail(true);
        const token = localStorage.getItem('triathlonToken');
        
        // Send to each selected recipient
        const emailPromises = selectedRecipients.map(recipient => 
          fetch(`${API_BASE_URL}/admin/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
              to: recipient.email, 
              subject: template.title || 'UofT Tri Club Update',
              message: emailForm.message || '',
              template: template 
            })
          })
        );
        
        try {
          const responses = await Promise.all(emailPromises);
          const results = await Promise.all(responses.map(resp => resp.json()));
          
          const successCount = responses.filter(resp => resp.ok).length;
          const errorCount = responses.length - successCount;
          
          if (errorCount === 0) {
            setEmailStatus({ type: 'success', text: `Email sent successfully to ${successCount} recipient(s)!` });
            setSelectedRecipients([]);
            setEmailForm({ to: '', subject: '', message: '' });
            setTemplate({ bannerTitle: '', title: '', intro: '', bullets: [''], body: '' });
          } else {
            setEmailStatus({ type: 'error', text: `Sent to ${successCount} recipients, failed to send to ${errorCount} recipients.` });
          }
        } catch (error) {
          setEmailStatus({ type: 'error', text: 'Failed to send emails' });
        }
        setSendingEmail(false);
      } else {
        setSendingBulkEmail(true);
        const token = localStorage.getItem('triathlonToken');
        const resp = await fetch(`${API_BASE_URL}/admin/send-bulk-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            subject: template.title || 'UofT Tri Club Update',
            message: template.body || '',
            template: template,
            recipients: {
              members: true,
              exec: true,
              admin: true,
              pending: false
            }
          })
        });
        const data = await resp.json();
        if (resp.ok) {
          setBulkEmailStatus({ type: 'success', text: `Bulk email sent successfully to ${data.sentCount} recipients!` });
          setTemplate({ bannerTitle: '', title: '', intro: '', bullets: [''], body: '' });
        } else {
          setBulkEmailStatus({ type: 'error', text: data.error || 'Failed to send bulk email' });
        }
        setSendingBulkEmail(false);
      }
    } catch (err) {
      if (emailType === 'individual') {
        setEmailStatus({ type: 'error', text: err.message });
        setSendingEmail(false);
      } else {
        setBulkEmailStatus({ type: 'error', text: err.message });
        setSendingBulkEmail(false);
      }
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

  // Load attendance dashboard data
  const loadAttendanceData = async () => {
    try {
      setAttendanceLoading(true);
      const token = localStorage.getItem('triathlonToken');
      
      const params = new URLSearchParams({
        page: attendanceFilters.page,
        type: attendanceFilters.type,
        status: attendanceFilters.status
      });

      console.log('🔍 Loading attendance data with params:', params.toString());
      console.log('🔍 API URL:', `${API_BASE_URL}/admin/attendance-dashboard?${params}`);

      const response = await fetch(`${API_BASE_URL}/admin/attendance-dashboard?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('🔍 Response status:', response.status);
      console.log('🔍 Response headers:', response.headers);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Attendance data received:', data);
        setAttendanceWorkouts(data.workouts);
        setAttendancePagination(data.pagination);
      } else {
        const errorText = await response.text();
        console.error('Failed to load attendance data:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Load detailed attendance for a specific workout
  const loadAttendanceDetails = async (workoutId) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      
      console.log('🔍 Loading attendance details for workout:', workoutId);
      console.log('🔍 API URL:', `${API_BASE_URL}/admin/attendance-dashboard/${workoutId}`);
      
      const response = await fetch(`${API_BASE_URL}/admin/attendance-dashboard/${workoutId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('🔍 Details response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Attendance details received:', data);
        setAttendanceDetails(data);
        setShowAttendanceModal(true);
      } else {
        const errorText = await response.text();
        console.error('Failed to load attendance details:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error loading attendance details:', error);
    }
  };

  // Handle attendance filter changes
  const handleAttendanceFilterChange = (filterType, value) => {
    setAttendanceFilters(prev => ({
      ...prev,
      [filterType]: value,
      page: 1 // Reset to first page when changing filters
    }));
  };

  // Handle attendance pagination
  const handleAttendancePageChange = (newPage) => {
    setAttendanceFilters(prev => ({
      ...prev,
      page: newPage
    }));
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
      charterAccepted: initialCharterAccepted,
      sport: member.sport || 'triathlon'
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
  
  // Allow admins, execs, and leaders to access dashboard
  if (!currentUser || (!isAdmin(currentUser) && !isExec(currentUser) && !isLeader(currentUser))) {
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
        {isAdmin(currentUser) && (
          <button 
            className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Approval
          </button>
        )}
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
        <button 
          className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          Attendance
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
                    <th>Sport</th>
                    {(isAdmin(currentUser) || isExec(currentUser)) && <th>Actions</th>}
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
                        <span className="sport-badge">
                          {member.sport === 'triathlon' ? '🏊‍♂️🚴‍♂️🏃‍♂️ Triathlon' : 
                           member.sport === 'duathlon' ? '🚴‍♂️🏃‍♂️ Duathlon' : 
                           member.sport === 'run_only' ? '🏃‍♂️ Run Only' : 
                           'Unknown'}
                        </span>
                      </td>

                      {(isAdmin(currentUser) || isExec(currentUser)) && (
                        <td>
                          <button className="action-btn small" onClick={() => editMember(member)}>Edit</button>
                          <button className="action-btn small danger" onClick={() => removeMember(member.id)}>Delete</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isAdmin(currentUser) && activeTab === 'pending' && (
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
                          onClick={() => editMember(member)}
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
                <label>Message (max 50 characters)</label>
                <input 
                  type="text" 
                  value={bannerForm.message} 
                  onChange={(e)=> setBannerForm({ ...bannerForm, message: e.target.value })} 
                  placeholder="Work in progress…" 
                  maxLength={50}
                />
                <div style={{fontSize: '12px', color: '#666', textAlign: 'right', marginTop: '4px'}}>
                  {bannerForm.message.length}/50 characters
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Save Banner</button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="email-section">
            <h2>Send Email</h2>
            <div className="email-layout">
              {/* Left side - Form */}
              <div className="email-form-panel">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  await handleSendEmail();
                }}>
                  {/* Email Type Selection */}
                  <div className="form-group email-type-group">
                    <label>
                      <input 
                        type="radio" 
                        name="emailType" 
                        value="individual" 
                        checked={emailType === 'individual'} 
                        onChange={(e) => setEmailType(e.target.value)}
                      />
                      Individual
                    </label>
                    <label>
                      <input 
                        type="radio" 
                        name="emailType" 
                        value="everyone" 
                        checked={emailType === 'everyone'} 
                        onChange={(e) => setEmailType(e.target.value)}
                      />
                      Everyone (Members, Exec, Admin)
                    </label>
                  </div>

                  {/* Individual Email Fields */}
                  {emailType === 'individual' && (
                    <>
                      <div className="form-group">
                        <label>Recipients</label>
                        <div className="recipient-selection">
                          <div className="recipient-input-container">
                            <input 
                              type="text" 
                              value={recipientSearch} 
                              onChange={(e) => {
                                setRecipientSearch(e.target.value);
                                setShowRecipientDropdown(true);
                              }}
                              onFocus={() => setShowRecipientDropdown(true)}
                              placeholder="Search members by name or email..."
                              className="recipient-search-input"
                            />
                            {showRecipientDropdown && recipientSearch && (
                              <div className="recipient-dropdown">
                                {filteredMembers.slice(0, 10).map(member => (
                                  <div 
                                    key={member.id}
                                    className="recipient-option"
                                    onClick={() => addRecipient(member)}
                                  >
                                    <div className="recipient-option-info">
                                      <span className="recipient-name">{member.name}</span>
                                      <span className="recipient-email">{member.email}</span>
                                      <span className="recipient-role">{member.role}</span>
                                    </div>
                                  </div>
                                ))}
                                {filteredMembers.length === 0 && (
                                  <div className="recipient-option no-results">No members found</div>
                                )}
                              </div>
                            )}
                          </div>
                          {selectedRecipients.length > 0 && (
                            <div className="selected-recipients">
                              {selectedRecipients.map(recipient => (
                                <div key={recipient.id} className="recipient-tag">
                                  <span className="recipient-tag-name">{recipient.name}</span>
                                  <span className="recipient-tag-email">({recipient.email})</span>
                                  <button 
                                    type="button"
                                    className="recipient-tag-remove"
                                    onClick={() => removeRecipient(recipient.id)}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Message</label>
                        <textarea 
                          rows="8" 
                          value={emailForm.message} 
                          onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} 
                          placeholder="Type your message here..."
                          required 
                        />
                      </div>
                    </>
                  )}

                  {/* Template Section - only show for everyone */}
                  {emailType === 'everyone' && (
                    <div className="card" style={{padding:'16px', border:'1px solid #eee', borderRadius:6, marginBottom:16}}>
                      <h3 style={{marginTop:0}}>Email Template</h3>
                      <div className="form-group">
                        <label>Banner Title</label>
                        <input type="text" value={template.bannerTitle} onChange={(e)=>setTemplate({...template, bannerTitle:e.target.value})} placeholder={`UofT Tri Club – ${new Date().toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}`} />
                      </div>
                      <div className="form-group">
                        <label>Title</label>
                        <input type="text" value={template.title} onChange={(e)=>setTemplate({...template, title:e.target.value})} placeholder="Email subject/title" />
                      </div>
                      <div className="form-group">
                        <label>Intro</label>
                        <textarea rows="3" value={template.intro} onChange={(e)=>setTemplate({...template, intro:e.target.value})} placeholder="Introduction text..." />
                      </div>
                      <div className="form-group">
                        <label>Bullets</label>
                        {(template.bullets||[]).map((b, idx)=> (
                          <div key={idx} style={{display:'flex', gap:8, marginBottom:8}}>
                            <input type="text" value={b} onChange={(e)=>{ const copy=[...template.bullets]; copy[idx]=e.target.value; setTemplate({...template, bullets:copy}); }} placeholder="Bullet point..." />
                            <button type="button" className="action-btn small danger" onClick={()=>{ const copy=[...template.bullets]; copy.splice(idx,1); if(copy.length===0) copy.push(''); setTemplate({...template, bullets:copy}); }}>Remove</button>
                          </div>
                        ))}
                        <button type="button" className="action-btn small" onClick={()=> setTemplate({...template, bullets:[...template.bullets, '']})}>Add bullet</button>
                      </div>
                      <div className="form-group">
                        <label>Body</label>
                        <textarea rows="6" value={template.body} onChange={(e)=>setTemplate({...template, body:e.target.value})} placeholder="Main email content..." />
                      </div>
                    </div>
                  )}

                  {/* Status Messages */}
                  {(emailStatus || bulkEmailStatus) && (
                    <div className={`notice ${(emailStatus || bulkEmailStatus).type}`} style={{ marginBottom: '1rem' }}>
                      {(emailStatus || bulkEmailStatus).text}
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="modal-actions">
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      disabled={sendingEmail || sendingBulkEmail}
                      style={{ 
                        backgroundColor: emailType === 'everyone' ? '#dc2626' : '#3b82f6',
                        width: '100%'
                      }}
                    >
                      {sendingEmail ? 'Sending...' : sendingBulkEmail ? 'Sending to All...' : 
                       emailType === 'everyone' ? 'Send to Everyone' : 'Send Email'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right side - Preview (only for everyone emails) */}
              {emailType === 'everyone' && (
                <div className="email-preview-panel">
                  <div className="card" style={{padding:'16px', border:'1px solid #eee', borderRadius:6, position: 'sticky', top: '20px'}}>
                    <h3 style={{marginTop:0}}>Preview</h3>
                    <div style={{
                      maxWidth: '600px',
                      margin: '0 auto',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                    }}>
                      {/* Header */}
                      <div style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        padding: '32px 24px',
                        textAlign: 'center'
                      }}>
                        <h1 style={{margin: 0, fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px'}}>
                          {template.bannerTitle || `University of Toronto Triathlon Club – ${new Date().toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}`}
                        </h1>
                      </div>
                      
                      {/* Content */}
                      <div style={{ padding: '24px 22px' }}>
                        <p style={{
                          margin: 0,
                          color: '#475569',
                          fontSize: '16px',
                          lineHeight: 1.6
                        }}>
                          {template.intro || ''}
                          {template.intro && (template.bullets||[]).filter(Boolean).length > 0 && <><br/><br/></>}
                          {(template.bullets||[]).filter(Boolean).map((b, i) => `${i + 1}. ${b}`).join('<br/>')}
                          {((template.intro || (template.bullets||[]).filter(Boolean).length > 0) && template.body) && <><br/><br/></>}
                          {template.body || ''}
                        </p>
                      </div>
                      
                      {/* Footer */}
                      <div style={{
                        background: '#f1f5f9',
                        padding: '24px',
                        textAlign: 'center',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        <p style={{margin: '0 0 12px 0', color: '#64748b', fontSize: '14px'}}>
                          UofT Triathlon Club | <a href="https://uoft-tri.club" style={{color: '#3b82f6', textDecoration: 'none', fontWeight: 500}}>uoft-tri.club</a>
                        </p>
                        <p style={{margin: 0, color: '#64748b', fontSize: '14px', fontStyle: 'italic'}}>
                          The UofT Tri Club Exec
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attendance Dashboard Tab */}
        {activeTab === 'attendance' && (
          <div className="attendance-section">
            <h2>Attendance Dashboard</h2>
            
            {/* Filters */}
            <div className="attendance-filters">
              <div className="filter-group">
                <label>Workout Type:</label>
                <select 
                  value={attendanceFilters.type} 
                  onChange={(e) => handleAttendanceFilterChange('type', e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="swim">Swim</option>
                  <option value="bike">Bike</option>
                  <option value="run">Run</option>
                  <option value="brick">Brick</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Status:</label>
                <select 
                  value={attendanceFilters.status} 
                  onChange={(e) => handleAttendanceFilterChange('status', e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="submitted">Submitted</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {/* Attendance Table */}
            {attendanceLoading ? (
              <div className="loading">Loading attendance data...</div>
            ) : (
              <div className="attendance-table-container">
                <table className="attendance-table">
                  <thead>
                    <tr>
                      <th>Workout</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Attendance</th>
                      <th>Submitted By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceWorkouts.map(workout => (
                      <tr key={workout.id} className="attendance-row">
                        <td className="workout-title">{workout.title}</td>
                        <td>
                          <span className={`workout-type-badge ${workout.workout_type?.toLowerCase()}`}>
                            {workout.workout_type}
                          </span>
                        </td>
                        <td>
                          {workout.workout_date && (
                            <div className="workout-date">
                              {new Date(workout.workout_date).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${workout.attendance_status}`}>
                            {workout.attendance_status === 'submitted' ? '✓ Submitted' : '⏳ Pending'}
                          </span>
                        </td>
                        <td>
                          {workout.attendance_status === 'submitted' ? (
                            <div className="attendance-stats">
                              <span className="attended-count">{workout.attended_count || 0} attended</span>
                              {workout.cancelled_count > 0 && (
                                <span className="cancelled-count">• {workout.cancelled_count} cancelled</span>
                              )}
                              {workout.late_count > 0 && (
                                <span className="late-count">• {workout.late_count} late</span>
                              )}
                            </div>
                          ) : (
                            <span className="no-attendance">No attendance recorded</span>
                          )}
                        </td>
                        <td>
                          {workout.submitted_by ? (
                            <div className="submitted-by">
                              <span>{workout.submitted_by}</span>
                              {workout.last_attendance_submitted && (
                                <div className="submitted-time">
                                  {new Date(workout.last_attendance_submitted).toLocaleString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="not-submitted">-</span>
                          )}
                        </td>
                        <td>
                          <button 
                            className="view-details-btn"
                            onClick={() => loadAttendanceDetails(workout.id)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {attendancePagination.pages > 1 && (
                  <div className="pagination">
                    <button 
                      onClick={() => handleAttendancePageChange(attendancePagination.page - 1)}
                      disabled={attendancePagination.page <= 1}
                    >
                      Previous
                    </button>
                    <span>
                      Page {attendancePagination.page} of {attendancePagination.pages}
                    </span>
                    <button 
                      onClick={() => handleAttendancePageChange(attendancePagination.page + 1)}
                      disabled={attendancePagination.page >= attendancePagination.pages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
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
                  <option value="leader">Leader</option>
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
                <label>Sport:</label>
                <select
                  value={editForm.sport || 'triathlon'}
                  onChange={(e) => setEditForm({...editForm, sport: e.target.value})}
                  required
                >
                  <option value="triathlon">Triathlon</option>
                  <option value="duathlon">Duathlon</option>
                  <option value="run_only">Run Only</option>
                </select>
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

      {/* Attendance Details Modal */}
      {showAttendanceModal && attendanceDetails && (
        <div className="modal-overlay">
          <div className="modal attendance-modal">
            <div className="modal-header">
              <h2>Attendance Details: {attendanceDetails.workout.title}</h2>
              <button 
                className="close-btn"
                onClick={() => setShowAttendanceModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="attendance-details-content">
              {/* Workout Info */}
              <div className="workout-info-section">
                <h3>Workout Information</h3>
                <div className="workout-info-grid">
                  <div><strong>Type:</strong> {attendanceDetails.workout.workout_type}</div>
                  <div><strong>Date:</strong> {attendanceDetails.workout.workout_date && new Date(attendanceDetails.workout.workout_date).toLocaleDateString()}</div>
                  <div><strong>Time:</strong> {attendanceDetails.workout.workout_time || 'Not specified'}</div>
                  <div><strong>Capacity:</strong> {attendanceDetails.workout.capacity || 'Unlimited'}</div>
                </div>
                {attendanceDetails.workout.content && (
                  <div className="workout-description">
                    <strong>Description:</strong>
                    <p>{attendanceDetails.workout.content}</p>
                  </div>
                )}
              </div>

              {/* Attendance Summary */}
              {attendanceDetails.summary && (
                <div className="attendance-summary-section">
                  <h3>Attendance Summary</h3>
                  <div className="summary-stats">
                    <div className="stat-item">
                      <span className="stat-number">{attendanceDetails.summary.attended_count}</span>
                      <span className="stat-label">Attended</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-number">{attendanceDetails.summary.absent_count}</span>
                      <span className="stat-label">Absent</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-number">{attendanceDetails.summary.total_records}</span>
                      <span className="stat-label">Total Records</span>
                    </div>
                    {attendanceDetails.summary.cancelled_count > 0 && (
                      <div className="stat-item">
                        <span className="stat-number">{attendanceDetails.summary.cancelled_count}</span>
                        <span className="stat-label">Cancelled</span>
                      </div>
                    )}
                    {attendanceDetails.summary.late_count > 0 && (
                      <div className="stat-item">
                        <span className="stat-number">{attendanceDetails.summary.late_count}</span>
                        <span className="stat-label">Late</span>
                      </div>
                    )}
                  </div>
                  <div className="submission-info">
                    <div><strong>First Submitted:</strong> {attendanceDetails.summary.first_submitted ? new Date(attendanceDetails.summary.first_submitted).toLocaleString() : 'N/A'}</div>
                    <div><strong>Last Updated:</strong> {attendanceDetails.summary.last_submitted ? new Date(attendanceDetails.summary.last_submitted).toLocaleString() : 'N/A'}</div>
                  </div>
                </div>
              )}

              {/* Signups List */}
              {attendanceDetails.signups.length > 0 && (
                <div className="signups-section">
                  <h3>Signups ({attendanceDetails.signups.length})</h3>
                  <div className="signups-list">
                    {attendanceDetails.signups.map(signup => (
                      <div key={signup.id} className="signup-item">
                        <div className="signup-user-info">
                          {signup.profile_picture_url ? (
                            <img 
                              src={`${API_BASE_URL.replace('/api', '')}${signup.profile_picture_url}`} 
                              alt="Profile" 
                              className="user-avatar"
                            />
                          ) : (
                            <div className="user-avatar-placeholder">
                              <img 
                                src="/images/default_profile.png" 
                                alt="Profile" 
                                style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }}
                              />
                            </div>
                          )}
                          <div className="user-details">
                            <span className="user-name">{signup.user_name}</span>
                            <span className="user-role">{signup.role}</span>
                          </div>
                        </div>
                        <div className="signup-time">
                          {new Date(signup.signup_time).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Who Was There - Attended Members */}
              {attendanceDetails.attendance.filter(record => record.attended).length > 0 && (
                <div className="attended-section">
                  <h3>✅ Who Was There ({attendanceDetails.attendance.filter(record => record.attended).length})</h3>
                  <div className="attendance-list">
                    {attendanceDetails.attendance
                      .filter(record => record.attended)
                      .sort((a, b) => a.user_name.localeCompare(b.user_name))
                      .map(record => (
                      <div key={record.id} className="attendance-item attended">
                        <div className="attendance-user-info">
                          {record.profile_picture_url ? (
                            <img 
                              src={`${API_BASE_URL.replace('/api', '')}${record.profile_picture_url}`} 
                              alt="Profile" 
                              className="user-avatar"
                            />
                          ) : (
                            <div className="user-avatar-placeholder">
                              <img 
                                src="/images/default_profile.png" 
                                alt="Profile" 
                                style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }}
                              />
                            </div>
                          )}
                          <div className="user-details">
                            <span className="user-name">{record.user_name}</span>
                            <span className="user-role">{record.role}</span>
                          </div>
                        </div>
                        <div className="attendance-status">
                          <div className="status-badges">
                            <span className="status-badge attended">
                              ✓ Attended
                            </span>
                            {record.late && (
                              <span className="status-badge late">
                                ⏰ Late
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Who Was Late - Only Late Members */}
              {attendanceDetails.attendance.filter(record => record.attended && record.late).length > 0 && (
                <div className="late-section">
                  <h3>⏰ Who Was Late ({attendanceDetails.attendance.filter(record => record.attended && record.late).length})</h3>
                  <div className="attendance-list">
                    {attendanceDetails.attendance
                      .filter(record => record.attended && record.late)
                      .sort((a, b) => a.user_name.localeCompare(b.user_name))
                      .map(record => (
                      <div key={record.id} className="attendance-item late-member">
                        <div className="attendance-user-info">
                          {record.profile_picture_url ? (
                            <img 
                              src={`${API_BASE_URL.replace('/api', '')}${record.profile_picture_url}`} 
                              alt="Profile" 
                              className="user-avatar"
                            />
                          ) : (
                            <div className="user-avatar-placeholder">
                              <img 
                                src="/images/default_profile.png" 
                                alt="Profile" 
                                style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }}
                              />
                            </div>
                          )}
                          <div className="user-details">
                            <span className="user-name">{record.user_name}</span>
                            <span className="user-role">{record.role}</span>
                          </div>
                        </div>
                        <div className="attendance-status">
                          <span className="status-badge late">
                            ⏰ Late
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Who Cancelled Within 24 Hours */}
              {attendanceDetails.attendance.filter(record => !record.attended && record.attendance_type === 'cancelled').length > 0 && (
                <div className="cancelled-section">
                  <h3>🚫 Who Cancelled Within 24 Hours ({attendanceDetails.attendance.filter(record => !record.attended && record.attendance_type === 'cancelled').length})</h3>
                  <div className="attendance-list">
                    {attendanceDetails.attendance
                      .filter(record => !record.attended && record.attendance_type === 'cancelled')
                      .sort((a, b) => a.user_name.localeCompare(b.user_name))
                      .map(record => (
                      <div key={record.id} className="attendance-item cancelled">
                        <div className="attendance-user-info">
                          {record.profile_picture_url ? (
                            <img 
                              src={`${API_BASE_URL.replace('/api', '')}${record.profile_picture_url}`} 
                              alt="Profile" 
                              className="user-avatar"
                            />
                          ) : (
                            <div className="user-avatar-placeholder">
                              <img 
                                src="/images/default_profile.png" 
                                alt="Profile" 
                                style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }}
                              />
                            </div>
                          )}
                          <div className="user-details">
                            <span className="user-name">{record.user_name}</span>
                            <span className="user-role">{record.role}</span>
                          </div>
                        </div>
                        <div className="attendance-status">
                          <span className="status-badge cancelled">
                            🚫 Cancelled (Absent)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Who Was Absent (Not Cancelled) */}
              {attendanceDetails.attendance.filter(record => !record.attended && record.attendance_type !== 'cancelled').length > 0 && (
                <div className="absent-section">
                  <h3>❌ Who Was Absent ({attendanceDetails.attendance.filter(record => !record.attended && record.attendance_type !== 'cancelled').length})</h3>
                  <div className="attendance-list">
                    {attendanceDetails.attendance
                      .filter(record => !record.attended && record.attendance_type !== 'cancelled')
                      .sort((a, b) => a.user_name.localeCompare(b.user_name))
                      .map(record => (
                      <div key={record.id} className="attendance-item absent">
                        <div className="attendance-user-info">
                          {record.profile_picture_url ? (
                            <img 
                              src={`${API_BASE_URL.replace('/api', '')}${record.profile_picture_url}`} 
                              alt="Profile" 
                              className="user-avatar"
                            />
                          ) : (
                            <div className="user-avatar-placeholder">
                              <img 
                                src="/images/default_profile.png" 
                                alt="Profile" 
                                style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }}
                              />
                            </div>
                          )}
                          <div className="user-details">
                            <span className="user-name">{record.user_name}</span>
                            <span className="user-role">{record.role}</span>
                          </div>
                        </div>
                        <div className="attendance-status">
                          <span className="status-badge absent">
                            ✗ Absent
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
