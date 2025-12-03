async function authRoutes(fastify) {
  // Login route
  fastify.post("/auth/login", async (request, reply) => {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.status(400).send({
          success: false,
          error: 'Email and password are required'
        });
      }

      console.log(email, password);

      // Authenticate with Supabase
      const { data: authData, error: authError } = await fastify.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid credentials'
        });
      }
      console.log(authData);
      console.log(authError);

      // Check if admin account exists for this user
      const adminAccount = await fastify.prisma.adminAccount.findUnique({
        where: { id: authData.user.id },
      });

      if (!adminAccount) {
        return reply.status(403).send({
          success: false,
          error: 'Access denied. Admin privileges required.'
        });
      }


      return {
        success: true,
        data: {
          user: {
            id: adminAccount.id,
            name: adminAccount.name,
            email: adminAccount.email,
            isAdmin: true
          },
          adminAccount: {
            id: adminAccount.id,
            temporaryPassword: adminAccount.temporaryPassword
          },
          session: {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            expires_at: authData.session.expires_at
          }
        }
      };

    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Register route (create user only)
  fastify.post("/auth/register", async (request, reply) => {
    try {
      const { name, email, password, phone, description } = request.body;

      if (!name || !email || !password) {
        return reply.status(400).send({
          success: false,
          error: 'Name, email and password are required'
        });
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await fastify.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name
        }
      });

      if (authError) {
        return reply.status(400).send({
          success: false,
          error: authError.message
        });
      }

      // Create user in our database
      const user = await fastify.prisma.user.create({
        data: {
          id: authData.user.id,
          name,
          email,
          phone: phone || null,
          description: description || null,
          tags: [],
          status: 'active'
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          description: true,
          status: true
        }
      });

      return {
        success: true,
        data: {
          user,
          message: 'User created successfully'
        }
      };

    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Logout route
  fastify.post("/auth/logout", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: 'No token provided'
        });
      }

      const token = authHeader.substring(7);
      
      // Sign out from Supabase
      await fastify.supabase.auth.admin.signOut(token);

      return {
        success: true,
        message: 'Logged out successfully'
      };

    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Refresh token route
  fastify.post("/auth/refresh", async (request, reply) => {
    try {
      const { refresh_token } = request.body;

      if (!refresh_token) {
        return reply.status(400).send({
          success: false,
          error: 'Refresh token is required'
        });
      }

      // Refresh session with Supabase
      const { data: authData, error: authError } = await fastify.supabase.auth.refreshSession({
        refresh_token
      });

      if (authError || !authData.session) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      // Verify admin account exists
      const adminAccount = await fastify.prisma.adminAccount.findUnique({
        where: { id: authData.user.id },
        select: {
          id: true,
          name: true,
          email: true,
        }
      });

      if (!adminAccount) {
        return reply.status(403).send({
          success: false,
          error: 'Admin account not found'
        });
      }

      return {
        success: true,
        data: {
          user: {
            id: adminAccount.id,
            name: adminAccount.name,
            email: adminAccount.email,
            isAdmin: true
          },
          session: {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            expires_at: authData.session.expires_at
          }
        }
      };

    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Verify token route (optimized with caching support)
  fastify.get("/auth/me", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: 'No token provided'
        });
      }

      const token = authHeader.substring(7);
      const supabaseUser = await fastify.verifyToken(token);
      
      // Get admin account from our database
      // This is still needed but will be cached on frontend
      const adminAccount = await fastify.prisma.adminAccount.findUnique({
        where: { id: supabaseUser.id },
        select: {
          id: true,
          name: true,
          email: true,
        }
      });

      if (!adminAccount) {
        return reply.status(404).send({
          success: false,
          error: 'Admin account not found'
        });
      }

      return {
        success: true,
        data: { 
          user: {
            id: adminAccount.id,
            name: adminAccount.name,
            email: adminAccount.email,
            isAdmin: true
          }
        }
      };

    } catch (error) {
      fastify.log.error(error);
      reply.status(401).send({
        success: false,
        error: 'Invalid token'
      });
    }
  });

  // Password reset request route
  fastify.post("/auth/password-reset", async (request, reply) => {
    try {
      const { email } = request.body;

      if (!email) {
        return reply.status(400).send({
          success: false,
          error: 'Email is required'
        });
      }

      // Get redirect URL from environment variable or use default
      const redirectUrl = process.env.PASSWORD_RESET_REDIRECT_URL || 'http://localhost:5173/reset-senha';

      // Send password reset email via Supabase
      const { error: resetError } = await fastify.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      // Always return success message (don't reveal if email exists)
      // This is a security best practice
      return {
        success: true,
        data: {
          message: 'If the email exists, a password reset link has been sent'
        }
      };

    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Password reset update route
  fastify.post("/auth/reset-password", async (request, reply) => {
    try {
      const { token, password } = request.body;

      if (!token || !password) {
        return reply.status(400).send({
          success: false,
          error: 'Token and password are required'
        });
      }

      if (password.length < 6) {
        return reply.status(400).send({
          success: false,
          error: 'Password must be at least 6 characters'
        });
      }

      // Verify token and get user
      const supabaseUser = await fastify.verifyToken(token);
      
      // Check if admin account exists
      const adminAccount = await fastify.prisma.adminAccount.findUnique({
        where: { id: supabaseUser.id },
      });

      if (!adminAccount) {
        return reply.status(403).send({
          success: false,
          error: 'Admin account not found'
        });
      }

      // Update password using Supabase Auth
      const { error: updateError } = await fastify.supabase.auth.admin.updateUserById(
        supabaseUser.id,
        { password }
      );

      if (updateError) {
        return reply.status(400).send({
          success: false,
          error: updateError.message || 'Failed to update password'
        });
      }

      return {
        success: true,
        data: {
          message: 'Password updated successfully'
        }
      };

    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}

export default authRoutes;

