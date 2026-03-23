import axios from 'axios';
import type { AuthTokens, AdminUser } from '@lite/shared';
import type { InternalAxiosRequestConfig, AxiosHeaders } from 'axios';
import { matchDemoRoute } from './demo-data';
import logger from './logger';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Demo mode interceptor — short-circuits all requests with mock data
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!isDemoMode) return config;

  const params: Record<string, string> = {};
  if (config.params) {
    for (const [k, v] of Object.entries(config.params)) {
      if (v !== undefined && v !== null) params[k] = String(v);
    }
  }

  const data = matchDemoRoute(config.url || '', params, config.method, config.data);

  config.adapter = () =>
    Promise.resolve({
      data: data ?? { success: true },
      status: 200,
      statusText: 'OK',
      headers: {} as AxiosHeaders,
      config,
    });

  return config;
});

// Global loading state will be injected via interceptor setup function
let globalLoadingCallbacks: { start: () => void; stop: () => void } | null = null;

export function setupLoadingInterceptors(callbacks: { start: () => void; stop: () => void }) {
  globalLoadingCallbacks = callbacks;
}

// Request interceptor to add auth token and show loading
api.interceptors.request.use(
  (config) => {
    // Show loading indicator
    globalLoadingCallbacks?.start();

    // Auth is handled via httpOnly cookies sent automatically with withCredentials: true
    return config;
  },
  (error) => {
    globalLoadingCallbacks?.stop();
    return Promise.reject(error);
  }
);

// Track refresh attempts to prevent loops
let refreshAttempts = 0;
const maxRefreshAttempts = 3;
let refreshPromise: Promise<unknown> | null = null;

