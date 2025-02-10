import { Router } from "express";
import {
  createLFAExperiment,
  updateExperimentSteps,
  getExperimentSteps,
  getExperiment,
  updateLFAExperiment,
  exportExperiment,
  getExperimentInstructions,
  cloneLFAExperiment,
  getLFADeckLayouts,
} from "../controllers/lfa.controller";
import { authenticateToken } from "../middleware/auth";
import { db } from "../db";

const router = Router();

// Create new LFA experiment
router.post("/", authenticateToken, createLFAExperiment);

// Get deck layouts
router.get("/deck-layouts", authenticateToken, getLFADeckLayouts);

// update experiment
router.put("/:id", authenticateToken, updateLFAExperiment);

// Get experiment with steps
router.get("/:id", authenticateToken, getExperiment);

// Update experiment steps
router.put("/:id/steps", authenticateToken, updateExperimentSteps);

// Get experiment steps
router.get("/:id/steps", authenticateToken, getExperimentSteps);

// Export experiment worklist
router.get("/:id/export", authenticateToken, exportExperiment);

// Get experiment instructions
router.get("/:id/instructions", authenticateToken, getExperimentInstructions);

// Clone experiment
router.post("/:id/clone", authenticateToken, cloneLFAExperiment);

export default router;
