// Waapi WhatsApp client

interface WaapiConfig {
  apiUrl: string;
  instanceId: string;
  token: string;
}

interface SendMessageParams {
  phone: string;
  message: string;
}

interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Formata número de telefone para o padrão Waapi
 * Adiciona @c.us se necessário
 * 
 * IMPORTANTE: Remove o 9º dígito adicional para compatibilidade
 * Formato final: 556196142188 (55 + DDD + 8 dígitos)
 */
function formatPhoneNumber(phone: string): string {
  // Se já tem @c.us, retorna como está
  if (phone.includes('@c.us')) {
    return phone;
  }
  
  // Remove espaços, hífens, parênteses e caracteres especiais
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '').replace(/[^\d]/g, '');
  
  // Validar que tem apenas dígitos
  if (cleaned.length === 0) {
    console.warn(`⚠️ Phone number is empty after cleaning: "${phone}"`);
    return `${cleaned}@c.us`;
  }
  
  // Log inicial para debug
  console.log(`📱 Formatting phone number: "${phone}" -> cleaned: "${cleaned}" (${cleaned.length} digits)`);
  
  // Número sem código de país (assumir Brasil e adicionar 55)
  if (cleaned.length === 11) {
    // DDD (2) + 9 dígitos -> adicionar 55 e remover o 9º (índice 2)
    // Exemplo: 15991775589 -> 55 + 15 + 91775589
    const ddd = cleaned.slice(0, 2);
    // Remover o 9º dígito (índice 2) e pegar apenas os 8 dígitos restantes
    const numberWithout9 = cleaned.slice(3); // Remove DDD + 9º dígito, pega os 8 dígitos
    cleaned = '55' + ddd + numberWithout9; // 55 + DDD + 8 dígitos = 12 dígitos
    console.log(`📱 Added 55 and removed 9th digit from "${phone}": ${cleaned}@c.us`);
    return `${cleaned}@c.us`;
  }
  
  if (cleaned.length === 10) {
    // DDD (2) + 8 dígitos -> adicionar 55
    cleaned = '55' + cleaned;
    console.log(`📱 Added 55 to number: ${cleaned}@c.us`);
    return `${cleaned}@c.us`;
  }
  
  // BRASIL: Números brasileiros (código 55)
  if (cleaned.startsWith('55')) {
    // SEMPRE verificar se tem 13 dígitos e remover o 9º dígito
    // Formato: 55 + DDD (2) + 9 dígitos -> remover o dígito no índice 4 (9º dígito)
    if (cleaned.length === 13) {
      // Exemplo: 5515991775589 -> 5515 (55+DDD) + 91775589 (sem o 9º)
      const countryDDD = cleaned.slice(0, 4); // 55 + DDD (índices 0-3)
      const numberWithout9 = cleaned.slice(5); // Pula índice 4 (9º dígito) e pega o resto
      const originalCleaned = cleaned;
      cleaned = countryDDD + numberWithout9;
      console.log(`📱 Formatted BR number (13->12): "${originalCleaned}" -> "${cleaned}" (removed 9th digit at index 4)`);
      return `${cleaned}@c.us`;
    }
    
    // 12 dígitos (55 + DDD + 8 dígitos) -> OK
    if (cleaned.length === 12) {
      console.log(`📱 Formatted BR number (12): ${cleaned}@c.us`);
      return `${cleaned}@c.us`;
    }
    
    // Outro tamanho com código 55 -> avisar mas aceitar
    console.warn(`⚠️ BR phone with unexpected length: ${cleaned} (${cleaned.length} digits from "${phone}")`);
    return `${cleaned}@c.us`;
  }
  
  // Outros países ou casos não tratados
  console.warn(`⚠️ Phone number with unexpected format: ${cleaned} (${cleaned.length} digits from "${phone}")`);
  return `${cleaned}@c.us`;
}

/**
 * Gera ambos os formatos de número (com e sem 9 extra)
 */
