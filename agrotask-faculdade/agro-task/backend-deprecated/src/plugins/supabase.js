import fp from "fastify-plugin";
import { createClient } from "@supabase/supabase-js";

async function supabasePlugin(fastify) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  fastify.decorate("supabase", supabase);

  // Helper function to verify JWT token
  fastify.decorate("verifyToken", async function(token) {
    try {
      console.log('🔐 Verifying token with Supabase...');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error) {
        console.log('❌ Supabase auth error:', error.message);
        throw new Error(`Supabase error: ${error.message}`);
      }
      
      if (!user) {
        console.log('❌ No user returned from Supabase');
        throw new Error('No user found');
      }

      console.log('✅ User verified:', user.email);
      return user;
    } catch (error) {
      console.log('❌ Token verification exception:', error.message);
      throw new Error(`Token verification failed: ${error.message}`);
    }
  });
}

export default fp(supabasePlugin);

