// Authentication middleware
export const requireAuth = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    console.log('🔍 Auth Header:', authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : 'None');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid auth header found');
      return reply.status(401).send({
        success: false,
        error: 'Authentication required'
      });
    }

    const token = authHeader.substring(7);
    console.log('🎫 Token length:', token.length);
    console.log('🎫 Token preview:', token.substring(0, 20) + '...');
    
    // Verify token with Supabase - if token is valid, user is admin
    const supabaseUser = await request.server.verifyToken(token);
    console.log('✅ Token verified successfully for user:', supabaseUser.email);

    // Add user info to request
    request.user = {
      id: supabaseUser.id,
      email: supabaseUser.email
    };

  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    return reply.status(401).send({
      success: false,
      error: 'Invalid token'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabaseUser = await request.server.verifyToken(token);
      
      request.user = {
        id: supabaseUser.id,
        email: supabaseUser.email
      };
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
  }
};

