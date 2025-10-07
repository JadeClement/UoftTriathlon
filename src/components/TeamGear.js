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
    setSelectedItem(item);
    setShowOrderModal(true);
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    setSelectedItem(null);
    setOrderEmail('');
    setOrderEmailConfirm('');
    setOrderError('');
  };

  const submitOrder = async () => {
    if (!selectedItem || !currentUser) return;
    // Validate email confirmation
    const emailToUse = (orderEmail || '').trim();
    const emailConfirmToUse = (orderEmailConfirm || '').trim();
    const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
    if (!emailRegex.test(emailToUse)) {
      setOrderError('Please enter a valid email address.');
      return;
    }
    if (emailToUse !== emailConfirmToUse) {
      setOrderError('Emails do not match.');
      return;
    }
    setOrderError('');

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

      const response = await fetch(`${API_BASE}/merch-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        throw new Error('Failed to submit order');
      }

      alert('Order submitted successfully! You will receive an invoice email shortly.');
      closeOrderModal();
    } catch (error) {
      console.error('Order submission error:', error);
      alert('Failed to submit order. Please try again.');
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <div className="page-container teamgear-page">
      <h1>Team Gear</h1>
      <p className="page-description">
        Show your UofT Tri Club pride with our official team gear! This page is under construction, please check back soon for more information.
      </p>
      <h3>Triathlon Specific Gear</h3>
      <p>
      The tri suits, bike kits and running singletsre from Champion Systems. The main reference for triathlon is here
      https://www.champ-sys.ca/pages/triathlon, but you may look at cycling and running items. 

      
      </p>
      
      <h3 style={{ marginTop: '2rem' }}>Under Armour Gear</h3>
      <p>Please order through website by October 19th. After this you will receive an invoice from the university.</p>
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
                          onChange={(e) => setOrderSelections(prev => ({ ...prev, [item.id]: { ...(prev[item.id]||{}), fit: e.target.value } }))}
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
                          <option value="xs">XS</option>
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
                          onChange={(e) => setOrderSelections(prev => ({ ...prev, [item.id]: { ...(prev[item.id]||{}), fit: e.target.value } }))}
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
                          <option value="xs">XS</option>
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
                <button className="gear-button" onClick={() => handleOrderClick(item)}>
                  Order Now
                </button>
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
      
      <div className="gear-info">
        <h2>Ordering Information</h2>
        <p>
          To place an order for team gear, please contact us at{' '}
          <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>:
        </p>
      </div>

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
    </div>
  );
};

export default TeamGear;


