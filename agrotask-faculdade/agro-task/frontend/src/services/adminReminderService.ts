import { apiService as api } from './api';

export interface AdminReminder {
  id: string;
  title: string;
  description?: string;
  status?: 'pending' | 'completed' | 'canceled';
  isRepeating?: boolean;
  repeatInterval?: number;
  repeatUnit?: 'day' | 'week';
  repeatStartDate?: string;
  repeatEndType?: 'never' | 'date' | 'occurrences';
  repeatEndDate?: string;
  repeatOccurrences?: number;
  repeatDaysOfWeek?: number[]; // Days of week for weekly repeating reminders
  scheduledDate?: string; // Full date+time for non-repeating reminders
  scheduledTime?: string; // Time only (HH:MM) for repeating reminders
  messageString?: string; // The actual reminder message
  createdAt: string;
}

export interface CreateAdminReminderData {
  title: string;
  description?: string;
  status?: 'pending' | 'completed' | 'canceled';
  isRepeating?: boolean;
  repeatInterval?: number;
  repeatUnit?: 'day' | 'week';
  repeatStartDate?: string;
  repeatEndType?: 'never' | 'date' | 'occurrences';
  repeatEndDate?: string;
  repeatOccurrences?: number;
  repeatDaysOfWeek?: number[]; // Days of week for weekly repeating reminders
  scheduledDate?: string; // Full date+time for non-repeating reminders
  scheduledTime?: string; // Time only (HH:MM) for repeating reminders
  messageString?: string; // The actual reminder message
}

const adminReminderService = {
  // Get all admin reminders
  async getAdminReminders(): Promise<AdminReminder[]> {
    const response = await api.get<AdminReminder[]>('/admin-reminders');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch admin reminders');
    }
    return response.data;
  },

  // Get admin reminder by ID
  async getAdminReminder(id: string): Promise<AdminReminder> {
    const response = await api.get<AdminReminder>(`/admin-reminders/${id}`);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch admin reminder');
    }
    return response.data;
  },

  // Create admin reminder
  async createAdminReminder(data: CreateAdminReminderData): Promise<AdminReminder> {
    const response = await api.post<AdminReminder>('/admin-reminders', data);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create admin reminder');
    }
    return response.data;
  },

  // Update admin reminder
  async updateAdminReminder(id: string, data: Partial<CreateAdminReminderData>): Promise<AdminReminder> {
    const response = await api.put<AdminReminder>(`/admin-reminders/${id}`, data);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update admin reminder');
    }
    return response.data;
  },

  // Delete admin reminder
  async deleteAdminReminder(id: string): Promise<void> {
    const response = await api.delete(`/admin-reminders/${id}`);
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete admin reminder');
    }
  }
};

export default adminReminderService;