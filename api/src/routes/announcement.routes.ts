import { Router, Response } from "express";
import Announcement from "../models/Announcement";
import AdminLog from "../models/AdminLog";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();

/** GET /api/announcements */
router.get("/", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { priority, limit } = req.query;
    const where: any = {};
    if (priority) where.priority = priority;

    const announcements = await Announcement.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ success: true, data: announcements });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
});

/** GET /api/announcements/stats */
router.get("/stats", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const all = await Announcement.findAll();
    res.json({
      success: true,
      data: {
        total: all.length,
        urgent: all.filter(a => a.priority === "urgent").length,
        important: all.filter(a => a.priority === "important").length,
        normal: all.filter(a => a.priority === "normal").length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
});

/** GET /api/announcements/:id */
router.get("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) { res.status(404).json({ success: false, message: "Pengumuman tidak ditemukan." }); return; }
    res.json({ success: true, data: announcement });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
});

/** POST /api/announcements */
router.post("/", authenticate, authorize("admin", "operator"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, priority = "normal" } = req.body;
    if (!title || !content) { res.status(400).json({ success: false, message: "Judul dan konten harus diisi!" }); return; }

    const announcement = await Announcement.create({
      title, content, priority,
      created_by: req.user!.nim,
      author_name: req.user!.name,
    });

    await AdminLog.create({ message: `${req.user!.name} membuat pengumuman "${title}"` });
    res.status(201).json({ success: true, message: "Pengumuman berhasil dibuat!", data: announcement });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
});

/** PUT /api/announcements/:id */
router.put("/:id", authenticate, authorize("admin", "operator"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) { res.status(404).json({ success: false, message: "Pengumuman tidak ditemukan." }); return; }

    const { title, content, priority } = req.body;
    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (priority) announcement.priority = priority;
    await announcement.save();

    await AdminLog.create({ message: `${req.user!.name} memperbarui pengumuman "${announcement.title}"` });
    res.json({ success: true, message: "Pengumuman berhasil diperbarui!", data: announcement });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
});

/** DELETE /api/announcements/:id */
router.delete("/:id", authenticate, authorize("admin", "operator"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) { res.status(404).json({ success: false, message: "Pengumuman tidak ditemukan." }); return; }

    const title = announcement.title;
    await announcement.destroy();
    await AdminLog.create({ message: `${req.user!.name} menghapus pengumuman "${title}"` });
    res.json({ success: true, message: "Pengumuman berhasil dihapus!" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
});

export default router;
