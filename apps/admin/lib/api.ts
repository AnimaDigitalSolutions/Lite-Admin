import axios from 'axios';
import Cookies from 'js-cookie';
import type { AuthTokens, AdminUser } from '@lite/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // The backend will use httpOnly cookies, but we can also send Bearer token if needed
    const token = Cookies.get('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track refresh attempts to prevent loops
let refreshAttempts = 0;
const maxRefreshAttempts = 3;
let refreshPromise: Promise<any> | null = null;

// Response interceptor to handle auth errors with circuit breaker
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Circuit breaker: Stop trying after max attempts
      if (refreshAttempts >= maxRefreshAttempts) {
        console.warn('Max refresh attempts reached, redirecting to login');
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        // Deduplicate refresh calls - if a refresh is already in progress, wait for it
        if (!refreshPromise) {
          refreshAttempts++;
          refreshPromise = api.post('/auth/refresh').finally(() => {
            refreshPromise = null;
          });
        }

        await refreshPromise;
        
        // Reset attempts on success
        refreshAttempts = 0;
        
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // If refresh fails, clear auth and redirect
        if (refreshAttempts >= maxRefreshAttempts) {
          clearAuthAndRedirect();
        }
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Helper function to clear auth state and redirect
function clearAuthAndRedirect() {
  // Clear cookies
  document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Reset refresh attempts
  refreshAttempts = 0;
  refreshPromise = null;
  
  // Redirect to login
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

// Auth API
export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokens & { user: AdminUser }> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
  },

  getMe: async (): Promise<AdminUser> => {
    const response = await api.get('/auth/me');
    return response.data.data.user;
  },

  refresh: async (): Promise<AuthTokens> => {
    const response = await api.post('/auth/refresh');
    return response.data.data;
  },

  // Clear all auth state
  clearAuth: () => {
    clearAuthAndRedirect();
  },
};

// Media API
export const mediaApi = {
  list: async (params?: { limit?: number; offset?: number; project?: string }) => {
    const response = await api.get('/media/portfolio', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/media/${id}`);
    return response.data;
  },

  upload: async (file: File, data: { project_name?: string; description?: string }) => {
    const formData = new FormData();
    formData.append('image', file);
    if (data.project_name) formData.append('project_name', data.project_name);
    if (data.description) formData.append('description', data.description);

    const response = await api.post('/admin/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  update: async (id: string, data: { project_name?: string; description?: string }) => {
    const response = await api.put(`/admin/media/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/admin/media/${id}`);
    return response.data;
  },
};

// Submissions API
export const submissionsApi = {
  list: async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get('/admin/submissions', { params });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/admin/submission/${id}`);
    return response.data;
  },
};

// Waitlist API
export const waitlistApi = {
  list: async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get('/admin/waitlist', { params });
    return response.data;
  },

  export: async () => {
    const response = await api.get('/admin/waitlist/export', {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Stats API
export const statsApi = {
  get: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },
};

// Email Testing API
export const emailTestApi = {
  testContact: async (data: {
    test_email: string;
    name: string;
    company?: string;
    project_type?: string;
    message: string;
  }) => {
    const response = await api.post('/admin/test-email/contact', data);
    return response.data;
  },

  testWaitlist: async (data: {
    test_email: string;
    name?: string;
  }) => {
    const response = await api.post('/admin/test-email/waitlist', data);
    return response.data;
  },
};