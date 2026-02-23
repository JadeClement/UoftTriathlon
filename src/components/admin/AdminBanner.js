import React from 'react';
import { useAdminContext } from '../../context/AdminContext';

const AdminBanner = () => {
  const {
    bannerForm,
    setBannerForm,
    handleSaveBanner,
    getBannerDisplayLength,
    popupPreview,
    handleSavePopup,
    handleRemovePopup,
  } = useAdminContext();

  return (
    <div className="admin-main-content" style={{ padding: '2rem' }}>
      <div className="email-section">
        <h2>Site Banner & Pop Ups</h2>
        <p>Configure the rotating site banner and an optional login pop-up message.</p>

        {/* Banner Section */}
        <div className="banner-section" style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Site Banner</h3>
          <form>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={!!bannerForm.enabled}
                  onChange={(e) => setBannerForm({ ...bannerForm, enabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">{bannerForm.enabled ? 'On' : 'Off'}</span>
            </div>
            <div className="form-group">
              <label>Rotation Interval (ms)</label>
              <input
                type="number"
                value={bannerForm.rotationIntervalMs}
                min={1000}
                step={500}
                onChange={(e) => setBannerForm({ ...bannerForm, rotationIntervalMs: Number(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>Banner Messages (max 10)</label>
              {(bannerForm.items || []).map((msg, idx) => {
                const length = getBannerDisplayLength(msg || '');
                const overLimit = length > 50;
                return (
                  <div key={idx} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={msg}
                        onChange={(e) => {
                          const next = [...(bannerForm.items || [])];
                          next[idx] = e.target.value;
                          setBannerForm({ ...bannerForm, items: next });
                        }}
                        placeholder={`Message #${idx + 1}`}
                      />
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          const next = (bannerForm.items || []).filter((_, i) => i !== idx);
                          setBannerForm({ ...bannerForm, items: next.length ? next : [''] });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <div style={{ fontSize: '12px', color: overLimit ? '#b91c1c' : '#6b7280', textAlign: 'left', marginTop: 2 }}>
                      {length}/50 characters
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'left', marginTop: 4, fontStyle: 'italic' }}>
                      Link format: [text](url). No spaces between brackets.
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const next = [...(bannerForm.items || [])];
                  if (next.length < 10) next.push('');
                  setBannerForm({ ...bannerForm, items: next });
                }}
              >
                + Add Banner
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" onClick={handleSaveBanner} className="btn btn-primary">
                Save Banner
              </button>
            </div>
          </form>
        </div>

        {/* Popup Section */}
        <div className="popup-section">
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Pop Up Modal</h3>
          <p style={{ marginBottom: '16px', color: '#6b7280' }}>
            Show a pop up in the middle of the screen when users log in. Each user will only see it once per pop up.
          </p>
          <form>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={!!bannerForm.popupEnabled}
                  onChange={(e) => setBannerForm({ ...bannerForm, popupEnabled: e.target.checked })}
                />
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
                onChange={(e) => setBannerForm({ ...bannerForm, popupDraft: e.target.value })}
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
                  <div className="popup-preview-message">{popupPreview.message}</div>
                  <button type="button" className="btn popup-remove-btn" onClick={() => handleRemovePopup()}>
                    Remove
                  </button>
                </div>
              ) : (
                <div className="popup-preview-card muted">
                  <div className="popup-preview-message">No pop up is currently active.</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" onClick={handleSavePopup} className="btn btn-primary">
                Save Pop Up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminBanner;
