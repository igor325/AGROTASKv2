import { apiService as api } from './api';

export interface WorkShift {
  id: string;
  title: string;
  time: string; // HH:MM format
  messageString?: string | null;
  alertMinutesBefore: number;
  createdAt: string;
}

export interface CreateWorkShiftData {
  title: string;
  time: string; // HH:MM format
  messageString?: string | null;
  alertMinutesBefore?: number;
}

const workShiftService = {
  // Get all work shifts
  async getWorkShifts(): Promise<WorkShift[]> {
    const response = await api.get<WorkShift[]>('/work-shifts');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch work shifts');
    }
    return response.data;
  },

  // Get work shift by ID
  async getWorkShift(id: string): Promise<WorkShift> {
    const response = await api.get<WorkShift>(`/work-shifts/${id}`);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch work shift');
    }
    return response.data;
  },

  // Create work shift
  async createWorkShift(data: CreateWorkShiftData): Promise<WorkShift> {
    const response = await api.post<WorkShift>('/work-shifts', data);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create work shift');
    }
    return response.data;
  },

  // Update work shift
  async updateWorkShift(id: string, data: Partial<CreateWorkShiftData>): Promise<WorkShift> {
    const response = await api.put<WorkShift>(`/work-shifts/${id}`, data);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update work shift');
    }
    return response.data;
  },

  // Delete work shift
  async deleteWorkShift(id: string): Promise<void> {
    const response = await api.delete(`/work-shifts/${id}`);
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete work shift');
    }
  }
};

export default workShiftService;

