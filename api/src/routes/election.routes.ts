import { Router, Response } from "express";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { BlockchainService } from "../services/blockchain.service";
import AdminLog from "../models/AdminLog";
import User from "../models/User";

const router = Router();

/**
 * GET /api/elections
 * Get all elections from blockchain.
 */
router.get("/", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const elections = await BlockchainService.getAllElections();
    const { status } = req.query;
    let filtered = elections;
    if (status && typeof status === "string") {
      filtered = elections.filter((e: any) => e.status === status);
    }
    const formatted = filtered.map((e: any) => ({
      ...e,
      created_at: new Date(e.createdAt * 1000).toISOString(),
      end_date: e.endDate > 0 ? new Date(e.endDate * 1000).toISOString() : null,
      start_date: e.startDate > 0 ? new Date(e.startDate * 1000).toISOString() : null,
    }));
    res.json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Gagal mengambil data elections." });
  }
});

/** GET /api/elections/stats */
router.get("/stats", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const elections = await BlockchainService.getAllElections();
    res.json({
      success: true,
      data: {
        total: elections.length,
        active: elections.filter((e: any) => e.status === "ongoing").length,
        completed: elections.filter((e: any) => e.status === "completed").length,
        draft: elections.filter((e: any) => e.status === "draft").length,
        totalParticipants: elections.reduce((s: number, e: any) => s + e.totalVotes, 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
});

/** GET /api/elections/:id */
router.get("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const election = await BlockchainService.getElection(id);
    const candidates = await BlockchainService.getCandidates(id);
    const isActive = await BlockchainService.isElectionActive(id);
    const rate = await BlockchainService.getParticipationRate(id);
    let hasVoted = false;
    let voteRecord = null;
    if (req.user?.wallet_address) {
      hasVoted = await BlockchainService.hasVoterVoted(id, req.user.wallet_address);
      if (hasVoted) {
        voteRecord = await BlockchainService.getVoteRecord(id, req.user.wallet_address);
      }
    }
    res.json({
      success: true,
      data: {
        ...election, candidates, isActive, participationRate: rate / 100, hasVoted, voteRecord,
        created_at: new Date(election.createdAt * 1000).toISOString(),
        end_date: election.endDate > 0 ? new Date(election.endDate * 1000).toISOString() : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/elections/:id/results */
router.get("/:id/results", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const election = await BlockchainService.getElection(id);
    if (election.status !== "completed") {
      res.status(400).json({ success: false, message: "Hasil hanya tersedia setelah pemilihan selesai." });
      return;
    }
    const results = await BlockchainService.getElectionResults(id);
    res.json({ success: true, data: { election, results, winner: results[0] || null } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/elections/:id/voters - Get voter status list for an election (admin/operator) */
router.get("/:id/voters", authenticate, authorize("admin", "operator"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.id);
    const election = await BlockchainService.getElection(electionId);

    // Get all users with role 'user'
    const users = await User.findAll({
      where: { role: "user" },
      attributes: ["id", "nim", "name", "wallet_address"],
      order: [["name", "ASC"]],
    });

    // Get wallet addresses for batch status check
    const walletsToCheck = users
      .filter(u => u.wallet_address)
      .map(u => u.wallet_address as string);

    const voterStatuses = await BlockchainService.getVotersStatus(electionId, walletsToCheck);

    // Create a map for quick lookup
    const statusMap = new Map(
      voterStatuses.map(s => [s.walletAddress.toLowerCase(), s])
    );

    // Build voter list
    const voters = users.map(u => {
      const status = u.wallet_address
        ? statusMap.get(u.wallet_address.toLowerCase())
        : null;
      return {
        id: u.id,
        nim: u.nim,
        name: u.name,
        hasVoted: status?.hasVoted || false,
        votedAt: status?.votedAt
          ? new Date(status.votedAt * 1000).toISOString()
          : null,
      };
    });

    const totalVoted = voters.filter(v => v.hasVoted).length;

    res.json({
      success: true,
      data: {
        electionId,
        electionTitle: election.title,
        totalEligible: voters.length,
        totalVoted,
        totalNotVoted: voters.length - totalVoted,
        voters,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil data voters.",
    });
  }
});

/** POST /api/elections */
// router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { title, description, totalVoters, candidates } = req.body;
//     if (!title) { res.status(400).json({ success: false, message: "Judul harus diisi!" }); return; }
//     const { txHash, electionId } = await BlockchainService.createElection(title, description || "", totalVoters || 0);
//     if (candidates && Array.isArray(candidates)) {
//       for (const c of candidates) {
//         await BlockchainService.addCandidate(electionId, c.name, c.description || "", c.imageHash || "");
//       }
//     }
//     await AdminLog.create({ message: `${req.user!.name} membuat election "${title}"` });
//     res.status(201).json({ success: true, message: "Election berhasil dibuat!", data: { electionId, txHash } });
//   } catch (error: any) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });
/** POST /api/elections */
router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, totalVoters, candidates } = req.body;
    if (!title) { res.status(400).json({ success: false, message: "Judul harus diisi!" }); return; }

    // 1. Buat Election (Transaksi 1)
    const { txHash, electionId } = await BlockchainService.createElection(title, description || "", totalVoters || 0);

    // 2. Tambahkan semua kandidat (Transaksi 2) - Tanpa Loop!
    if (candidates && Array.isArray(candidates) && candidates.length > 0) {
      await BlockchainService.addCandidatesBatch(electionId, candidates);
    }

    await AdminLog.create({ message: `${req.user!.name} membuat election "${title}"` });
    res.status(201).json({ success: true, message: "Election & Kandidat berhasil dibuat!", data: { electionId, txHash } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});


/** POST /api/elections/:id/candidates */
router.post("/:id/candidates", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, imageHash } = req.body;
    if (!name) { res.status(400).json({ success: false, message: "Nama kandidat harus diisi!" }); return; }
    const result = await BlockchainService.addCandidate(parseInt(req.params.id), name, description || "", imageHash || "");
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/elections/:id/start */
router.post("/:id/start", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Terima durationInSeconds langsung, dengan backward compatibility jika frontend lama mengirim durationDays
    const durationInSeconds = req.body.durationInSeconds || (req.body.durationDays || 7) * 86400;
    const result = await BlockchainService.startElection(parseInt(req.params.id), durationInSeconds);
    // console.log(durationInSeconds);
    await AdminLog.create({ message: `${req.user!.name} memulai election #${req.params.id}` });
    res.json({ success: true, message: "Election dimulai!", data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/elections/:id/end */
router.post("/:id/end", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await BlockchainService.endElection(parseInt(req.params.id));
    await AdminLog.create({ message: `${req.user!.name} mengakhiri election #${req.params.id}` });
    res.json({ success: true, message: "Election diakhiri!", data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