// Response interceptor to handle auth errors with circuit breaker
api.interceptors.response.use(
  (response) => {
    globalLoadingCallbacks?.stop();
    return response;
  },
  async (error) => {
    globalLoadingCallbacks?.stop();
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // If the refresh request itself failed, give up immediately — retrying would loop
      if (originalRequest.url?.includes('/auth/refresh')) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // Circuit breaker: Stop trying after max attempts
      if (refreshAttempts >= maxRefreshAttempts) {
        logger.warn('Max refresh attempts reached, redirecting to login');
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
        // 401 from refresh is expected when not logged in — no need to log it
        const is401 = (refreshError as { response?: { status?: number } }).response?.status === 401;
        if (!is401) logger.warn('Token refresh failed:', refreshError);
        
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
  // Reset refresh attempts
  refreshAttempts = 0;
  refreshPromise = null;

  if (typeof window !== 'undefined') {
    // Don't redirect if already on the login page — avoids an infinite reload loop
    // when checkAuth() fires on mount and finds no valid session.
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = isDemoMode ? '/' : '/login';
    }
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
    formData.append('file', file);
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

  rename: async (id: string, name: string) => {
    const response = await api.patch(`/admin/media/${id}/rename`, { name });
    return response.data;
  },

  bulkDownload: async (ids: string[]): Promise<Blob> => {
    const response = await api.post('/admin/media/bulk-download', { ids }, { responseType: 'blob' });
    return response.data as Blob;
  },
};

// Submissions API
export const submissionsApi = {
  list: async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get('/admin/submissions', { params });
    return response.data;
  },

  create: async (data: { name: string; email: string; company?: string; project_type?: string; message: string }) => {
    const response = await api.post('/admin/submissions', data);
    return response.data;
  },

  update: async (id: string, data: { name?: string; email?: string; company?: string; project_type?: string; message?: string }) => {
    const response = await api.patch(`/admin/submissions/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/admin/submission/${id}`);
    return response.data;
  },

  bulkDelete: async (ids: number[]) => {
    const response = await api.post('/admin/submissions/bulk-delete', { ids });
    return response.data;
  },

  updateStatus: async (id: string | number, status: string, comment?: string) => {
    const response = await api.patch(`/admin/submissions/${id}/status`, { status, comment });
    return response.data;
  },

  getNotes: async (id: string | number) => {
    const response = await api.get(`/admin/submissions/${id}/notes`);
    return response.data;
  },

  addNote: async (id: string | number, content: string, color?: string, subtype?: string, due_at?: string) => {
    const response = await api.post(`/admin/submissions/${id}/notes`, { content, color, subtype, due_at });
    return response.data;
  },

  deleteNote: async (id: string | number, noteId: number) => {
    const response = await api.delete(`/admin/submissions/${id}/notes/${noteId}`);
    return response.data;
  },

  toggleNoteDone: async (id: string | number, noteId: number) => {
    const response = await api.patch(`/admin/submissions/${id}/notes/${noteId}/toggle`);
    return response.data;
  },

  updateTodoDue: async (id: string | number, noteId: number, due_at: string | null) => {
    const response = await api.patch(`/admin/submissions/${id}/notes/${noteId}/due`, { due_at });
    return response.data;
  },

  getStatusHistory: async (ids: number[]) => {
    const response = await api.post('/admin/submissions/status-history', { ids });
    return response.data;
  },

  getTodosSummary: async () => {
    const response = await api.get('/admin/submissions/todos-summary');
    return response.data;
  },

  getTodoContactIds: async () => {
    const response = await api.get('/admin/submissions/todo-contact-ids');
    return response.data;
  },

  getActivity: async (start: string, end: string) => {
    const response = await api.get('/admin/submissions/activity', { params: { start, end } });
    return response.data;
  },

  updateFollowUp: async (id: string | number, follow_up_at: string | null) => {
    const response = await api.patch(`/admin/submissions/${id}/follow-up`, { follow_up_at });
    return response.data;
  },

  sendEmail: async (id: string | number, subject: string, body: string) => {
    const response = await api.post(`/admin/submissions/${id}/send-email`, { subject, body });
    return response.data;
  },
};

// Compose Email API (standalone multi-recipient compose)
export const composeApi = {
  send: async (data: {
    to: { email: string; name?: string }[];
    cc?: { email: string; name?: string }[];
    bcc?: { email: string; name?: string }[];
    subject: string;
    body: string;
  }) => {
    const response = await api.post('/admin/email/compose', data);
    return response.data;
  },
};

// Waitlist API
export const waitlistApi = {
  list: async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get('/admin/waitlist', { params });
    return response.data;
  },

  create: async (data: { email: string; name?: string }) => {
    const response = await api.post('/admin/waitlist', data);
    return response.data;
  },

  update: async (id: string, data: { name?: string; email?: string; tags?: string }) => {
    const response = await api.patch(`/admin/waitlist/${id}`, data);
    return response.data;
  },

  export: async () => {
    const response = await api.get('/admin/waitlist/export', {
      responseType: 'blob',
    });
    return response.data;
  },

  bulkDelete: async (ids: number[]) => {
    const response = await api.post('/admin/waitlist/bulk-delete', { ids });
    return response.data;
  },

  getTags: async () => {
    const response = await api.get('/admin/waitlist/tags');
    return response.data;
  },

  countByTarget: async (targetType: 'all' | 'tagged', tags?: string[]) => {
    const params: Record<string, string> = { target_type: targetType };
    if (tags && tags.length) params.tags = tags.join(',');
    const response = await api.get('/admin/waitlist/count-by-target', { params });
    return response.data;
  },

  previewRecipients: async (targetType: 'all' | 'tagged', tags?: string[]) => {
    const params: Record<string, string> = { target_type: targetType };
    if (tags && tags.length) params.tags = tags.join(',');
    const response = await api.get('/admin/waitlist/preview-recipients', { params });
    return response.data;
  },
};

// Stats API
export const statsApi = {
  get: async (days = 30) => {
    const response = await api.get('/admin/stats', { params: { days } });
    return response.data;
  },
};

// Settings API
export const settingsApi = {
  get: async () => {
    const response = await api.get('/admin/settings');
    return response.data;
  },

  update: async (data: { email_enabled?: boolean; maintenance_mode?: boolean; maintenance_message?: string; display_timezone?: string }) => {
    const response = await api.put('/admin/settings', data);
    return response.data;
  },
};

