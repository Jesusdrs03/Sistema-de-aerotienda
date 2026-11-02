'use client';
import { createContext, useContext } from 'react';
export const AdminContext = createContext({ user: null, admin: null });
export const useAdmin = () => useContext(AdminContext);
