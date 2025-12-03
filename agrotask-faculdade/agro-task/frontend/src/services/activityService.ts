import { apiService as api } from './api';

export interface Activity {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'completed' | 'canceled';
  isRepeating: boolean;
  shouldSendNotification: boolean;
  repeatInterval: number;
  repeatUnit: 'day' | 'week';
  repeatStartDate?: string;
  repeatEndType: 'never' | 'date' | 'occurrences';
  repeatEndDate?: string;
  repeatOccurrences?: number;
  repeatDaysOfWeek?: number[]; // Days of week for weekly repeating tasks (0=Monday, 6=Sunday)
  scheduledDate?: string; // Full date+time for non-repeating tasks
  scheduledTime?: string; // Time only (HH:MM) for repeating tasks
  messageTemplateId?: string | null;
  messageString?: string;
  roles?: string[]; // Array of role strings (renamed from tags)
  createdAt: string;
  users: {
    activityId: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email?: string;
      phone?: string;
    };
  }[];
  messageTemplate?: {
    id: string;
    name: string;
    templateBody: string;
  };
}

export interface CreateActivityData {
  title: string;
  description?: string;
  status?: 'pending' | 'completed' | 'canceled';
  isRepeating?: boolean;
  shouldSendNotification?: boolean;
  repeatInterval?: number;
  repeatUnit?: 'day' | 'week';
  repeatStartDate?: string;
  repeatEndType?: 'never' | 'date' | 'occurrences';
  repeatEndDate?: string;
  repeatOccurrences?: number;
  repeatDaysOfWeek?: number[]; // Days of week for weekly repeating tasks
  scheduledDate?: string; // Full date+time for non-repeating tasks
  scheduledTime?: string; // Time only (HH:MM) for repeating tasks
  roles?: string[]; // Array of role strings
  messageTemplateId?: string | null;
  messageString?: string;
  userIds: string[];
}

export interface UpdateActivityData extends Partial<CreateActivityData> {
  id: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  templateBody: string;
  createdAt: string;
}

const activityService = {
  // Get all activities
  async getActivities(): Promise<Activity[]> {
    const response = await api.get<Activity[]>('/activities');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch activities');
    }
    return response.data;
  },

  // Get activity by ID
  async getActivity(id: string): Promise<Activity> {
    const response = await api.get<Activity>(`/activities/${id}`);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch activity');
    }
    return response.data;
  },

  // Create activity
  async createActivity(data: CreateActivityData): Promise<Activity> {
    const response = await api.post<Activity>('/activities', data);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create activity');
    }
    return response.data;
  },

  // Update activity
  async updateActivity(id: string, data: Partial<CreateActivityData>): Promise<Activity> {
    const response = await api.put<Activity>(`/activities/${id}`, data);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update activity');
    }
    return response.data;
  },

  // Toggle canceled status (cancel if active; reactivate with computed status if canceled)
  async toggleCanceled(id: string): Promise<Activity> {
    const response = await api.post<Activity>(`/activities/${id}/toggle-canceled`, {});
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to toggle activity');
    }
    return response.data;
  },

  // Delete activity
  async deleteActivity(id: string): Promise<void> {
    const response = await api.delete(`/activities/${id}`);
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete activity');
    }
  },

  // Get message templates
  async getMessageTemplates(): Promise<MessageTemplate[]> {
    const response = await api.get<MessageTemplate[]>('/message-templates');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch message templates');
    }
    return response.data;
  }
};

export default activityService;

