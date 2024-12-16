import { Router } from "express";
import authRoutes from "./auth.routes";
import documentsRoutes from "./documents.routes";
import experimentsRoutes from "./experiments.routes";
import mastermixesRoutes from "./mastermixes.routes";
import usersRoutes from "./users.routes";
import settingsRoutes from "./settings.routes";
import lfaRoutes from "./lfa.routes";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

router.use("/auth", authRoutes);
router.use("/documents", documentsRoutes);
router.use("/experiments", experimentsRoutes);
router.use("/experiments/lfa", lfaRoutes);
router.use("/mastermixes", mastermixesRoutes);
router.use("/users", authenticateToken, requireAdmin, usersRoutes);
router.use("/settings", authenticateToken, requireAdmin, settingsRoutes);

export default router;
