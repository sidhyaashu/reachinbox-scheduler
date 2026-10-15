import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axiosInstance, onUnauthorized, apiClient } from '../lib/api-client.js';

describe('Web API Client & Axios Interceptors', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configures Axios instance with withCredentials: true and 30s timeout', () => {
    expect(axiosInstance.defaults.withCredentials).toBe(true);
    expect(axiosInstance.defaults.timeout).toBe(30000);
    expect(axiosInstance.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('registers and unregisters onUnauthorized callback listeners', async () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    // Simulate a 401 response error via the interceptor rejection handler
    const responseInterceptor = (axiosInstance.interceptors.response as any).handlers[0];
    const mockError = {
      response: {
        status: 401,
        data: {
          error: { message: 'Session expired' },
        },
      },
    };

    await expect(responseInterceptor.rejected(mockError)).rejects.toThrow('Session expired');
    expect(listener).toHaveBeenCalledTimes(1);

    // Unsubscribe and trigger again
    unsubscribe();
    await expect(responseInterceptor.rejected(mockError)).rejects.toThrow('Session expired');
    expect(listener).toHaveBeenCalledTimes(1); // Not called again
  });

  it('normalizes error messages from nested error.message, message, or fallback', async () => {
    const responseInterceptor = (axiosInstance.interceptors.response as any).handlers[0];

    const errorWithMessage = {
      response: {
        status: 400,
        data: { message: 'Bad email payload' },
      },
    };
    await expect(responseInterceptor.rejected(errorWithMessage)).rejects.toThrow('Bad email payload');

    const networkError = {
      message: 'Network Error',
    };
    await expect(responseInterceptor.rejected(networkError)).rejects.toThrow('Network Error');
  });

  it('apiClient.auth.getCurrentUser returns null when API fails with 401/error', async () => {
    vi.spyOn(axiosInstance, 'request').mockRejectedValueOnce(new Error('Unauthorized'));
    const user = await apiClient.auth.getCurrentUser();
    expect(user).toBeNull();
  });

  it('apiClient.auth.getCurrentUser returns user profile on successful response', async () => {
    vi.spyOn(axiosInstance, 'request').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 'user-123',
          email: 'founder@reachinbox.ai',
          name: 'Ashutosh',
        },
      },
    });

    const user = await apiClient.auth.getCurrentUser();
    expect(user).toEqual({
      id: 'user-123',
      email: 'founder@reachinbox.ai',
      name: 'Ashutosh',
    });
  });
});
