import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { sequelize } from "./config/database";
import { initBlockchain } from "./config/blockchain";

// Force restart 33
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import electionRoutes from "./routes/election.routes";
import voteRoutes from "./routes/vote.routes";
import announcementRoutes from "./routes/announcement.routes";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/elections", electionRoutes);
app.use("/api/vote", voteRoutes);
app.use("/api/announcements", announcementRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  try {
    const contractsPath = require("path").join(__dirname, "config", "contracts.json");
    const contractsData = require("fs").readFileSync(contractsPath, "utf-8");
    const parsed = JSON.parse(contractsData);
    
    res.json({
      status: "ok",
      service: "VeriVote API",
      timestamp: new Date().toISOString(),
      contracts: {
        registry: parsed.contracts.VoterRegistry.address,
        main: parsed.contracts.VeriVoteMain.address
      }
    });
  } catch (err) {
    res.json({
      status: "ok",
      service: "VeriVote API",
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Sync models (create tables if not exist)
    await sequelize.sync({ alter: true });
    console.log("✅ Database synced");

    // Initialize blockchain connection
    await initBlockchain();
    console.log("✅ Blockchain connected");

    // Start auto-end election scheduler
    const { startElectionScheduler } = require("./services/scheduler");
    startElectionScheduler();
    console.log("✅ Election scheduler started");

    app.listen(PORT, () => {
      console.log(`\n🚀 VeriVote API running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
      console.log(`\nAvailable routes:`);
      console.log(`  POST   /api/auth/login`);
      console.log(`  POST   /api/auth/register`);
      console.log(`  GET    /api/users`);
      console.log(`  GET    /api/elections`);
      console.log(`  POST   /api/elections`);
      console.log(`  POST   /api/vote/:electionId`);
      console.log(`  GET    /api/announcements`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default app;
