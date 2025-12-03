import { requireAuth } from "../middleware/auth.js";

async function waapiRoutes(fastify) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fastify.log.warn('Supabase configuration missing. WaAPI routes may not work.');
  }

  // Helper to call Supabase Edge Function
  const callEdgeFunction = async (request, functionName, method = 'GET', body = null) => {
    const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
    const authHeader = request.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`;
    
    const options = {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Edge function error: ${response.status}`);
    }

    return data;
  };

  // GET /waapi/status
  fastify.get("/waapi/status", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await callEdgeFunction(request, 'waapi/status', 'GET');
      return { success: true, data };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to fetch status' 
      });
    }
  });

  // GET /waapi/me
  fastify.get("/waapi/me", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await callEdgeFunction(request, 'waapi/me', 'GET');
      return { success: true, data };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to fetch client info' 
      });
    }
  });

  // GET /waapi/qr
  fastify.get("/waapi/qr", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await callEdgeFunction(request, 'waapi/qr', 'GET');
      return { success: true, data };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to fetch QR code' 
      });
    }
  });

  // POST /waapi/logout
  fastify.post("/waapi/logout", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await callEdgeFunction(request, 'waapi/logout', 'POST');
      return { success: true, data };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to logout' 
      });
    }
  });

  // POST /waapi/reboot
  fastify.post("/waapi/reboot", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await callEdgeFunction(request, 'waapi/reboot', 'POST');
      return { success: true, data };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ 
        success: false, 
        error: error.message || 'Failed to reboot' 
      });
    }
  });
}

export default waapiRoutes;

