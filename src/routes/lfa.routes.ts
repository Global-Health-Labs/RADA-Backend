import { Router } from "express";
import { getLFAConfigs } from "../controllers/lfa-settings.controller";
import {
  cloneLFAExperiment,
  createLFAExperiment,
  exportExperiment,
  getExperiment,
  getExperimentInstructions,
  getExperimentSteps,
  getLFADeckLayouts,
  getLFAPresets,
  getLiquidTypes,
  updateExperimentSteps,
  updateLFAExperiment,
} from "../controllers/lfa.controller";

const router = Router();

// Create new LFA experiment
router.post("/", createLFAExperiment);

// Get deck layouts
router.get("/deck-layouts", getLFADeckLayouts);

// GET /experiments/lfa/liquid-types
router.get("/liquid-types", getLiquidTypes);

// Get presets
router.get("/presets", getLFAPresets);

// Get assay plate configurations
router.get("/assay-plate-configs", getLFAConfigs);

// update experiment
router.put("/:id", updateLFAExperiment);

// Get experiment with steps
router.get("/:id", getExperiment);

// Update experiment steps
router.put("/:id/steps", updateExperimentSteps);

// Get experiment steps
router.get("/:id/steps", getExperimentSteps);

// Export experiment worklist
router.get("/:id/export", exportExperiment);

// Get experiment instructions
router.get("/:id/instructions", getExperimentInstructions);

// Clone experiment
router.post("/:id/clone", cloneLFAExperiment);

export default router;
