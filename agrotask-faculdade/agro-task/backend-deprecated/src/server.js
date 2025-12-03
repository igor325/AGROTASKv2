import Fastify from "fastify";
import dotenv from "dotenv";
import cors from "@fastify/cors";

import prismaPlugin from "./plugins/prisma.js";
import supabasePlugin from "./plugins/supabase.js";
import userRoutes from "./routes/users.js";
import activityRoutes from "./routes/activities.js";
import authRoutes from "./routes/auth.js";
import adminReminderRoutes from "./routes/adminReminders.js";
import workShiftRoutes from "./routes/workShifts.js";
import messageTemplateRoutes from "./routes/messageTemplates.js";
import waapiRoutes from "./routes/waapi.js";

dotenv.config();

const app = Fastify({ logger: true });

// Allow empty JSON bodies for DELETE requests
app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    const json = body === '' ? {} : JSON.parse(body);
    done(null, json);
  } catch (err) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// Register CORS
app.register(cors, {
  origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "http://localhost:8081", "http://0.0.0.0:3000", "http://0.0.0.0:3001"],
  credentials: true
});

// Register plugins
app.register(prismaPlugin);
app.register(supabasePlugin);

// Register routes
app.register(authRoutes);
app.register(userRoutes);
app.register(activityRoutes);
app.register(adminReminderRoutes);
app.register(workShiftRoutes);
app.register(messageTemplateRoutes);
app.register(waapiRoutes);

app.get("/", async () => {
  return { status: "ok", message: "AgroTask API with Supabase 🚀" };
});

const start = async () => {
  try {
    await app.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
    console.log("✅ Server running at http://localhost:3000");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
