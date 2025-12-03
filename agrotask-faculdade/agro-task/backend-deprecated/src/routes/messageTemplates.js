import { requireAuth } from "../middleware/auth.js";

async function messageTemplateRoutes(fastify) {
  // Get all templates
  fastify.get("/message-templates", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const templates = await fastify.prisma.messageTemplate.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });

      return { success: true, data: templates };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch message templates'
      });
    }
  });

  // Get template by ID
  fastify.get("/message-templates/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;
      const template = await fastify.prisma.messageTemplate.findUnique({
        where: { id }
      });

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found'
        });
      }

      return { success: true, data: template };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch template'
      });
    }
  });

  // Create template
  fastify.post("/message-templates", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { name, category, templateBody } = request.body;

      // Validate required fields
      if (!name || !category || !templateBody) {
        return reply.status(400).send({
          success: false,
          error: 'Name, category, and template body are required'
        });
      }

      const template = await fastify.prisma.messageTemplate.create({
        data: {
          name,
          category,
          templateBody
        }
      });

      return { success: true, data: template };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to create template'
      });
    }
  });

  // Update template
  fastify.put("/message-templates/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, category, templateBody } = request.body;

      // Build update data
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (category !== undefined) updateData.category = category;
      if (templateBody !== undefined) updateData.templateBody = templateBody;

      const template = await fastify.prisma.messageTemplate.update({
        where: { id },
        data: updateData
      });

      return { success: true, data: template };
    } catch (error) {
      fastify.log.error(error);

      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          error: 'Template not found'
        });
      }

      reply.status(500).send({
        success: false,
        error: 'Failed to update template'
      });
    }
  });

  // Delete template
  fastify.delete("/message-templates/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Check if template is being used by any activities
      const activitiesUsingTemplate = await fastify.prisma.activity.count({
        where: { messageTemplateId: id }
      });

      if (activitiesUsingTemplate > 0) {
        return reply.status(400).send({
          success: false,
          error: `Cannot delete template. It is being used by ${activitiesUsingTemplate} activity(ies)`
        });
      }

      await fastify.prisma.messageTemplate.delete({
        where: { id }
      });

      return { success: true, message: 'Template deleted successfully' };
    } catch (error) {
      fastify.log.error(error);

      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          error: 'Template not found'
        });
      }

      reply.status(500).send({
        success: false,
        error: 'Failed to delete template'
      });
    }
  });
}

export default messageTemplateRoutes;

