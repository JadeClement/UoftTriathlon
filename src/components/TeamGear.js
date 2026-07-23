import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { showError, showSuccess } from './SimpleNotification';
import ConfirmModal from './ConfirmModal';
import './TeamGear.css';
import { getApiBaseUrl } from '../utils/apiConfig';

const TeamGear = () => {
  const { currentUser, isAdmin, getUserRole, needsReauth } = useAuth();
  const API_BASE = getApiBaseUrl();
  console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
  const [gearItems, setGearItems] = useState([]);

  // State to track current image index for each gear item
  const [currentImageIndex, setCurrentImageIndex] = useState({});

  // Admin edit modal state
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', price: '', description: '', hasGender: false, hasSize: false, availableSizes: [] });
  const [newImages, setNewImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [currentImages, setCurrentImages] = useState([]);
  // Simple per-item selection for ordering options
  const [orderSelections, setOrderSelections] = useState({}); // { [itemId]: { fit: 'mens'|'womens', size: 'xs'|'s'|'m'|'l'|'xl'|'2xl' } }

  // Admin add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', price: '', description: '', hasGender: false, hasSize: false, availableSizes: [] });
  const [adding, setAdding] = useState(false);

  // Lightbox (enlarge) state
  const [lightboxItem, setLightboxItem] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Order confirmation modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteGearConfirm, setDeleteGearConfirm] = useState({ isOpen: false, itemId: null });
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderEmail, setOrderEmail] = useState('');
  const [orderEmailConfirm, setOrderEmailConfirm] = useState('');
  const [orderError, setOrderError] = useState('');
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState(null);
  
  // Offline state
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const normalizeImageUrl = (url) => {
    if (!url) {
      return '/images/placeholder-gear.svg';
    }
    
    if (url.startsWith('/uploads/')) {
      return `${API_BASE}/..${url}`;
    }
    if (url.startsWith('/api/')) {
      return `${API_BASE.replace('/api','')}${url}`;
    }
    if (url.startsWith('http')) {
      return url;
    }
    
    return '/images/placeholder-gear.svg';
  };

  // Fetch gear items from backend
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/gear`);
        if (!res.ok) throw new Error('Failed to load gear');
        const data = await res.json();
        const items = (data.items || []).map(item => ({
          ...item,
          images: Array.isArray(item.images) && item.images.length > 0 ? item.images : ['/images/placeholder-gear.svg']
        }));
        setGearItems(items);
      } catch (e) {
        console.error('Failed to load team gear:', e);
      }
    };
    load();
  }, [API_BASE]);

  // Cleanup effect to restore body scroll when component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Navigation functions
  const goToPreviousImage = (itemId) => {
    const currentIndex = currentImageIndex[itemId] || 0;
    const item = gearItems.find(item => item.id === itemId);
    if (item && item.images.length > 0) {
      const newIndex = currentIndex === 0 ? item.images.length - 1 : currentIndex - 1;
      setCurrentImageIndex(prev => ({
        ...prev,
        [itemId]: newIndex
      }));
    }
  };

  const goToNextImage = (itemId) => {
    const currentIndex = currentImageIndex[itemId] || 0;
    const item = gearItems.find(item => item.id === itemId);
    if (item && item.images.length > 0) {
      const newIndex = currentIndex === item.images.length - 1 ? 0 : currentIndex + 1;
      setCurrentImageIndex(prev => ({
        ...prev,
        [itemId]: newIndex
      }));
    }
  };

  // Get current image for an item
  const getCurrentImage = (item) => {
    const currentIndex = currentImageIndex[item.id] || 0;
    const src = item.images[currentIndex] || item.images[0] || '/images/placeholder-gear.svg';
    return normalizeImageUrl(src);
  };

  // Lightbox helpers
  const openLightbox = (item, index = 0) => {
    setLightboxItem(item);
    setLightboxIndex(index);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxItem(null);
    setLightboxIndex(0);
    document.body.style.overflow = '';
  };

  const lightboxPrev = () => {
    if (!lightboxItem) return;
    const len = (lightboxItem.images || []).length;
    if (len === 0) return;
    setLightboxIndex((prev) => (prev === 0 ? len - 1 : prev - 1));
  };

  const lightboxNext = () => {
    if (!lightboxItem) return;
    const len = (lightboxItem.images || []).length;
    if (len === 0) return;
    setLightboxIndex((prev) => (prev === len - 1 ? 0 : prev + 1));
  };

  // Edit handlers
  const openEditModal = (item) => {
    setEditingItem(item);
    // Migrate old size format to new format if needed
    let availableSizes = Array.isArray(item.availableSizes) ? item.availableSizes : [];
    // If item has old format (just 'xs', 's', etc) and hasGender, convert to new format
    if (item.hasGender && availableSizes.length > 0 && availableSizes[0] && !availableSizes[0].includes('-')) {
      // Old format detected - convert to new format (default to men's for backward compatibility)
      availableSizes = availableSizes.map(size => `m-${size}`);
    }
    setEditForm({
      title: item.title || '',
      price: item.price || '',
      description: item.description || '',
      hasGender: item.hasGender || false,
      hasSize: item.hasSize || false,
      availableSizes: availableSizes
    });
    setCurrentImages([...(item.images || [])]);
    setNewImages([]);
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setNewImages([]);
    setCurrentImages([]);
    setSaving(false);
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setNewImages(files);
  };

  // Image management functions
  const removeImage = async (imageUrl) => {
    if (!editingItem) return;
    
    // Don't try to delete placeholder images
    if (imageUrl.includes('placeholder-gear.svg') || imageUrl.includes('/images/')) {
      setCurrentImages(prev => prev.filter(img => img !== imageUrl));
      return;
    }
    
    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(`${API_BASE}/gear/${editingItem.id}/images`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ imageUrl })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove image (${res.status})`);
      }
      
      await res.json();
      
      // Update local state
      setCurrentImages(prev => prev.filter(img => img !== imageUrl));
    } catch (e) {
      console.error('❌ [FRONTEND] Error removing image:', e);
      showError(`Failed to remove image: ${e.message}`);
    }
  };

  const moveImageUp = (index) => {
    if (index === 0) return;
    const newImages = [...currentImages];
    [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    setCurrentImages(newImages);
  };

  const moveImageDown = (index) => {
    if (index === currentImages.length - 1) return;
    const newImages = [...currentImages];
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
    setCurrentImages(newImages);
  };

  // Add new gear item
  const addGearItem = async () => {
    if (!addForm.title.trim()) {
      showError('Please enter a title');
      return;
    }
    
    try {
      setAdding(true);
      const token = localStorage.getItem('triathlonToken');
      
      const res = await fetch(`${API_BASE}/gear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(addForm)
      });
      
      if (!res.ok) throw new Error('Failed to create gear item');
      
      // Refetch gear list
      const gearRes = await fetch(`${API_BASE}/gear`);
      const data = await gearRes.json();
      setGearItems((data.items || []).map(item => ({
        ...item,
        images: Array.isArray(item.images) && item.images.length > 0 ? item.images : ['/images/placeholder-gear.svg']
      })));
      
      setShowAddModal(false);
      setAddForm({ title: '', price: '', description: '', hasGender: false, hasSize: false, availableSizes: [] });
    } catch (e) {
      console.error('Error adding gear item:', e);
      showError('Failed to add gear item');
    } finally {
      setAdding(false);
    }
  };

  // Delete gear item
  const deleteGearItem = async (itemId) => {
    setDeleteGearConfirm({ isOpen: true, itemId });
  };

  const confirmDeleteGearItem = async () => {
    const { itemId } = deleteGearConfirm;
    setDeleteGearConfirm({ isOpen: false, itemId: null });
    
    if (!itemId) return;
    
    try {
      const token = localStorage.getItem('triathlonToken');
      
      const res = await fetch(`${API_BASE}/gear/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) throw new Error('Failed to delete gear item');
      
      // Refetch gear list
      const gearRes = await fetch(`${API_BASE}/gear`);
      const data = await gearRes.json();
      setGearItems((data.items || []).map(item => ({
        ...item,
        images: Array.isArray(item.images) && item.images.length > 0 ? item.images : ['/images/placeholder-gear.svg']
      })));
      
      closeEditModal();
      showSuccess('Gear item deleted successfully');
    } catch (e) {
      console.error('Error deleting gear item:', e);
      showError('Failed to delete gear item');
    }
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      setSaving(true);
      const token = localStorage.getItem('triathlonToken');
      const putRes = await fetch(`${API_BASE}/gear/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editForm.title,
          price: editForm.price,
          description: editForm.description,
          images: currentImages,
          hasGender: editForm.hasGender,
          hasSize: editForm.hasSize,
          availableSizes: editForm.availableSizes
        })
      });
      if (!putRes.ok) throw new Error('Failed to save gear details');

      // Upload new images if any
      if (newImages.length > 0) {
        const formData = new FormData();
        newImages.forEach(f => formData.append('images', f));
        const imgRes = await fetch(`${API_BASE}/gear/${editingItem.id}/images`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        if (!imgRes.ok) throw new Error('Failed to upload images');
        const imgJson = await imgRes.json().catch(()=>null);
        
        // Update currentImages with the new images from server
        if (imgJson && imgJson.images) {
          setCurrentImages(imgJson.images);
        }
      }

      // Refetch list
      const res = await fetch(`${API_BASE}/gear`);
      const data = await res.json();
      const updatedItems = (data.items || []).map(item => ({
        ...item,
        images: Array.isArray(item.images) && item.images.length > 0 ? item.images : ['/images/placeholder-gear.svg']
      }));
      setGearItems(updatedItems);
      closeEditModal();
    } catch (e) {
      console.error(e);
      showError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Order confirmation handlers
  const handleOrderClick = (item) => {
    // Check if user is logged in and has member role
    if (!currentUser) {
      showError('Please log in to place an order.');
      return;
    }

    if (needsReauth) {
      showError('Your membership was updated. Please log out and log back in to place orders.');
      return;
    }
    
    if (!['member', 'coach', 'exec', 'administrator'].includes(currentUser.role)) {
      showError('You need to be a member to place orders. Please contact an administrator to upgrade your account.');
      return;
    }
    
    setSelectedItem(item);
    setShowOrderModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    setSelectedItem(null);
    setOrderEmail('');
    setOrderEmailConfirm('');
    setOrderError('');
    document.body.style.overflow = '';
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setOrderSuccessData(null);
    document.body.style.overflow = '';
  };

  const submitOrder = async () => {
    if (!selectedItem || !currentUser) return;
    
    // Validate email confirmation
    const emailToUse = (orderEmail || '').trim();
    const emailConfirmToUse = (orderEmailConfirm || '').trim();
    
    if (!emailToUse || !emailConfirmToUse) {
      setOrderError('Please enter both email addresses.');
      return;
    }
    
    if (emailToUse !== emailConfirmToUse) {
      setOrderError('Emails do not match.');
      return;
    }
    setOrderError('');

    // Check if user is offline
    if (isOffline) {
      setOrderError('You appear to be offline. Please check your internet connection and try again.');
      return;
    }

    setOrderSubmitting(true);
    try {
      const token = localStorage.getItem('triathlonToken');
      const nameParts = (currentUser.name || '').trim().split(/\s+/).filter(Boolean);
      const firstName = (currentUser.first_name || nameParts[0] || '').trim();
      // Single-word names have no last name from split; use '-' so backend validation still passes
      const lastName = (currentUser.last_name || nameParts.slice(1).join(' ') || '-').trim();
      const selection = orderSelections[selectedItem.id] || {};
      const fit = selection.fit || 'mens';
      let size = selection.size || null;
      if (selectedItem.hasSize && !size) {
        // Match UI defaults when the user never changed the dropdowns
        const availableSizes = Array.isArray(selectedItem.availableSizes) ? selectedItem.availableSizes : [];
        if (selectedItem.hasGender) {
          const genderPrefix = fit === 'womens' ? 'w-' : 'm-';
          const genderSizes = availableSizes
            .filter((s) => s && s.startsWith(genderPrefix))
            .map((s) => s.replace(genderPrefix, ''))
            .filter((s) => ['xs', 's', 'm', 'l', 'xl', '2xl'].includes(s));
          size = genderSizes[0] || 'm';
        } else {
          const unisexSizes = availableSizes
            .filter((s) => s && !String(s).includes('-'))
            .filter((s) => ['xs', 's', 'm', 'l', 'xl', '2xl'].includes(s));
          size = unisexSizes[0] || availableSizes[0] || 'm';
        }
      }
      const orderData = {
        firstName,
        lastName,
        email: emailToUse,
        item: selectedItem.title,
        gender: selectedItem.hasGender ? (fit === 'womens' ? 'womens' : 'mens') : null,
        size: selectedItem.hasSize ? size : null,
        quantity: 1
      };

      console.log('🔍 About to make API call to:', `${API_BASE}/merch-orders`);
      console.log('🔍 Token exists:', !!token);
      console.log('🔍 Token value:', token ? token.substring(0, 20) + '...' : 'null');
      console.log('🔍 Order data:', orderData);
      console.log('🔍 Current user:', currentUser);
      console.log('🔍 User role from context:', currentUser?.role);
      console.log('🔍 User role from getUserRole:', getUserRole(currentUser));
      console.log('🔍 Request headers:', {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });
      
      // Decode JWT token to see what's actually in it
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('🔍 JWT payload:', payload);
          console.log('🔍 JWT role:', payload.role);
        } catch (e) {
          console.log('🔍 Failed to decode JWT:', e.message);
        }
      }
      
      // Store logs in localStorage so they persist through redirects
      const logData = {
        timestamp: new Date().toISOString(),
        url: `${API_BASE}/merch-orders`,
        tokenExists: !!token,
        orderData,
        currentUser
      };
      localStorage.setItem('orderDebugLog', JSON.stringify(logData));
      
      const response = await fetch(`${API_BASE}/merch-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });
      
        console.log('🔍 API response status:', response.status);
        console.log('🔍 API response ok:', response.ok);
        console.log('🔍 API response headers:', Object.fromEntries(response.headers.entries()));
        
        // Try to get response body for debugging
        const responseClone = response.clone();
        try {
          const responseText = await responseClone.text();
          console.log('🔍 API response body:', responseText);
        } catch (e) {
          console.log('🔍 Could not read response body:', e.message);
        }
      
      // Store response data too
      const responseData = {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      };
      localStorage.setItem('orderResponseLog', JSON.stringify(responseData));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new Error('Authentication required. Please log in again.');
        }
        if (response.status === 403) {
          if (errorData.error === 'term_expired') {
            throw new Error(
              errorData.message ||
                'Sorry, your term has expired. To regain access, purchase a membership for the next term, then go to your Profile page and upload your payment receipt. An exec will review it and reactivate your account. If you have questions, email info@uoft-tri.club.'
            );
          }
          if (errorData.error === 'stale_token') {
            throw new Error(
              errorData.message ||
                'Your membership was updated. Please log out and log back in to continue.'
            );
          }
          throw new Error(
            errorData.message ||
              'Access denied. You need to be a member to place orders. If you were recently approved, please log out and log back in.'
          );
        }
        if (response.status === 400) {
          throw new Error(errorData.error || errorData.message || 'Invalid order data. Please check your information.');
        }
        if (response.status >= 500) {
          throw new Error(errorData.error || 'Server error. Please try again later.');
        }
        throw new Error(errorData.error || errorData.message || `Failed to submit order (${response.status})`);
      }

      await response.json();
      
      // Show success modal with order details
      setOrderSuccessData({
        item: selectedItem,
        email: emailToUse,
        size: orderData.size,
        fit: selectedItem.hasGender ? fit : undefined
      });
      setShowSuccessModal(true);
      closeOrderModal();
      document.body.style.overflow = 'hidden';
    } catch (error) {
      console.error('Order submission error:', error);
      
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_INTERNET_DISCONNECTED')) {
        setOrderError('Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        // Surface the specific error from the API (auth, term expiry, validation, etc.)
        setOrderError(error.message || 'Failed to submit order. Please try again.');
      }
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <div className="page-container teamgear-page">
      <h1>Team Gear</h1>
      <p className="page-description">
        Show your UofT Tri Club pride with our official team gear! 
      </p>
      <h2>Triathlon Specific Gear</h2>
      <p>
      The tri suits, bike kits and running singletsre from Champion Systems. The main reference for triathlon is here
      https://www.champ-sys.ca/pages/triathlon, but you may look at cycling and running items. 

      
      </p>
      
      <h2 style={{ marginTop: '2rem' }}>Under Armour Gear</h2>
      <p>Please order through website by October 19th. After this you will receive an invoice from the university.</p>
      <p>Under construction, please check back later today.</p>
      <div className="gear-grid">
        {gearItems.map(item => (
          <div key={item.id} className="gear-item">
            <div className="gear-image-container">
              <img 
                src={getCurrentImage(item)} 
                alt={item.title}
                className="gear-image"
                onError={(e) => {
                  e.target.src = '/images/placeholder-gear.svg';
                }}
              />
              <button
                className="gear-enlarge-button"
                onClick={() => openLightbox(item, currentImageIndex[item.id] || 0)}
                aria-label="Enlarge image"
                title="Enlarge"
              >
                ⤢
              </button>
              {item.images.length > 1 && (
                <>
                  <button 
                    className="gear-nav-button gear-nav-left"
                    onClick={() => goToPreviousImage(item.id)}
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button 
                    className="gear-nav-button gear-nav-right"
                    onClick={() => goToNextImage(item.id)}
                    aria-label="Next image"
                  >
                    ›
                  </button>
                  <div className="gear-image-indicators">
                    {item.images.map((_, index) => (
                      <button
                        key={index}
                        className={`gear-indicator ${(currentImageIndex[item.id] || 0) === index ? 'active' : ''}`}
                        onClick={() => setCurrentImageIndex(prev => ({
                          ...prev,
                          [item.id]: index
                        }))}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="gear-content">
              <h3 className="gear-title">{item.title}</h3>
              <p className="gear-description">{(item.images && item.images.length > 1) ? (item.description || '').replace(/image coming soon\.?/ig, '').trim() : item.description}</p>
              <div className="gear-price">${item.price}</div>
              {/* Ordering options - based on gear item flags */}
              {(() => {
                const hasGender = item.hasGender || false;
                const hasSize = item.hasSize || false;
                
                // If neither flag is set, show no options
                if (!hasGender && !hasSize) {
                  return null;
                }
                
                // Build options based on flags
                const options = [];
                
                if (hasGender) {
                  options.push(
                    <div key="fit" className="form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Fit</label>
                      <select
                        value={(orderSelections[item.id]?.fit) || 'mens'}
                        onChange={(e) => {
                          const fit = e.target.value;
                          setOrderSelections(prev => {
                            const prevItem = prev[item.id] || {};
                            // When gender changes, reset size to first available for that gender
                            const genderPrefix = fit === 'womens' ? 'w-' : 'm-';
                            const availableSizes = Array.isArray(item.availableSizes) ? item.availableSizes : [];
                            const genderSizes = availableSizes
                              .filter(size => size && size.startsWith(genderPrefix))
                              .map(size => size.replace(genderPrefix, ''))
                              .filter(size => ['xs', 's', 'm', 'l', 'xl', '2xl'].includes(size));
                            const defaultSize = genderSizes.length > 0 ? genderSizes[0] : 'm';
                            return { ...prev, [item.id]: { ...prevItem, fit, size: defaultSize } };
                          });
                        }}
                        aria-label="Select fit"
                      >
                        <option value="mens">Men's</option>
                        <option value="womens">Women's</option>
                      </select>
                    </div>
                  );
                }
                
                if (hasSize) {
                  // Get available sizes based on selected gender and item's availableSizes
                  const selectedFit = (orderSelections[item.id]?.fit) || 'mens';
                  const availableSizes = Array.isArray(item.availableSizes) ? item.availableSizes : [];
                  
                  let sizeOptions = [];
                  if (hasGender) {
                    // Filter sizes for the selected gender (w- or m- prefix)
                    const genderPrefix = selectedFit === 'womens' ? 'w-' : 'm-';
                    const genderSizes = availableSizes
                      .filter(size => size && size.startsWith(genderPrefix))
                      .map(size => size.replace(genderPrefix, ''))
                      .filter(size => ['xs', 's', 'm', 'l', 'xl', '2xl'].includes(size));
                    
                    sizeOptions = genderSizes.length > 0 ? genderSizes : ['xs', 's', 'm', 'l', 'xl', '2xl']; // Fallback if no sizes specified
                  } else {
                    // Unisex sizes (no prefix)
                    const unisexSizes = availableSizes
                      .filter(size => size && !size.includes('-'))
                      .filter(size => ['xs', 's', 'm', 'l', 'xl', '2xl'].includes(size));
                    
                    sizeOptions = unisexSizes.length > 0 ? unisexSizes : ['xs', 's', 'm', 'l', 'xl', '2xl']; // Fallback if no sizes specified
                  }
                  
                  // Get current size or default to first available
                  const currentSize = orderSelections[item.id]?.size;
                  const defaultSize = sizeOptions.includes(currentSize) ? currentSize : (sizeOptions[0] || 'm');
                  
                  options.push(
                    <div key="size" className="form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Size</label>
                      <select
                        value={defaultSize}
                        onChange={(e) => setOrderSelections(prev => ({ ...prev, [item.id]: { ...(prev[item.id]||{}), size: e.target.value } }))}
                        aria-label="Select size"
                      >
                        {sizeOptions.map(size => (
                          <option key={size} value={size}>{size.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                
                if (options.length === 0) {
                  return null;
                }
                
                return (
                  <div className="gear-order-options" style={{ display: 'grid', gridTemplateColumns: options.length === 2 ? '1fr 1fr' : '1fr', gap: '8px', margin: '8px 0 12px' }}>
                    {options}
                  </div>
                );
              })()}
              <div className="gear-buttons">
                {currentUser && ['member', 'coach', 'exec', 'administrator'].includes(currentUser.role) ? (
                  <button className="gear-button" onClick={() => handleOrderClick(item)}>
                    Order Now
                  </button>
                ) : currentUser ? (
                  <div className="gear-button-disabled" style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#f3f4f6', 
                    color: '#6b7280', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '4px',
                    cursor: 'not-allowed',
                    fontSize: '14px'
                  }}>
                    Member required to order
                  </div>
                ) : (
                  <div className="gear-button-disabled" style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#f3f4f6', 
                    color: '#6b7280', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '4px',
                    cursor: 'not-allowed',
                    fontSize: '14px'
                  }}>
                    Login to order
                  </div>
                )}
                {isAdmin && isAdmin(currentUser) && (
                  <button className="gear-edit-button" onClick={() => openEditModal(item)}>
                    ✎ Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {isAdmin && isAdmin(currentUser) && (
        <div className="gear-add-section">
          <button 
            className="gear-add-button" 
            onClick={() => setShowAddModal(true)}
          >
            + Add New Merchandise
          </button>
        </div>
      )}
      
    

      {lightboxItem && (
        <div className="gear-lightbox-overlay" onClick={closeLightbox}>
          <div className="gear-lightbox" onClick={(e) => e.stopPropagation()}>
            <button className="gear-lightbox-close" onClick={closeLightbox} aria-label="Close">×</button>
            <button className="gear-lightbox-nav gear-lightbox-left" onClick={lightboxPrev} aria-label="Previous">‹</button>
            <img
              className="gear-lightbox-image"
              src={normalizeImageUrl(lightboxItem.images[lightboxIndex])}
              alt={lightboxItem.title}
              onError={(e) => { e.target.src = '/images/placeholder-gear.svg'; }}
            />
            <button className="gear-lightbox-nav gear-lightbox-right" onClick={lightboxNext} aria-label="Next">›</button>
            {Array.isArray(lightboxItem.images) && lightboxItem.images.length > 1 && (
              <div className="gear-lightbox-indicators">
                {lightboxItem.images.map((_, idx) => (
                  <button
                    key={idx}
                    className={`gear-indicator ${lightboxIndex === idx ? 'active' : ''}`}
                    onClick={() => setLightboxIndex(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editingItem && (
        <div className="gear-modal-overlay" onClick={closeEditModal}>
          <div className="gear-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Gear: {editingItem.title}</h2>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Price</label>
              <input
                type="text"
                value={editForm.price}
                onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                rows="5"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
              <label style={{ fontWeight: 600, marginBottom: '4px' }}>Options</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={editForm.hasGender}
                  onChange={(e) => setEditForm({ ...editForm, hasGender: e.target.checked })}
                />
                <span>Has Men's/Women's fit options</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={editForm.hasSize}
                  onChange={(e) => setEditForm({ ...editForm, hasSize: e.target.checked, availableSizes: e.target.checked ? editForm.availableSizes : [] })}
                />
                <span>Has size options</span>
              </label>
              {editForm.hasSize && (
                <div style={{ marginTop: '8px' }}>
                  {editForm.hasGender ? (
                    // Show 10 boxes: 5 women's, then 5 men's
                    <div>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', display: 'block' }}>Women's Sizes:</label>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          {['xs', 's', 'm', 'l', 'xl'].map(size => (
                            <div key={`w-${size}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="checkbox"
                                checked={editForm.availableSizes.includes(`w-${size}`)}
                                onChange={(e) => {
                                  const newSizes = e.target.checked
                                    ? [...editForm.availableSizes, `w-${size}`]
                                    : editForm.availableSizes.filter(s => s !== `w-${size}`);
                                  setEditForm({ ...editForm, availableSizes: newSizes });
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '12px', textTransform: 'uppercase' }}>W-{size}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', display: 'block' }}>Men's Sizes:</label>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          {['xs', 's', 'm', 'l', 'xl'].map(size => (
                            <div key={`m-${size}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="checkbox"
                                checked={editForm.availableSizes.includes(`m-${size}`)}
                                onChange={(e) => {
                                  const newSizes = e.target.checked
                                    ? [...editForm.availableSizes, `m-${size}`]
                                    : editForm.availableSizes.filter(s => s !== `m-${size}`);
                                  setEditForm({ ...editForm, availableSizes: newSizes });
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '12px', textTransform: 'uppercase' }}>M-{size}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Show 5 unisex boxes when no gender
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {['xs', 's', 'm', 'l', 'xl'].map(size => (
                        <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="checkbox"
                            checked={editForm.availableSizes.includes(size)}
                            onChange={(e) => {
                              const newSizes = e.target.checked
                                ? [...editForm.availableSizes, size]
                                : editForm.availableSizes.filter(s => s !== size);
                              setEditForm({ ...editForm, availableSizes: newSizes });
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '12px', textTransform: 'uppercase' }}>{size}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Current Images</label>
              {currentImages.length > 0 ? (
                <div className="gear-current-images">
                  {currentImages.map((imageUrl, index) => (
                    <div key={index} className="gear-image-item">
                      <img 
                        src={normalizeImageUrl(imageUrl)} 
                        alt={`${index + 1}`}
                        className="gear-image-preview"
                        onError={(e) => { e.target.src = '/images/placeholder-gear.svg'; }}
                      />
                      <div className="gear-image-controls">
                        <button 
                          type="button" 
                          onClick={() => moveImageUp(index)}
                          disabled={index === 0}
                          className="gear-move-btn"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button 
                          type="button" 
                          onClick={() => moveImageDown(index)}
                          disabled={index === currentImages.length - 1}
                          className="gear-move-btn"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button 
                          type="button" 
                          onClick={() => removeImage(imageUrl)}
                          className="gear-remove-btn"
                          title="Remove image"
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="gear-no-images">No images</p>
              )}
            </div>
            <div className="form-group">
              <label>Add New Photos</label>
              <input type="file" accept="image/*" multiple onChange={handleFilesChange} />
              {newImages.length > 0 && (
                <div className="gear-new-images">
                  {newImages.map((f, idx) => (
                    <div className="gear-new-image" key={idx}>{f.name}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="gear-modal-actions">
              <button className="cancel-button" onClick={closeEditModal} disabled={saving}>Cancel</button>
              <button 
                className="delete-button" 
                onClick={() => deleteGearItem(editingItem.id)}
                disabled={saving}
                style={{ backgroundColor: '#ef4444', marginRight: 'auto' }}
              >
                Delete Item
              </button>
              <button className="save-button" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add new gear modal */}
      {showAddModal && (
        <div className="gear-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="gear-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gear-modal-header">
              <h2>Add New Merchandise</h2>
              <button type="button" className="gear-modal-close" onClick={() => setShowAddModal(false)} aria-label="Close">×</button>
            </div>
            <div className="gear-modal-body">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  placeholder="Enter merchandise title"
                />
              </div>
              <div className="form-group">
                <label>Price</label>
                <input
                  type="text"
                  value={addForm.price}
                  onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                  placeholder="Enter price (e.g., $25 or X)"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows="3"
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="Enter description"
                />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                <label style={{ fontWeight: 600, marginBottom: '4px' }}>Options</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={addForm.hasGender}
                    onChange={(e) => setAddForm({ ...addForm, hasGender: e.target.checked })}
                  />
                  <span>Has Men's/Women's fit options</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={addForm.hasSize}
                    onChange={(e) => setAddForm({ ...addForm, hasSize: e.target.checked, availableSizes: e.target.checked ? addForm.availableSizes : [] })}
                  />
                  <span>Has size options</span>
                </label>
                {addForm.hasSize && (
                  <div style={{ marginTop: '8px' }}>
                    {addForm.hasGender ? (
                      // Show 10 boxes: 5 women's, then 5 men's
                      <div>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', display: 'block' }}>Women's Sizes:</label>
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            {['xs', 's', 'm', 'l', 'xl'].map(size => (
                              <div key={`w-${size}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="checkbox"
                                  checked={addForm.availableSizes.includes(`w-${size}`)}
                                  onChange={(e) => {
                                    const newSizes = e.target.checked
                                      ? [...addForm.availableSizes, `w-${size}`]
                                      : addForm.availableSizes.filter(s => s !== `w-${size}`);
                                    setAddForm({ ...addForm, availableSizes: newSizes });
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '12px', textTransform: 'uppercase' }}>W-{size}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', display: 'block' }}>Men's Sizes:</label>
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            {['xs', 's', 'm', 'l', 'xl'].map(size => (
                              <div key={`m-${size}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="checkbox"
                                  checked={addForm.availableSizes.includes(`m-${size}`)}
                                  onChange={(e) => {
                                    const newSizes = e.target.checked
                                      ? [...addForm.availableSizes, `m-${size}`]
                                      : addForm.availableSizes.filter(s => s !== `m-${size}`);
                                    setAddForm({ ...addForm, availableSizes: newSizes });
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '12px', textTransform: 'uppercase' }}>M-{size}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Show 5 unisex boxes when no gender
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {['xs', 's', 'm', 'l', 'xl'].map(size => (
                          <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="checkbox"
                              checked={addForm.availableSizes.includes(size)}
                              onChange={(e) => {
                                const newSizes = e.target.checked
                                  ? [...addForm.availableSizes, size]
                                  : addForm.availableSizes.filter(s => s !== size);
                                setAddForm({ ...addForm, availableSizes: newSizes });
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '12px', textTransform: 'uppercase' }}>{size}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="gear-modal-actions">
              <button className="cancel-button" onClick={() => setShowAddModal(false)} disabled={adding}>Cancel</button>
              <button className="save-button" onClick={addGearItem} disabled={adding}>{adding ? 'Adding...' : 'Add Item'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Order confirmation modal */}
      {showOrderModal && selectedItem && (
        <div className="gear-modal-overlay" onClick={closeOrderModal}>
          <div className="gear-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gear-modal-header order-modal-header">
              <button type="button" className="gear-modal-close order-modal-close" onClick={closeOrderModal} aria-label="Close">×</button>
              <h2>Confirm Order</h2>
            </div>
            <div className="gear-modal-body">
              <div className="order-confirmation">
                <h3>Order Details</h3>
                <div className="order-item">
                  <strong>Item:</strong> {selectedItem.title}
                </div>
                {selectedItem.hasSize && (
                  <div className={`order-item ${orderSelections[selectedItem.id]?.size ? 'size-highlighted' : ''}`}>
                    <strong>Size:</strong> {orderSelections[selectedItem.id]?.size ? (
                      <span style={{ color: '#059669', fontWeight: '600' }}>
                        {orderSelections[selectedItem.id].size.toUpperCase()}
                      </span>
                    ) : (
                      <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Not specified</span>
                    )}
                  </div>
                )}
                <div className="order-item">
                  <strong>Quantity:</strong> 1
                </div>
                <div className="order-item">
                  <strong>Price:</strong> {selectedItem.price || 'Contact for pricing'}
                </div>
                <div className="order-item" style={{ marginTop: '10px' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Email</label>
                  <input
                    type="email"
                    value={orderEmail}
                    onChange={(e) => setOrderEmail(e.target.value)}
                    placeholder={currentUser?.email || 'Enter your email'}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="order-item" style={{ marginTop: '8px' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Confirm Email</label>
                  <input
                    type="email"
                    value={orderEmailConfirm}
                    onChange={(e) => setOrderEmailConfirm(e.target.value)}
                    placeholder="Retype your email"
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                {orderError && (
                  <div style={{ color: '#b91c1c', marginTop: 6 }}>{orderError}</div>
                )}
                <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: 8 }}>
                  Note: Use your University of Toronto email, or the same email you used to purchase your gym membership.
                </p>
                <div className="order-notice">
                  <p><strong>Important:</strong> You'll receive an invoice email once all orders have been submitted.</p>
                  <p>Please check your email for payment instructions and order details.</p>
                </div>
              </div>
            </div>
            <div className="gear-modal-actions">
              <button className="cancel-button" onClick={closeOrderModal} disabled={orderSubmitting}>
                Cancel
              </button>
              <button 
                className="save-button" 
                onClick={submitOrder} 
                disabled={orderSubmitting}
                style={{ backgroundColor: '#10b981' }}
              >
                {orderSubmitting ? 'Submitting...' : 'Confirm Order'}
              </button>
            </div>
        </div>
      </div>
    )}

    {/* Success Modal */}
    {showSuccessModal && orderSuccessData && (
      <div className="gear-modal-overlay" onClick={closeSuccessModal}>
        <div className="gear-modal success-modal" onClick={(e) => e.stopPropagation()}>
          <div className="gear-modal-header success-header">
            <div className="success-header-title">
              <span className="success-icon" aria-hidden="true">🎉</span>
              <h2>Order Confirmed!</h2>
            </div>
            <button type="button" className="gear-modal-close" onClick={closeSuccessModal} aria-label="Close">×</button>
          </div>
          <div className="gear-modal-body success-body">
            <div className="success-message">
              <p className="success-main-text">
                Thank you for your order! We've received your request and will process it shortly.
              </p>
              
              <div className="order-recap">
                <h3>📋 Order Summary</h3>
                <div className="recap-item">
                  <strong>Item:</strong>
                  <span className="recap-value">{orderSuccessData.item.title}</span>
                </div>
                {orderSuccessData.size && (
                  <div className="recap-item">
                    <strong>Size:</strong>
                    <span className="recap-value">{orderSuccessData.size.toUpperCase()}</span>
                  </div>
                )}
                {orderSuccessData.fit && (
                  <div className="recap-item">
                    <strong>Fit:</strong>
                    <span className="recap-value">{orderSuccessData.fit === 'mens' ? "Men's" : "Women's"}</span>
                  </div>
                )}
                <div className="recap-item">
                  <strong>Email:</strong>
                  <span className="recap-value">{orderSuccessData.email}</span>
                </div>
                <div className="recap-item">
                  <strong>Price:</strong>
                  <span className="recap-value">{orderSuccessData.item.price || 'Contact for pricing'}</span>
                </div>
              </div>

              <div className="next-steps">
                <h3>📧 What's Next?</h3>
                <p>
                  You'll receive an invoice email once all orders have been submitted. 
                  Please check your email for payment instructions and order details.
                </p>
              </div>

              <div className="help-section">
                <h3>❓ Need Help?</h3>
                <p>
                  Made a mistake? Have questions? Email us at{' '}
                  <a href="mailto:info@uoft-tri.club" style={{ color: '#10b981', fontWeight: '600' }}>
                    info@uoft-tri.club
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="gear-modal-actions">
            <button 
              className="save-button" 
              onClick={closeSuccessModal}
              style={{ backgroundColor: '#10b981', width: '100%' }}
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    )}

    <ConfirmModal
      isOpen={deleteGearConfirm.isOpen}
      onConfirm={confirmDeleteGearItem}
      onCancel={() => setDeleteGearConfirm({ isOpen: false, itemId: null })}
      title="Delete Gear Item"
      message="Are you sure you want to delete this gear item? This action cannot be undone."
      confirmText="Delete"
      cancelText="Cancel"
      confirmDanger={true}
    />
  </div>
);
};

export default TeamGear;


