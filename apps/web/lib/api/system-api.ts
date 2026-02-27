'use client';

import { apiRequest } from './client';
import type { HealthResponse, RootResponse } from './types';

export function getSystemRoot() {
  return apiRequest<RootResponse>('/');
}

export function getHealth() {
  return apiRequest<HealthResponse>('/health');
}

export function getReady() {
  return apiRequest<HealthResponse>('/ready');
}
