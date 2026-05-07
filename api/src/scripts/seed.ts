import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import { sequelize } from "../config/database";
import User from "../models/User";
import Announcement from "../models/Announcement";
import AdminLog from "../models/AdminLog";
import { BlockchainService } from "../services/blockchain.service";
import { initBlockchain } from "../config/blockchain";

async function seed() {
  console.log("🌱 Seeding database...\n");

  await sequelize.authenticate();
  await sequelize.sync({ force: true }); // WARNING: drops all tables
  console.log("✅ Database synced (tables recreated)\n");

  await initBlockchain();

  // Seed users (matching mobile app's demo data)
  const users = [
    { nim: "admin001", name: "Admin Joko", password: "admin123", role: "admin" },
    { nim: "admin002", name: "Admin Febri", password: "admin123", role: "admin" },
    { nim: "admin003", name: "Admin Firman", password: "admin123", role: "admin" },
    { nim: "operator001", name: "Operator Budi", password: "operator123", role: "operator" },
    { nim: "operator002", name: "Operator Siti", password: "operator123", role: "operator" },
  ];

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    const wallet = BlockchainService.generateWallet();
    await User.create({
      nim: u.nim,
      name: u.name,
      password: hashed,
      role: u.role as any,
      wallet_address: wallet.address,
    });

    // Register on blockchain
    const roleMap: Record<string, number> = { user: 0, operator: 1, admin: 2 };
    try {
      await BlockchainService.registerVoter(
        wallet.address,
        u.nim,
        u.name,
        roleMap[u.role] || 0
      );
    } catch (e: any) {
      console.warn(`    ⚠️ Blockchain registration failed for ${u.nim}:`, e);
    }

    console.log(`  ✅ ${u.name} (${u.nim}) - ${u.role}`);
  }

  // Seed announcements
  const announcements = [
    { title: "Jadwal Pemilihan Ketua BEM 2026", content: "Pemilihan Ketua BEM periode 2026-2027 akan dilaksanakan pada tanggal 15 Mei 2026.", priority: "urgent", created_by: "admin001", author_name: "Admin Joko" },
    { title: "Pemeliharaan Sistem VeriVote", content: "Sistem VeriVote akan mengalami pemeliharaan rutin pada hari Sabtu.", priority: "important", created_by: "operator001", author_name: "Operator Budi" },
    { title: "Selamat Datang di VeriVote!", content: "VeriVote adalah platform e-voting digital yang aman dan transparan.", priority: "normal", created_by: "admin002", author_name: "Admin Febri" },
    { title: "Pendaftaran Kandidat Dibuka", content: "Pendaftaran kandidat untuk pemilihan telah dibuka.", priority: "important", created_by: "admin003", author_name: "Admin Firman" },
  ];

  for (const a of announcements) {
    await Announcement.create(a as any);
  }
  console.log(`\n  ✅ ${announcements.length} announcements created`);

  // Seed admin logs
  await AdminLog.create({ message: "Database seeded with demo data" });
  console.log("  ✅ Admin logs created");

  console.log("\n🎉 Seeding complete!");
  console.log("\nDemo credentials:");
  console.log("  Admin:    admin001 / admin123");
  console.log("  User:     user001  / user123");
  console.log("  Operator: operator001 / operator123");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
