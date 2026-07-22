import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getApiBaseUrl } from '../utils/apiConfig';

const PendingReceiptsContext = createContext({
  pendingReceiptsCount: 0,
  refreshPendingReceipts: () => {}
});

export const usePendingReceipts = () => useContext(PendingReceiptsContext);

const POLL_INTERVAL_MS = 60000;

export const PendingReceiptsProvider = ({ children }) => {
  const { currentUser, isAdmin, isExec } = useAuth();
  const [pendingReceiptsCount, setPendingReceiptsCount] = useState(0);
  const API_BASE_URL = getApiBaseUrl();

  const canReview = !!currentUser && (isAdmin(currentUser) || isExec(currentUser));

  const refreshPendingReceipts = useCallback(async () => {
    if (!currentUser || !(isAdmin(currentUser) || isExec(currentUser))) {
      setPendingReceiptsCount(0);
      return;
    }
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) return;
      const resp = await fetch(`${API_BASE_URL}/admin/receipts/pending-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setPendingReceiptsCount(Number(data.count) || 0);
    } catch (_error) {
      // best effort; leave the previous count in place
    }
  }, [API_BASE_URL, currentUser, isAdmin, isExec]);

  useEffect(() => {
    refreshPendingReceipts();
    if (!canReview) return undefined;

    const interval = setInterval(refreshPendingReceipts, POLL_INTERVAL_MS);
    const onFocus = () => refreshPendingReceipts();
    const onReceiptsUpdated = () => refreshPendingReceipts();
    window.addEventListener('focus', onFocus);
    window.addEventListener('receiptsUpdated', onReceiptsUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('receiptsUpdated', onReceiptsUpdated);
    };
  }, [refreshPendingReceipts, canReview]);

  return (
    <PendingReceiptsContext.Provider value={{ pendingReceiptsCount, refreshPendingReceipts }}>
      {children}
    </PendingReceiptsContext.Provider>
  );
};

export default PendingReceiptsContext;
