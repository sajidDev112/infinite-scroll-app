import axios from 'axios';

// Default '/api' = same origin, forwarded by Vite to the API (works from any device on the network).
export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'sf_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY),
  set(token, remember) {
    this.clear();
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

export const http = axios.create({ baseURL: API_URL, timeout: 30000 });

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return Promise.reject(err);
  },
);

/** Human-readable message from an axios error. */
export function errorMessage(err, fallback = 'Something went wrong.') {
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check that the API is running.';
  return err?.response?.data?.error?.message || err?.message || fallback;
}

export const errorDetails = (err) => err?.response?.data?.error?.details || [];

// ---- endpoints --------------------------------------------------------------------
export const authApi = {
  login: (body) => http.post('/auth/login', body).then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data.admin),
  updateProfile: (body) => http.patch('/auth/me', body).then((r) => r.data.admin),
  changePassword: (body) => http.post('/auth/change-password', body).then((r) => r.data),
};

export const storiesApi = {
  list: (params) => http.get('/stories', { params }).then((r) => r.data),
  get: (id) => http.get(`/stories/${id}`).then((r) => r.data.story),
  create: (body) => http.post('/stories', body).then((r) => r.data.story),
  update: (id, body) => http.put(`/stories/${id}`, body).then((r) => r.data.story),
  remove: (id) => http.delete(`/stories/${id}`),
  setStatus: (id, status) => http.patch(`/stories/${id}/status`, { status }).then((r) => r.data.story),
  publish: (id) => http.post(`/stories/${id}/publish`).then((r) => r.data.story),
  duplicate: (id) => http.post(`/stories/${id}/duplicate`).then((r) => r.data.story),
  stats: () => http.get('/dashboard/stats').then((r) => r.data),
};

export const uploadsApi = {
  upload(file, onProgress, signal) {
    const form = new FormData();
    form.append('images', file);
    return http
      .post('/uploads/images', form, {
        signal,
        timeout: 0,
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      })
      .then((r) => r.data.images[0]);
  },
  remove: (id) => http.delete(`/uploads/${id}`),
};
