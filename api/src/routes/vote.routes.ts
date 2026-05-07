import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { BlockchainService } from "../services/blockchain.service";
import AdminLog from "../models/AdminLog";

const router = Router();

/**
 * POST /api/vote/:electionId
 * Cast a vote in an election. Recorded on blockchain.
 */
router.post("/:electionId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.electionId);
    const { candidateId } = req.body;

    if (!candidateId) {
      res.status(400).json({ success: false, message: "Pilih kandidat terlebih dahulu!" });
      return;
    }

    if (!req.user?.wallet_address) {
      res.status(400).json({ success: false, message: "Akun belum terhubung dengan blockchain." });
      return;
    }

    // Check if already voted
    const alreadyVoted = await BlockchainService.hasVoterVoted(electionId, req.user.wallet_address);
    if (alreadyVoted) {
      res.status(400).json({ success: false, message: "Anda sudah memberikan suara pada pemilihan ini." });
      return;
    }

    // Cast vote on blockchain
    const { txHash, voteHash } = await BlockchainService.castVote(electionId, candidateId, req.user.wallet_address);

    await AdminLog.create({
      message: `${req.user.name} memberikan suara pada election #${electionId}`,
    });

    res.json({
      success: true,
      message: "Suara Anda berhasil dicatat di blockchain!",
      data: {
        txHash,
        voteHash,
        electionId,
        verificationMessage: "Gunakan voteHash untuk memverifikasi suara Anda di blockchain.",
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Gagal memberikan suara." });
  }
});

/**
 * GET /api/vote/:electionId/status
 * Check if current user has voted in an election.
 */
router.get("/:electionId/status", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.electionId);

    if (!req.user?.wallet_address) {
      res.json({ success: true, data: { hasVoted: false } });
      return;
    }

    const hasVoted = await BlockchainService.hasVoterVoted(electionId, req.user.wallet_address);

    let voteHash = null;
    if (hasVoted) {
      try {
        voteHash = await BlockchainService.getVoteVerification(electionId, req.user.wallet_address);
      } catch {}
    }

    res.json({
      success: true,
      data: { hasVoted, voteHash },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
});

/**
 * GET /api/vote/:electionId/verify/:address
 * Verify a vote on blockchain.
 */
router.get("/:electionId/verify/:address", async (req, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.electionId);
    const address = req.params.address;

    const hasVoted = await BlockchainService.hasVoterVoted(electionId, address);

    if (!hasVoted) {
      res.json({ success: true, data: { verified: false, message: "Alamat ini belum memberikan suara." } });
      return;
    }

    const voteHash = await BlockchainService.getVoteVerification(electionId, address);

    res.json({
      success: true,
      data: { verified: true, voteHash, message: "Suara terverifikasi di blockchain." },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
});

export default router;
