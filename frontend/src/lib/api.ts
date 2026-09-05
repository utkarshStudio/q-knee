/// <reference types="vite/client" />
import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_URL = import.meta.env.VITE_API_URL || (isLocalhost ? 'http://localhost:3001' : 'https://q-knee-api-jqnj.onrender.com');

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('qknee_guest_session_id');
  if (!id) {
    id = 'guest_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem('qknee_guest_session_id', id);
  }
  return id;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hqml_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const guestSessionId = getOrCreateGuestSessionId();
  if (guestSessionId) {
    config.headers['X-Guest-Session-ID'] = guestSessionId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/signup');
    if (error.response?.status === 401 && !isAuthRoute) {
      // Clear stale auth credentials so client continues smoothly in guest mode
      localStorage.removeItem('hqml_token');
      localStorage.removeItem('hqml_user');
      // DO NOT REDIRECT TO /login - the application is auth-optional and remains fully usable
    }
    return Promise.reject(error);
  }
);

export default api;

