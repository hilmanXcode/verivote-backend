import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import AdminLog from "../models/AdminLog";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { BlockchainService } from "../services/blockchain.service";

const router = Router();

/**
 * GET /api/users
 * Get all users. Admin only.
 */
router.get("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan.",
    });
  }
});

/**
 * GET /api/users/stats
 * Get user statistics. Admin only.
 */
router.get("/stats", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.findAll();

    const admins = users.filter(u => u.role === "admin");
    const regularUsers = users.filter(u => u.role === "user");
    const operators = users.filter(u => u.role === "operator");

    res.json({
      success: true,
      data: {
        totalUsers: users.length,
        activeUsers: regularUsers.length,
        activeAdmins: admins.length,
        totalOperators: operators.length,
        breakdown: {
          admin: admins.length,
          user: regularUsers.length,
          operator: operators.length,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan.",
    });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID. Admin only.
 */
router.get("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User tidak ditemukan.",
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan.",
    });
  }
});

/**
 * POST /api/users
 * Create a new user. Admin only.
 */
router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { nim, name, password, role = "user" } = req.body;

    if (!nim || !name || !password) {
      res.status(400).json({
        success: false,
        message: "NIM, nama, dan password harus diisi!",
      });
      return;
    }

    const existing = await User.findOne({ where: { nim } });
    if (existing) {
      res.status(409).json({
        success: false,
        message: "NIM sudah terdaftar!",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const wallet = BlockchainService.generateWallet();

    const user = await User.create({
      nim,
      name,
      password: hashedPassword,
      role,
      wallet_address: wallet.address,
    });

    // Register on blockchain
    try {
      const roleMap: Record<string, number> = { user: 0, operator: 1, admin: 2 };
      await BlockchainService.registerVoter(wallet.address, nim, name, roleMap[role] || 0);
    } catch (e: any) {
      console.warn("Blockchain registration warning:", e.message);
    }

    await AdminLog.create({
      message: `${req.user!.name} menambahkan user ${name} (${nim}) sebagai ${role}`,
    });

    res.status(201).json({
      success: true,
      message: "User berhasil ditambahkan!",
      data: {
        id: user.id,
        nim: user.nim,
        name: user.name,
        role: user.role,
        wallet_address: user.wallet_address,
        created_at: user.created_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menambahkan user.",
    });
  }
});

/**
 * PUT /api/users/:id
 * Update user. Admin only.
 */
router.put("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User tidak ditemukan.",
      });
      return;
    }

    const { nim, name, password, role } = req.body;

    if (nim) user.nim = nim;
    if (name) user.name = name;
    if (role) user.role = role;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    await AdminLog.create({
      message: `${req.user!.name} memperbarui data user ${user.name}`,
    });

    res.json({
      success: true,
      message: "User berhasil diperbarui!",
      data: {
        id: user.id,
        nim: user.nim,
        name: user.name,
        role: user.role,
        wallet_address: user.wallet_address,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat memperbarui user.",
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user. Admin only.
 */
router.delete("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User tidak ditemukan.",
      });
      return;
    }

    const userName = user.name;
    await user.destroy();

    await AdminLog.create({
      message: `${req.user!.name} menghapus user ${userName}`,
    });

    res.json({
      success: true,
      message: "User berhasil dihapus!",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menghapus user.",
    });
  }
});

/**
 * GET /api/users/logs/admin
 * Get admin activity logs.
 */
router.get("/logs/admin", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const logs = await AdminLog.findAll({
      order: [["id", "DESC"]],
      limit: 20,
    });

    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan.",
    });
  }
});

export default router;
