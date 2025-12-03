import { requireAuth } from "../middleware/auth.js";

async function userRoutes(fastify) {
  // Helpers: Basic validations for BR phone and email
  const digitsOnly = (s) => s.replace(/\D+/g, "")
  const formatBrazilPhone = (digits) => {
    const d = digits.slice(0, 11)
    const part1 = d.slice(0, 2)
    const part2 = d.slice(2, 7)
    const part3 = d.slice(7, 11)
    let out = ""
    if (part1) out += `(${part1}`
    if (part1 && part1.length === 2) out += ") "
    if (part2) out += part2
    if (part3) out += `-${part3}`
    return out
  }
  const validateBrazilPhone = (value) => {
    if (value == null || value === "") return null
    if (/[^\d()\s-]/.test(value)) return "Caracteres não numéricos"
    const d = digitsOnly(value)
    if (d.length < 11) return "Número incompleto"
    if (!/^\d{11}$/.test(d)) return "Formato inválido"
    return null
  }
  const normalizeBrazilPhone = (value) => {
    const d = digitsOnly(value)
    return formatBrazilPhone(d)
  }
  const validateEmail = (value) => {
    if (value == null || value === "") return null
    const trimmed = String(value).trim()
    if (/[\s]/.test(trimmed)) return "Email não pode conter espaços"
    if (!trimmed.includes("@")) return "Falta @ no email"
    const parts = trimmed.split("@")
    if (parts.length !== 2 || !parts[1]) return "Falta domínio após @"
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    if (!emailRegex.test(trimmed)) return "Formato de email inválido"
    return null
  }
  // Get all users
  fastify.get("/users", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const users = await fastify.prisma.user.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          description: true,
          tags: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      return { success: true, data: users };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch users' 
      });
    }
  });

  // Get user by ID
  fastify.get("/users/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;
      const user = await fastify.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          description: true,
          tags: true,
          status: true,
          createdAt: true,
        }
      });

      if (!user) {
        return reply.status(404).send({ 
          success: false, 
          error: 'User not found' 
        });
      }

      return { success: true, data: user };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch user' 
      });
    }
  });

  // Create user
  fastify.post("/users", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { name, phone, email, description, tags } = request.body;
      
      // Validate required fields
      if (!name) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Name is required' 
        });
      }

      // Server-side validations
      const phoneErr = validateBrazilPhone(phone)
      if (phoneErr) {
        return reply.status(400).send({ success: false, error: `Celular inválido: ${phoneErr}` })
      }
      const emailErr = validateEmail(email)
      if (emailErr) {
        return reply.status(400).send({ success: false, error: `Email inválido: ${emailErr}` })
      }

      const userData = {
        name,
        phone: phone ? normalizeBrazilPhone(phone) : null,
        email: email || null,
        description: description || null,
        tags: tags || [],
      };

      const user = await fastify.prisma.user.create({
        data: userData,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          description: true,
          tags: true,
          status: true,
          createdAt: true,
        }
      });

      return { success: true, data: user };
    } catch (error) {
      fastify.log.error(error);
      
      // Handle unique constraint violations
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        return reply.status(400).send({ 
          success: false, 
          error: `${field} already exists` 
        });
      }
      
      reply.status(500).send({ 
        success: false, 
        error: 'Failed to create user' 
      });
    }
  });

  // Update user
  fastify.put("/users/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, phone, email, description, tags, status } = request.body;

      // Server-side validations when fields provided
      if (phone !== undefined) {
        const phoneErr = validateBrazilPhone(phone)
        if (phoneErr) {
          return reply.status(400).send({ success: false, error: `Celular inválido: ${phoneErr}` })
        }
      }
      if (email !== undefined) {
        const emailErr = validateEmail(email)
        if (emailErr) {
          return reply.status(400).send({ success: false, error: `Email inválido: ${emailErr}` })
        }
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone ? normalizeBrazilPhone(phone) : null;
      if (email !== undefined) updateData.email = email;
      if (description !== undefined) updateData.description = description;
      if (tags !== undefined) updateData.tags = tags;
      if (status !== undefined) updateData.status = status;

      const user = await fastify.prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          description: true,
          tags: true,
          status: true,
          createdAt: true,
        }
      });

      return { success: true, data: user };
    } catch (error) {
      fastify.log.error(error);
      
      if (error.code === 'P2025') {
        return reply.status(404).send({ 
          success: false, 
          error: 'User not found' 
        });
      }
      
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        return reply.status(400).send({ 
          success: false, 
          error: `${field} already exists` 
        });
      }
      
      reply.status(500).send({ 
        success: false, 
        error: 'Failed to update user' 
      });
    }
  });

  // Delete user
  fastify.delete("/users/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;


      await fastify.prisma.user.delete({
        where: { id }
      });

      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      fastify.log.error(error);
      
      if (error.code === 'P2025') {
        return reply.status(404).send({ 
          success: false, 
          error: 'User not found' 
        });
      }
      
      reply.status(500).send({ 
        success: false, 
        error: 'Failed to delete user' 
      });
    }
  });
}

export default userRoutes;
  