// Menu Configuration API
export const menuApi = {
  get: async () => {
    const response = await api.get('/admin/settings/menu');
    return response.data;
  },

  update: async (prefs: Record<string, boolean>) => {
    const response = await api.put('/admin/settings/menu', prefs);
    return response.data;
  },
};

// Logs API
export const logsApi = {
  list: async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get('/admin/logs', { params });
    return response.data;
  },

  deleteOne: async (id: number) => {
    const response = await api.delete(`/admin/logs/${id}`);
    return response.data;
  },

  deleteAll: async () => {
    const response = await api.delete('/admin/logs');
    return response.data;
  },
};

// Sites API
export const sitesApi = {
  list: async () => {
    const response = await api.get('/admin/sites');
    return response.data;
  },

  create: async (data: { name: string; domain?: string; description?: string }) => {
    const response = await api.post('/admin/sites', data);
    return response.data;
  },

  regenerateKey: async (id: number) => {
    const response = await api.post(`/admin/sites/${id}/regenerate`);
    return response.data;
  },

  toggle: async (id: number, is_active: boolean) => {
    const response = await api.patch(`/admin/sites/${id}`, { is_active });
    return response.data;
  },

  updatePermissions: async (id: number, permissions: string[]) => {
    const response = await api.put(`/admin/sites/${id}/permissions`, { permissions });
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/admin/sites/${id}`);
    return response.data;
  },
};

// Provider Credentials API
export const credentialsApi = {
  get: async () => {
    const response = await api.get('/admin/credentials');
    return response.data;
  },

  update: async (data: {
    email?: {
      active_provider?: string;
      ahasend_api_key?: string;
      ahasend_account_id?: string;
      resend_api_key?: string;
      from_address?: string;
      display_name?: string;
      notification_address?: string;
    };
    storage?: { s3_access_key_id?: string; s3_secret_access_key?: string; s3_bucket?: string; s3_region?: string };
  }) => {
    const response = await api.put('/admin/credentials', data);
    return response.data;
  },

  verifyKey: async (provider: string, api_key: string) => {
    const response = await api.post('/admin/credentials/verify-key', { provider, api_key });
    return response.data as { valid: boolean; error?: string };
  },
};

// Auth/Users API
export const usersApi = {
  changePassword: async (current_password: string, new_password: string) => {
    const response = await api.post('/auth/change-password', { current_password, new_password });
    return response.data;
  },
};

// Email Templates API
export const templatesApi = {
  list: async () => {
    const response = await api.get('/admin/email-templates');
    return response.data as {
      data: Record<string, {
        name: string;
        default_html: string;
        custom_html: string | null;
        variables: string[];
      }>;
    };
  },

  update: async (name: string, html: string) => {
    const response = await api.put(`/admin/email-templates/${name}`, { html });
    return response.data;
  },

  reset: async (name: string) => {
    const response = await api.delete(`/admin/email-templates/${name}`);
    return response.data;
  },
};

// Campaigns API
export const campaignsApi = {
  list: async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get('/admin/campaigns', { params });
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/admin/campaigns/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string; subject: string; preheader?: string; html_content: string; text_content?: string;
    target_type?: 'all' | 'tagged'; target_tags?: string[];
  }) => {
    const response = await api.post('/admin/campaigns', data);
    return response.data;
  },

  update: async (id: number, data: {
    name?: string; subject?: string; preheader?: string; html_content?: string; text_content?: string;
    target_type?: 'all' | 'tagged'; target_tags?: string[];
  }) => {
    const response = await api.patch(`/admin/campaigns/${id}`, data);
    return response.data;
  },

  remove: async (id: number) => {
    const response = await api.delete(`/admin/campaigns/${id}`);
    return response.data;
  },

  send: async (id: number) => {
    const response = await api.post(`/admin/campaigns/${id}/send`);
    return response.data;
  },
};

// Invoices API
export const invoicesApi = {
  list: async (params?: { limit?: number; offset?: number; status?: string }) => {
    const response = await api.get('/admin/invoices', { params });
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/admin/invoices/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/admin/invoices', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.patch(`/admin/invoices/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/admin/invoices/${id}`);
    return response.data;
  },

  nextNumber: async () => {
    const response = await api.get('/admin/invoices-next-number');
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