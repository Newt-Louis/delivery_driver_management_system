import axios from 'axios';
import { clearAuthToken, getAuthToken, setAuthToken } from './authCookies';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

let authRedirecting = false;
let renewPromise: Promise<string | null> | null = null;

async function renewToken(): Promise<string | null> {
  const token = getAuthToken();
  if (!token) return null;

  const res = await axios.post(`${API_BASE}/api/auth/renew`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const nextToken = res.data?.token;
  if (!nextToken) return null;

  const maxAge = res.data?.session?.expiresInSeconds ?? res.data?.expiresInSeconds ?? 60;
  setAuthToken(nextToken, maxAge);
  return nextToken;
}

function redirectToLogin(message: string): void {
  if (authRedirecting) return;
  authRedirecting = true;
  clearAuthToken();
  alert(`🔒 ${message}\nBạn sẽ được chuyển đến trang đăng nhập.`);
  window.location.href = '/login';
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const url: string = err.config?.url ?? '';
    const config = err.config as (typeof err.config & { _retry?: boolean });
    const hasBearerToken = Boolean(config?.headers?.Authorization);
    const isLogin = url.includes('/api/auth/login');
    const isRenew = url.includes('/api/auth/renew');
    if (err.response?.status === 401 && hasBearerToken && !isLogin && !isRenew && !config?._retry) {
      try {
        config._retry = true;
        renewPromise = renewPromise ?? renewToken().finally(() => {
          renewPromise = null;
        });
        const renewed = await renewPromise;
        if (renewed) {
          config.headers.Authorization = `Bearer ${renewed}`;
          return api(config);
        }
      } catch {
        const message = err.response?.data?.message ?? 'Phiên đăng nhập hết hạn.';
        redirectToLogin(message);
      }
    } else if (err.response?.status === 401 && hasBearerToken && !isLogin && !authRedirecting) {
      const message = err.response?.data?.message ?? 'Phiên đăng nhập hết hạn.';
      redirectToLogin(message);
    }
    return Promise.reject(err);
  }
);

export default api;
