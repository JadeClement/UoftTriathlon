import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';
import { showError, showSuccess } from './SimpleNotification';
import { getApiBaseUrl } from '../utils/apiConfig';
import { isTermExpiredError } from '../utils/apiError';
import './News.css';

const formatSentAt = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const News = () => {
  const { bulletinId } = useParams();
  const navigate = useNavigate();
  const { currentUser, isMember, isAdmin } = useAuth();
  const API_BASE_URL = getApiBaseUrl();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [bulletins, setBulletins] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [termExpired, setTermExpired] = useState(false);
  const [reader, setReader] = useState(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const removeConfirmOpen = useRef(false);
  removeConfirmOpen.current = showRemoveConfirm;

  const canRead = Boolean(currentUser && isMember(currentUser));
  const canRemove = Boolean(currentUser && isAdmin(currentUser));

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadBulletins = useCallback(async () => {
    if (!canRead) {
      setListLoading(false);
      return;
    }

    try {
      setListLoading(true);
      setListError('');
      setTermExpired(false);
      const token = localStorage.getItem('triathlonToken');
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      const query = params.toString();
      const response = await fetch(`${API_BASE_URL}/news${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (isTermExpiredError(data)) {
          setTermExpired(true);
          return;
        }
        throw new Error(data.error || 'Failed to load bulletins');
      }
      setBulletins(data.bulletins || []);
    } catch (error) {
      setListError(error.message || 'Failed to load bulletins');
    } finally {
      setListLoading(false);
    }
  }, [API_BASE_URL, canRead, search]);

  useEffect(() => {
    loadBulletins();
  }, [loadBulletins]);

  const closeReader = useCallback(() => {
    setReader(null);
    setReaderError('');
    setShowRemoveConfirm(false);
    if (bulletinId) {
      navigate('/news', { replace: true });
    }
  }, [bulletinId, navigate]);

  useEffect(() => {
    if (!canRead || !bulletinId) {
      setReader(null);
      setReaderLoading(false);
      setReaderError('');
      return undefined;
    }

    let cancelled = false;
    const loadOne = async () => {
      try {
        setReaderLoading(true);
        setReaderError('');
        setReader(null);
        const token = localStorage.getItem('triathlonToken');
        const response = await fetch(`${API_BASE_URL}/news/${encodeURIComponent(bulletinId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          if (isTermExpiredError(data)) {
            setTermExpired(true);
            return;
          }
          throw new Error(data.error || 'That bulletin is no longer available');
        }
        setReader(data.bulletin);
      } catch (error) {
        if (!cancelled) {
          setReaderError(error.message || 'That bulletin is no longer available');
        }
      } finally {
        if (!cancelled) setReaderLoading(false);
      }
    };

    loadOne();
    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, bulletinId, canRead]);

  useEffect(() => {
    if (!canRead || !bulletinId) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !removeConfirmOpen.current) {
        closeReader();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [bulletinId, canRead, closeReader]);

  const removeBulletin = async () => {
    if (!reader?.id) return;
    try {
      setRemoving(true);
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/news/${reader.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove bulletin');
      }
      setShowRemoveConfirm(false);
      showSuccess('Removed from News');
      closeReader();
      loadBulletins();
    } catch (error) {
      showError(error.message || 'Failed to remove bulletin');
    } finally {
      setRemoving(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="news-page">
        <div className="news-shell">
          <header className="news-header">
            <h1>News</h1>
          </header>
          <div className="news-notice">
            <p>
              Log in as a member to read club bulletins. <Link to="/login">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="news-page">
        <div className="news-shell">
          <header className="news-header">
            <h1>News</h1>
          </header>
          <div className="news-notice">
            <p>
              You don&apos;t have access to News yet. Go to your <Link to="/profile">Profile</Link> page
              and upload your membership payment receipt. An exec will review it and confirm your
              registration. After approval, log out and log back in.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const readerOpen = Boolean(bulletinId) && !termExpired;

  const readerModal = readerOpen
    ? createPortal(
        <div className="news-reader-overlay modal-overlay" onClick={closeReader}>
          <div
            className="news-reader"
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-reader-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="news-reader-header">
              <div className="news-reader-heading">
                {reader?.banner_title && reader.banner_title !== reader.title && (
                  <p className="news-reader-kicker">{reader.banner_title}</p>
                )}
                <h2 id="news-reader-title">{reader?.title || (readerLoading ? 'Loading…' : 'Bulletin')}</h2>
                {reader?.sent_at && <p className="news-reader-date">{formatSentAt(reader.sent_at)}</p>}
              </div>
              <button
                type="button"
                className="news-reader-close"
                onClick={closeReader}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="news-reader-body">
              {readerLoading && <p className="news-status">Loading bulletin…</p>}
              {readerError && !readerLoading && <p className="news-status news-status-error">{readerError}</p>}
              {reader?.html_body && (
                <div
                  className="news-reader-content"
                  dangerouslySetInnerHTML={{ __html: reader.html_body }}
                />
              )}
              {canRemove && reader && (
                <div className="news-reader-admin">
                  <button
                    type="button"
                    className="news-remove-btn"
                    onClick={() => setShowRemoveConfirm(true)}
                    disabled={removing}
                  >
                    Remove from News
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="news-page">
      <div className="news-shell">
        <header className="news-header">
          <h1>News</h1>
          <p>Club bulletins, newest first.</p>
        </header>

        {!termExpired && (
          <label className="news-search">
            <span className="visually-hidden">Search bulletins</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search titles and bulletin text"
              autoComplete="off"
            />
          </label>
        )}

        {listLoading && <p className="news-status">Loading bulletins…</p>}
        {termExpired && !listLoading && (
          <div className="news-notice">
            <p>Sorry, your term has expired. Please submit your registration receipt.</p>
            <Link to="/profile" className="news-profile-btn">Go to Profile</Link>
          </div>
        )}
        {listError && !listLoading && !termExpired && (
          <div className="news-status news-status-error">
            <p>{listError}</p>
            <button type="button" onClick={loadBulletins}>
              Try again
            </button>
          </div>
        )}

        {!listLoading && !listError && !termExpired && bulletins.length === 0 && (
          <p className="news-status">
            {search
              ? 'No bulletins match that search.'
              : 'No bulletins yet. When the exec sends a bulletin email, it will show up here.'}
          </p>
        )}

        {!listLoading && !listError && !termExpired && bulletins.length > 0 && (
          <ul className="news-list">
            {bulletins.map((bulletin) => (
              <li key={bulletin.id}>
                <button
                  type="button"
                  className={`news-item ${String(bulletin.id) === String(bulletinId) ? 'open' : ''}`}
                  onClick={() => navigate(`/news/${bulletin.id}`)}
                >
                  <span className="news-item-title">{bulletin.title}</span>
                  <span className="news-item-date">{formatSentAt(bulletin.sent_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {readerModal}

      <ConfirmModal
        isOpen={showRemoveConfirm}
        title="Remove this bulletin?"
        message="It will disappear from News. The email that was already sent stays sent."
        confirmText={removing ? 'Removing…' : 'Remove'}
        confirmDanger
        onConfirm={removeBulletin}
        onCancel={() => {
          if (!removing) setShowRemoveConfirm(false);
        }}
      />
    </div>
  );
};

export default News;
