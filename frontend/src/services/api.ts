/// <reference types="vite/client" />
import axios, { InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(err);
  }
);

export interface GlobalPolicyResponse {
  id: string;
  name: string;
  blockedDomains: string[];
  allowedApps: string[];
  screenshotInterval: number;
  kioskMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export const deviceService = {
  getDevice: (id: string) => api.get(`/devices/${id}`),
  updatePolicy: (id: string, policy: Record<string, unknown>) => api.put(`/devices/${id}/policies`, policy),
  getScreenshots: (id: string) => api.get(`/screenshots/history/${id}`)
};

export const globalPoliciesService = {
  get: (): Promise<{ data: GlobalPolicyResponse }> => api.get('/global-policies'),
  update: (body: Partial<{ blockedDomains: string[]; allowedApps: string[]; screenshotInterval: number; kioskMode: boolean }>) =>
    api.put('/global-policies', body),
  addBlacklist: (domain: string) => api.post('/global-policies/blacklist', { domain }),
  removeBlacklist: (domain: string) => api.delete(`/global-policies/blacklist/${encodeURIComponent(domain)}`),
  addWhitelist: (packageName: string) => api.post('/global-policies/whitelist', { packageName }),
  removeWhitelist: (packageName: string) => api.delete(`/global-policies/whitelist/${encodeURIComponent(packageName)}`)
};

export const androidManagementService = {
  listDevices: (enterpriseName: string) =>
    api.get<{ success: boolean; data: Array<{ name: string; state?: string; [k: string]: unknown }> }>(
      '/android-management/devices',
      { params: { enterpriseName } }
    )
};

export default api;
