import { requireAuth } from "../middleware/auth.js";

async function activityRoutes(fastify) {
  // Get all activities with users
  fastify.get("/activities", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const activities = await fastify.prisma.activity.findMany({
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true
                }
              }
            }
          },
          messageTemplate: {
            select: {
              id: true,
              name: true,
              templateBody: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return { success: true, data: activities };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch activities'
      });
    }
  });

  // Toggle canceled status: if currently canceled, reactivate with computed status; otherwise cancel
  fastify.post("/activities/:id/toggle-canceled", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;

      const activity = await fastify.prisma.activity.findUnique({
        where: { id }
      });

      if (!activity) {
        return reply.status(404).send({ success: false, error: 'Activity not found' });
      }

      // If not canceled, set to canceled
      if (activity.status !== 'canceled') {
        const updated = await fastify.prisma.activity.update({
          where: { id },
          data: { status: 'canceled' }
        });
        return { success: true, data: updated };
      }

      // Reactivate: decide between completed or pending
      const now = new Date();
      let newStatus = 'pending';

      if (!activity.isRepeating) {
        // Non-repeating: if scheduledDate is in the past -> completed
        if (activity.scheduledDate && activity.scheduledDate < now) {
          newStatus = 'completed';
        } else {
          newStatus = 'pending';
        }
      } else {
        // Repeating
        if (activity.repeatEndType === 'never') {
          newStatus = 'pending';
        } else if (activity.repeatEndType === 'date') {
          if (activity.repeatEndDate && activity.repeatEndDate < now) {
            newStatus = 'completed';
          } else {
            newStatus = 'pending';
          }
        } else if (activity.repeatEndType === 'occurrences' && activity.repeatOccurrences) {
          const schedTime = activity.scheduledTime || null;
          const pad = (n) => String(n).padStart(2, '0');
          const applyTime = (d) => {
            if (!schedTime) return d;
            const [hh, mm] = schedTime.split(':').map(Number);
            const dd = new Date(d);
            dd.setHours(hh || 0, mm || 0, 0, 0);
            return dd;
          };

          if (activity.repeatUnit === 'day') {
            const start = activity.repeatStartDate ? new Date(activity.repeatStartDate) : null;
            if (start) {
              const last = new Date(start);
              const intervalDays = activity.repeatInterval || 1;
              last.setDate(last.getDate() + intervalDays * (activity.repeatOccurrences - 1));
              const lastWithTime = applyTime(last);
              newStatus = lastWithTime < now ? 'completed' : 'pending';
            } else {
              newStatus = 'pending';
            }
          } else if (activity.repeatUnit === 'week') {
            const start = activity.repeatStartDate ? new Date(activity.repeatStartDate) : null;
            const days = Array.isArray(activity.repeatDaysOfWeek) ? activity.repeatDaysOfWeek.slice().sort((a,b)=>a-b) : [];
            const intervalWeeks = activity.repeatInterval || 1;
            if (start && days.length > 0 && activity.repeatOccurrences > 0) {
              // normalize to Monday-based week (0=Segunda ... 6=Domingo)
              const normalizeToMonday = (date) => {
                const jsDay = date.getDay(); // 0=Sun..6=Sat
                const mondayOffset = (jsDay + 6) % 7; // 0->Sun -> 6, 1->Mon -> 0
                const monday = new Date(date);
                monday.setDate(monday.getDate() - mondayOffset);
                monday.setHours(0,0,0,0);
                return monday;
              };

              const baseMonday = normalizeToMonday(start);
              const occurrences = [];
              let weekIndex = 0;
              while (occurrences.length < activity.repeatOccurrences && weekIndex < 10000) {
                const thisWeekMonday = new Date(baseMonday);
                thisWeekMonday.setDate(thisWeekMonday.getDate() + weekIndex * 7 * intervalWeeks);
                for (const d of days) {
                  const occ = new Date(thisWeekMonday);
                  occ.setDate(occ.getDate() + d);
                  occurrences.push(applyTime(occ));
                  if (occurrences.length >= activity.repeatOccurrences) break;
                }
                weekIndex++;
              }
              const last = occurrences[occurrences.length - 1];
              newStatus = last && last < now ? 'completed' : 'pending';
            } else {
              newStatus = 'pending';
            }
          } else {
            newStatus = 'pending';
          }
        } else {
          newStatus = 'pending';
        }
      }

      const updated = await fastify.prisma.activity.update({
        where: { id },
        data: { status: newStatus }
      });

      return { success: true, data: updated };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ success: false, error: 'Failed to toggle activity' });
    }
  });

  // Get activity by ID
  fastify.get("/activities/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;
      const activity = await fastify.prisma.activity.findUnique({
        where: { id },
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true
                }
              }
            }
          },
          messageTemplate: {
            select: {
              id: true,
              name: true,
              templateBody: true
            }
          }
        }
      });

      if (!activity) {
        return reply.status(404).send({
          success: false,
          error: 'Activity not found'
        });
      }

      return { success: true, data: activity };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch activity'
      });
    }
  });

  // Create activity
  fastify.post("/activities", { preHandler: requireAuth }, async (request, reply) => {
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
        messageTemplateId,
        customMessage,
        messageString,
        roles, // Array of role strings (renamed from tags)
        userIds // Array of user IDs
      } = request.body;

      // Validate required fields
      if (!title) {
        return reply.status(400).send({
          success: false,
          error: 'Title is required'
        });
      }

      // Validate that there's a message (template, custom, or description)
      if (!messageTemplateId && !customMessage && !description) {
        return reply.status(400).send({
          success: false,
          error: 'Activity must have a description or message (template/custom)'
        });
      }

      // Validate date/time based on isRepeating
      if (isRepeating) {
        // For daily tasks, start date is required
        if (repeatUnit === 'day' && !repeatStartDate) {
          return reply.status(400).send({
            success: false,
            error: 'Start date is required for daily repeating tasks'
          });
        }
        // For weekly tasks, days of week are required
        if (repeatUnit === 'week' && (!repeatDaysOfWeek || repeatDaysOfWeek.length === 0)) {
          return reply.status(400).send({
            success: false,
            error: 'Days of week are required for weekly repeating tasks'
          });
        }
      } else {
        if (!scheduledDate) {
          return reply.status(400).send({
            success: false,
            error: 'Scheduled date is required for non-repeating tasks'
          });
        }
      }

      // Create activity with users
      const activity = await fastify.prisma.activity.create({
        data: {
          title,
          description: description || null,
          status: status || 'pending',
          isRepeating: isRepeating || false,
          repeatInterval: isRepeating ? (repeatInterval || 1) : 1,
          repeatUnit: isRepeating ? (repeatUnit || 'day') : 'day',
          repeatStartDate: isRepeating && repeatStartDate ? new Date(repeatStartDate) : null,
          repeatEndType: isRepeating ? (repeatEndType || 'never') : 'never',
          repeatEndDate: isRepeating && repeatEndDate ? new Date(repeatEndDate) : null,
          repeatOccurrences: isRepeating ? (repeatOccurrences || null) : null,
          repeatDaysOfWeek: isRepeating && repeatDaysOfWeek ? repeatDaysOfWeek : [],
          // Accept scheduledDate for both non-repeating and repeating (redundant allowed)
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          // Always persist scheduledTime if provided
          scheduledTime: scheduledTime || null,
          messageTemplateId: messageTemplateId || null,
          customMessage: customMessage || null,
          messageString: messageString || null,
          roles: roles || [],
          users: {
            create: userIds && userIds.length > 0
              ? userIds.map(userId => ({ userId }))
              : []
          }
        },
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true
                }
              }
            }
          },
          messageTemplate: true
        }
      });

      return { success: true, data: activity };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        success: false,
        error: 'Failed to create activity'
      });
    }
  });

  // Update activity
  fastify.put("/activities/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;
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
        messageTemplateId,
        customMessage,
        messageString,
        roles,
        userIds
      } = request.body;

      // Load existing activity to detect scheduling changes
      const existing = await fastify.prisma.activity.findUnique({
        where: { id },
        select: {
          status: true,
          scheduledDate: true,
          scheduledTime: true
        }
      });

      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Activity not found' });
      }

      // Build update data
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
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
      if (messageTemplateId !== undefined) updateData.messageTemplateId = messageTemplateId;
      if (customMessage !== undefined) updateData.customMessage = customMessage;
      if (messageString !== undefined) updateData.messageString = messageString;
      if (roles !== undefined) updateData.roles = roles;

      // Detect scheduling change
      const existingDateIso = existing.scheduledDate ? existing.scheduledDate.toISOString() : null;
      const newDateIso = scheduledDate !== undefined ? (scheduledDate ? new Date(scheduledDate).toISOString() : null) : existingDateIso;
      const dateChanged = newDateIso !== existingDateIso;
      const timeChanged = scheduledTime !== undefined ? (existing.scheduledTime !== scheduledTime) : false;

      // If rescheduling and status was completed, force status back to pending
      if ((dateChanged || timeChanged) && existing.status === 'completed') {
        updateData.status = 'pending';
      }

      // Update users if provided
      if (userIds !== undefined) {
        // Delete existing relations
        await fastify.prisma.activityUsers.deleteMany({
          where: { activityId: id }
        });

        // Create new relations
        if (userIds.length > 0) {
          await fastify.prisma.activityUsers.createMany({
            data: userIds.map(userId => ({
              activityId: id,
              userId
            }))
          });
        }
      }

      // Update activity
      const activity = await fastify.prisma.activity.update({
        where: { id },
        data: updateData,
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true
                }
              }
            }
          },
          messageTemplate: true
        }
      });

      return { success: true, data: activity };
    } catch (error) {
      fastify.log.error(error);

      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          error: 'Activity not found'
        });
      }

      reply.status(500).send({
        success: false,
        error: 'Failed to update activity'
      });
    }
  });

  // Delete activity
  fastify.delete("/activities/:id", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Delete activity (cascade will delete ActivityUsers)
      await fastify.prisma.activity.delete({
        where: { id }
      });

      return { success: true, message: 'Activity deleted successfully' };
    } catch (error) {
      fastify.log.error(error);

      if (error.code === 'P2025') {
        return reply.status(404).send({
          success: false,
          error: 'Activity not found'
        });
      }

      reply.status(500).send({
        success: false,
        error: 'Failed to delete activity'
      });
    }
  });
}

export default activityRoutes;
  