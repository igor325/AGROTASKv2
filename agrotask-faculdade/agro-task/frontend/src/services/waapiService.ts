import { apiService, ApiResponse } from './api'

// Types based on exact JSON examples from WaAPI documentation
export interface WaAPIStatusResponse {
  clientStatus: {
    status: string
    instanceId: number
    name: string
    data: any | null
    instanceStatus: string // "booting", "loading_screen", "qr", "authenticated", "ready", etc.
    instanceWebhook: string | null
    instanceEvents: string[][]
  }
  links?: {
    self: string
  }
  status: string
}

export interface WaAPIMeResponse {
  me: {
    status: string
    instanceId: string | number
    data: {
      displayName: string
      contactId: string // "@c.us"
      formattedNumber: string
      profilePicUrl: string | null
    }
  }
  links: {
    self: string
  }
  status: string
}

export interface WaAPIQrResponse {
  qrCode: {
    status: string
    instanceId: number
    data: {
      qr_code: string // data URI: "data:image/png;base64,..."
    }
  }
  links: {
    self: string
  }
  status: string
}

export interface WaAPILogoutResponse {
  data: {
    status: string
    instanceId: number
  }
  links: {
    self: string
  }
  status: string
}

export interface WaAPIRebootResponse {
  data: {
    status: string
    instanceId: number
  }
  links: {
    self: string
  }
  status: string
}

const waapiService = {
  // Get client status
  async getStatus(): Promise<WaAPIStatusResponse> {
    const response = await apiService.get<WaAPIStatusResponse>('/whatsapp-qr/status')
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch status')
    }
    return response.data!
  },

  // Get client info (me)
  async getMe(): Promise<WaAPIMeResponse> {
    const response = await apiService.get<WaAPIMeResponse>('/whatsapp-qr/me')
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch client info')
    }
    return response.data!
  },

  // Get QR Code
  async getQr(): Promise<WaAPIQrResponse> {
    const response = await apiService.get<WaAPIQrResponse>('/whatsapp-qr/qr')
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch QR code')
    }
    return response.data!
  },

  // Logout
  async logout(): Promise<WaAPILogoutResponse> {
    const response = await apiService.post<WaAPILogoutResponse>('/whatsapp-qr/logout', {})
    if (!response.success) {
      throw new Error(response.error || 'Failed to logout')
    }
    return response.data!
  },

  // Reboot (optional)
  async reboot(): Promise<WaAPIRebootResponse> {
    const response = await apiService.post<WaAPIRebootResponse>('/whatsapp-qr/reboot', {})
    if (!response.success) {
      throw new Error(response.error || 'Failed to reboot')
    }
    return response.data!
  },
}

export default waapiService


