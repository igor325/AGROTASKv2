import { requireAuth } from "../middleware/auth.js";

async function workShiftRoutes(fastify) {
  // Get all work shifts
  fastify.get("/work-shifts", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const workShifts = await fastify.prisma.workShift.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });

      return { success: true, data: workShifts };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch work shifts'
      });
    }
  });

  // Get work shift by ID
  fastify.get("/work-shifts/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;
      const workShift = await fastify.prisma.workShift.findUnique({
        where: { id }
      });

      if (!workShift) {
        return reply.status(404).send({
          success: false,
          error: 'Work shift not found'
        });
      }

      return { success: true, data: workShift };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch work shift'
      });
    }
  });

  // Create work shift
  fastify.post("/work-shifts", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const {
        startTime,
        endTime,
        alertMinutesBefore,
        startMessageString,
        endMessageString,
      } = request.body;

      // Validate required fields
      if (!startTime || !endTime) {
        return reply.status(400).send({
          success: false,
          error: 'Start time and end time are required'
        });
      }

      // Create work shift
      const workShift = await fastify.prisma.workShift.create({
        data: {
          startTime: startTime, // Store as HH:MM string
          endTime: endTime,     // Store as HH:MM string
          alertMinutesBefore: alertMinutesBefore || 0,
          startMessageString: startMessageString || null,
          endMessageString: endMessageString || null,
        }
      });

      return { success: true, data: workShift };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to create work shift'
      });
    }
  });

  // Update work shift
  fastify.put("/work-shifts/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;
      const {
        startTime,
        endTime,
        alertMinutesBefore,
        startMessageString,
        endMessageString,
      } = request.body;

      // Build update data
      const updateData = {};
      if (startTime !== undefined) updateData.startTime = startTime; // Store as HH:MM string
      if (endTime !== undefined) updateData.endTime = endTime;       // Store as HH:MM string
      if (alertMinutesBefore !== undefined) updateData.alertMinutesBefore = alertMinutesBefore;
      if (startMessageString !== undefined) updateData.startMessageString = startMessageString;
      if (endMessageString !== undefined) updateData.endMessageString = endMessageString;

      // Update work shift
      const workShift = await fastify.prisma.workShift.update({
        where: { id },
        data: updateData
      });

      return { success: true, data: workShift };
    } catch (error) {
      fastify.log.error(error);

      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          error: 'Work shift not found'
        });
      }

      reply.status(500).send({
        success: false,
        error: 'Failed to update work shift'
      });
    }
  });

  // Delete work shift
  fastify.delete("/work-shifts/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;

      await fastify.prisma.workShift.delete({
        where: { id }
      });

      return { success: true, message: 'Work shift deleted successfully' };
    } catch (error) {
      fastify.log.error(error);

      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          error: 'Work shift not found'
        });
      }

      reply.status(500).send({
        success: false,
        error: 'Failed to delete work shift'
      });
    }
  });
}

export default workShiftRoutes;

