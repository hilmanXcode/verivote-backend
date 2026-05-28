import { BlockchainService } from "./blockchain.service";
import AdminLog from "../models/AdminLog";

export function startElectionScheduler() {
  // Run every 30 seconds
  setInterval(async () => {
    try {
      const elections = await BlockchainService.getAllElections();
      const now = Math.floor(Date.now() / 1000);

      for (const election of elections) {
        if (election.status === "ongoing" && election.endDate > 0 && election.endDate < now) {
          try {
            await BlockchainService.endElection(election.id);
            await AdminLog.create({ message: `System: auto-ended election "${election.title}" (waktu habis)` });
            console.log(`[Scheduler] Auto-ended election #${election.id} ("${election.title}")`);
          } catch (err: any) {
            console.error(`[Scheduler] Failed to auto-end election #${election.id}:`, err.message);
          }
        }
      }
    } catch (error: any) {
      console.error("[Scheduler] Error fetching elections:", error.message);
    }
  }, 30000);
}
