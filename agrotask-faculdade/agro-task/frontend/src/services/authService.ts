import { apiService, ApiResponse } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  description?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface LoginResponse {
  user: User;
  session: AuthSession;
}

class AuthService {
  private readonly TOKEN_KEY = 'agrotask_token';
  private readonly REFRESH_TOKEN_KEY = 'agrotask_refresh_token';
  private readonly USER_KEY = 'agrotask_user';
  private readonly ADMIN_CHECK_KEY = 'agrotask_admin_check';
  private refreshPromise: Promise<ApiResponse<LoginResponse>> | null = null;

  // Login
  async login(credentials: LoginCredentials): Promise<ApiResponse<LoginResponse>> {
    const response = await apiService.post<LoginResponse>('/auth/login', credentials);
    
    if (response.success && response.data) {
      // Store token, refresh token, and user data
      this.setToken(response.data.session.access_token);
      this.setRefreshToken(response.data.session.refresh_token);
      this.setUser(response.data.user);
      this.cacheAdminCheck(true);
    }
    
    return response;
  }

  // Register (create admin user)
  async register(userData: RegisterData): Promise<ApiResponse<{ user: User; message: string }>> {
    return apiService.post<{ user: User; message: string }>('/auth/register', userData);
  }

  // Create Admin (Auth user + AdminAccount). Password is not persisted in DB
  async createAdmin(userData: RegisterData): Promise<ApiResponse<{ user: User; adminAccount: any; message: string }>> {
    return apiService.post<{ user: User; adminAccount: any; message: string }>('/auth/create-admin', userData)
  }

  // Send password reset email
  async sendPasswordReset(email: string): Promise<ApiResponse<{ message: string }>> {
    return apiService.post<{ message: string }>('/auth/password-reset', { email });
  }

  // Update password with reset token
  async updatePassword(token: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return apiService.post<{ message: string }>('/auth/reset-password', { token, password: newPassword });
  }

  // Logout
  async logout(): Promise<ApiResponse<{ message: string }>> {
    const token = this.getToken();
    
    if (token) {
      // Call logout endpoint (token will be added automatically by API service)
      await apiService.post<{ message: string }>('/auth/logout', {});
    }
    
    // Clear local storage
    this.clearAuth();
    
    return { success: true, data: { message: 'Logged out successfully' } };
  }

  // Verify current session with smart caching
  async verifySession(forceRefresh = false): Promise<ApiResponse<{ user: User }>> {
    const token = this.getToken();
    
    if (!token) {
      return { success: false, error: 'No token found' };
    }

    // Check cached admin verification (valid for 5 minutes)
    const cachedAdmin = this.getCachedAdminCheck();
    if (!forceRefresh && cachedAdmin && cachedAdmin.isAdmin) {
      const cachedUser = this.getUser();
      if (cachedUser) {
        return {
          success: true,
          data: { user: cachedUser }
        };
      }
    }

    // Simplified: Just make the request - api.ts will handle 401 automatically
    const response = await apiService.get<{ user: User }>('/auth/me');
    
    if (response.success && response.data) {
      this.setUser(response.data.user);
      this.cacheAdminCheck(true);
    } else {
      // If request failed, clear auth (api.ts already tried refresh if needed)
      this.clearAuth();
    }
    
    return response;
  }

  // Refresh token using refresh token
  async refreshToken(): Promise<ApiResponse<LoginResponse> | null> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      return null;
    }

    // Prevent multiple simultaneous refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = apiService.post<LoginResponse>('/auth/refresh', {
      refresh_token: refreshToken
    });

    try {
      const response = await this.refreshPromise;
      
      if (response.success && response.data) {
        this.setToken(response.data.session.access_token);
        this.setRefreshToken(response.data.session.refresh_token);
        this.setUser(response.data.user);
        this.cacheAdminCheck(true);
      } else {
        // Refresh failed, clear auth
        this.clearAuth();
        return null;
      }
      
      return response;
    } catch (error) {
      this.clearAuth();
      return null;
    } finally {
      this.refreshPromise = null;
    }
  }

  // Token management
  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    // Update API service to include token in future requests
    this.updateApiHeaders();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setRefreshToken(refreshToken: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  // User management
  setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  getUser(): User | null {
    const userData = localStorage.getItem(this.USER_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  // Admin check caching (valid for 5 minutes)
  cacheAdminCheck(isAdmin: boolean): void {
    const cache = {
      isAdmin,
      timestamp: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
    };
    localStorage.setItem(this.ADMIN_CHECK_KEY, JSON.stringify(cache));
  }

  getCachedAdminCheck(): { isAdmin: boolean; timestamp: number; expiresAt: number } | null {
    const cached = localStorage.getItem(this.ADMIN_CHECK_KEY);
    if (!cached) return null;
    
    try {
      const cache = JSON.parse(cached);
      // Check if cache is still valid
      if (Date.now() < cache.expiresAt) {
        return cache;
      }
      // Cache expired, remove it
      localStorage.removeItem(this.ADMIN_CHECK_KEY);
      return null;
    } catch {
      return null;
    }
  }

  // Clear authentication data
  clearAuth(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.ADMIN_CHECK_KEY);
    this.updateApiHeaders();
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  }

  // Update API service headers with current token
  private updateApiHeaders(): void {
    const token = this.getToken();
    if (token) {
      // This will be handled by the API interceptor
    }
  }
}

export const authService = new AuthService();
