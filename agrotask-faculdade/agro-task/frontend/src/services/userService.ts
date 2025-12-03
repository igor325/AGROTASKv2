import { apiService, ApiResponse } from './api';

export interface User {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  tags: string[];
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface CreateUserData {
  name: string;
  phone?: string;
  email?: string;
  description?: string;
  tags?: string[];
}

export interface UpdateUserData {
  name?: string;
  phone?: string;
  email?: string;
  description?: string;
  tags?: string[];
  status?: 'active' | 'inactive';
}

class UserService {
  async getAllUsers(): Promise<ApiResponse<User[]>> {
    return apiService.get<User[]>('/users');
  }

  async getUserById(id: string): Promise<ApiResponse<User>> {
    return apiService.get<User>(`/users/${id}`);
  }

  async createUser(userData: CreateUserData): Promise<ApiResponse<User>> {
    return apiService.post<User>('/users', userData);
  }

  async updateUser(id: string, userData: UpdateUserData): Promise<ApiResponse<User>> {
    return apiService.put<User>(`/users/${id}`, userData);
  }

  async deleteUser(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiService.delete<{ message: string }>(`/users/${id}`);
  }
}

export const userService = new UserService();
