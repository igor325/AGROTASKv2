const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      console.log('Making API request to:', url);
      
      // Get token from localStorage
      const token = localStorage.getItem('agrotask_token');
      
      const config: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          ...(SUPABASE_ANON_KEY && { 'apikey': SUPABASE_ANON_KEY }),
          // Always send Authorization header (user token or anon key)
          'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
          ...options.headers,
        },
        ...options,
      };

      const response = await fetch(url, config);
      console.log('API response status:', response.status);
      
      const data = await response.json();
      console.log('API response data:', data);

      // Handle 401 Unauthorized - token expired
      // Allow refresh for most endpoints, but avoid recursion on the refresh endpoint itself
      if (response.status === 401 && retryCount === 0 && !endpoint.startsWith('/auth/refresh')) {
        // Try to refresh token and retry request
        const { authService } = await import('./authService');
        const refreshed = await authService.refreshToken();
        
        if (refreshed && refreshed.success) {
          // Retry request with new token
          const newToken = authService.getToken();
          config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${newToken || SUPABASE_ANON_KEY}`,
          };
          
          const retryResponse = await fetch(url, config);
          const retryData = await retryResponse.json();
          
          if (!retryResponse.ok) {
            return {
              success: false,
              error: retryData.error || `HTTP error! status: ${retryResponse.status}`,
            };
          }
          
          return retryData;
        } else {
          // Refresh failed, clear auth
          authService.clearAuth();
          return {
            success: false,
            error: 'Session expired. Please login again.',
          };
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP error! status: ${response.status}`,
        };
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        baseURL: this.baseURL,
        endpoint,
        fullURL: `${this.baseURL}${endpoint}`
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiService = new ApiService();
