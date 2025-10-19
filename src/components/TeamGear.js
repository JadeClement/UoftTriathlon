import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './TeamGear.css';

const TeamGear = () => {
  const { currentUser, isAdmin } = useAuth();
  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
  const [gearItems, setGearItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State to track current image index for each gear item
  const [currentImageIndex, setCurrentImageIndex] = useState({});

  // Admin edit modal state
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', price: '', description: '' });
  const [newImages, setNewImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [currentImages, setCurrentImages] = useState([]);
  // Simple per-item selection for ordering options
  const [orderSelections, setOrderSelections] = useState({}); // { [itemId]: { fit: 'mens'|'womens', size: 'xs'|'s'|'m'|'l'|'xl'|'2xl' } }

  // Admin add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', price: '', description: '' });
  const [adding, setAdding] = useState(false);

  // Lightbox (enlarge) state
  const [lightboxItem, setLightboxItem] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Order confirmation modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
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
      console.log('🖼️ [NORMALIZE] No URL provided, using placeholder');
      return '/images/placeholder-gear.svg';
    }
    
    console.log('🖼️ [NORMALIZE] Processing URL:', url);
    
    if (url.startsWith('/uploads/')) {
      const normalized = `${API_BASE}/..${url}`;
      console.log('🖼️ [NORMALIZE] Uploads URL ->', normalized);
      return normalized;
    }
    if (url.startsWith('/api/')) {
      const normalized = `${API_BASE.replace('/api','')}${url}`;
      console.log('🖼️ [NORMALIZE] API URL ->', normalized);
      return normalized;
    }
    if (url.startsWith('http')) {
      console.log('🖼️ [NORMALIZE] Full URL ->', url);
      return url;
    }
    
    console.log('🖼️ [NORMALIZE] Fallback to placeholder for:', url);
    return '/images/placeholder-gear.svg';
  };

  // Fetch gear items from backend
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/gear`);
        if (!res.ok) throw new Error('Failed to load gear');
        const data = await res.json();
        const items = (data.items || []).map(item => ({
          ...item,
          images: Array.isArray(item.images) && item.images.length > 0 ? item.images : ['/images/placeholder-gear.svg']
        }));
        setGearItems(items);
      } catch (e) {
        setError('Failed to load team gear');
        console.error(e);
      } finally {
        setLoading(false);
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
    console.log('📝 [GEAR EDIT] Opening modal for item:', item);
    setEditingItem(item);
    setEditForm({
      title: item.title || '',
      price: item.price || '',
      description: item.description || ''
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
    console.log('📁 [GEAR FILES] Selected files:', files.map(f => ({name: f.name, size: f.size, type: f.type})));
    setNewImages(files);
  };

  // Image management functions
  const removeImage = async (imageUrl) => {
    if (!editingItem) return;
    
    // Don't try to delete placeholder images
    if (imageUrl.includes('placeholder-gear.svg') || imageUrl.includes('/images/')) {
      console.log('🗑️ [FRONTEND] Skipping placeholder image deletion:', imageUrl);
      setCurrentImages(prev => prev.filter(img => img !== imageUrl));
      return;
    }
    
    try {
      console.log('🗑️ [FRONTEND] Attempting to remove image:', imageUrl);
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
        console.error('❌ [FRONTEND] Delete image failed:', res.status, errorData);
        throw new Error(errorData.error || `Failed to remove image (${res.status})`);
      }
      
      const result = await res.json();
      console.log('✅ [FRONTEND] Image removed successfully:', result);
      
      // Update local state
      setCurrentImages(prev => prev.filter(img => img !== imageUrl));
    } catch (e) {
      console.error('❌ [FRONTEND] Error removing image:', e);
      alert(`Failed to remove image: ${e.message}`);
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
      alert('Please enter a title');
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
      setAddForm({ title: '', price: '', description: '' });
    } catch (e) {
      console.error('Error adding gear item:', e);
      alert('Failed to add gear item');
    } finally {
      setAdding(false);
    }
  };

  // Delete gear item
  const deleteGearItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this gear item? This action cannot be undone.')) {
      return;
    }
    
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
    } catch (e) {
      console.error('Error deleting gear item:', e);
      alert('Failed to delete gear item');
    }
  };

  const saveEdit = async () => {
    console.log('🚀 [GEAR SAVE] Function called, editingItem:', editingItem);
    if (!editingItem) return;
    try {
      setSaving(true);
      const token = localStorage.getItem('triathlonToken');
      console.log('🔑 [GEAR SAVE] Token exists:', !!token);

      // Update fields including reordered images
      console.log('📤 [GEAR SAVE] PUT details', editForm);
      console.log('📤 [GEAR SAVE] Current images order:', currentImages);
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
          images: currentImages
        })
      });
      if (!putRes.ok) throw new Error('Failed to save gear details');

      // Upload new images if any
      if (newImages.length > 0) {
        const formData = new FormData();
        newImages.forEach(f => formData.append('images', f));
        console.log('📤 [GEAR SAVE] POST images', newImages.map(f=>({name:f.name,size:f.size,type:f.type})));
        const imgRes = await fetch(`${API_BASE}/gear/${editingItem.id}/images`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        if (!imgRes.ok) throw new Error('Failed to upload images');
        const imgJson = await imgRes.json().catch(()=>null);
        console.log('✅ [GEAR SAVE] Images response:', imgJson);
        
        // Update currentImages with the new images from server
        if (imgJson && imgJson.images) {
          setCurrentImages(imgJson.images);
          console.log('🔄 [GEAR SAVE] Updated currentImages with server response:', imgJson.images);
        }
      }

      // Refetch list
      console.log('🔄 [GEAR SAVE] Refetch gear list');
      const res = await fetch(`${API_BASE}/gear`);
      const data = await res.json();
      const updatedItems = (data.items || []).map(item => ({
        ...item,
        images: Array.isArray(item.images) && item.images.length > 0 ? item.images : ['/images/placeholder-gear.svg']
      }));
      setGearItems(updatedItems);
      console.log('✅ [GEAR SAVE] Updated gear items:', updatedItems);

      closeEditModal();
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Order confirmation handlers
  const handleOrderClick = (item) => {
    // Check if user is logged in and has member role
    if (!currentUser) {
      alert('Please log in to place an order.');
      return;
    }
    
    if (!['member', 'coach', 'exec', 'administrator'].includes(currentUser.role)) {
      alert('You need to be a member to place orders. Please contact an administrator to upgrade your account.');
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
      const orderData = {
        firstName: currentUser.first_name || currentUser.name?.split(' ')[0] || '',
        lastName: currentUser.last_name || currentUser.name?.split(' ').slice(1).join(' ') || '',
        email: emailToUse,
        item: selectedItem.title,
        size: orderSelections[selectedItem.id]?.size || '',
        quantity: 1
      };

      console.log('🔍 About to make API call to:', `${API_BASE}/merch-orders`);
      console.log('🔍 Token exists:', !!token);
      console.log('🔍 Order data:', orderData);
      console.log('🔍 Current user:', currentUser);
      
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

      if (!response.ok) {
        // Handle specific HTTP status codes
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('Access denied. You need to be a member to place orders.');
        } else if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Invalid order data. Please check your information.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Failed to submit order (${response.status})`);
        }
      }

      const result = await response.json();
      
      // Show success modal with order details
      setOrderSuccessData({
        item: selectedItem,
        email: emailToUse,
        size: orderSelections[selectedItem.id]?.size,
        fit: orderSelections[selectedItem.id]?.fit
      });
      setShowSuccessModal(true);
      closeOrderModal();
      document.body.style.overflow = 'hidden';
    } catch (error) {
      console.error('Order submission error:', error);
      
      // Provide more specific error messages based on the error type
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_INTERNET_DISCONNECTED')) {
        setOrderError('Unable to connect to the server. Please check your internet connection and try again.');
      } else if (error.message.includes('Failed to submit order')) {
        setOrderError('Server error occurred. Please try again later.');
      } else {
        setOrderError('Failed to submit order. Please try again.');
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
      <h3>Triathlon Specific Gear</h3>
      <p>
      The tri suits, bike kits and running singletsre from Champion Systems. The main reference for triathlon is here
      https://www.champ-sys.ca/pages/triathlon, but you may look at cycling and running items. 

      
      </p>
      
      <h3 style={{ marginTop: '2rem' }}>Under Armour Gear</h3>
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
              {/* Ordering options */}
              {(() => {
                const isClothingItem = item.title.toLowerCase().includes('suit') || 
                                     item.title.toLowerCase().includes('jersey') || 
                                     item.title.toLowerCase().includes('shorts');
                const isUnisexItem = item.title.toLowerCase().includes('backpack') || 
                                   item.title.toLowerCase().includes('cap');
                
                if (isUnisexItem) {
                  // No ordering options for unisex items (backpack, cap) - they're one-size
                  return null;
                } else if (isClothingItem) {
                  // Show both fit and size for clothing items
                  return (
                    <div className="gear-order-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '8px 0 12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Fit</label>
                        <select
                          value={(orderSelections[item.id]?.fit) || 'mens'}
                          onChange={(e) => setOrderSelections(prev => {
                            const fit = e.target.value;
                            const prevItem = prev[item.id] || {};
                            const adjustedSize = (fit === 'mens' && prevItem.size === 'xs') ? 's' : (prevItem.size || 'm');
                            return { ...prev, [item.id]: { ...prevItem, fit, size: adjustedSize } };
                          })}
                          aria-label="Select fit"
                        >
                          <option value="mens">Men's</option>
                          <option value="womens">Women's</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Size</label>
                        <select
                          value={(orderSelections[item.id]?.size) || 'm'}
                          onChange={(e) => setOrderSelections(prev => ({ ...prev, [item.id]: { ...(prev[item.id]||{}), size: e.target.value } }))}
                          aria-label="Select size"
                        >
                          {((orderSelections[item.id]?.fit) || 'mens') !== 'mens' && (<option value="xs">XS</option>)}
                          <option value="s">S</option>
                          <option value="m">M</option>
                          <option value="l">L</option>
                          <option value="xl">XL</option>
                          <option value="2xl">2XL</option>
                        </select>
                      </div>
                    </div>
                  );
                } else {
                  // Default: show both options for other items
                  return (
                    <div className="gear-order-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '8px 0 12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Fit</label>
                        <select
                          value={(orderSelections[item.id]?.fit) || 'mens'}
                          onChange={(e) => setOrderSelections(prev => {
                            const fit = e.target.value;
                            const prevItem = prev[item.id] || {};
                            const adjustedSize = (fit === 'mens' && prevItem.size === 'xs') ? 's' : (prevItem.size || 'm');
                            return { ...prev, [item.id]: { ...prevItem, fit, size: adjustedSize } };
                          })}
                          aria-label="Select fit"
                        >
                          <option value="mens">Men's</option>
                          <option value="womens">Women's</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Size</label>
                        <select
                          value={(orderSelections[item.id]?.size) || 'm'}
                          onChange={(e) => setOrderSelections(prev => ({ ...prev, [item.id]: { ...(prev[item.id]||{}), size: e.target.value } }))}
                          aria-label="Select size"
                        >
                          {((orderSelections[item.id]?.fit) || 'mens') !== 'mens' && (<option value="xs">XS</option>)}
                          <option value="s">S</option>
                          <option value="m">M</option>
                          <option value="l">L</option>
                          <option value="xl">XL</option>
                          <option value="2xl">2XL</option>
                        </select>
                      </div>
                    </div>
                  );
                }
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
            <div className="form-group">
              <label>Current Images</label>
              {currentImages.length > 0 ? (
                <div className="gear-current-images">
                  {currentImages.map((imageUrl, index) => (
                    <div key={index} className="gear-image-item">
                      <img 
                        src={normalizeImageUrl(imageUrl)} 
                        alt={`Image ${index + 1}`}
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
              <button className="gear-modal-close" onClick={() => setShowAddModal(false)}>×</button>
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
            <div className="gear-modal-header">
              <h2>Confirm Order</h2>
              <button className="gear-modal-close" onClick={closeOrderModal}>×</button>
            </div>
            <div className="gear-modal-body">
              <div className="order-confirmation">
                <h3>Order Details</h3>
                <div className="order-item">
                  <strong>Item:</strong> {selectedItem.title}
                </div>
                <div className={`order-item ${orderSelections[selectedItem.id]?.size ? 'size-highlighted' : ''}`}>
                  <strong>Size:</strong> {orderSelections[selectedItem.id]?.size ? (
                    <span style={{ color: '#059669', fontWeight: '600' }}>
                      {orderSelections[selectedItem.id].size.toUpperCase()}
                    </span>
                  ) : (
                    <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Not specified</span>
                  )}
                </div>
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
                  <p><strong>Important:</strong> You will receive an invoice email shortly after confirming your order.</p>
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
            <div className="success-icon">🎉</div>
            <h2>Order Confirmed!</h2>
            <button className="gear-modal-close" onClick={closeSuccessModal}>×</button>
          </div>
          <div className="gear-modal-body success-body">
            <div className="success-message">
              <p className="success-main-text">
                Thank you for your order! We've received your request and will process it shortly.
              </p>
              
              <div className="order-recap">
                <h3>📋 Order Summary</h3>
                <div className="recap-item">
                  <strong>Item:</strong> {orderSuccessData.item.title}
                </div>
                {orderSuccessData.size && (
                  <div className="recap-item">
                    <strong>Size:</strong> {orderSuccessData.size.toUpperCase()}
                  </div>
                )}
                {orderSuccessData.fit && (
                  <div className="recap-item">
                    <strong>Fit:</strong> {orderSuccessData.fit === 'mens' ? "Men's" : "Women's"}
                  </div>
                )}
                <div className="recap-item">
                  <strong>Email:</strong> {orderSuccessData.email}
                </div>
                <div className="recap-item">
                  <strong>Price:</strong> {orderSuccessData.item.price || 'Contact for pricing'}
                </div>
              </div>

              <div className="next-steps">
                <h3>📧 What's Next?</h3>
                <p>
                  You'll receive an invoice email once all orders have been submitted. 
                  Please check your email ({orderSuccessData.email}) for payment instructions and order details.
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

    <style jsx>{`
      /* Success Modal Styles */
      .success-modal {
        max-width: 500px;
      }

      .success-header {
        text-align: center;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border-radius: 8px 8px 0 0;
        padding: 20px;
        position: relative;
      }

      .success-icon {
        font-size: 3rem;
        margin-bottom: 10px;
      }

      .success-header h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
      }

      .success-body {
        padding: 24px;
      }

      .success-main-text {
        font-size: 1.1rem;
        color: #374151;
        margin-bottom: 24px;
        text-align: center;
        line-height: 1.6;
      }

      .order-recap, .next-steps, .help-section {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .order-recap h3, .next-steps h3, .help-section h3 {
        margin: 0 0 12px 0;
        font-size: 1rem;
        font-weight: 600;
        color: #374151;
      }

      .recap-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #e5e7eb;
      }

      .recap-item:last-child {
        border-bottom: none;
      }

      .recap-item strong {
        color: #374151;
        font-weight: 600;
      }

      .next-steps p, .help-section p {
        margin: 0;
        color: #6b7280;
        line-height: 1.5;
      }

      .help-section a {
        text-decoration: none;
        transition: color 0.2s ease;
      }

      .help-section a:hover {
        text-decoration: underline;
      }
    `}</style>
  </div>
);
};

export default TeamGear;


