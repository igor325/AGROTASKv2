import { handleCors, ok, err } from '../_shared/response.ts'
import { requireAuth } from '../_shared/auth.ts'

// Get WaAPI secrets from environment
const getWaAPIConfig = () => {
  const token = Deno.env.get('WAAPI_TOKEN')
  const instanceId = Deno.env.get('WAAPI_INSTANCE_ID')
  const apiUrl = Deno.env.get('WAAPI_API_URL')
  
  if (!token || !instanceId || !apiUrl) {
    throw new Error('WaAPI configuration missing. Check WAAPI_TOKEN, WAAPI_INSTANCE_ID, and WAAPI_API_URL secrets.')
  }
  
  return { token, instanceId, apiUrl }
}

// Helper to make requests to WaAPI
const waapiRequest = async (
  method: string,
  endpoint: string,
  body?: any
): Promise<any> => {
  const { token, instanceId, apiUrl } = getWaAPIConfig()
  const baseUrl = `${apiUrl}/instances/${instanceId}`
  const url = `${baseUrl}${endpoint}`
  
  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  
  const options: RequestInit = {
    method,
    headers,
  }
  
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body)
  }
  
  const response = await fetch(url, options)
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || data.message || `WaAPI request failed: ${response.status}`)
  }
  
  // Verificar se há erro na estrutura de dados mesmo com status 200
  // Mas só lançar erro se realmente houver um problema (não bloquear se for apenas um aviso)
  // Se o endpoint for /client/qr e o status for 'error', verificar se a instância está realmente em modo QR
  if (endpoint === '/client/qr' && data.qrCode?.status === 'error') {
    // Se a mensagem indicar que não está em modo QR, lançar erro
    if (data.qrCode?.message?.includes('not in QR mode') || data.qrCode?.explanation?.includes('must be in QR mode')) {
      const errorMessage = data.qrCode?.message || data.qrCode?.explanation || 'A instância não está em modo QR'
      throw new Error(errorMessage)
    }
  }
  
  // Para outros endpoints, verificar erros normalmente
  if (data.status === 'error' && endpoint !== '/client/qr') {
    const errorMessage = data.message || data.error || 'Erro desconhecido'
    throw new Error(errorMessage)
  }
  
  return data
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Require authentication
    await requireAuth(req)
    
    const url = new URL(req.url)
    const method = req.method
    // Extract path after /functions/v1/whatsapp-qr
    // URL format: /functions/v1/whatsapp-qr/status, /functions/v1/whatsapp-qr/me, etc.
    const pathParts = url.pathname.split('/').filter(Boolean)
    const functionNameIndex = pathParts.findIndex(p => p === 'whatsapp-qr')
    const route = functionNameIndex >= 0 && pathParts[functionNameIndex + 1] ? pathParts[functionNameIndex + 1] : null
    
    // GET /whatsapp-qr/status
    if (method === 'GET' && route === 'status') {
      const data = await waapiRequest('GET', '/client/status')
      return ok(data)
    }
    
    // GET /whatsapp-qr/me
    if (method === 'GET' && route === 'me') {
      const data = await waapiRequest('GET', '/client/me')
      return ok(data)
    }
    
    // GET /whatsapp-qr/qr
    if (method === 'GET' && route === 'qr') {
      const data = await waapiRequest('GET', '/client/qr')
      return ok(data)
    }
    
    // POST /whatsapp-qr/logout
    if (method === 'POST' && route === 'logout') {
      const data = await waapiRequest('POST', '/client/action/logout')
      return ok(data)
    }
    
    // POST /whatsapp-qr/reboot
    if (method === 'POST' && route === 'reboot') {
      const data = await waapiRequest('POST', '/client/action/reboot')
      return ok(data)
    }
    
    return err('Route not found', 404)
  } catch (error) {
    console.error('WaAPI Error:', error)
    return err(error.message || 'Internal server error', error.message?.includes('Auth') ? 401 : 500)
  }
})

