import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "verivote-secret-key";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    nim: string;
    name: string;
    role: string;
    wallet_address: string | null;
  };
}

/**
 * JWT Authentication middleware.
 * Extracts and verifies JWT from Authorization header.
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ 
      success: false, 
      message: "Token tidak ditemukan. Silakan login terlebih dahulu." 
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      nim: string;
      name: string;
      role: string;
      wallet_address: string | null;
    };

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: "Token tidak valid atau sudah kadaluarsa." 
    });
  }
}

/**
 * Role-based access control middleware.
 * @param roles Array of allowed roles
 */
export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        success: false, 
        message: "Anda tidak memiliki akses untuk melakukan aksi ini." 
      });
      return;
    }

    next();
  };
}

/**
 * Generate JWT token for a user.
 */
export function generateToken(user: { id: number; nim: string; name: string; role: string; wallet_address: string | null }): string {
  return jwt.sign(
    {
      id: user.id,
      nim: user.nim,
      name: user.name,
      role: user.role,
      wallet_address: user.wallet_address,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}
