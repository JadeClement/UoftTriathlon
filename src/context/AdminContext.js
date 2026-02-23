import React, { createContext, useContext } from 'react';

const AdminContext = createContext(null);

export const useAdminContext = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdminContext must be used within AdminContext.Provider');
  }
  return ctx;
};

export const useAdminContextOptional = () => useContext(AdminContext);

export default AdminContext;