function generateBothFormats(phone: string): string[] {
  const formatted = formatPhoneNumber(phone);
  const withoutSuffix = formatted.replace('@c.us', '');
  
  // Se já tem 12 dígitos (sem 9 extra), gerar também com 9 extra
  if (withoutSuffix.length === 12 && withoutSuffix.startsWith('55')) {
    // 551591775589 -> 5515991775589 (adicionar 9 após DDD)
    const countryDDD = withoutSuffix.slice(0, 4); // 55 + DDD
    const numberPart = withoutSuffix.slice(4); // 8 dígitos
    const with9Extra = countryDDD + '9' + numberPart + '@c.us';
    
    return [formatted, with9Extra]; // [sem 9, com 9]
  }
  
  // Se já tem 13 dígitos (com 9 extra), gerar também sem 9 extra
  if (withoutSuffix.length === 13 && withoutSuffix.startsWith('55')) {
    // 5515991775589 -> 551591775589 (remover 9 após DDD)
    const countryDDD = withoutSuffix.slice(0, 4); // 55 + DDD
    const numberPart = withoutSuffix.slice(5); // pula o 9, pega 8 dígitos
    const without9 = countryDDD + numberPart + '@c.us';
    
    return [without9, formatted]; // [sem 9, com 9]
  }
  
  // Se não for brasileiro ou formato não reconhecido, retorna só o formatado
  return [formatted];
}

/**
 * Envia mensagem via Waapi (tenta ambos os formatos: com e sem 9 extra)
 */
export async function sendWhatsAppMessage(
  params: SendMessageParams,
  config: WaapiConfig
): Promise<SendMessageResult> {
  const chatIds = generateBothFormats(params.phone);
  
  console.log(`📱 Generated chatId formats: ${JSON.stringify(chatIds)}`);
  
  // Tentar enviar para todos os formatos
  const results = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      const url = `${config.apiUrl}/instances/${config.instanceId}/client/action/send-message`;
      
      const payload = {
        chatId,
        message: params.message,
      };
      
      console.log(`📤 Attempting to send to: ${chatId}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return {
        chatId,
        messageId: data.id || data.messageId,
        data,
      };
    })
  );

  // Verificar se pelo menos um funcionou
  const successful = results.find((r) => r.status === 'fulfilled');
  
  if (successful && successful.status === 'fulfilled') {
    console.log(`✅ Message sent successfully to: ${successful.value.chatId}`);
    return {
      success: true,
      messageId: successful.value.messageId,
    };
  }

  // Se nenhum funcionou, retornar erro
  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => r.status === 'rejected' ? r.reason?.message || 'Unknown error' : '')
    .join('; ');
  
  console.error(`❌ Failed to send to all formats. Errors: ${errors}`);
  return {
    success: false,
    error: `Failed to send to all formats: ${errors}`,
  };
}

/**
 * Envia mensagem com retry automático
 */
export async function sendWhatsAppMessageWithRetry(
  params: SendMessageParams,
  config: WaapiConfig,
  maxRetries: number = 3
): Promise<SendMessageResult> {
  let lastError: string = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Sending WhatsApp to ${params.phone} (attempt ${attempt}/${maxRetries})`);
    
    const result = await sendWhatsAppMessage(params, config);
    
    if (result.success) {
      return result;
    }

    lastError = result.error || 'Unknown error';
    
    // Se não for o último retry, espera antes de tentar novamente
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: `Failed after ${maxRetries} attempts. Last error: ${lastError}`,
  };
}

/**
 * Cria cliente Waapi com configuração
 */
export function createWaapiClient(env: Record<string, string>) {
  const config: WaapiConfig = {
    apiUrl: env.WAAPI_API_URL || 'https://waapi.app/api/v1',
    instanceId: env.WAAPI_INSTANCE_ID || '',
    token: env.WAAPI_TOKEN || '',
  };

  // Validar configuração
  if (!config.instanceId) {
    throw new Error('WAAPI_INSTANCE_ID is not configured');
  }
  if (!config.token) {
    throw new Error('WAAPI_TOKEN is not configured');
  }

  return {
    sendMessage: (params: SendMessageParams) => 
      sendWhatsAppMessageWithRetry(params, config),
    sendMessageSimple: (params: SendMessageParams) => 
      sendWhatsAppMessage(params, config),
  };
}

