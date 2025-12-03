import { corsHeaders, handleCors as corsHandler } from './cors.ts'

export const handleCors = corsHandler

export const ok = (data: any, status = 200) => {
  return new Response(
    JSON.stringify({ success: true, data }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

export const err = (error: string, status = 500) => {
  return new Response(
    JSON.stringify({ success: false, error }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

