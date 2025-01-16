import { Router } from "express";
import authRoutes from "./auth.routes";
import documentsRoutes from "./documents.routes";
import experimentsRoutes from "./experiments.routes";
import naatRoutes from "./naat.routes";
import lfaRoutes from "./lfa.routes";
import mastermixesRoutes from "./mastermixes.routes";
import usersRoutes from "./users.routes";
import naatSettingsRoutes from "./naat-settings.routes";
import lfaSettingsRouter from "./lfa-settings.routes";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

router.use("/auth", authRoutes);
router.use("/documents", documentsRoutes);
router.use("/experiments", experimentsRoutes);
router.use("/experiments/naat", naatRoutes);
router.use("/experiments/lfa", lfaRoutes);
router.use("/mastermixes", mastermixesRoutes);
router.use("/users", authenticateToken, requireAdmin, usersRoutes);
router.use(
  "/settings/naat",
  authenticateToken,
  requireAdmin,
  naatSettingsRoutes
);

// LFA Settings routes
router.use("/settings/lfa", authenticateToken, requireAdmin, lfaSettingsRouter);

export default router;
