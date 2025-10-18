import React, { useState, useEffect, useContext, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from './SimpleNotification';
import './Admin.css';

const Admin = () => {
  const { currentUser, isAdmin, isExec, isCoach } = useAuth();
  
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    // Restore last active tab from localStorage, default to 'members'
    const savedTab = localStorage.getItem('adminActiveTab');
    console.log('🔍 Admin: Restoring tab from localStorage:', savedTab);
    return savedTab || 'members';
  });
  // Merch orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderForm, setOrderForm] = useState({ id: null, firstName: '', lastName: '', email: '', item: '', size: '', quantity: 1 });
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [bannerForm, setBannerForm] = useState({ enabled: false, rotationIntervalMs: 6000 });
  const [bannerItems, setBannerItems] = useState([]);
  const [newBannerText, setNewBannerText] = useState('');
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', message: '' });
  const [template, setTemplate] = useState({ bannerTitle: '', title: '', intro: '', bullets: [''], body: '' });
  // Members pagination state
  const [membersPage, setMembersPage] = useState(1);
  const [membersLimit, setMembersLimit] = useState(20);
  const [membersPagination, setMembersPagination] = useState({ currentPage: 1, totalPages: 1, totalMembers: 0, hasMore: false });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  const [bulkEmailStatus, setBulkEmailStatus] = useState(null);
  const [emailType, setEmailType] = useState('individual'); // 'individual' or 'everyone'
  // SMS (Phase 1 - Test Mode) state
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null);
  const [smsTestMode, setSmsTestMode] = useState(true);
  const [smsRecipientType, setSmsRecipientType] = useState('custom'); // 'custom' or 'member'
  const [smsCustomPhone, setSmsCustomPhone] = useState('');
  const [smsSelectedMember, setSmsSelectedMember] = useState(null);
  const [smsMemberSearch, setSmsMemberSearch] = useState('');
  const [showSmsMemberDropdown, setShowSmsMemberDropdown] = useState(false);
  const lastFocusedTextareaRef = useRef(null);
  
  // Individual email recipient selection
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [showCustomEmailInput, setShowCustomEmailInput] = useState(false);
  
  // Bulk email recipient selection
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState({
    members: true,
    exec: true,
    admin: true,
    custom: false
  });
  const [customEmails, setCustomEmails] = useState('');

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

  // Add: Members search state (with debounce)
  const [membersSearch, setMembersSearch] = useState('');
  const [membersSearchDebounced, setMembersSearchDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setMembersSearchDebounced(membersSearch.trim()), 300);
    return () => clearTimeout(id);
  }, [membersSearch]);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

  // Save active tab to localStorage whenever it changes
  const handleTabChange = (newTab) => {
    console.log('🔍 Admin: Changing tab to:', newTab);
    setActiveTab(newTab);
    localStorage.setItem('adminActiveTab', newTab);
    console.log('🔍 Admin: Saved tab to localStorage:', newTab);
  };

  // Function to insert formatting into banner input field
  const insertBannerFormatting = (before, after) => {
    const input = document.querySelector('.banner-input');
    if (!input) return;

    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    const selectedText = text.substring(start, end);
    
    // Special handling for links to save space
    if (before === '[' && after === '()') {
      const url = prompt('Enter the URL (e.g., https://example.com):');
      if (!url) return; // User cancelled
      
      // Clean up the URL
      const cleanUrl = url.trim();
      if (!cleanUrl) return;
      
      after = `](${cleanUrl})`;
    }
    
    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
    
    // For links, only count the display text toward the 50-char limit
    let limitedText;
    if (before === '[' && after.includes('](')) {
      // Extract just the display text for character counting
      const linkMatch = newText.match(/\[([^\]]*)\]\([^)]*\)/g);
      if (linkMatch) {
        let displayTextLength = 0;
        let processedText = newText;
        
        // Count only the text inside brackets for all links
        linkMatch.forEach(link => {
          const displayText = link.match(/\[([^\]]*)\]/)[1];
          displayTextLength += displayText.length;
        });
        
        // Remove links temporarily to count other text
        const textWithoutLinks = newText.replace(/\[([^\]]*)\]\([^)]*\)/g, '');
        const totalDisplayLength = textWithoutLinks.length + displayTextLength;
        
        if (totalDisplayLength <= 50) {
          limitedText = newText; // Keep full text with links
        } else {
          // If too long, truncate the non-link text
          const availableLength = 50 - displayTextLength;
          limitedText = textWithoutLinks.slice(0, Math.max(0, availableLength));
          // Re-add the links
          linkMatch.forEach(link => {
            limitedText += link;
          });
        }
      } else {
        limitedText = newText.slice(0, 50);
      }
    } else {
      limitedText = newText.slice(0, 50);
    }
    
    // Update the state and input value
    setNewBannerText(limitedText);
    
    // Restore cursor position
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };


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
    if (!currentUser || (!isAdmin(currentUser) && !isExec(currentUser) && !isCoach(currentUser))) {
      return;
    }

    loadAttendanceData();
  }, [attendanceFilters, currentUser, isAdmin, isExec, isCoach]);

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

  // Function to insert formatting at cursor position
  const insertFormatting = (before, after, field) => {
    // Prefer the currently focused textarea so buttons work across all compose areas
    let textarea = document.activeElement;
    if (!textarea || textarea.tagName !== 'TEXTAREA') {
      // Fallback to legacy selector by placeholder text
      textarea = document.querySelector(`textarea[placeholder*="${field === 'message' ? 'message' : field === 'intro' ? 'Introduction' : 'Main email'}"]`);
    }
    if ((!textarea || textarea.tagName !== 'TEXTAREA') && lastFocusedTextareaRef.current) {
      textarea = lastFocusedTextareaRef.current;
    }
    if (!textarea || textarea.tagName !== 'TEXTAREA') return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    
    let newText;
    if (before === '\n1. ' && after === '') {
      // Smart numbered list - find the highest number in the text and add 1
      const allNumbers = text.match(/\n(\d+)\.\s/g);
      let nextNumber = 1;
      if (allNumbers && allNumbers.length > 0) {
        const maxNumber = Math.max(...allNumbers.map(match => parseInt(match.match(/(\d+)/)[1])));
        nextNumber = maxNumber + 1;
      }
      newText = text.substring(0, start) + `\n${nextNumber}. ` + selectedText + after + text.substring(end);
    } else {
      newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
    }
    
    if (field === 'message') {
      setEmailForm({ ...emailForm, message: newText });
    } else {
      setTemplate({ ...template, [field]: newText });
    }

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  // Function to convert markdown-like formatting to HTML
  const formatText = (text) => {
    if (!text) return '';
    
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #3b82f6; text-decoration: none;">$1</a>') // Links
      .replace(/\n• /g, '<br/><br/>• ') // Add extra space before bullet points
      .replace(/\n\d+\. /g, '<br/>$&') // Add single space before numbered bullets
      .replace(/\n/g, '<br/>'); // Line breaks
  };

  const loadBannerData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/site/banner`);
      if (response.ok) {
        const data = await response.json();
        const normalized = data.banner || {};
        const items = Array.isArray(normalized.items)
          ? normalized.items.map((it) => (typeof it === 'string' ? it : String(it?.message || ''))).filter(Boolean)
          : (normalized.message ? [String(normalized.message)] : []);
        setBannerForm({
          enabled: !!normalized.enabled,
          rotationIntervalMs: Number(normalized.rotationIntervalMs) > 0 ? Number(normalized.rotationIntervalMs) : 6000,
        });
        setBannerItems(items);
      }
    } catch (error) {
      console.error('Error loading banner data:', error);
    }
  };

  // Banner editor helpers
  const handleAddBannerItem = () => {
    const trimmed = (newBannerText || '').trim();
    if (!trimmed) return;
    const limited = trimmed.slice(0, 50);
    setBannerItems(prevItems => {
      if (prevItems.length >= 10) return prevItems;
      return [...prevItems, limited];
    });
    setNewBannerText('');
  };

  const handleRemoveBannerItem = (indexToRemove) => {
    setBannerItems(prevItems => prevItems.filter((_, idx) => idx !== indexToRemove));
  };

  // Calculate display length (excluding URLs in links)
  const getDisplayLength = (text) => {
    if (!text) return 0;
    // Replace [text](url) with just the display text for counting
    const withoutUrls = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    return withoutUrls.length;
  };

  // Load merch orders
  const loadOrders = async () => {
    try {
      if (!currentUser || !isAdmin(currentUser)) return;
      setOrdersLoading(true);
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(`${API_BASE_URL}/merch-orders`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
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
  }, [activeTab]);

  const openNewOrder = () => {
    setOrderForm({ id: null, firstName: '', lastName: '', email: '', item: '', size: '', quantity: 1 });
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
      showError(e.message, { title: 'Failed to Save Order' });
    }
  };

  const deleteOrder = async (id) => {
    if (!window.confirm('Delete this order?')) return;
    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(`${API_BASE_URL}/merch-orders/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to delete order');
      await loadOrders();
    } catch (e) {
      showError(e.message, { title: 'Failed to Delete Order' });
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

  const addCustomEmail = () => {
    const email = customEmailInput.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const customRecipient = {
        id: `custom-${Date.now()}`,
        name: 'External Recipient',
        email: email,
        role: 'custom'
      };
      setSelectedRecipients(prev => [...prev, customRecipient]);
      setCustomEmailInput('');
      setShowCustomEmailInput(false);
    }
  };

  // Handle Enter key for auto-numbering
  const handleTextareaKeyPress = (e, field) => {
    if (e.key === 'Enter') {
      const textarea = e.target;
      const text = textarea.value;
      const cursorPos = textarea.selectionStart;
      
      // Check if we're at the end of a numbered line
      const lines = text.substring(0, cursorPos).split('\n');
      const currentLine = lines[lines.length - 1];
      const numberMatch = currentLine.match(/^(\d+)\.\s/);
      
      if (numberMatch) {
        e.preventDefault();
        const currentNumber = parseInt(numberMatch[1]);
        const nextNumber = currentNumber + 1;
        
        // Insert the next numbered line
        const beforeCursor = text.substring(0, cursorPos);
        const afterCursor = text.substring(cursorPos);
        const newText = beforeCursor + '\n' + nextNumber + '. ' + afterCursor;
        
        if (field === 'message') {
          setEmailForm({ ...emailForm, message: newText });
        } else {
          setTemplate({ ...template, [field]: newText });
        }
        
        // Set cursor position after the new number
        setTimeout(() => {
          textarea.focus();
          const newCursorPos = beforeCursor.length + '\n'.length + (nextNumber + '. ').length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }
    }
  };

  const filteredMembers = members.filter(member => 
    member.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
    member.email.toLowerCase().includes(recipientSearch.toLowerCase())
  );

  // Filter members with phone numbers for SMS
  const membersWithPhones = members.filter(member => 
    member.phone_number && 
    member.phone_number.trim().length > 0 &&
    (member.name.toLowerCase().includes(smsMemberSearch.toLowerCase()) ||
     member.email.toLowerCase().includes(smsMemberSearch.toLowerCase()))
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
            recipients: bulkEmailRecipients,
            customEmails: customEmails
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

  const handleSendSMS = async () => {
    setSmsStatus(null);
    setSmsSending(true);
    
    try {
      let targetPhone = '';
      
      if (smsRecipientType === 'custom') {
        if (!smsCustomPhone.trim()) {
          setSmsStatus({ type: 'error', text: 'Please enter a phone number.' });
          setSmsSending(false);
          return;
        }
        targetPhone = smsCustomPhone.trim();
      } else {
        if (!smsSelectedMember) {
          setSmsStatus({ type: 'error', text: 'Please select a member.' });
          setSmsSending(false);
          return;
        }
        targetPhone = smsSelectedMember.phone_number;
      }
      
      if (!smsMessage.trim()) {
        setSmsStatus({ type: 'error', text: 'Please enter a message.' });
        setSmsSending(false);
        return;
      }

      const token = localStorage.getItem('triathlonToken');
      const resp = await fetch(`${API_BASE_URL}/admin/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          to: targetPhone, 
          message: smsMessage.trim(), 
          testMode: smsTestMode 
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setSmsStatus({ type: 'success', text: `Text sent to ${targetPhone}.` });
        setSmsMessage('');
        setSmsCustomPhone('');
        setSmsSelectedMember(null);
        setSmsMemberSearch('');
      } else {
        setSmsStatus({ type: 'error', text: data.error || 'Failed to send text' });
      }
    } catch (err) {
      setSmsStatus({ type: 'error', text: err.message });
    } finally {
      setSmsSending(false);
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
      const params = new URLSearchParams({ page: String(membersPage), limit: String(membersLimit) });
      if (membersSearchDebounced) params.set('search', membersSearchDebounced);
      const membersResponse = await fetch(`${API_BASE_URL}/admin/members?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        // Remove verbose member logging in production
        
        // Transform backend data to frontend format (snake_case to camelCase)
        const transformedMembers = membersData.members.map(member => ({
          ...member,
          joinDate: member.join_date,
          expiryDate: member.expiry_date,
          absences: member.absences || 0,
          charterAccepted: member.charter_accepted || 0
        }));
        
        
        setMembers(transformedMembers);
        if (membersData.pagination) {
          setMembersPagination(membersData.pagination);
        } else {
          setMembersPagination({ currentPage: membersPage, totalPages: 1, totalMembers: transformedMembers.length, hasMore: false });
        }
        
        // Filter pending members
        const pending = transformedMembers.filter(m => m.role === 'pending');
        setPendingMembers(pending);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  // Reload members when page/limit change or search changes
  useEffect(() => {
    loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membersPage, membersLimit, membersSearchDebounced]);

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

  // Export merch orders to Excel
  const exportMerchToExcel = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/admin/merch/export`, {
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
      a.href = url;
      a.download = `merch_orders_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Failed to export merch orders');
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
      showError('Please set an expiry date before approving the member.', { title: 'Missing Information' });
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
        showError(`Failed to delete user${err.error ? `: ${err.error}` : ''}`, { title: 'Delete Failed' });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showError(`Error deleting user: ${error.message}`, { title: 'Delete Error' });
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
      // Backend expects snake_case `phone_number`
      phone_number: formatPhoneNumber(editForm.phoneNumber),
      expiryDate: editForm.expiryDate || null,
      charterAccepted: editForm.charterAccepted ? 1 : 0
    };
    // Remove camelCase phoneNumber to avoid ambiguity on the server
    delete cleanFormData.phoneNumber;
    
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
        
        // Optimistically update the members table immediately
        setMembers(prev => prev.map(m => {
          if (m.id !== editingMember.id) return m;
          return {
            ...m,
            name: editForm.name,
            email: editForm.email,
            role: editForm.role,
            expiryDate: editForm.expiryDate || null,
            phone_number: formatPhoneNumber(editForm.phoneNumber),
            charterAccepted: editForm.charterAccepted ? 1 : 0,
            sport: editForm.sport || m.sport
          };
        }));

        // Check if role was actually changed and notify the user
        // Use strict comparison and ensure we're comparing the original role value
        const originalRole = editingMember.role;
        const newRole = editForm.role;
        const roleChanged = originalRole !== newRole;
        
        console.log('🔍 Role comparison - Original:', originalRole, 'New:', newRole, 'Changed:', roleChanged);
        
        if (roleChanged) {
          console.log('🔄 Role changed from', originalRole, 'to', newRole);
          
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
                oldRole: originalRole,
                newRole: newRole
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
        } else {
          console.log('ℹ️ No role change detected - skipping notification');
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
        showError(`Failed to update member: ${errorData.error || 'Unknown error'}`, { title: 'Update Failed' });
      }
    } catch (error) {
      console.error('❌ Error updating member:', error);
      showError(`Error updating member: ${error.message}`, { title: 'Update Error' });
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
  
  // Allow admins, execs, and coaches to access dashboard
  if (!currentUser || (!isAdmin(currentUser) && !isExec(currentUser) && !isCoach(currentUser))) {
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
          onClick={() => handleTabChange('members')}
        >
          All Members
        </button>
        {isAdmin(currentUser) && (
          <button 
            className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => handleTabChange('pending')}
          >
            Pending Approval
          </button>
        )}
        <button 
          className={`tab-button ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => handleTabChange('email')}
        >
          Send Email
        </button>
        <button 
          className={`tab-button ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => handleTabChange('text')}
        >
          Send Text (Test)
        </button>
        <button 
          className={`tab-button ${activeTab === 'banner' ? 'active' : ''}`}
          onClick={() => handleTabChange('banner')}
        >
          Site Banner
        </button>
        <button 
          className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => handleTabChange('attendance')}
        >
          Attendance
        </button>
        {isAdmin(currentUser) && (
          <button 
            className={`tab-button ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => handleTabChange('orders')}
          >
            Merch Orders
          </button>
        )}
      </div>

      <div className="admin-content">


        {activeTab === 'members' && (
                      <div className="members-section">
              <h2>All Members</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 16px', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Total: {membersPagination.totalMembers} • Page {membersPagination.currentPage} of {membersPagination.totalPages}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Search input */}
                  <input
                    type="text"
                    value={membersSearch}
                    onChange={(e) => { setMembersPage(1); setMembersSearch(e.target.value); }}
                    placeholder="Search name or email..."
                    style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, minWidth: 220 }}
                    aria-label="Search members"
                  />
                  <label style={{ fontSize: 13, color: '#6b7280' }}>Rows per page:</label>
                  <select value={membersLimit} onChange={(e)=> { setMembersPage(1); setMembersLimit(parseInt(e.target.value)||20); }}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <button className="btn" disabled={membersPage <= 1} onClick={() => setMembersPage(p => Math.max(1, p - 1))}>Previous</button>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Page {membersPagination.currentPage} of {membersPagination.totalPages}</span>
              <button className="btn" disabled={membersPage >= membersPagination.totalPages} onClick={() => setMembersPage(p => Math.min(membersPagination.totalPages, p + 1))}>Next</button>
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
            <p>Toggle a banner at the top of the site with one or more rotating messages.</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const token = localStorage.getItem('triathlonToken');
                const resp = await fetch(`${API_BASE_URL}/site/banner`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({
                    enabled: !!bannerForm.enabled,
                    items: bannerItems,
                    rotationIntervalMs: Number(bannerForm.rotationIntervalMs) > 0 ? Number(bannerForm.rotationIntervalMs) : 6000,
                  })
                });
                if (!resp.ok) {
                  const err = await resp.json().catch(() => ({}));
                  throw new Error(err.error || 'Failed to update banner');
                }
                showSuccess('Banner updated successfully!');
                console.log('🔄 Banner updated, reloading page...');
                try {
                  await loadBannerData();
                  console.log('🔄 Banner data reloaded successfully');
                } catch (error) {
                  console.error('⚠️ Error reloading banner data:', error);
                }
                console.log('🔄 Reloading page now...');
                // Reload the page to show banner changes immediately
                setTimeout(() => {
                  window.location.reload();
                }, 100); // Small delay to ensure success message is shown
              } catch (err) {
                showError(err.message, { title: 'Failed to Update Banner' });
              }
            }}>
              <div className="form-group" style={{display:'flex', alignItems:'center', gap:'12px'}}>
                <label className="toggle-switch">
                  <input type="checkbox" checked={!!bannerForm.enabled} onChange={(e)=> setBannerForm({ ...bannerForm, enabled: e.target.checked })} />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">{bannerForm.enabled ? 'On' : 'Off'}</span>
              </div>

              <div className="form-group banner-editor">
                <label>Messages</label>
                <div className="text-editor-toolbar">
                  <button 
                    type="button" 
                    className="format-btn" 
                    onClick={() => insertBannerFormatting('**', '**')}
                    title="Bold"
                  >
                    <strong>B</strong>
                  </button>
                  <button 
                    type="button" 
                    className="format-btn" 
                    onClick={() => insertBannerFormatting('*', '*')}
                    title="Italic"
                  >
                    <em>I</em>
                  </button>
                  <button 
                    type="button" 
                    className="format-btn" 
                    onClick={() => insertBannerFormatting('[', ']()')}
                    title="Link - Add URL inside parentheses"
                  >
                    🔗
                  </button>
                </div>
                <div className="banner-add-row">
                  <input
                    type="text"
                    className="banner-input"
                    placeholder="Type a message (max 50 characters)"
                    value={newBannerText}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow typing if display length is under 50
                      if (getDisplayLength(value) <= 50) {
                        setNewBannerText(value);
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddBannerItem(); } }}
                  />
                  <button
                    type="button"
                    className="action-btn primary banner-add-btn"
                    onClick={handleAddBannerItem}
                    disabled={!newBannerText.trim() || bannerItems.length >= 10}
                  >
                    Add
                  </button>
                </div>
                <div className="banner-meta">
                  <span>{getDisplayLength(newBannerText)}/50</span>
                  <span style={{ marginLeft: 'auto' }}>{bannerItems.length}/10 items</span>
                </div>

                <ul className="banner-items-list">
                  {bannerItems.length === 0 && (
                    <li className="banner-item empty">No messages added yet.</li>
                  )}
                  {bannerItems.map((msg, idx) => (
                    <li key={idx} className="banner-item">
                      <span className="banner-item-text">{msg}</span>
                      <button
                        type="button"
                        className="banner-remove-btn"
                        aria-label={`Remove message ${idx + 1}`}
                        onClick={() => handleRemoveBannerItem(idx)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="form-group">
                <label>Rotation interval (ms)</label>
                <input 
                  type="number" 
                  value={bannerForm.rotationIntervalMs}
                  onChange={(e)=> setBannerForm({ ...bannerForm, rotationIntervalMs: e.target.value })}
                  min={1000}
                  step={500}
                />
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
                          
                          {/* Custom Email Input */}
                          <div className="custom-email-section" style={{ marginTop: '12px' }}>
                            <button 
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setShowCustomEmailInput(!showCustomEmailInput)}
                              style={{ fontSize: '14px', padding: '6px 12px' }}
                            >
                              {showCustomEmailInput ? 'Cancel' : '+ Add Custom Email'}
                            </button>
                            
                            {showCustomEmailInput && (
                              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <input 
                                  type="email" 
                                  value={customEmailInput} 
                                  onChange={(e) => setCustomEmailInput(e.target.value)}
                                  placeholder="Enter email address..."
                                  className="form-control"
                                  style={{ flex: 1 }}
                                  onKeyPress={(e) => e.key === 'Enter' && addCustomEmail()}
                                />
                                <button 
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={addCustomEmail}
                                  disabled={!customEmailInput.trim()}
                                  style={{ fontSize: '14px', padding: '6px 12px' }}
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {selectedRecipients.length > 0 && (
                            <div className="selected-recipients">
                              {selectedRecipients.map(recipient => (
                                <div key={recipient.id} className="recipient-tag">
                                  <span className="recipient-tag-name">{recipient.name}</span>
                                  <span className="recipient-tag-email">({recipient.email})</span>
                                  {recipient.role === 'custom' && (
                                    <span className="recipient-tag-role" style={{ fontSize: '11px', color: '#6b7280' }}>Custom</span>
                                  )}
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
                        <div className="text-editor">
                          <div className="text-editor-toolbar">
                            <button 
                              type="button" 
                              className="format-btn" 
                              onClick={() => insertFormatting('**', '**', 'message')}
                              title="Bold"
                            >
                              <strong>B</strong>
                            </button>
                            <button 
                              type="button" 
                              className="format-btn" 
                              onClick={() => insertFormatting('*', '*', 'message')}
                              title="Italic"
                            >
                              <em>I</em>
                            </button>
                            <button 
                              type="button" 
                              className="format-btn" 
                              onClick={() => insertFormatting('\n• ', '', 'message')}
                              title="Bullet Point"
                            >
                              •
                            </button>
                            <button 
                              type="button" 
                              className="format-btn" 
                              onClick={() => insertFormatting('\n1. ', '', 'message')}
                              title="Numbered List"
                            >
                              1.
                            </button>
                            <button 
                              type="button" 
                              className="format-btn" 
                              onClick={() => insertFormatting('[', '](url)', 'message')}
                              title="Link"
                            >
                              🔗
                            </button>
                          </div>
                          <textarea 
                            rows="8" 
                            value={emailForm.message} 
                            onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} 
                            onKeyPress={(e) => handleTextareaKeyPress(e, 'message')}
                            onFocus={(e) => { lastFocusedTextareaRef.current = e.target; }}
                            placeholder="Type your message here... Use **bold**, *italic*, • bullets, 1. numbered lists, and [link text](url) formatting."
                            required 
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Individual Email Preview */}
                  {emailType === 'individual' && (
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
                          {/* Content */}
                          <div style={{ padding: '24px' }}>
                            {template.title && (
                              <h2 style={{ color: '#1f2937', margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>
                                {template.title}
                              </h2>
                            )}
                            
                            <div 
                              style={{ margin: 0, color: '#475569', fontSize: '16px', lineHeight: 1.6, whiteSpace: 'pre-line' }}
                              dangerouslySetInnerHTML={{ 
                                __html: formatText(emailForm.message || 'Your message will appear here...') + '<br/><br/><em style="color: #6b7280; font-style: italic;">The UofT Tri Club Exec</em>'
                              }}
                            />
                          </div>
                          
                          {/* Footer */}
                          <div style={{
                            background: '#f8fafc',
                            padding: '16px 24px',
                            borderTop: '1px solid #e5e7eb',
                            textAlign: 'center'
                          }}>
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                              UofT Triathlon Club | <a href="https://uoft-tri.club" style={{ color: '#3b82f6' }}>uoft-tri.club</a>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recipient Selection - only show for everyone */}
                  {emailType === 'everyone' && (
                    <div className="card" style={{padding:'16px', border:'1px solid #eee', borderRadius:6, marginBottom:16}}>
                      <h3 style={{marginTop:0}}>Recipients</h3>
                      <div className="form-group">
                        <label>
                          <input 
                            type="checkbox" 
                            checked={bulkEmailRecipients.members} 
                            onChange={(e) => setBulkEmailRecipients({...bulkEmailRecipients, members: e.target.checked})}
                          />
                          Members
                        </label>
                        <label>
                          <input 
                            type="checkbox" 
                            checked={bulkEmailRecipients.exec} 
                            onChange={(e) => setBulkEmailRecipients({...bulkEmailRecipients, exec: e.target.checked})}
                          />
                          Exec
                        </label>
                        <label>
                          <input 
                            type="checkbox" 
                            checked={bulkEmailRecipients.admin} 
                            onChange={(e) => setBulkEmailRecipients({...bulkEmailRecipients, admin: e.target.checked})}
                          />
                          Admin
                        </label>
                        <label>
                          <input 
                            type="checkbox" 
                            checked={bulkEmailRecipients.custom} 
                            onChange={(e) => setBulkEmailRecipients({...bulkEmailRecipients, custom: e.target.checked})}
                          />
                          Custom Email Addresses
                        </label>
                      </div>
                      {bulkEmailRecipients.custom && (
                        <div className="form-group">
                          <label>Custom Email Addresses</label>
                          <textarea 
                            rows="3" 
                            value={customEmails} 
                            onChange={(e) => setCustomEmails(e.target.value)} 
                            placeholder="Enter email addresses separated by commas or new lines:&#10;email1@example.com&#10;email2@example.com&#10;email3@example.com"
                          />
                          <small style={{color: '#6b7280', fontSize: '12px'}}>
                            Separate multiple emails with commas or new lines
                          </small>
                        </div>
                      )}
                    </div>
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
                        <label>Email Content</label>
                        <div className="text-editor">
                          <div className="text-editor-toolbar">
                            <button 
                              type="button" 
                              className="format-btn" 
                              onClick={() => insertFormatting('**', '**', 'body')}
                              title="Bold"
                            >
                              <strong>B</strong>
                            </button>
                            <button 
                              type="button" 
                              className="format-btn" 
                              onClick={() => insertFormatting('*', '*', 'body')}
                              title="Italic"
                            >
                              <em>I</em>
                            </button>
                            <button 
                              type="button" 
                              className="format-btn" 
                              onClick={() => insertFormatting('\n• ', '', 'body')}
                              title="Bullet Point"
                            >
                              •
                            </button>
                            <button 
                              type="button" 
                              className="format-btn" 
                              onClick={() => insertFormatting('\n1. ', '', 'body')}
                              title="Numbered List"
                            >
                              1.
                            </button>
                            <button 
                              type="button" 
                              className="format-btn" 
                              onClick={() => insertFormatting('[', '](url)', 'body')}
                              title="Link"
                            >
                              🔗
                            </button>
                          </div>
                          <textarea 
                            rows="12" 
                            value={template.body} 
                            onChange={(e)=>setTemplate({...template, body:e.target.value})} 
                            onFocus={(e) => { lastFocusedTextareaRef.current = e.target; }}
                            onKeyPress={(e) => handleTextareaKeyPress(e, 'body')}
                            placeholder="Write your email content here... Use **bold**, *italic*, • bullets, 1. numbered lists (press Enter for auto-numbering), and [link text](url) formatting."
                          />
                        </div>
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
                        {/* Body with preserved line breaks */}
                        {template.body && (
                          <div
                            style={{ margin: 0, color: '#475569', fontSize: '16px', lineHeight: 1.6, whiteSpace: 'pre-line' }}
                            dangerouslySetInnerHTML={{ 
                              __html: formatText(template.body) + '<br/><br/><em style="color: #6b7280; font-style: italic;">The UofT Tri Club Exec</em>'
                            }}
                          />
                        )}
                      </div>
                      
                      {/* Footer */}
                      <div style={{
                        background: '#f1f5f9',
                        padding: '24px',
                        textAlign: 'center',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        <p style={{margin: 0, color: '#64748b', fontSize: '14px'}}>
                          UofT Triathlon Club | <a href="https://uoft-tri.club" style={{color: '#3b82f6', textDecoration: 'none', fontWeight: 500}}>uoft-tri.club</a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="email-section">
            <h2>Send Text (Test Mode)</h2>
            <p style={{marginTop: 0, color: '#6b7280'}}>Phase 1 sends only to the configured admin test phone on the server.</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await handleSendSMS();
            }}>
              <div className="form-group">
                <label>Recipient</label>
                <div className="form-group" style={{display: 'flex', gap: '12px', marginBottom: '12px'}}>
                  <label>
                    <input 
                      type="radio" 
                      name="smsRecipientType" 
                      value="custom" 
                      checked={smsRecipientType === 'custom'} 
                      onChange={(e) => setSmsRecipientType(e.target.value)}
                    />
                    Custom Phone
                  </label>
                  <label>
                    <input 
                      type="radio" 
                      name="smsRecipientType" 
                      value="member" 
                      checked={smsRecipientType === 'member'} 
                      onChange={(e) => setSmsRecipientType(e.target.value)}
                    />
                    Member
                  </label>
                </div>
                
                {smsRecipientType === 'custom' && (
                  <input 
                    type="tel" 
                    value={smsCustomPhone} 
                    onChange={(e) => setSmsCustomPhone(e.target.value)}
                    placeholder="Enter phone number (e.g., +1234567890)"
                    style={{ width: '100%' }}
                  />
                )}
                
                {smsRecipientType === 'member' && (
                  <div className="recipient-selection">
                    <div className="recipient-input-container">
                      <input 
                        type="text" 
                        value={smsMemberSearch} 
                        onChange={(e) => {
                          setSmsMemberSearch(e.target.value);
                          setShowSmsMemberDropdown(true);
                        }}
                        onFocus={() => setShowSmsMemberDropdown(true)}
                        placeholder="Search members with phone numbers..."
                        className="recipient-search-input"
                      />
                      {showSmsMemberDropdown && smsMemberSearch && (
                        <div className="recipient-dropdown">
                          {membersWithPhones.slice(0, 10).map(member => (
                            <div 
                              key={member.id}
                              className="recipient-option"
                              onClick={() => {
                                setSmsSelectedMember(member);
                                setSmsMemberSearch('');
                                setShowSmsMemberDropdown(false);
                              }}
                            >
                              <div className="recipient-option-info">
                                <span className="recipient-name">{member.name}</span>
                                <span className="recipient-email">{member.email}</span>
                                <span className="recipient-role">{member.phone_number}</span>
                              </div>
                            </div>
                          ))}
                          {membersWithPhones.length === 0 && (
                            <div className="recipient-option no-results">No members with phone numbers found</div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {smsSelectedMember && (
                      <div className="selected-recipients" style={{marginTop: '8px'}}>
                        <div className="recipient-tag">
                          <span className="recipient-tag-name">{smsSelectedMember.name}</span>
                          <span className="recipient-tag-email">({smsSelectedMember.phone_number})</span>
                          <button 
                            type="button"
                            className="recipient-tag-remove"
                            onClick={() => {
                              setSmsSelectedMember(null);
                              setSmsMemberSearch('');
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group" style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <label className="toggle-switch">
                  <input type="checkbox" checked={smsTestMode} onChange={(e)=> setSmsTestMode(e.target.checked)} />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">Test mode (required)</span>
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea
                  rows="4"
                  value={smsMessage}
                  onChange={(e)=> setSmsMessage(e.target.value)}
                  placeholder="Short SMS message..."
                  required
                  maxLength={918}
                />
                <div style={{fontSize: '12px', color: '#666', textAlign: 'right', marginTop: '4px'}}>
                  {smsMessage.length}/918 characters
                </div>
              </div>
              {smsStatus && (
                <div className={`notice ${smsStatus.type}`} style={{ marginBottom: '1rem' }}>
                  {smsStatus.text}
                </div>
              )}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={smsSending || !smsTestMode} style={{width: '100%'}}> 
                  {smsSending ? 'Sending...' : 'Send Test Text'}
                </button>
              </div>
            </form>
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
                              {(() => {
                                try {
                                  const base = String(workout.workout_date).split('T')[0];
                                  const [y, m, d] = base.split('-').map(Number);
                                  const date = new Date(Date.UTC(y, m - 1, d));
                                  return date.toLocaleDateString(undefined, { timeZone: 'UTC' });
                                } catch {
                                  return workout.workout_date;
                                }
                              })()}
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

        {isAdmin(currentUser) && activeTab === 'orders' && (
          <div className="orders-section">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h2>Merch Orders</h2>
              <div style={{display:'flex', gap:8}}>
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
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>Email</th>
                      <th>Item</th>
                      <th>Size</th>
                      <th>Qty</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id}>
                        <td>{o.firstName || o.name?.split(' ')[0] || '-'}</td>
                        <td>{o.lastName || o.name?.split(' ').slice(1).join(' ') || '-'}</td>
                        <td>{o.email}</td>
                        <td>{o.item}</td>
                        <td>{o.size}</td>
                        <td>{o.quantity}</td>
                        <td>{o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}</td>
                        <td>
                          <button className="action-btn small" onClick={() => editOrder(o)}>Edit</button>
                          <button className="action-btn small danger" onClick={() => deleteOrder(o.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr><td colSpan="8" style={{textAlign:'center', color:'#6b7280'}}>No orders yet</td></tr>
                    )}
                  </tbody>
                </table>
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
                  <option value="coach">Coach</option>
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

      {/* Order Modal */}
      {showOrderModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{orderForm.id ? 'Edit Order' : 'New Order'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>First Name</label><input type="text" value={orderForm.firstName} onChange={e=>setOrderForm({...orderForm,firstName:e.target.value})} required /></div>
              <div className="form-group"><label>Last Name</label><input type="text" value={orderForm.lastName} onChange={e=>setOrderForm({...orderForm,lastName:e.target.value})} required /></div>
              <div className="form-group"><label>Email</label><input type="email" value={orderForm.email} onChange={e=>setOrderForm({...orderForm,email:e.target.value})} required /></div>
              <div className="form-group"><label>Item</label><input type="text" value={orderForm.item} onChange={e=>setOrderForm({...orderForm,item:e.target.value})} required /></div>
              <div className="form-group"><label>Size</label><input type="text" value={orderForm.size} onChange={e=>setOrderForm({...orderForm,size:e.target.value})} /></div>
              <div className="form-group"><label>Quantity</label><input type="number" min="1" value={orderForm.quantity} onChange={e=>setOrderForm({...orderForm,quantity:Number(e.target.value)||1})} required /></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={saveOrder}>Save</button>
              <button className="btn btn-secondary" onClick={()=>setShowOrderModal(false)}>Cancel</button>
            </div>
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
                  <div><strong>Date:</strong> {attendanceDetails.workout.workout_date && (() => {
                    try {
                      const base = String(attendanceDetails.workout.workout_date).split('T')[0];
                      const [y, m, d] = base.split('-').map(Number);
                      const date = new Date(Date.UTC(y, m - 1, d));
                      return date.toLocaleDateString(undefined, { timeZone: 'UTC' });
                    } catch {
                      return attendanceDetails.workout.workout_date;
                    }
                  })()}</div>
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
                          {(() => {
                            const { normalizeProfileImageUrl } = require('../utils/imageUtils');
                            const url = normalizeProfileImageUrl(signup.profile_picture_url);
                            return url ? (
                              <img 
                                src={url}
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
                            );
                          })()}
                          {!signup.profile_picture_url && (
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

              {/* Who Cancelled Within 12 Hours */}
              {attendanceDetails.attendance.filter(record => !record.attended && record.attendance_type === 'cancelled').length > 0 && (
                <div className="cancelled-section">
                  <h3>🚫 Who Cancelled Within 12 Hours ({attendanceDetails.attendance.filter(record => !record.attended && record.attendance_type === 'cancelled').length})</h3>
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
