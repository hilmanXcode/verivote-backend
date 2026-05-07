import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import AdminLog from "../models/AdminLog";
import { generateToken, authenticate, AuthRequest } from "../middleware/auth";
import { BlockchainService } from "../services/blockchain.service";

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate user with NIM and password.
 * Returns JWT token and user data.
 */
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { nim, password } = req.body;

    if (!nim || !password) {
      res.status(400).json({
        success: false,
        message: "NIM dan password harus diisi!",
      });
      return;
    }

    const user = await User.findOne({ where: { nim } });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "NIM atau password salah!",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "NIM atau password salah!",
      });
      return;
    }

    const token = generateToken({
      id: user.id,
      nim: user.nim,
      name: user.name,
      role: user.role,
      wallet_address: user.wallet_address,
    });

    // Log the login
    await AdminLog.create({
      message: `${user.name} (${user.role}) berhasil login`,
    });

    res.json({
      success: true,
      message: "Login berhasil!",
      data: {
        token,
        user: {
          id: user.id,
          nim: user.nim,
          name: user.name,
          role: user.role,
          wallet_address: user.wallet_address,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat login.",
    });
  }
});

/**
 * POST /api/auth/register
 * Register a new user. Admin only in production.
 * Creates both DB record and blockchain identity.
 */
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { nim, name, password, role = "user" } = req.body;

    if (!nim || !name || !password) {
      res.status(400).json({
        success: false,
        message: "NIM, nama, dan password harus diisi!",
      });
      return;
    }

    // Check if NIM already exists
    const existingUser = await User.findOne({ where: { nim } });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "NIM sudah terdaftar!",
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate wallet address for blockchain identity
    const wallet = BlockchainService.generateWallet();

    // Create user in database
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
      await BlockchainService.registerVoter(
        wallet.address,
        nim,
        name,
        roleMap[role] || 0
      );
    } catch (blockchainError: any) {
      console.warn("Blockchain registration warning:", blockchainError.message);
      require("fs").writeFileSync("blockchain-error.txt", blockchainError.message + "\n" + (blockchainError.stack || ""), { flag: "a" });
      // Don't fail the registration if blockchain is unavailable
    }

    const token = generateToken({
      id: user.id,
      nim: user.nim,
      name: user.name,
      role: user.role,
      wallet_address: user.wallet_address,
    });

    await AdminLog.create({
      message: `User baru ${name} (${nim}) terdaftar sebagai ${role}`,
    });

    res.status(201).json({
      success: true,
      message: "Registrasi berhasil!",
      data: {
        token,
        user: {
          id: user.id,
          nim: user.nim,
          name: user.name,
          role: user.role,
          wallet_address: user.wallet_address,
          created_at: user.created_at,
        },
      },
    });
  } catch (error: any) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat registrasi.",
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info.
 */
router.get("/me", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findByPk(req.user!.id, {
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
 * PUT /api/auth/change-password
 * Change password for authenticated user.
 */
router.put("/change-password", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Password lama dan baru harus diisi!",
      });
      return;
    }

    const user = await User.findByPk(req.user!.id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User tidak ditemukan.",
      });
      return;
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      res.status(400).json({
        success: false,
        message: "Password lama salah!",
      });
      return;
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await AdminLog.create({
      message: `${user.name} mengubah password`,
    });

    res.json({
      success: true,
      message: "Password berhasil diubah!",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengubah password.",
    });
  }
});

export default router;
