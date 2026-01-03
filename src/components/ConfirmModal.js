import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmModal.css';

const ConfirmModal = ({ isOpen, onConfirm, onCancel, title, message, confirmText = 'Confirm', cancelText = 'Cancel', confirmDanger = false }) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      
      // Lock body scroll - use a simpler approach that doesn't interfere with modal positioning
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;
      
      // Prevent scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.left = '0';
      document.body.style.right = '0';
      
      return () => {
        // Restore original styles
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        document.body.style.left = '';
        document.body.style.right = '';
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Render modal directly to document.body using Portal to avoid parent container constraints
  const modalContent = (
    <div 
      className="confirm-modal-overlay" 
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        minWidth: '100vw',
        minHeight: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        padding: '1rem',
        boxSizing: 'border-box',
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}
    >
      <div 
        className="confirm-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          margin: 'auto',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto'
        }}
      >
        {title && <h2 className="confirm-modal-title">{title}</h2>}
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button 
            className="confirm-modal-button confirm-modal-button-cancel" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`confirm-modal-button ${confirmDanger ? 'confirm-modal-button-danger' : 'confirm-modal-button-confirm'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ConfirmModal;


