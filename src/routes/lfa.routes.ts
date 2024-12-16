import { Router } from "express";
import {
  createExperiment,
  updateExperimentSteps,
  getExperimentSteps,
  getExperiment,
} from "../controllers/lfa.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Create new LFA experiment
router.post("/", authenticateToken, createExperiment);

// Get experiment with steps
router.get("/:id", authenticateToken, getExperiment);

// Update experiment steps
router.put("/:id/steps", authenticateToken, updateExperimentSteps);

// Get experiment steps
router.get("/:id/steps", authenticateToken, getExperimentSteps);

export default router;
