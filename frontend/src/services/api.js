import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://api.bloomland.com.pe',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let axios set the correct Content-Type automatically.
  // If FormData, avoid forcing application/json which breaks file uploads.
  if (config.data instanceof FormData) {
    if (config.headers && config.headers['Content-Type']) {
      delete config.headers['Content-Type'];
    }
  } else if (!config.headers['Content-Type'] && config.method && config.method.toLowerCase() !== 'get') {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

export default api;
