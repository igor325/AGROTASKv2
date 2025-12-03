import { requireAuth } from "../middleware/auth.js";

async function adminReminderRoutes(fastify) {
  // Get all admin reminders
  fastify.get("/admin-reminders", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const reminders = await fastify.prisma.adminReminder.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });

      return { success: true, data: reminders };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch admin reminders'
      });
    }
  });

  // Get admin reminder by ID
  fastify.get("/admin-reminders/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;
      const reminder = await fastify.prisma.adminReminder.findUnique({
        where: { id }
      });

      if (!reminder) {
        return reply.status(404).send({
          success: false,
          error: 'Admin reminder not found'
        });
      }

      return { success: true, data: reminder };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch admin reminder'
      });
    }
  });

  // Create admin reminder
  fastify.post("/admin-reminders", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const {
        title,
        description,
        status,
        isRepeating,
        repeatInterval,
        repeatUnit,
        repeatStartDate,
        repeatEndType,
        repeatEndDate,
        repeatOccurrences,
        repeatDaysOfWeek,
        scheduledDate,
        scheduledTime,
        messageString
      } = request.body;

      console.log('📥 Backend recebeu scheduledTime:', scheduledTime, 'scheduledDate:', scheduledDate);

      // Validate required fields
      if (!title) {
        return reply.status(400).send({
          success: false,
          error: 'Title is required'
        });
      }

      // Validate that there's a message (description or messageString)
      if (!description && !messageString) {
        return reply.status(400).send({
          success: false,
          error: 'Admin reminder must have a description or message'
        });
      }

      // Validate date/time based on isRepeating
      if (isRepeating) {
        // For daily tasks, start date is required
        if (repeatUnit === 'day' && !repeatStartDate) {
          return reply.status(400).send({
            success: false,
            error: 'Start date is required for daily repeating reminders'
          });
        }
        // For weekly tasks, days of week are required
        if (repeatUnit === 'week' && (!repeatDaysOfWeek || repeatDaysOfWeek.length === 0)) {
          return reply.status(400).send({
            success: false,
            error: 'Days of week are required for weekly repeating reminders'
          });
        }
      } else {
        if (!scheduledDate) {
          return reply.status(400).send({
            success: false,
            error: 'Scheduled date is required for non-repeating reminders'
          });
        }
      }

      // Create admin reminder
      const reminder = await fastify.prisma.adminReminder.create({
        data: {
          title,
          description: description || null,
          status: status || 'pending',
          isRepeating: isRepeating || false,
          repeatInterval: isRepeating ? (repeatInterval || 1) : null,
          repeatUnit: isRepeating ? (repeatUnit || 'day') : null,
          repeatStartDate: isRepeating && repeatStartDate ? new Date(repeatStartDate) : null,
          repeatEndType: isRepeating ? (repeatEndType || 'never') : null,
          repeatEndDate: isRepeating && repeatEndDate ? new Date(repeatEndDate) : null,
          repeatOccurrences: isRepeating ? (repeatOccurrences || null) : null,
          repeatDaysOfWeek: isRepeating && repeatDaysOfWeek ? repeatDaysOfWeek : [],
          // Accept scheduledDate for both non-repeating and repeating (redundant allowed)
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          // Always persist scheduledTime if provided
          scheduledTime: scheduledTime || null,
          messageString: messageString || null
        }
      });

      return { success: true, data: reminder };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to create admin reminder'
      });
    }
  });

  // Update admin reminder
  fastify.put("/admin-reminders/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;
      const {
        title,
        description,
        isRepeating,
        repeatInterval,
        repeatUnit,
        repeatStartDate,
        repeatEndType,
        repeatEndDate,
        repeatOccurrences,
        repeatDaysOfWeek,
        scheduledDate,
        scheduledTime,
        messageString,
        status // Adicionando status aos parâmetros
      } = request.body;

      // Build update data
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (isRepeating !== undefined) updateData.isRepeating = isRepeating;
      if (repeatInterval !== undefined) updateData.repeatInterval = repeatInterval;
      if (repeatUnit !== undefined) updateData.repeatUnit = repeatUnit;
      if (repeatStartDate !== undefined) updateData.repeatStartDate = repeatStartDate ? new Date(repeatStartDate) : null;
      if (repeatEndType !== undefined) updateData.repeatEndType = repeatEndType;
      if (repeatEndDate !== undefined) updateData.repeatEndDate = repeatEndDate ? new Date(repeatEndDate) : null;
      if (repeatOccurrences !== undefined) updateData.repeatOccurrences = repeatOccurrences;
      if (repeatDaysOfWeek !== undefined) updateData.repeatDaysOfWeek = repeatDaysOfWeek;
      if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;
      if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime;
      if (messageString !== undefined) updateData.messageString = messageString;
      if (status !== undefined) {
        // Validando se o status é válido
        const validStatuses = ['pending', 'completed', 'canceled'];
        if (!validStatuses.includes(status)) {
          return reply.status(400).send({
            success: false,
            error: 'Status inválido. Use: pending, completed ou canceled'
          });
        }
        updateData.status = status;
      }

      // Update reminder
      const reminder = await fastify.prisma.adminReminder.update({
        where: { id },
        data: updateData
      });

      return { success: true, data: reminder };
    } catch (error) {
      fastify.log.error(error);

      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          error: 'Admin reminder not found'
        });
      }

      reply.status(500).send({
        success: false,
        error: 'Failed to update admin reminder'
      });
    }
  });

  // Delete admin reminder
  fastify.delete("/admin-reminders/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;

      await fastify.prisma.adminReminder.delete({
        where: { id }
      });

      return { success: true, message: 'Admin reminder deleted successfully' };
    } catch (error) {
      fastify.log.error(error);

      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          error: 'Admin reminder not found'
        });
      }

      reply.status(500).send({
        success: false,
        error: 'Failed to delete admin reminder'
      });
    }
  });
}

export default adminReminderRoutes;

