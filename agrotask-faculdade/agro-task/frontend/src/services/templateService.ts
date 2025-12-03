import { apiService as api } from './api'

export interface MessageTemplate {
  id: string
  name: string
  category: string
  templateBody: string
  createdAt: string
}

export interface CreateTemplateData {
  name: string
  category: string
  templateBody: string
}

export interface UpdateTemplateData {
  name?: string
  category?: string
  templateBody?: string
}

const templateService = {
  // Get all templates
  async getAll(): Promise<MessageTemplate[]> {
    const response = await api.get<MessageTemplate[]>('/message-templates')
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch templates')
    }
    return response.data || []
  },

  // Get template by ID
  async getById(id: string): Promise<MessageTemplate> {
    const response = await api.get<MessageTemplate>(`/message-templates/${id}`)
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch template')
    }
    return response.data!
  },

  // Create template
  async create(data: CreateTemplateData): Promise<MessageTemplate> {
    const response = await api.post<MessageTemplate>('/message-templates', data)
    if (!response.success) {
      throw new Error(response.error || 'Failed to create template')
    }
    return response.data!
  },

  // Update template
  async update(id: string, data: UpdateTemplateData): Promise<MessageTemplate> {
    const response = await api.put<MessageTemplate>(`/message-templates/${id}`, data)
    if (!response.success) {
      throw new Error(response.error || 'Failed to update template')
    }
    return response.data!
  },

  // Delete template
  async delete(id: string): Promise<void> {
    const response = await api.delete<void>(`/message-templates/${id}`)
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete template')
    }
  }
}

export default templateService

