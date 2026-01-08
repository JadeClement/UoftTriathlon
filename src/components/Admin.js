import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFieldsForSport } from '../config/sportFields';
import { formatSignupTimeForDisplay } from '../utils/dateUtils';
import { showError, showSuccess } from './SimpleNotification';
import ConfirmModal from './ConfirmModal';
import './Admin.css';

const Admin = () => {
  const { currentUser, isAdmin, isCoach, isExec } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [activeTab, setActiveTab] = useState('members');
  
  // Test Events state
  const [testEvents, setTestEvents] = useState([]);
  const [selectedTestEvent, setSelectedTestEvent] = useState(null);
  const [testEventRecords, setTestEventRecords] = useState([]);
  const [expandedRecordIds, setExpandedRecordIds] = useState(new Set()); // Track which records are expanded
  const [showTestEventModal, setShowTestEventModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [testEventForm, setTestEventForm] = useState({
    title: '',
    sport: 'swim',
    date: '',
    workout: '',
    workout_post_id: null
  });
  const [testEventRecordCount, setTestEventRecordCount] = useState(0);
  const [availableWorkouts, setAvailableWorkouts] = useState([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [recordForm, setRecordForm] = useState({
    title: '',
    result: '',
    description: '',
    user_id: null,
    result_fields: {}
  });
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Pagination state for members
  const [currentPage, setCurrentPage] = useState(1);
  const [membersPerPage] = useState(15);
  
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [memberSearch]);
  
  // Banner + popup form supports multiple items and rotation interval
  const [bannerForm, setBannerForm] = useState({
    enabled: false,
    items: [''],
    rotationIntervalMs: 6000,
    popupEnabled: false,
    popupDraft: '',
    popupPreview: ''
  });
  const [bannerSnapshot, setBannerSnapshot] = useState({
    enabled: false,
    items: [],
    rotationIntervalMs: 6000
  });
  const [popupPreview, setPopupPreview] = useState({
    enabled: false,
    message: '',
    popupId: null
  });
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', message: '' });
  const [template, setTemplate] = useState({ bannerTitle: '', title: '', body: '' });
  const [emailAttachments, setEmailAttachments] = useState([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  const [bulkEmailStatus, setBulkEmailStatus] = useState(null);
  const [emailType, setEmailType] = useState('individual'); // 'individual' or 'everyone'
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' }); // 'success' or 'error'

  // Show notification helper
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Format term name for display (e.g., "Fall 25" or "Fall/Winter 25-26")
  const formatTermName = (term) => {
    const termName = term.term.charAt(0).toUpperCase() + term.term.slice(1);
    // Parse defensively; if dates are missing/invalid, fall back to name only
    const startDate = new Date(`${term.start_date}T00:00:00`);
    const endDate = new Date(`${term.end_date}T00:00:00`);
    const startYearFull = Number.isFinite(startDate.getFullYear()) ? startDate.getFullYear() : null;
    const endYearFull = Number.isFinite(endDate.getFullYear()) ? endDate.getFullYear() : null;

    if (startYearFull === null || endYearFull === null) {
      return termName;
    }

    const startYear = startYearFull % 100; // last 2 digits
    const endYear = endYearFull % 100;
    
    if (startYear === endYear) {
      return `${termName} ${startYear}`;
    } else {
      return `${termName} ${startYear}-${endYear}`;
    }
  };

  // Rich text editor functions
  const insertText = (text, wrapper = '') => {
    const textarea = document.getElementById('email-body-textarea');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const newText = wrapper ? `${wrapper}${selectedText || text}${wrapper}` : text;
    
    const newValue = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
    setTemplate({ ...template, body: newValue });
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  };

  const insertBold = () => insertText('', '**');
  const insertItalic = () => insertText('', '*');
  const insertNumberedList = () => insertText('1. ');
  
  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Enter') {
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const textBeforeCursor = textarea.value.substring(0, start);
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];
      
      // Check if current line starts with a number followed by a dot
      const numberedListMatch = currentLine.match(/^(\d+)\.\s/);
      
      if (numberedListMatch) {
        e.preventDefault();
        const currentNumber = parseInt(numberedListMatch[1]);
        const nextNumber = currentNumber + 1;
        const newText = `\n${nextNumber}. `;
        
        const newValue = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
        setTemplate({ ...template, body: newValue });
        
        // Position cursor after the new number
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + newText.length, start + newText.length);
        }, 0);
      }
    }
  };
  
  const insertUrl = () => {
    const url = prompt('Enter URL:');
    const text = prompt('Enter link text (optional):') || url;
    if (url) {
      insertText(`[${text}](${url})`);
    }
  };

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
  const [terms, setTerms] = useState([]);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    phoneNumber: '',
    charterAccepted: false,
    sport: 'triathlon',
    term_id: null
  });
  const [approvingMember, setApprovingMember] = useState(null);
  const [approvalForm, setApprovalForm] = useState({
    role: 'member'
  });

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [orderFilter, setOrderFilter] = useState('not_archived'); // 'all', 'archived', 'not_archived'
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({
    id: null,
    firstName: '',
    lastName: '',
    email: '',
    item: '',
    size: '',
    quantity: 1,
    gender: 'mens' // Add gender field
  });
  const [gearItems, setGearItems] = useState([]);
  const [removeBannerConfirm, setRemoveBannerConfirm] = useState({ isOpen: false });
  const [deleteOrderConfirm, setDeleteOrderConfirm] = useState({ isOpen: false, orderId: null });
  const [archiveOrdersConfirm, setArchiveOrdersConfirm] = useState({ isOpen: false, count: 0 });
  const [unarchiveOrdersConfirm, setUnarchiveOrdersConfirm] = useState({ isOpen: false, count: 0 });
  const [deleteTestEventConfirm, setDeleteTestEventConfirm] = useState({ isOpen: false, eventId: null });
  const [deleteUserConfirm, setDeleteUserConfirm] = useState({ isOpen: false, userId: null });

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
    loadTerms();
  }, [currentUser, isAdmin]);

  // Load attendance data when filters change
  useEffect(() => {
    if (!currentUser || !isAdmin(currentUser)) {
      return;
    }

    loadAttendanceData();
  }, [attendanceFilters, currentUser, isAdmin]);

  const loadBannerData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/site/banner`);
      if (response.ok) {
        const data = await response.json();
        const enabled = !!data?.banner?.enabled;
        const rotationIntervalMs = Number(data?.banner?.rotationIntervalMs) > 0 ? Number(data.banner.rotationIntervalMs) : 6000;
        // Normalize items to a flat array of strings
        let items = [];
        if (Array.isArray(data?.banner?.items)) {
          items = data.banner.items.map((it) => (typeof it === 'string' ? it : String(it?.message || ''))).filter(Boolean);
        } else if (data?.banner?.message) {
          items = [String(data.banner.message)];
        }
        const popupEnabled = !!data?.popup?.enabled && !!data?.popup?.message;
        const popupMessage = data?.popup?.message || '';
        setBannerForm({
          enabled: enabled && items.length > 0,
          items: items.length ? items : [''],
          rotationIntervalMs,
          popupEnabled,
          popupDraft: ''
        });
        setBannerSnapshot({
          enabled: enabled && items.length > 0,
          items: items.length ? items : [],
          rotationIntervalMs
        });
        setPopupPreview({
          enabled: popupEnabled,
          message: popupMessage,
          popupId: data?.popup?.popupId || null
        });
      }
    } catch (error) {
      console.error('Error loading banner data:', error);
    }
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('triathlonToken');
      // Prepare items to send - filter out empty ones
      const itemsToSend = (bannerForm.items || [])
        .map((m) => ({ message: String(m || '').trim() }))
        .filter((m) => m.message);
      
      const resp = await fetch(`${API_BASE_URL}/site/banner`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          enabled: !!bannerForm.enabled,
          rotationIntervalMs: Number(bannerForm.rotationIntervalMs) || 6000,
          items: itemsToSend,
          // Preserve current popup settings
          popupEnabled: popupPreview.enabled,
          popupMessage: popupPreview.message || ''
        })
      });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) {
        const err = payload || {};
        throw new Error(err.error || 'Failed to update banner');
      }
      showNotification('Banner updated successfully!', 'success');
      if (payload?.banner) {
        const savedItems = Array.isArray(payload.banner.items)
          ? payload.banner.items.map((it) => (typeof it === 'string' ? it : String(it?.message || ''))).filter(Boolean)
          : [];
        const savedBanner = {
          enabled: !!payload.banner.enabled, // Preserve the enabled state as saved
          items: savedItems,
          rotationIntervalMs: Number(payload.banner.rotationIntervalMs) > 0 ? Number(payload.banner.rotationIntervalMs) : 6000
        };
        setBannerSnapshot(savedBanner);
        // Preserve the items that were just sent, converted back to strings
        // This ensures the user's entered messages don't disappear
        const itemsJustSent = itemsToSend.map((it) => it.message);
        setBannerForm(prev => ({
          ...prev,
          enabled: savedBanner.enabled, // Use the saved enabled state directly
          items: itemsJustSent.length ? itemsJustSent : [''], // Preserve what was just sent
          rotationIntervalMs: savedBanner.rotationIntervalMs
        }));
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleSavePopup = async (e) => {
    e.preventDefault();
    if (!bannerForm.popupEnabled || !bannerForm.popupDraft?.trim()) {
      showNotification('Please enable the pop up and enter a message', 'error');
      return;
    }
    try {
      const token = localStorage.getItem('triathlonToken');
      const resp = await fetch(`${API_BASE_URL}/site/banner`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          // Preserve current banner settings
          enabled: !!bannerSnapshot.enabled,
          rotationIntervalMs: Number(bannerSnapshot.rotationIntervalMs) || 6000,
          items: (bannerSnapshot.items || []).map((message) => ({ message })),
          popupEnabled: !!bannerForm.popupEnabled,
          popupMessage: bannerForm.popupDraft.trim()
        })
      });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) {
        const err = payload || {};
        throw new Error(err.error || 'Failed to update pop up');
      }
      showNotification('Pop up updated successfully!', 'success');
      if (payload?.popup) {
        setPopupPreview({
          enabled: !!payload.popup.enabled && !!payload.popup.message,
          message: payload.popup.message || '',
          popupId: payload.popup.popupId || null
        });
      }
      setBannerForm((prev) => ({
        ...prev,
        popupDraft: ''
      }));
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleRemovePopup = async () => {
    if (!popupPreview.enabled) {
      return;
    }

    setRemoveBannerConfirm({ isOpen: true });
  };

  const confirmRemoveBanner = async () => {
    setRemoveBannerConfirm({ isOpen: false });

    try {
      const token = localStorage.getItem('triathlonToken');
      const resp = await fetch(`${API_BASE_URL}/site/banner`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          enabled: !!bannerSnapshot.enabled,
          rotationIntervalMs: Number(bannerSnapshot.rotationIntervalMs) || 6000,
          items: (bannerSnapshot.items || []).map((message) => ({ message })),
          popupEnabled: false,
          popupMessage: ''
        })
      });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(payload?.error || 'Failed to remove pop up');
      }
      setPopupPreview({ enabled: false, message: '', popupId: null });
      setBannerForm((prev) => ({ ...prev, popupEnabled: false, popupDraft: '' }));
      showNotification('Pop up removed successfully!', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const loadGearItems = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/gear`);
      if (response.ok) {
        const data = await response.json();
        setGearItems(data.items || []);
      }
    } catch (error) {
      console.error('Error loading gear items:', error);
    }
  };

  const handleSendEmail = async () => {
    setEmailStatus(null);
    setBulkEmailStatus(null);
    
    // For individual emails, check if there's a subject and message
    if (emailType === 'individual') {
      if (!emailForm.subject.trim()) {
        setEmailStatus({ type: 'error', text: 'Please provide a subject.' });
        return;
      }
      if (!emailForm.message.trim()) {
        setEmailStatus({ type: 'error', text: 'Please provide a message.' });
        return;
      }
    }
    
    // For bulk emails, check template content
    if (emailType === 'everyone' && !template.title && !template.body) {
      setBulkEmailStatus({ type: 'error', text: 'Please provide template content.' });
      return;
    }
    
    if (emailType === 'individual' && !emailForm.to) {
      setEmailStatus({ type: 'error', text: 'Please provide recipient email.' });
      return;
    }
    
    try {
      if (emailType === 'individual') {
        setSendingEmail(true);
        const token = localStorage.getItem('triathlonToken');
        
        // Prepare form data for file uploads
        const formData = new FormData();
        formData.append('to', emailForm.to);
        formData.append('subject', emailForm.subject);
        formData.append('message', emailForm.message);
        formData.append('template', JSON.stringify(template));
        
        // Add attachments if any
        emailAttachments.forEach((file) => {
          formData.append('attachments', file);
        });
        
        const resp = await fetch(`${API_BASE_URL}/admin/send-email`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await resp.json();
        if (resp.ok) {
          setEmailStatus({ type: 'success', text: 'Email sent successfully!' });
          setEmailForm({ to: '', subject: '', message: '' });
          setTemplate({ bannerTitle: '', title: '', intro: '', bullets: [''], body: '' });
          setEmailAttachments([]);
        } else {
          setEmailStatus({ type: 'error', text: data.error || 'Failed to send email' });
        }
        setSendingEmail(false);
      } else {
        setSendingBulkEmail(true);
        const token = localStorage.getItem('triathlonToken');
        
        // Prepare form data for file uploads
        const formData = new FormData();
        formData.append('subject', template.title || 'UofT Tri Club Update');
        formData.append('message', template.body || '');
        formData.append('template', JSON.stringify(template));
        formData.append('recipients', JSON.stringify({
          members: true,
          coach: true,
          exec: true,
          admin: true,
          pending: false
        }));
        
        // Add attachments if any
        console.log('📎 Frontend: Preparing to send bulk email with attachments:', emailAttachments.length);
        emailAttachments.forEach((file, idx) => {
          console.log(`📎 Frontend: Adding attachment ${idx + 1}:`, file.name, `(${(file.size / 1024).toFixed(1)} KB)`);
          formData.append('attachments', file);
        });
        
        const resp = await fetch(`${API_BASE_URL}/admin/send-bulk-email`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await resp.json();
        if (resp.ok) {
          setBulkEmailStatus({ type: 'success', text: `Bulk email sent successfully to ${data.recipientCount || data.sentCount || 0} recipients!` });
          setTemplate({ bannerTitle: '', title: '', intro: '', bullets: [''], body: '' });
          setEmailAttachments([]);
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

  const loadTerms = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/admin/terms`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTerms(data.terms || []);
      }
    } catch (error) {
      console.error('Error loading terms:', error);
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
      
      // Load gear items for order form
      await loadGearItems();

      // Load all members (set high limit to get all members)
      const membersResponse = await fetch(`${API_BASE_URL}/admin/members?limit=1000`, {
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
          joinDate: member.join_date || member.created_at, // Use created_at as fallback if join_date is null
          term: member.term || null, // Term name (fall, winter, etc.)
          term_id: member.term_id || null, // Term ID for editing
          absences: member.absences || 0,
          charterAccepted: member.charter_accepted || 0
        }));
        
        console.log('🔄 Transformed members data:', transformedMembers);
        console.log('📊 Raw backend data:', membersData.members);
        console.log('🔍 Sample member with absences:', transformedMembers.find(m => m.id)?.absences);
        console.log('🔍 Sample member with charter:', transformedMembers.find(m => m.id)?.charterAccepted);
        console.log('🔍 Raw charter_accepted values:', membersData.members.map(m => ({ id: m.id, charter_accepted: m.charter_accepted })));
        console.log('🔍 Full transformed members:', JSON.stringify(transformedMembers, null, 2));
        
        // Debug: Check for jade members
        const jadeMembers = transformedMembers.filter(m => 
          (m.name && m.name.toLowerCase().includes('jade')) || 
          (m.email && m.email.toLowerCase().includes('jade'))
        );
        console.log('🔍 Jade members found:', jadeMembers);
        
        setMembers(transformedMembers);
        
        // Filter pending members
        const pending = transformedMembers.filter(m => m.role === 'pending');
        setPendingMembers(pending);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  // Load merch orders
  const loadOrders = async () => {
    try {
      if (!currentUser || !isAdmin(currentUser)) return;
      setOrdersLoading(true);
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(`${API_BASE_URL}/merch-orders?filter=${orderFilter}`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });

      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      // Clear selection when orders change
      setSelectedOrders(new Set());
    } catch (e) {
      console.error('Failed to load orders:', e);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab, orderFilter]);

  const openNewOrder = () => {
    setOrderForm({ id: null, firstName: '', lastName: '', email: '', item: '', size: '', quantity: 1, gender: 'mens' });
    setShowOrderModal(true);
  };

  const editOrder = (order) => {
    // Handle legacy orders that might have 'name' instead of 'firstName' and 'lastName'
    const formData = { ...order };
    if (order.name && !order.firstName && !order.lastName) {
      const nameParts = order.name.split(' ');
      formData.firstName = nameParts[0] || '';
      formData.lastName = nameParts.slice(1).join(' ') || '';
      delete formData.name;
    }
    // Add default gender if not present
    if (!formData.gender) {
      formData.gender = 'mens';
    }
    setOrderForm(formData);
    setShowOrderModal(true);
  };

  const saveOrder = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const isEdit = !!orderForm.id;
      const url = isEdit ? `${API_BASE_URL}/merch-orders/${orderForm.id}` : `${API_BASE_URL}/merch-orders`;
      const method = isEdit ? 'PUT' : 'POST';
      
      // Prepare data for backend - combine firstName and lastName into name for now
      const orderData = {
        ...orderForm,
        name: `${orderForm.firstName} ${orderForm.lastName}`.trim()
      };
      
      const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(orderData) });

      if (!res.ok) throw new Error('Failed to save order');
      await loadOrders();
      setShowOrderModal(false);
    } catch (e) {
      showError(`Failed to Save Order: ${e.message}`);
    }
  };

  const deleteOrder = async (id) => {
    setDeleteOrderConfirm({ isOpen: true, orderId: id });
  };

  const confirmDeleteOrder = async () => {
    const { orderId } = deleteOrderConfirm;
    setDeleteOrderConfirm({ isOpen: false, orderId: null });
    
    if (!orderId) return;
    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(`${API_BASE_URL}/merch-orders/${orderId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });

      if (!res.ok) throw new Error('Failed to delete order');
      await loadOrders();
    } catch (e) {
      showError(`Failed to Delete Order: ${e.message}`);
    }
  };

  const handleOrderSelect = (orderId) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  const archiveSelectedOrders = async () => {
    if (selectedOrders.size === 0) {
      showError('Please select at least one order to archive');
      return;
    }
    setArchiveOrdersConfirm({ isOpen: true, count: selectedOrders.size });
  };

  const confirmArchiveOrders = async () => {
    const count = archiveOrdersConfirm.count;
    setArchiveOrdersConfirm({ isOpen: false, count: 0 });
    
    // Use the state instead of reading from DOM
    if (selectedOrders.size === 0) {
      showError('Please select at least one order to archive');
      return;
    }

    const orderIds = Array.from(selectedOrders);

    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(`${API_BASE_URL}/merch-orders/archive`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderIds })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to archive orders');
      }

      const data = await res.json();
      showSuccess(data.message || `${orderIds.length} order(s) archived successfully`);
      setSelectedOrders(new Set()); // Clear selection after archiving
      await loadOrders();
    } catch (e) {
      showError(`Failed to Archive Orders: ${e.message}`);
    }
  };

  const unarchiveSelectedOrders = async () => {
    if (selectedOrders.size === 0) {
      showError('Please select at least one order to unarchive');
      return;
    }
    setUnarchiveOrdersConfirm({ isOpen: true, count: selectedOrders.size });
  };

  const confirmUnarchiveOrders = async () => {
    const count = unarchiveOrdersConfirm.count;
    setUnarchiveOrdersConfirm({ isOpen: false, count: 0 });
    
    // Use the state instead of reading from DOM
    if (selectedOrders.size === 0) {
      showError('Please select at least one order to unarchive');
      return;
    }

    const orderIds = Array.from(selectedOrders);

    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(`${API_BASE_URL}/merch-orders/unarchive`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderIds })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to unarchive orders');
      }

      const data = await res.json();
      showSuccess(data.message || `${orderIds.length} order(s) unarchived successfully`);
      setSelectedOrders(new Set()); // Clear selection after unarchiving
      await loadOrders();
    } catch (e) {
      showError(`Failed to Unarchive Orders: ${e.message}`);
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

  // Load test events
  const loadTestEvents = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/test-events`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTestEvents(data.testEvents || []);
      }
    } catch (error) {
      console.error('Error loading test events:', error);
      showNotification('Failed to load test events', 'error');
    }
  };

  // Load records for a test event
  const loadTestEventRecords = async (testEventId) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/test-events/${testEventId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedTestEvent(data.testEvent);
        setTestEventRecords(data.records || []);
      }
    } catch (error) {
      console.error('Error loading test event records:', error);
      showNotification('Failed to load records', 'error');
    }
  };

  // Load workouts for linking (filtered by sport and optional date)
  const loadAvailableWorkouts = async (sport, date = null) => {
    if (!sport) {
      setAvailableWorkouts([]);
      return;
    }

    try {
      setLoadingWorkouts(true);
      const token = localStorage.getItem('triathlonToken');
      const params = new URLSearchParams({ sport });
      if (date) {
        params.append('date', date);
      }
      
      const response = await fetch(`${API_BASE_URL}/test-events/workouts/search?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableWorkouts(data.workouts || []);
      }
    } catch (error) {
      console.error('Error loading workouts:', error);
      setAvailableWorkouts([]);
    } finally {
      setLoadingWorkouts(false);
    }
  };

  // Load record count for a test event
  const loadTestEventRecordCount = async (testEventId) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/records?test_event_id=${testEventId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTestEventRecordCount(data.records?.length || 0);
      }
    } catch (error) {
      console.error('Error loading record count:', error);
      setTestEventRecordCount(0);
    }
  };

  // Delete test event
  const deleteTestEvent = async () => {
    if (!testEventForm.id) return;

    setDeleteTestEventConfirm({ isOpen: true, eventId: testEventForm.id });
  };

  const confirmDeleteTestEvent = async () => {
    const { eventId } = deleteTestEventConfirm;
    setDeleteTestEventConfirm({ isOpen: false, eventId: null });
    
    if (!eventId) return;
    
    const confirmMessage = `Are you sure you want to delete this test? There ${testEventRecordCount === 1 ? 'is' : 'are'} ${testEventRecordCount} result${testEventRecordCount === 1 ? '' : 's'} of this test that will be deleted if you do.`;

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/test-events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        showNotification('Test event deleted successfully', 'success');
        setShowTestEventModal(false);
        setTestEventForm({ title: '', sport: 'swim', date: '', workout: '', workout_post_id: null });
        setTestEventRecordCount(0);
        await loadTestEvents();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete test event');
      }
    } catch (error) {
      showNotification(`Failed to delete test event: ${error.message}`, 'error');
    }
  };

  // Create or update test event
  const createTestEvent = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const isEdit = !!testEventForm.id;
      const url = isEdit ? `${API_BASE_URL}/test-events/${testEventForm.id}` : `${API_BASE_URL}/test-events`;
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testEventForm)
      });
      if (response.ok) {
        showNotification(`Test event ${isEdit ? 'updated' : 'created'} successfully`, 'success');
        setShowTestEventModal(false);
        setTestEventForm({ title: '', sport: 'swim', date: '', workout: '', workout_post_id: null });
        await loadTestEvents();
      } else {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${isEdit ? 'update' : 'create'} test event`);
      }
    } catch (error) {
      showNotification(`Failed to ${testEventForm.id ? 'update' : 'create'} test event: ${error.message}`, 'error');
    }
  };

  // Search users for record creation
  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setUserSearchResults([]);
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/admin/members?search=${encodeURIComponent(query)}&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserSearchResults(data.members || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  // Handle user search input
  const handleUserSearchChange = (e) => {
    const query = e.target.value;
    setUserSearchQuery(query);
    if (query) {
      searchUsers(query);
      setShowUserDropdown(true);
    } else {
      setUserSearchResults([]);
      setShowUserDropdown(false);
      setSelectedUser(null);
      setRecordForm((prev) => ({ ...prev, user_id: null }));
    }
  };

  // Select a user from search results
  const selectUser = (user) => {
    setSelectedUser(user);
    setUserSearchQuery(user.name || user.email);
    setRecordForm((prev) => ({ ...prev, user_id: user.id }));
    setShowUserDropdown(false);
    setUserSearchResults([]);
  };

  // Create new record
  const createRecord = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...recordForm,
          test_event_id: selectedTestEvent.id,
          title: recordForm.title || selectedTestEvent.title,
          user_id: recordForm.user_id || currentUser?.id,
          result_fields: recordForm.result_fields || {}
        })
      });
      if (response.ok) {
        showNotification('Record created successfully', 'success');
        setShowRecordModal(false);
        setRecordForm({ title: '', result: '', description: '', user_id: null, result_fields: {} });
        setUserSearchQuery('');
        setSelectedUser(null);
        await loadTestEventRecords(selectedTestEvent.id);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create record');
      }
    } catch (error) {
      showNotification(`Failed to create record: ${error.message}`, 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'test-events' && !selectedTestEvent) {
      loadTestEvents();
    }
  }, [activeTab]);

  // Load workouts when sport or date changes in test event form
  useEffect(() => {
    if (showTestEventModal && testEventForm.sport) {
      loadAvailableWorkouts(testEventForm.sport, testEventForm.date || null);
    }
  }, [showTestEventModal, testEventForm.sport, testEventForm.date]);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('.user-search-container')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

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

  // Export merch orders to Excel
  const exportMerchToExcel = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/admin/merch/export?filter=${orderFilter}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || 'Failed to export merch orders');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      const filterSuffix = orderFilter === 'archived' ? '_archived' : orderFilter === 'not_archived' ? '_not_archived' : '';
      a.href = url;
      a.download = `merch_orders${filterSuffix}_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showError(err.message || 'Failed to export merch orders');
    }
  };

  const approveMember = (member) => {
    setApprovingMember(member);
    setApprovalForm({
      role: 'member'
    });
  };

  const handleApprovalSubmit = async () => {
    if (!approvingMember) {
      showError('Please select a member to approve.');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/admin/members/${approvingMember.id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          role: approvalForm.role
        })
      });

      if (response.ok) {
        // Reload data to get updated information
        await loadAdminData();
        setApprovingMember(null);
        setApprovalForm({ role: 'member' });
      } else {
        console.error('Failed to approve member');
      }
    } catch (error) {
      console.error('Error approving member:', error);
    }
  };

  const cancelApproval = () => {
    setApprovingMember(null);
    setApprovalForm({ role: 'member' });
  };



  const removeMember = async (memberId) => {
    setDeleteUserConfirm({ isOpen: true, userId: memberId });
  };

  const confirmDeleteUser = async () => {
    const { userId } = deleteUserConfirm;
    setDeleteUserConfirm({ isOpen: false, userId: null });
    
    if (!userId) return;

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/admin/members/${userId}`, {
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
        showError(`Failed to delete user${err.error ? `: ${err.error}` : ''}`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showError(`Error deleting user: ${error.message}`);
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
      phoneNumber: member.phone_number || '',
      charterAccepted: initialCharterAccepted,
      sport: member.sport || 'triathlon',
      term_id: member.term_id || null
    });
    console.log('📝 Edit form set to:', {
      name: member.name,
      email: member.email,
      role: member.role,
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
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      phone_number: formatPhoneNumber(editForm.phoneNumber), // Format phone number before sending and map to backend field name
      charterAccepted: editForm.charterAccepted ? 1 : 0,
      sport: editForm.sport || 'triathlon',
      term_id: editForm.term_id || null
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
          phoneNumber: '',
          charterAccepted: false,
          sport: 'triathlon',
          term_id: null
        });
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to update member:', errorData);
        showError(`Failed to update member: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error updating member:', error);
      showError(`Error updating member: ${error.message}`);
    }
  };

  const cancelEdit = () => {
    setEditingMember(null);
    setEditForm({
      name: '',
      email: '',
      role: '',
      phoneNumber: '',
      charterAccepted: false,
      sport: 'triathlon',
      term_id: null
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
      {/* Notification Toast */}
      {notification.show && (
        <div className={`notification-toast notification-${notification.type}`}>
          <div className="notification-content">
            <span className="notification-icon">
              {notification.type === 'success' ? '✓' : '✕'}
            </span>
            <span className="notification-message">{notification.message}</span>
          </div>
        </div>
      )}

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
        <button 
          className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          Attendance
        </button>
        {isAdmin(currentUser) && (
          <button 
            className={`tab-button ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Merch Orders
          </button>
        )}
        {(isCoach(currentUser) || isExec(currentUser) || isAdmin(currentUser)) && (
          <button 
            className={`tab-button ${activeTab === 'test-events' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('test-events');
              setSelectedTestEvent(null);
              loadTestEvents();
            }}
          >
            Test Events
          </button>
        )}
      </div>

      <div className="admin-content">


        {activeTab === 'members' && (
                      <div className="members-section">
              <h2>All Members</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: '16px' }}>
                <div className="form-group" style={{ maxWidth: 420, display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search by name or email…"
                    value={memberSearch}
                    onChange={(e)=> setMemberSearch(e.target.value)}
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
                  const filteredMembers = members.filter(member => {
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
                        <button 
                          className="pagination-btn"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          First
                        </button>
                        <button 
                          className="pagination-btn"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </button>
                        
                        {/* Page numbers */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                          // Show first page, last page, current page, and pages around current
                          const shouldShow = pageNum === 1 || 
                                           pageNum === totalPages || 
                                           Math.abs(pageNum - currentPage) <= 2;
                          
                          if (!shouldShow) {
                            // Show ellipsis for gaps
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
                    // Filter members based on search
                    const filteredMembers = members.filter(member => {
                      const q = memberSearch.trim().toLowerCase();
                      if (!q) return true;
                      
                      const nameMatch = String(member.name || '').toLowerCase().includes(q);
                      const emailMatch = String(member.email || '').toLowerCase().includes(q);
                      const matches = nameMatch || emailMatch;
                      
                      // Debug logging
                      if (q === 'jade') {
                        console.log('🔍 Search debug for "jade":', {
                          memberName: member.name,
                          memberEmail: member.email,
                          nameMatch,
                          emailMatch,
                          matches
                        });
                      }
                      
                      return matches;
                    });

                    // Calculate pagination
                    const startIndex = (currentPage - 1) * membersPerPage;
                    const endIndex = startIndex + membersPerPage;
                    const currentMembers = filteredMembers.slice(startIndex, endIndex);

                    return currentMembers.map(member => (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>{member.email}</td>
                        <td><span className={`role-badge ${member.role}`}>{member.role}</span></td>
                        <td>
                          <span className={`sport-badge ${member.sport || 'triathlon'}`}>
                            {member.sport === 'run_only' ? 'Run Only' : 
                             member.sport === 'swim_only' ? 'Swim Only' : 
                             member.sport === 'duathlon' ? 'Duathlon' : 
                             member.sport === 'triathlon' ? 'Triathlon' : 
                             'Triathlon'}
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
                const filteredMembers = members.filter(member => {
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
                
                // Show pagination if there are members and we have more than 1 page
                const shouldShowPagination = members.length > 0 && totalPages > 1;
                
                if (!shouldShowPagination) {
                  // If no pagination needed, show member count info
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
                      <button 
                        className="pagination-btn"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        First
                      </button>
                      <button 
                        className="pagination-btn"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                        // Show first page, last page, current page, and pages around current
                        const shouldShow = pageNum === 1 || 
                                         pageNum === totalPages || 
                                         Math.abs(pageNum - currentPage) <= 2;
                        
                        if (!shouldShow) {
                          // Show ellipsis for gaps
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
            <h2>Site Banner & Pop Ups</h2>
            <p>Configure the rotating site banner and an optional login pop-up message.</p>
            
            {/* Banner Section */}
            <div className="banner-section" style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Site Banner</h3>
              <form>
                <div className="form-group" style={{display:'flex', alignItems:'center', gap:'12px'}}>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={!!bannerForm.enabled} onChange={(e)=> setBannerForm({ ...bannerForm, enabled: e.target.checked })} />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-label">{bannerForm.enabled ? 'On' : 'Off'}</span>
                </div>
                {/* Rotation interval */}
                <div className="form-group">
                  <label>Rotation Interval (ms)</label>
                  <input
                    type="number"
                    value={bannerForm.rotationIntervalMs}
                    min={1000}
                    step={500}
                    onChange={(e)=> setBannerForm({ ...bannerForm, rotationIntervalMs: Number(e.target.value) })}
                  />
                </div>

                {/* Multiple banner items */}
                <div className="form-group">
                  <label>Banner Messages (max 10)</label>
                  {(bannerForm.items || []).map((msg, idx) => (
                    <div key={idx} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                      <input
                        type="text"
                        value={msg}
                        onChange={(e)=> {
                          const next = [...(bannerForm.items || [])];
                          next[idx] = e.target.value;
                          setBannerForm({ ...bannerForm, items: next });
                        }}
                        placeholder={`Message #${idx+1}`}
                      />
                      <button type="button" className="btn" onClick={()=> {
                        const next = (bannerForm.items || []).filter((_,i)=> i!==idx);
                        setBannerForm({ ...bannerForm, items: next.length ? next : [''] });
                      }}>Remove</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn"
                    onClick={()=> {
                      const next = [...(bannerForm.items || [])];
                      if (next.length < 10) next.push('');
                      setBannerForm({ ...bannerForm, items: next });
                    }}
                  >+ Add Banner</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button type="button" onClick={handleSaveBanner} className="btn btn-primary">Save Banner</button>
                </div>
              </form>
            </div>

            {/* Popup Section */}
            <div className="popup-section">
              <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Pop Up Modal</h3>
              <p style={{ marginBottom: '16px', color: '#6b7280' }}>Show a pop up in the middle of the screen when users log in. Each user will only see it once per pop up.</p>
              <form>
                <div className="form-group" style={{display:'flex', alignItems:'center', gap:'12px'}}>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={!!bannerForm.popupEnabled} onChange={(e)=> setBannerForm({ ...bannerForm, popupEnabled: e.target.checked })} />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-label">{bannerForm.popupEnabled ? 'Pop Up On' : 'Pop Up Off'}</span>
                </div>
                <div className="form-group">
                  <label>Pop Up Message</label>
                  <textarea
                    rows="4"
                    placeholder="Write the message you want members to see after logging in..."
                    value={bannerForm.popupDraft}
                    onChange={(e)=> setBannerForm({ ...bannerForm, popupDraft: e.target.value })}
                    disabled={!bannerForm.popupEnabled}
                  />
                  <small style={{ color: '#6b7280' }}>
                    Tip: Keep it short. Use markdown-style links like [Click here](https://uoft-tri.club) if needed.
                  </small>
                </div>
                <div className="popup-preview-section">
                  <label>Published Pop Up</label>
                  {popupPreview.enabled && popupPreview.message ? (
                    <div className="popup-preview-card">
                      <div className="popup-preview-message">
                        {popupPreview.message}
                      </div>
                      <button type="button" className="btn popup-remove-btn" onClick={() => handleRemovePopup()}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="popup-preview-card muted">
                      <div className="popup-preview-message">
                        No pop up is currently active.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button type="button" onClick={handleSavePopup} className="btn btn-primary">Save Pop Up</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="email-section">
            <h2>Send Email</h2>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
              {/* Left side - Form */}
              <div style={{ flex: 1, minWidth: '400px' }}>
                <form>
                  {/* Email Type Selection */}
                  <div className="form-group" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="emailType" 
                        value="individual" 
                        checked={emailType === 'individual'} 
                        onChange={(e) => setEmailType(e.target.value)}
                      />
                      Individual
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
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
                        <label>To</label>
                        <input 
                          type="email" 
                          value={emailForm.to} 
                          onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} 
                          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                          placeholder="recipient@example.com"
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Subject</label>
                        <input 
                          type="text" 
                          value={emailForm.subject} 
                          onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} 
                          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                          placeholder="Email subject"
                          required 
                        />
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
                      <div className="form-group">
                        <label>Attachments (optional)</label>
                        <div style={{ 
                          border: '2px dashed #cbd5e1', 
                          borderRadius: '8px', 
                          padding: '20px', 
                          textAlign: 'center',
                          backgroundColor: '#f8fafc',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.backgroundColor = '#eff6ff';
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#cbd5e1';
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#cbd5e1';
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                          const files = Array.from(e.dataTransfer.files);
                          setEmailAttachments([...emailAttachments, ...files]);
                        }}
                        onClick={() => document.getElementById('email-file-input').click()}
                        >
                          <input 
                            id="email-file-input"
                            type="file" 
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files);
                              setEmailAttachments([...emailAttachments, ...files]);
                              e.target.value = ''; // Reset so same file can be selected again
                            }}
                            style={{ display: 'none' }}
                          />
                          <div style={{ color: '#64748b', marginBottom: '8px' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 8px', display: 'block' }}>
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="17 8 12 3 7 8"></polyline>
                              <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: '500' }}>
                              Click to upload or drag and drop
                            </p>
                            <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>
                              PDF, DOC, DOCX, images, or other files (max 10MB per file)
                            </p>
                          </div>
                        </div>
                        {emailAttachments.length > 0 && (
                          <div style={{ 
                            marginTop: '16px', 
                            padding: '12px', 
                            backgroundColor: '#f1f5f9', 
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0'
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#475569' }}>
                              Attached Files ({emailAttachments.length})
                            </div>
                            {emailAttachments.map((file, idx) => (
                              <div key={idx} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                gap: '12px', 
                                padding: '8px 12px',
                                marginBottom: '6px',
                                backgroundColor: 'white',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: '18px' }}>📎</span>
                                  <span style={{ 
                                    fontSize: '14px', 
                                    color: '#1e293b',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {file.name}
                                  </span>
                                  <span style={{ color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    ({(file.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newFiles = [...emailAttachments];
                                    newFiles.splice(idx, 1);
                                    setEmailAttachments(newFiles);
                                  }}
                                  style={{
                                    background: '#fee2e2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = '#fecaca';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = '#fee2e2';
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Template Section - only show for everyone */}
                  {emailType === 'everyone' && (
                    <div className="card" style={{padding:'16px', border:'1px solid #eee', borderRadius:6, marginBottom:16}}>
                      <h3 style={{marginTop:0}}>Email Template</h3>
                      <div className="form-group">
                        <label>Banner Title</label>
                        <input 
                          type="text" 
                          value={template.bannerTitle} 
                          onChange={(e)=>setTemplate({...template, bannerTitle:e.target.value})} 
                          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                          placeholder={`UofT Tri Club – ${new Date().toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}`} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Title</label>
                        <input 
                          type="text" 
                          value={template.title} 
                          onChange={(e)=>setTemplate({...template, title:e.target.value})} 
                          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                          placeholder="Email subject/title" 
                        />
                      </div>
                      <div className="form-group">
                        <label>Email Body</label>
                        <div style={{ border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}>
                          {/* Formatting Toolbar */}
                          <div style={{ 
                            background: '#f8f9fa', 
                            padding: '8px 12px', 
                            borderBottom: '1px solid #ddd',
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap'
                          }}>
                            <button 
                              type="button" 
                              onClick={insertBold}
                              style={{
                                padding: '6px 12px',
                                border: '1px solid #ccc',
                                background: 'white',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold'
                              }}
                              title="Bold"
                            >
                              B
                            </button>
                            <button 
                              type="button" 
                              onClick={insertItalic}
                              style={{
                                padding: '6px 12px',
                                border: '1px solid #ccc',
                                background: 'white',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontStyle: 'italic'
                              }}
                              title="Italic"
                            >
                              I
                            </button>
                            <button 
                              type="button" 
                              onClick={insertNumberedList}
                              style={{
                                padding: '6px 12px',
                                border: '1px solid #ccc',
                                background: 'white',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                              title="Numbered List"
                            >
                              1.
                            </button>
                            <button 
                              type="button" 
                              onClick={insertUrl}
                              style={{
                                padding: '6px 12px',
                                border: '1px solid #ccc',
                                background: 'white',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                              title="Insert Link"
                            >
                              🔗
                            </button>
                          </div>
                          {/* Textarea */}
                          <textarea 
                            id="email-body-textarea"
                            rows="8" 
                            value={template.body} 
                            onChange={(e)=>setTemplate({...template, body:e.target.value})} 
                            onKeyDown={handleTextareaKeyDown}
                            placeholder="Type your email content here... Use Enter for new lines. Use the buttons above for formatting."
                            style={{
                              width: '100%',
                              border: 'none',
                              padding: '12px',
                              fontSize: '14px',
                              lineHeight: '1.5',
                              resize: 'vertical',
                              outline: 'none',
                              fontFamily: 'inherit'
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          💡 Tip: Use **bold**, *italic*, numbered lists (1. 2. 3.), and [links](url) for formatting. Press Enter after numbered items to auto-continue the list!
                        </div>
                      </div>
                      <div className="form-group" style={{ marginTop: '20px' }}>
                        <label>Attachments (optional)</label>
                        <div style={{ 
                          border: '2px dashed #cbd5e1', 
                          borderRadius: '8px', 
                          padding: '20px', 
                          textAlign: 'center',
                          backgroundColor: '#f8fafc',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.backgroundColor = '#eff6ff';
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#cbd5e1';
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#cbd5e1';
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                          const files = Array.from(e.dataTransfer.files);
                          setEmailAttachments([...emailAttachments, ...files]);
                        }}
                        onClick={() => document.getElementById('email-file-input-everyone').click()}
                        >
                          <input 
                            id="email-file-input-everyone"
                            type="file" 
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files);
                              setEmailAttachments([...emailAttachments, ...files]);
                              e.target.value = ''; // Reset so same file can be selected again
                            }}
                            style={{ display: 'none' }}
                          />
                          <div style={{ color: '#64748b', marginBottom: '8px' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 8px', display: 'block' }}>
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="17 8 12 3 7 8"></polyline>
                              <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: '500' }}>
                              Click to upload or drag and drop
                            </p>
                            <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>
                              PDF, DOC, DOCX, images, or other files (max 10MB per file)
                            </p>
                          </div>
                        </div>
                        {emailAttachments.length > 0 && (
                          <div style={{ 
                            marginTop: '16px', 
                            padding: '12px', 
                            backgroundColor: '#f1f5f9', 
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0'
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#475569' }}>
                              Attached Files ({emailAttachments.length})
                            </div>
                            {emailAttachments.map((file, idx) => (
                              <div key={idx} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                gap: '12px', 
                                padding: '8px 12px',
                                marginBottom: '6px',
                                backgroundColor: 'white',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: '18px' }}>📎</span>
                                  <span style={{ 
                                    fontSize: '14px', 
                                    color: '#1e293b',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {file.name}
                                  </span>
                                  <span style={{ color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    ({(file.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newFiles = [...emailAttachments];
                                    newFiles.splice(idx, 1);
                                    setEmailAttachments(newFiles);
                                  }}
                                  style={{
                                    background: '#fee2e2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = '#fecaca';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = '#fee2e2';
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
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
                      type="button" 
                      className="btn btn-primary" 
                      disabled={sendingEmail || sendingBulkEmail}
                      onClick={handleSendEmail}
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
                <div style={{ flex: 1, minWidth: '400px' }}>
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
                      <div style={{ padding: '32px 24px' }}>
                        {template.body && (
                          <div style={{
                            background: '#f8fafc',
                            padding: '24px',
                            borderRadius: '12px'
                          }}>
                            <div style={{
                              margin: 0,
                              color: '#475569',
                              fontSize: '16px',
                              lineHeight: 1.6,
                              whiteSpace: 'pre-wrap'
                            }}>
                              {(() => {
                                // Apply markdown-like formatting to the entire text
                                let formattedText = template.body;
                                
                                // Bold text
                                formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                                
                                // Italic text
                                formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
                                
                                // Links
                                formattedText = formattedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #3b82f6; text-decoration: none;">$1</a>');
                                
                                return <div dangerouslySetInnerHTML={{ __html: formattedText }} />;
                              })()}
                            </div>
                          </div>
                        )}
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
                                  {formatSignupTimeForDisplay(workout.last_attendance_submitted)}
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

        {/* Merch Orders Tab */}
        {isAdmin(currentUser) && activeTab === 'orders' && (
          <div className="orders-section">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '16px'}}>
              <h2>Merch Orders</h2>
              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <select 
                  value={orderFilter} 
                  onChange={(e) => setOrderFilter(e.target.value)}
                  style={{padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc'}}
                >
                  <option value="not_archived">Not Archived</option>
                  <option value="archived">Archived</option>
                  <option value="all">All Orders</option>
                </select>
                {selectedOrders.size > 0 && (
                  orderFilter === 'archived' ? (
                    <button 
                      className="btn btn-primary" 
                      onClick={unarchiveSelectedOrders}
                      style={{backgroundColor: '#10b981'}}
                    >
                      Unarchive Selected ({selectedOrders.size})
                    </button>
                  ) : (
                    <button 
                      className="btn btn-primary" 
                      onClick={archiveSelectedOrders}
                      style={{backgroundColor: '#f59e0b'}}
                    >
                      Archive Selected ({selectedOrders.size})
                    </button>
                  )
                )}
                <button className="btn btn-primary" onClick={openNewOrder}>+ New Order</button>
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
                      <th style={{width: '40px'}}></th>
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
                    {orders.map(o => (
                      <tr key={o.id} style={o.archived ? {opacity: 0.6, backgroundColor: '#f9fafb'} : {}}>
                        <td>
                          <input 
                            type="checkbox" 
                            checked={selectedOrders.has(o.id)}
                            onChange={() => handleOrderSelect(o.id)}
                            style={{cursor: 'pointer'}}
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
                          <button className="action-btn small" onClick={() => editOrder(o)}>Edit</button>
                          <button className="action-btn small danger" onClick={() => deleteOrder(o.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr><td colSpan="9" style={{textAlign:'center', color:'#6b7280'}}>
                        {orderFilter === 'archived' ? 'No archived orders' : 
                         orderFilter === 'not_archived' ? 'No orders yet' : 
                         'No orders found'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Test Events Tab */}
        {(isCoach(currentUser) || isExec(currentUser) || isAdmin(currentUser)) && activeTab === 'test-events' && (
          <div className="test-events-section" style={{ padding: '2rem' }}>
            {!selectedTestEvent ? (
              // Test Events List View
              <>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '16px'}}>
                  <h2>Test Events</h2>
                  <button className="btn btn-primary" onClick={() => {
                    setTestEventForm({ title: '', sport: 'swim', date: '', workout: '', workout_post_id: null });
                    setTestEventRecordCount(0);
                    setAvailableWorkouts([]);
                    setShowTestEventModal(true);
                  }}>+ New</button>
                </div>
                <div className="test-events-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Sport</th>
                        <th>Date</th>
                        <th>Workout</th>
                        <th>Created By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testEvents.map(te => (
                        <tr 
                          key={te.id} 
                          style={{cursor: 'pointer'}}
                          onClick={() => loadTestEventRecords(te.id)}
                        >
                          <td>{te.title}</td>
                          <td><span className={`sport-badge ${te.sport}`}>{te.sport}</span></td>
                          <td>{new Date(te.date).toLocaleDateString()}</td>
                          <td>{te.workout}</td>
                          <td>{te.created_by_name || '-'}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button className="action-btn small" onClick={async () => {
                              setTestEventForm(te);
                              setShowTestEventModal(true);
                              if (te.id) {
                                await loadTestEventRecordCount(te.id);
                              }
                              if (te.sport && te.date) {
                                await loadAvailableWorkouts(te.sport, te.date);
                              }
                            }}>Edit</button>
                          </td>
                        </tr>
                      ))}
                      {testEvents.length === 0 && (
                        <tr><td colSpan="6" style={{textAlign:'center', color:'#6b7280'}}>No test events yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              // Records Detail View
              <>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '16px'}}>
                  <div>
                    <button className="btn btn-secondary" onClick={() => {
                      setSelectedTestEvent(null);
                      setTestEventRecords([]);
                    }} style={{marginRight: '12px'}}>← Back</button>
                    <h2 style={{display: 'inline', marginLeft: '12px'}}>{selectedTestEvent.title}</h2>
                  </div>
                  <button className="btn btn-primary" onClick={() => {
                    setRecordForm({ title: selectedTestEvent.title || '', result: '', description: '', user_id: null, result_fields: {} });
                    setUserSearchQuery('');
                    setSelectedUser(null);
                    setShowUserDropdown(false);
                    setShowRecordModal(true);
                  }}>+ New Record</button>
                </div>
                <div style={{marginBottom: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px'}}>
                  <p><strong>Sport:</strong> <span className={`sport-badge ${selectedTestEvent.sport}`}>{selectedTestEvent.sport}</span></p>
                  <p><strong>Date:</strong> {new Date(selectedTestEvent.date).toLocaleDateString()}</p>
                  <p><strong>Workout:</strong> {selectedTestEvent.workout}</p>
                  {selectedTestEvent.workout_post_title && (
                    <p><strong>Linked Workout:</strong> {selectedTestEvent.workout_post_title}</p>
                  )}
                </div>
                <div className="records-table">
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Title</th>
                        <th>Result</th>
                        <th>Notes</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testEventRecords.map(r => {
                        // Parse result_fields if available
                        let resultFields = {};
                        if (r.result_fields) {
                          try {
                            resultFields = typeof r.result_fields === 'string' 
                              ? JSON.parse(r.result_fields) 
                              : r.result_fields;
                          } catch (e) {
                            resultFields = {};
                          }
                        }
                        const sport = selectedTestEvent?.sport;
                        const fields = sport ? getFieldsForSport(sport) : [];
                        const hasFields = fields.length > 0 && Object.keys(resultFields).length > 0;
                        
                        const isExpanded = expandedRecordIds.has(r.id);
                        
                        return (
                          <React.Fragment key={r.id}>
                            <tr>
                              <td>{r.user_name || r.user_email}</td>
                              <td>{r.title}</td>
                              <td>{r.result || '-'}</td>
                              <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{r.description || r.notes || '-'}</td>
                              <td>{new Date(r.created_at).toLocaleDateString()}</td>
                              <td>
                                {hasFields && (
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedRecordIds);
                                      if (isExpanded) {
                                        newExpanded.delete(r.id);
                                      } else {
                                        newExpanded.add(r.id);
                                      }
                                      setExpandedRecordIds(newExpanded);
                                    }}
                                    style={{
                                      background: isExpanded ? '#6b7280' : '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      padding: '0.375rem 0.75rem',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.875rem',
                                      fontWeight: 500
                                    }}
                                  >
                                    {isExpanded ? '▼ Collapse' : '▶ Expand'}
                                  </button>
                                )}
                              </td>
                            </tr>
                            {isExpanded && hasFields && (
                              <tr style={{ background: '#f8fafc' }}>
                                <td colSpan="6" style={{ padding: '1rem' }}>
                                  <div style={{ padding: '1rem', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                    <h4 style={{ margin: '0 0 0.75rem 0', color: '#374151', fontSize: '0.875rem', fontWeight: 600 }}>
                                      {sport.charAt(0).toUpperCase() + sport.slice(1)}-Specific Details:
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                      {fields.map(field => {
                                        const value = resultFields[field.key];
                                        if (value === null || value === undefined || value === '') return null;
                                        return (
                                          <div key={field.key} style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '4px' }}>
                                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                                              {field.label}:
                                            </div>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>
                                              {Array.isArray(value) ? value.join(', ') : value}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {testEventRecords.length === 0 && (
                        <tr><td colSpan="6" style={{textAlign:'center', color:'#6b7280'}}>No records yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
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
                  <option value="coach">Coach</option>
                  <option value="exec">Executive</option>
                  <option value="administrator">Administrator</option>
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
                <label>Sport:</label>
                <select
                  value={editForm.sport}
                  onChange={(e) => setEditForm({...editForm, sport: e.target.value})}
                >
                  <option value="triathlon">Triathlon</option>
                  <option value="duathlon">Duathlon</option>
                  <option value="run_only">Run Only</option>
                  <option value="swim_only">Swim Only</option>
                </select>
                <small>Determines which workout types the member can see and create</small>
              </div>

              <div className="form-group">
                <label>Term:</label>
                <select
                  value={editForm.term_id || ''}
                  onChange={(e) => setEditForm({...editForm, term_id: e.target.value === '' ? null : parseInt(e.target.value, 10)})}
                >
                  <option value="">No term assigned</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>
                      {formatTermName(term)}
                    </option>
                  ))}
                </select>
                <small>Determines membership expiry date</small>
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
                  <option value="coach">Coach</option>
                  <option value="exec">Executive</option>
                  <option value="administrator">Administrator</option>
                </select>
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
              <button 
                className="close-btn"
                onClick={() => setShowAttendanceModal(false)}
              >
                ×
              </button>
              <h2>Attendance Details: {attendanceDetails.workout.title}</h2>
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
                          {formatSignupTimeForDisplay(signup.signup_time)}
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

      {/* Order Modal */}
      {showOrderModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{orderForm.id ? 'Edit Order' : 'New Order'}</h2>
            <form onSubmit={(e) => { e.preventDefault(); saveOrder(); }}>
              <div className="form-group">
                <label>First Name:</label>
                <input
                  type="text"
                  value={orderForm.firstName}
                  onChange={(e) => setOrderForm({...orderForm, firstName: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name:</label>
                <input
                  type="text"
                  value={orderForm.lastName}
                  onChange={(e) => setOrderForm({...orderForm, lastName: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={orderForm.email}
                  onChange={(e) => setOrderForm({...orderForm, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Gender:</label>
                <select
                  value={orderForm.gender}
                  onChange={(e) => setOrderForm({...orderForm, gender: e.target.value})}
                  required
                >
                  <option value="mens">Men's</option>
                  <option value="womens">Women's</option>
                </select>
              </div>
              <div className="form-group">
                <label>Item:</label>
                <select
                  value={orderForm.item}
                  onChange={(e) => setOrderForm({...orderForm, item: e.target.value})}
                  required
                >
                  <option value="">Select an item...</option>
                  {gearItems.map(item => (
                    <option key={item.id} value={item.title}>
                      {item.title} - ${item.price}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Size:</label>
                <select
                  value={orderForm.size}
                  onChange={(e) => setOrderForm({...orderForm, size: e.target.value})}
                  required
                >
                  <option value="">Select a size...</option>
                  {orderForm.gender === 'womens' ? (
                    // Women's sizes: XS, S, M, L, XL, 2XL
                    <>
                      <option value="XS">XS</option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                      <option value="2XL">2XL</option>
                    </>
                  ) : (
                    // Men's sizes: S, M, L, XL, 2XL (no XS, no XXS)
                    <>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                      <option value="2XL">2XL</option>
                    </>
                  )}
                </select>
              </div>
              <div className="form-group">
                <label>Quantity:</label>
                <input
                  type="number"
                  min="1"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm({...orderForm, quantity: parseInt(e.target.value) || 1})}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowOrderModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {orderForm.id ? 'Update Order' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Event Modal */}
      {showTestEventModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{testEventForm.id ? 'Edit Test Event' : 'New Test Event'}</h2>
            <form onSubmit={(e) => { e.preventDefault(); createTestEvent(); }}>
              <div className="form-group">
                <label>Title:</label>
                <input
                  type="text"
                  value={testEventForm.title}
                  onChange={(e) => setTestEventForm({...testEventForm, title: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Sport:</label>
                <select
                  value={testEventForm.sport}
                  onChange={(e) => setTestEventForm({...testEventForm, sport: e.target.value})}
                  required
                >
                  <option value="swim">Swim</option>
                  <option value="bike">Bike</option>
                  <option value="run">Run</option>
                </select>
              </div>
              <div className="form-group">
                <label>Date:</label>
                <input
                  type="date"
                  value={testEventForm.date}
                  onChange={(e) => setTestEventForm({...testEventForm, date: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Workout Description:</label>
                <textarea
                  rows="3"
                  value={testEventForm.workout}
                  onChange={(e) => setTestEventForm({...testEventForm, workout: e.target.value})}
                  placeholder="e.g., 5 400ms fast on the track"
                  required
                />
              </div>
              <div className="form-group">
                <label>Link to Workout (optional):</label>
                {testEventForm.sport && testEventForm.date ? (
                  <select
                    value={testEventForm.workout_post_id || ''}
                    onChange={(e) => setTestEventForm({...testEventForm, workout_post_id: e.target.value ? parseInt(e.target.value) : null})}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    disabled={loadingWorkouts}
                  >
                    <option value="">No workout linked</option>
                    {availableWorkouts.map(workout => (
                      <option key={workout.id} value={workout.id}>
                        {workout.title} - {workout.workout_type} ({new Date(workout.workout_date).toLocaleDateString()} {workout.workout_time ? workout.workout_time.substring(0, 5) : ''})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ padding: '0.75rem', background: '#f3f4f6', borderRadius: '4px', color: '#6b7280' }}>
                    {!testEventForm.sport && !testEventForm.date ? 'Select sport and date to see available workouts' :
                     !testEventForm.sport ? 'Select sport to see available workouts' :
                     'Select date to see available workouts'}
                  </div>
                )}
                {loadingWorkouts && (
                  <small style={{ color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>Loading workouts...</small>
                )}
                {!loadingWorkouts && testEventForm.sport && testEventForm.date && availableWorkouts.length === 0 && (
                  <small style={{ color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>No workouts found for {testEventForm.sport} on {(() => {
                    // Format date string directly to avoid timezone issues
                    const dateStr = testEventForm.date;
                    if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      const [year, month, day] = dateStr.split('-');
                      return `${month}/${day}/${year}`;
                    }
                    return new Date(testEventForm.date).toLocaleDateString();
                  })()}</small>
                )}
                <small style={{ color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>Optional: Link this test event to a specific workout</small>
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {testEventForm.id && (
                    <button 
                      type="button" 
                      className="btn" 
                      onClick={deleteTestEvent}
                      style={{ 
                        background: '#dc2626', 
                        color: 'white',
                        border: 'none'
                      }}
                    >
                      Delete Event
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowTestEventModal(false);
                    setTestEventForm({ title: '', sport: 'swim', date: '', workout: '', workout_post_id: null });
                    setTestEventRecordCount(0);
                    setAvailableWorkouts([]);
                  }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {testEventForm.id ? 'Update Test Event' : 'Create Test Event'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Modal */}
      {showRecordModal && selectedTestEvent && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>New Record</h2>
            <form onSubmit={(e) => { e.preventDefault(); createRecord(); }}>
              <div className="form-group user-search-container" style={{ position: 'relative', marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>User:</label>
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={handleUserSearchChange}
                  onFocus={() => userSearchQuery && setShowUserDropdown(true)}
                  placeholder="Start typing user's name..."
                  style={{ 
                    width: '100%', 
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
                {showUserDropdown && userSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    marginTop: '4px'
                  }}>
                    {userSearchResults.map(user => (
                      <div
                        key={user.id}
                        onClick={() => selectUser(user)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                      >
                        <div style={{ fontWeight: '500' }}>{user.name || user.email}</div>
                        {user.name && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{user.email}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <small style={{ display: 'block', marginTop: '4px', color: '#059669' }}>
                    Selected: {selectedUser.name || selectedUser.email}
                  </small>
                )}
                <small style={{ display: 'block', marginTop: '4px', color: '#6b7280' }}>
                  {!selectedUser && 'Leave empty to create record for yourself'}
                </small>
              </div>
              <div className="form-group">
                <label>Title:</label>
                <input
                  type="text"
                  value={recordForm.title}
                  onChange={(e) => setRecordForm({...recordForm, title: e.target.value})}
                  placeholder={selectedTestEvent.title}
                  required
                />
                <small>Defaults to test event title</small>
              </div>
              
              {/* Sport-specific fields */}
              {selectedTestEvent && (() => {
                const sport = selectedTestEvent.sport;
                const sportFields = sport ? getFieldsForSport(sport) : [];
                
                if (sportFields.length > 0) {
                  return (
                    <div className="form-group" style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <label style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#374151', display: 'block' }}>
                        {sport.charAt(0).toUpperCase() + sport.slice(1)}-Specific Details:
                      </label>
                      {sportFields.map(field => (
                        <div key={field.key} style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                            {field.label}:
                          </label>
                          {field.type === 'array' ? (
                            <input
                              type="text"
                              value={Array.isArray(recordForm.result_fields?.[field.key]) 
                                ? recordForm.result_fields[field.key].join(', ') 
                                : (recordForm.result_fields?.[field.key] || '')}
                              onChange={(e) => {
                                const value = e.target.value;
                                const arrayValue = value ? value.split(',').map(v => v.trim()).filter(v => v) : [];
                                setRecordForm({
                                  ...recordForm,
                                  result_fields: {
                                    ...recordForm.result_fields,
                                    [field.key]: arrayValue.length > 0 ? arrayValue : null
                                  }
                                });
                              }}
                              placeholder={field.placeholder}
                              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          ) : field.type === 'number' ? (
                            <input
                              type="number"
                              value={recordForm.result_fields?.[field.key] || ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? null : parseFloat(e.target.value);
                                setRecordForm({
                                  ...recordForm,
                                  result_fields: {
                                    ...recordForm.result_fields,
                                    [field.key]: value
                                  }
                                });
                              }}
                              placeholder={field.placeholder}
                              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          ) : (
                            <input
                              type="text"
                              value={recordForm.result_fields?.[field.key] || ''}
                              onChange={(e) => {
                                setRecordForm({
                                  ...recordForm,
                                  result_fields: {
                                    ...recordForm.result_fields,
                                    [field.key]: e.target.value || null
                                  }
                                });
                              }}
                              placeholder={field.placeholder}
                              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          )}
                          {field.helpText && (
                            <small style={{ color: '#6b7280', display: 'block', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                              {field.helpText}
                            </small>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}
              
              <div className="form-group">
                <label>Result:</label>
                <textarea
                  rows="3"
                  value={recordForm.result}
                  onChange={(e) => setRecordForm({...recordForm, result: e.target.value})}
                  placeholder="e.g., 1:20, 1:18, 1:19, 1:17, 1:16"
                />
                <small>Text description of times/results</small>
              </div>
              <div className="form-group">
                <label>Description (optional):</label>
                <textarea
                  rows="3"
                  value={recordForm.description}
                  onChange={(e) => setRecordForm({...recordForm, description: e.target.value})}
                  placeholder="Additional notes..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowRecordModal(false);
                  setRecordForm({ title: '', result: '', description: '', user_id: null, result_fields: {} });
                  setUserSearchQuery('');
                  setSelectedUser(null);
                  setShowUserDropdown(false);
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={removeBannerConfirm.isOpen}
        onConfirm={confirmRemoveBanner}
        onCancel={() => setRemoveBannerConfirm({ isOpen: false })}
        title="Remove Banner"
        message="Remove the current pop up message?"
        confirmText="Remove"
        cancelText="Cancel"
        confirmDanger={false}
      />

      <ConfirmModal
        isOpen={deleteOrderConfirm.isOpen}
        onConfirm={confirmDeleteOrder}
        onCancel={() => setDeleteOrderConfirm({ isOpen: false, orderId: null })}
        title="Delete Order"
        message="Delete this order?"
        confirmText="Delete"
        cancelText="Cancel"
        confirmDanger={true}
      />

      <ConfirmModal
        isOpen={archiveOrdersConfirm.isOpen}
        onConfirm={confirmArchiveOrders}
        onCancel={() => setArchiveOrdersConfirm({ isOpen: false, count: 0 })}
        title="Archive Orders"
        message={`Archive ${archiveOrdersConfirm.count} selected order(s)?`}
        confirmText="Archive"
        cancelText="Cancel"
        confirmDanger={false}
      />

      <ConfirmModal
        isOpen={unarchiveOrdersConfirm.isOpen}
        onConfirm={confirmUnarchiveOrders}
        onCancel={() => setUnarchiveOrdersConfirm({ isOpen: false, count: 0 })}
        title="Unarchive Orders"
        message={`Unarchive ${unarchiveOrdersConfirm.count} selected order(s)?`}
        confirmText="Unarchive"
        cancelText="Cancel"
        confirmDanger={false}
      />

      <ConfirmModal
        isOpen={deleteTestEventConfirm.isOpen}
        onConfirm={confirmDeleteTestEvent}
        onCancel={() => setDeleteTestEventConfirm({ isOpen: false, eventId: null })}
        title="Delete Test Event"
        message={`Are you sure you want to delete this test? There ${testEventRecordCount === 1 ? 'is' : 'are'} ${testEventRecordCount} result${testEventRecordCount === 1 ? '' : 's'} of this test that will be deleted if you do.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmDanger={true}
      />

      <ConfirmModal
        isOpen={deleteUserConfirm.isOpen}
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeleteUserConfirm({ isOpen: false, userId: null })}
        title="Delete User"
        message="⚠️ WARNING: This will PERMANENTLY DELETE this user and all their data! This action cannot be undone. Are you sure you want to continue?"
        confirmText="Delete"
        cancelText="Cancel"
        confirmDanger={true}
      />
    </div>
  );
};

export default Admin;
