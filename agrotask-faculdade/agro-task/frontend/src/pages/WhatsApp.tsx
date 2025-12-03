import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Smartphone,
  Loader2,
  RefreshCw,
  LogOut,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import waapiService, { 
  type WaAPIStatusResponse, 
  type WaAPIMeResponse, 
  type WaAPIQrResponse 
} from "@/services/waapiService"

const QR_EXPIRY_TIME = 180000 // 3 minutes in milliseconds
const STATUS_POLL_INTERVAL = 5000 // 5 seconds
const QR_REFRESH_INTERVAL = 45000 // 45 seconds

const WhatsApp = () => {
  const [status, setStatus] = useState<WaAPIStatusResponse | null>(null)
  const [clientInfo, setClientInfo] = useState<WaAPIMeResponse | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrExpiry, setQrExpiry] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loadingQr, setLoadingQr] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  
  const statusPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const qrRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const qrExpiryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load initial data
  useEffect(() => {
    loadData()
    return () => {
      // Cleanup intervals on unmount
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current)
      }
      if (qrRefreshIntervalRef.current) {
        clearInterval(qrRefreshIntervalRef.current)
      }
      if (qrExpiryTimeoutRef.current) {
        clearTimeout(qrExpiryTimeoutRef.current)
      }
    }
  }, [])

  // Poll status when QR is shown
  useEffect(() => {
    if (qrCode && status?.clientStatus.instanceStatus !== 'authenticated' && status?.clientStatus.instanceStatus !== 'ready') {
      startStatusPolling()
    } else {
      stopStatusPolling()
    }
    return () => stopStatusPolling()
  }, [qrCode, status?.clientStatus.instanceStatus])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([loadStatus(), loadClientInfo()])
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }

  const loadStatus = async () => {
    try {
      const data = await waapiService.getStatus()
      console.log('Status data:', data)
      setStatus(data)
      return data
    } catch (error: any) {
      console.error('Error loading status:', error)
      throw error
    }
  }

  const loadClientInfo = async () => {
    try {
      const data = await waapiService.getMe()
      console.log('Client info data:', data)
      setClientInfo(data)
      return data
    } catch (error: any) {
      // If client is not connected, this might fail - that's ok
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        setClientInfo(null)
        return null
      }
      throw error
    }
  }

  const refreshStatus = async () => {
    try {
      setLoadingStatus(true)
      await loadStatus()
      toast.success("Status atualizado")
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar status")
    } finally {
      setLoadingStatus(false)
    }
  }

  const waitForQrMode = async (maxAttempts = 15, delay = 1500) => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay))
        const currentStatus = await waapiService.getStatus()
        const instanceStatus = currentStatus?.clientStatus?.instanceStatus
        
        console.log(`Tentativa ${i + 1}/${maxAttempts}: Status atual = ${instanceStatus}`)
        
        if (instanceStatus === 'qr') {
          console.log('Instância está em modo QR!')
          return true
        }
        
        // Se estiver em booting ou loading_screen, continuar aguardando
        if (instanceStatus === 'booting' || instanceStatus === 'loading_screen') {
          continue
        }
        
        // Se estiver em outro estado que não seja QR, pode ser que precise aguardar mais
        if (i < maxAttempts - 1) {
          continue
        }
      } catch (error) {
        console.error(`Erro ao verificar status (tentativa ${i + 1}):`, error)
        // Continuar tentando mesmo com erro
        if (i < maxAttempts - 1) {
          continue
        }
      }
    }
    return false
  }

  const generateNewQr = async () => {
    try {
      setLoadingQr(true)
      
      // Try to logout first (best effort - ignore errors)
      try {
        await waapiService.logout()
        setClientInfo(null)
      } catch (error) {
        // Ignore logout errors
        console.log('Logout error (ignored):', error)
      }
      
      // Wait for instance to be in QR mode
      toast.info('Aguardando instância entrar em modo QR...')
      const isInQrMode = await waitForQrMode(15, 1500)
      if (!isInQrMode) {
        // Tentar gerar QR mesmo assim, pode ser que funcione
        console.warn('Instância não entrou em modo QR após aguardar, mas tentando gerar QR mesmo assim...')
      }
      
      // Aguardar um pouco mais antes de gerar o QR
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Generate new QR
      let qrData
      try {
        qrData = await waapiService.getQr()
        console.log('QR data:', qrData)
      } catch (error: any) {
        // Se der erro, aguardar mais um pouco e tentar novamente
        console.log('Erro ao gerar QR, aguardando mais um pouco e tentando novamente...', error.message)
        await new Promise(resolve => setTimeout(resolve, 2000))
        qrData = await waapiService.getQr()
        console.log('QR data (segunda tentativa):', qrData)
      }
      
      // Verificar se há erro na resposta
      if (qrData?.qrCode?.status === 'error') {
        const errorMsg = qrData.qrCode.message || qrData.qrCode.explanation || 'Erro ao gerar QR Code'
        // Se o erro for sobre não estar em modo QR, aguardar mais e tentar novamente
        if (errorMsg.includes('not in QR mode') || errorMsg.includes('must be in QR mode')) {
          console.log('Instância ainda não está em modo QR, aguardando mais...')
          await new Promise(resolve => setTimeout(resolve, 3000))
          qrData = await waapiService.getQr()
          console.log('QR data (terceira tentativa):', qrData)
          
          if (qrData?.qrCode?.status === 'error') {
            throw new Error('A instância não entrou em modo QR. Aguarde alguns segundos e tente novamente.')
          }
        } else {
          throw new Error(errorMsg)
        }
      }
      
      // A resposta pode ter estrutura diferente, vamos tentar diferentes caminhos
      const qrCodeString = qrData?.qrCode?.data?.qr_code || qrData?.data?.qrCode?.data?.qr_code || qrData?.qr_code
      if (!qrCodeString) {
        throw new Error('QR Code não encontrado na resposta')
      }
      setQrCode(qrCodeString)
      
      // Set expiry timer
      const expiryTime = Date.now() + QR_EXPIRY_TIME
      setQrExpiry(expiryTime)
      
      // Clear existing expiry timeout
      if (qrExpiryTimeoutRef.current) {
        clearTimeout(qrExpiryTimeoutRef.current)
      }
      
      // Set new expiry timeout
      qrExpiryTimeoutRef.current = setTimeout(() => {
        setQrCode(null)
        setQrExpiry(null)
        toast.info("QR Code expirado. Gere um novo para conectar.")
      }, QR_EXPIRY_TIME)
      
      // Refresh status
      await loadStatus()
      
      toast.success("QR Code gerado com sucesso")
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar QR Code")
    } finally {
      setLoadingQr(false)
    }
  }

  const refreshQr = async () => {
    try {
      setLoadingQr(true)
      
      // Verificar se está em modo QR antes de tentar gerar
      const currentStatus = await waapiService.getStatus()
      if (currentStatus?.clientStatus?.instanceStatus !== 'qr') {
        throw new Error('A instância não está em modo QR. Aguarde ou gere um novo QR Code.')
      }
      
      const qrData = await waapiService.getQr()
      console.log('QR data:', qrData)
      
      // Verificar se há erro na resposta
      if (qrData?.qrCode?.status === 'error') {
        throw new Error(qrData.qrCode.message || 'Erro ao atualizar QR Code')
      }
      
      // A resposta pode ter estrutura diferente, vamos tentar diferentes caminhos
      const qrCodeString = qrData?.qrCode?.data?.qr_code || qrData?.data?.qrCode?.data?.qr_code || qrData?.qr_code
      if (!qrCodeString) {
        throw new Error('QR Code não encontrado na resposta')
      }
      setQrCode(qrCodeString)
      
      // Reset expiry timer
      const expiryTime = Date.now() + QR_EXPIRY_TIME
      setQrExpiry(expiryTime)
      
      // Clear existing expiry timeout
      if (qrExpiryTimeoutRef.current) {
        clearTimeout(qrExpiryTimeoutRef.current)
      }
      
      // Set new expiry timeout
      qrExpiryTimeoutRef.current = setTimeout(() => {
        setQrCode(null)
        setQrExpiry(null)
        toast.info("QR Code expirado. Gere um novo para conectar.")
      }, QR_EXPIRY_TIME)
      
      toast.success("QR Code atualizado")
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar QR Code")
    } finally {
      setLoadingQr(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true)
      await waapiService.logout()
      setClientInfo(null)
      setQrCode(null)
      setQrExpiry(null)
      await loadStatus()
      toast.success("Desconectado com sucesso")
    } catch (error: any) {
      toast.error(error.message || "Erro ao desconectar")
    } finally {
      setDisconnecting(false)
    }
  }

  const startStatusPolling = () => {
    if (statusPollIntervalRef.current) return
    
    statusPollIntervalRef.current = setInterval(async () => {
      try {
        const newStatus = await loadStatus()
        // If connected, stop polling and reload client info
        if (newStatus.clientStatus.instanceStatus === 'authenticated' || 
            newStatus.clientStatus.instanceStatus === 'ready') {
          stopStatusPolling()
          setQrCode(null)
          setQrExpiry(null)
          await loadClientInfo()
          toast.success("Conectado com sucesso!")
        }
      } catch (error) {
        console.error('Error polling status:', error)
      }
    }, STATUS_POLL_INTERVAL)
  }

  const stopStatusPolling = () => {
    if (statusPollIntervalRef.current) {
      clearInterval(statusPollIntervalRef.current)
      statusPollIntervalRef.current = null
    }
  }

  const getStatusBadge = (instanceStatus: string) => {
    switch (instanceStatus) {
      case 'authenticated':
      case 'ready':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Conectado</Badge>
      case 'qr':
        return <Badge className="bg-yellow-500"><QrCode className="w-3 h-3 mr-1" />Aguardando QR</Badge>
      case 'booting':
      case 'loading_screen':
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Iniciando</Badge>
      case 'disconnected':
      default:
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Desconectado</Badge>
    }
  }

  const getQrTimeRemaining = () => {
    if (!qrExpiry) return null
    const remaining = Math.max(0, Math.floor((qrExpiry - Date.now()) / 1000))
    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const instanceStatus = status?.clientStatus.instanceStatus || 'unknown'
  const isConnected = instanceStatus === 'authenticated' || instanceStatus === 'ready'
  const isWaitingQr = instanceStatus === 'qr'
  const showQr = qrCode && !isConnected

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie a conexão do WhatsApp
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    Status da Conexão
                  </CardTitle>
                  <CardDescription>
                    Status atual da instância do WhatsApp
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {status && getStatusBadge(status.clientStatus.instanceStatus)}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={refreshStatus}
                    disabled={loadingStatus}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {status && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Instância:</span>
                    <span className="text-sm font-medium">
                      {clientInfo?.me?.data?.displayName 
                        ? clientInfo.me.data.displayName 
                        : status?.clientStatus?.instanceId 
                        ? `Instância ${status.clientStatus.instanceId}` 
                        : 'Carregando...'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <span className="text-sm font-medium">{status?.clientStatus?.instanceStatus || 'N/A'}</span>
                  </div>
                </div>
              )}

              {isConnected && clientInfo?.me?.data && (
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage 
                        src={clientInfo.me.data.profilePicUrl || undefined} 
                        alt={clientInfo.me.data.displayName}
                      />
                      <AvatarFallback>
                        {clientInfo.me.data.displayName?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{clientInfo.me.data.displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        {clientInfo.me.data.formattedNumber}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="w-full"
                  >
                    {disconnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Desconectando...
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4 mr-2" />
                        Desconectar
                      </>
                    )}
                  </Button>
                </div>
              )}

              {!isConnected && !isWaitingQr && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-4">
                    Nenhuma conexão ativa. Clique em "Desconectar" para gerar um novo QR Code.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Code Card */}
          {isWaitingQr && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  Conectar via QR Code
                </CardTitle>
                <CardDescription>
                  Escaneie o QR Code com o WhatsApp para conectar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {showQr ? (
                  <>
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <img 
                          src={qrCode} 
                          alt="QR Code" 
                          className="w-64 h-64 border rounded-lg"
                        />
                      </div>
                      {qrExpiry && (
                        <div className="bg-black/70 text-white px-3 py-1.5 rounded text-sm font-medium">
                          Tempo restante: {getQrTimeRemaining()}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground text-center max-w-md">
                        Abra o WhatsApp no seu celular, vá em Configurações → Aparelhos conectados → 
                        Conectar um aparelho e escaneie este QR Code.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={refreshQr}
                        disabled={loadingQr}
                        className="flex-1"
                      >
                        {loadingQr ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Atualizando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Atualizar QR
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={generateNewQr}
                        disabled={loadingQr}
                        className="flex-1"
                      >
                        {loadingQr ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <QrCode className="w-4 h-4 mr-2" />
                            Gerar Novo QR
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <AlertCircle className="w-12 h-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground text-center">
                      Nenhum QR Code disponível. Clique no botão abaixo para gerar um novo.
                    </p>
                    <Button
                      onClick={generateNewQr}
                      disabled={loadingQr}
                    >
                      {loadingQr ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4 mr-2" />
                          Gerar QR Code
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export default WhatsApp


