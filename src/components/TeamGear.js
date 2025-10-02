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

  const normalizeImageUrl = (url) => {
    if (!url) return '/images/placeholder-gear.svg';
    if (url.startsWith('/uploads/')) return `${API_BASE}/..${url}`;
    if (url.startsWith('/api/')) return `${API_BASE.replace('/api','')}${url}`;
    return url;
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

  // Edit handlers
  const openEditModal = (item) => {
    setEditingItem(item);
    setEditForm({
      title: item.title || '',
      price: item.price || '',
      description: item.description || ''
    });
    setNewImages([]);
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setNewImages([]);
    setSaving(false);
  };

  const handleFilesChange = (e) => {
    setNewImages(Array.from(e.target.files || []));
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      setSaving(true);
      const token = localStorage.getItem('triathlonToken');

      // Update fields
      const putRes = await fetch(`${API_BASE}/gear/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editForm.title,
          price: editForm.price,
          description: editForm.description
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
      }

      // Refetch list
      const res = await fetch(`${API_BASE}/gear`);
      const data = await res.json();
      setGearItems((data.items || []).map(item => ({
        ...item,
        images: Array.isArray(item.images) && item.images.length > 0 ? item.images : ['/images/placeholder-gear.svg']
      })));

      closeEditModal();
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container teamgear-page">
      <h1>Team Gear</h1>
      <p className="page-description">
        Show your UofT Tri Club pride with our official team gear! This page is under construction, please check back soon for more information.
      </p>
      <p>
      The clothing pieces are from Champion Systems. The main reference for triathlon is here
      https://www.champ-sys.ca/pages/triathlon, but you may look at cycling and running items
      </p>
      
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
              <p className="gear-description">{item.description}</p>
              <div className="gear-price">${item.price}</div>
              <button className="gear-button">
                Order Now
              </button>
              {isAdmin && isAdmin(currentUser) && (
                <button className="gear-edit-button" onClick={() => openEditModal(item)}>
                  ✎ Edit
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="gear-info">
        <h2>Ordering Information</h2>
        <p>
          To place an order for team gear, please contact us at{' '}
          <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>:
        </p>
      </div>

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
              <label>Add Photos</label>
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
              <button className="save-button" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamGear;


