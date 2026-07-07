import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

let authRedirecting = false;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? '';
    const hasBearerToken = Boolean(err.config?.headers?.Authorization);
    const isLogin = url.includes('/api/auth/login');
    if (err.response?.status === 401 && hasBearerToken && !isLogin && !authRedirecting) {
      authRedirecting = true;
      const message = err.response?.data?.message ?? 'Phiên đăng nhập hết hạn.';
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      alert(`🔒 ${message}\nBạn sẽ được chuyển đến trang đăng nhập.`);
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
