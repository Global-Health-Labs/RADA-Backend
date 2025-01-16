import { spawn } from "child_process";
import csvParser from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import { and, eq } from "drizzle-orm";
import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { db } from "../db";
import {
  assayPlateConfigs,
  lfaExperiments,
  lfaSteps,
  reagentPlates,
  users,
} from "../db/schema";
import { ExportQueue } from "../utils/ExportQueue";
import { camelCase, omit } from "lodash";

type LFAExperimentWithPlateConfig = typeof lfaExperiments.$inferSelect & {
  plateConfig: typeof assayPlateConfigs.$inferSelect;
  steps: (typeof lfaSteps.$inferSelect)[];
};

export interface LFAStep {
  step: string;
  dx: number;
  dz: number;
  volume: number;
  liquidClass: string;
  time: number;
  source: string;
}

// Helper function to check if user has access to experiment
async function getExperimentWithAccess(experimentId: string, userId: string) {
  // Get experiment with related data
  const experiment = await db.query.lfaExperiments.findFirst({
    where: eq(lfaExperiments.id, experimentId),
    with: {
      plateConfig: true,
      steps: {
        orderBy: (steps, { asc }) => [asc(steps.orderIndex)],
      },
    },
  });

  if (!experiment) {
    return null;
  }

  // Check if user has access (owner or admin/supervisor)
  if (experiment.ownerId !== userId) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        role: true,
      },
    });

    if (!user?.role || !["admin", "supervisor"].includes(user.role.name)) {
      return null;
    }
  }

  return experiment;
}

export async function createLFAExperiment(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, numReplicates, plateConfigId } = req.body;

    // Validate plate config exists
    const plateConfig = await db.query.assayPlateConfigs.findFirst({
      where: eq(assayPlateConfigs.id, plateConfigId),
    });

    if (!plateConfig) {
      return res.status(404).json({ error: "Plate configuration not found" });
    }

    // Create new LFA experiment
    const [experiment] = await db
      .insert(lfaExperiments)
      .values({
        name,
        numReplicates,
        plateConfigId,
        ownerId: userId,
      })
      .returning();

    res.status(201).json(experiment);
  } catch (error) {
    console.error("Error creating LFA experiment:", error);
    res.status(500).json({ error: "Failed to create LFA experiment" });
  }
}

export async function updateLFAExperiment(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const experimentId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if experiment exists and user has access
    const existingExperiment = await db.query.lfaExperiments.findFirst({
      where: eq(lfaExperiments.id, experimentId),
    });

    if (!existingExperiment) {
      return res
        .status(404)
        .json({ error: "Experiment not found or access denied" });
    }

    const updateData = { ...req.body };
    delete updateData.id; // Remove id from update data
    delete updateData.ownerId; // Prevent owner change

    // If plateConfigId is being updated, validate it exists
    if (updateData.plateConfigId) {
      const plateConfig = await db.query.assayPlateConfigs.findFirst({
        where: eq(assayPlateConfigs.id, updateData.plateConfigId),
      });

      if (!plateConfig) {
        return res.status(404).json({ error: "Plate configuration not found" });
      }
    }

    console.log(updateData);
    // Update the experiment
    const [updated] = await db
      .update(lfaExperiments)
      .set({
        name: updateData.name,
        numReplicates: updateData.numReplicates,
        plateConfigId: updateData.plateConfigId,
        updatedAt: new Date(),
      })
      .where(eq(lfaExperiments.id, experimentId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error updating LFA experiment:", error);
    res.status(500).json({ error: "Failed to update LFA experiment" });
  }
}

export async function updateExperimentSteps(req: Request, res: Response) {
  try {
    const experimentId = req.params.id;
    const userId = req.user?.id;
    const steps = req.body.steps as LFAStep[];

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const experiment = await getExperimentWithAccess(experimentId, userId);
    if (!experiment) {
      return res
        .status(404)
        .json({ error: "Experiment not found or access denied" });
    }

    // Start a transaction to update steps
    await db.transaction(async (tx) => {
      // Delete existing steps
      await tx.delete(lfaSteps).where(eq(lfaSteps.experimentId, experimentId));

      // Insert new steps with order index
      if (steps && steps.length > 0) {
        await tx.insert(lfaSteps).values(
          steps.map((step, index) => ({
            experimentId,
            step: step.step,
            dx: step.dx,
            dz: step.dz,
            volume: step.volume,
            liquidClass: step.liquidClass,
            time: step.time,
            source: step.source,
            orderIndex: index,
          }))
        );
      }
    });

    // Return updated experiment
    const updatedExperiment = await getExperimentWithAccess(
      experimentId,
      userId
    );
    res.json(updatedExperiment);
  } catch (error) {
    console.error("Error updating LFA steps:", error);
    res.status(500).json({ error: "Failed to update LFA steps" });
  }
}

export async function getExperimentSteps(req: Request, res: Response) {}

export const getExperiment = async (req: Request, res: Response) => {
  try {
    const experimentId = req.params.id;
    const userId = req.user?.id;

    const experiment = await getExperimentWithAccess(experimentId, userId!);
    if (!experiment) {
      return res
        .status(404)
        .json({ error: "Experiment not found or access denied" });
    }

    res.json(experiment);
  } catch (error) {
    console.error("Error fetching LFA experiment:", error);
    res.status(500).json({ error: "Failed to fetch LFA experiment" });
  }
};

async function writeExperimentSteps(
  experiment: LFAExperimentWithPlateConfig,
  workingDirectory: string
) {
  const experimentStepsPath = path.join(
    workingDirectory,
    "input_experiment/factorial_experiment.csv"
  );

  // Sort steps by orderIndex
  const sortedSteps = [...experiment.steps].sort(
    (a, b) => a.orderIndex - b.orderIndex
  );

  // Create CSV writer
  const csvWriter = createObjectCsvWriter({
    path: experimentStepsPath,
    header: [
      { id: "step", title: "step" },
      { id: "dx", title: "dx" },
      { id: "dz", title: "dz" },
      { id: "volume", title: "volume" },
      { id: "liquid_class", title: "liquid_class" },
      { id: "time", title: "time" },
      { id: "source", title: "source" },
    ],
  });

  // Format steps data
  const stepsData = sortedSteps.map((step) => ({
    step: step.step,
    dx: step.dx,
    dz: step.dz,
    volume: step.volume,
    liquid_class: step.liquidClass,
    time: step.time,
    source: step.source,
  }));

  await csvWriter.writeRecords(stepsData);
}

async function writeReagentPlatesCSV(workingDirectory: string) {
  // Get all reagent plates from database
  const plates = await db.query.reagentPlates.findMany();

  // Create CSV writer
  const csvWriter = createObjectCsvWriter({
    path: path.join(workingDirectory, "input_instrument", "reagent_plates.csv"),
    header: [
      { id: "plate", title: "plate" },
      { id: "volumeWell", title: "volume_well" },
      { id: "numRows", title: "nrow" },
      { id: "numCols", title: "ncol" },
      { id: "volumeHoldover", title: "volume_holdover" },
    ],
  });

  // Write data
  await csvWriter.writeRecords(plates);
}

async function updateInputMasterFile(
  experiment: LFAExperimentWithPlateConfig,
  workingDirectory: string
) {
  const inputMasterPath = path.join(workingDirectory, "input_master.csv");
  const rows: any[] = [];

  // Read existing CSV
  await new Promise((resolve, reject) => {
    fs.createReadStream(inputMasterPath)
      .pipe(csvParser())
      .on("data", (row: any) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  // Update values based on plate config
  const updatedRows = rows.map((row) => {
    switch (row.key) {
      case "nplate":
        return { ...row, value: experiment.plateConfig.numPlates.toString() };
      case "nperplate":
        return {
          ...row,
          value: experiment.plateConfig.numStrips.toString(),
        };
      case "ncol":
        return { ...row, value: experiment.plateConfig.numColumns.toString() };
      case "nrep":
        return { ...row, value: experiment.numReplicates.toString() };
      default:
        return row;
    }
  });

  // Write back to CSV
  const csvWriter = createObjectCsvWriter({
    path: inputMasterPath,
    header: [
      { id: "key", title: "key" },
      { id: "value", title: "value" },
      { id: "description", title: "description" },
      { id: "modification_frequency", title: "modification_frequency" },
      { id: "category", title: "category" },
      { id: "note", title: "note" },
    ],
  });

  await csvWriter.writeRecords(updatedRows);
}

async function executePythonScript(experiment: LFAExperimentWithPlateConfig) {
  const pythonScriptPath = path.join(
    __dirname,
    "../../resources/lfa-py/main.py"
  );
  const workingDirectory = path.join(__dirname, "../../resources/lfa-py");

  // Update input files
  await Promise.all([
    updateInputMasterFile(experiment, workingDirectory),
    writeExperimentSteps(experiment, workingDirectory),
    writeReagentPlatesCSV(workingDirectory),
  ]);

  // Create a promise to handle the Python script execution
  await new Promise((resolve, reject) => {
    console.time("Exporting experiment");
    const pythonProcess = spawn("python", [pythonScriptPath, experiment.id], {
      cwd: workingDirectory,
    });

    let scriptOutput = "";
    let scriptError = "";

    pythonProcess.stdout.on("data", (data: Buffer) => {
      scriptOutput += data.toString();
      console.log("Python output:", data.toString());
    });

    pythonProcess.stderr.on("data", (data: Buffer) => {
      scriptError += data.toString();
      console.error("Python error:", data.toString());
    });

    pythonProcess.on("error", (error) => {
      console.error("Failed to start Python process:", error);
      reject(error);
    });

    pythonProcess.on("close", (code: number) => {
      console.timeEnd("Exporting experiment");
      if (code !== 0) {
        console.error("Python script error:", scriptError);
        reject(
          new Error(`Python script failed with code ${code}: ${scriptError}`)
        );
      } else {
        console.log("Python script execution completed");
        resolve(true);
      }
    });
  });
}

export async function exportExperiment(req: Request, res: Response) {
  const queue = ExportQueue.getInstance();

  try {
    const userId = req.user?.id;
    const experimentId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if experiment exists and user has access
    const experiment = await getExperimentWithAccess(experimentId, userId);
    if (!experiment) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    // Set timeout to 1 minute
    req.setTimeout(60000);
    res.setTimeout(60000);

    // Add export task to queue
    await queue.add(async () => {
      await executePythonScript(experiment);

      const workingDirectory = path.join(__dirname, "../../resources/lfa-py");
      const filePath = path.join(
        workingDirectory,
        "output_full_worklist/factorial_experiment0_full_worklist.csv"
      );

      if (!fs.existsSync(filePath)) {
        throw new Error("Worklist file not found");
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=lfa_experiment_${experimentId}_worklist.csv`
      );

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    });
  } catch (error) {
    console.error("Error exporting LFA experiment:", error);
    res.status(500).json({
      error: "Failed to export LFA experiment",
      details: error instanceof Error ? error.message : String(error),
      queueLength: queue.getQueueLength(),
    });
  }
}

export async function getExperimentInstructions(req: Request, res: Response) {
  const queue = ExportQueue.getInstance();

  try {
    const userId = req.user?.id;
    const experimentId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if experiment exists and user has access
    const experiment = await getExperimentWithAccess(experimentId, userId);
    if (!experiment) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    // Add export task to queue
    await queue.add(async () => {
      await executePythonScript(experiment);

      const workingDirectory = path.join(__dirname, "../../resources/lfa-py");
      const filePath = path.join(
        workingDirectory,
        "output_full_worklist/factorial_experiment0_full_user_solution.csv"
      );

      if (!fs.existsSync(filePath)) {
        throw new Error("Worklist file not found");
      }

      // Read and parse CSV file
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const rows = fileContent.split("\n").filter((row) => row.trim());
      const headers = rows[0].split(",");

      const jsonData = rows.slice(1).map((row) => {
        const values = row.split(",");
        const rowData: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowData[camelCase(header)] = values[index];
        });
        return rowData;
      });

      res.json(jsonData);
    });
  } catch (error) {
    console.error("Error getting LFA experiment instructions:", error);
    res.status(500).json({
      error: "Failed to get LFA experiment instructions",
      details: error instanceof Error ? error.message : String(error),
      queueLength: queue.getQueueLength(),
    });
  }
}

export async function cloneLFAExperiment(req: Request, res: Response) {
  try {
    const experimentId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get the original experiment with steps
    const originalExperiment = await getExperimentWithAccess(
      experimentId,
      userId
    );
    if (!originalExperiment) {
      return res
        .status(404)
        .json({ error: "Experiment not found or access denied" });
    }

    // Start a transaction to clone the experiment and its steps
    const clonedExperiment = await db.transaction(async (tx) => {
      // Clone the experiment
      const [newExperiment] = await tx
        .insert(lfaExperiments)
        .values({
          name: `${originalExperiment.name} (Copy)`,
          numReplicates: originalExperiment.numReplicates,
          plateConfigId: originalExperiment.plateConfigId,
          ownerId: userId,
        })
        .returning();

      // Clone the steps if they exist
      if (originalExperiment.steps && originalExperiment.steps.length > 0) {
        await tx.insert(lfaSteps).values(
          originalExperiment.steps.map((step) => ({
            ...omit(step, "id"),
            experimentId: newExperiment.id,
          }))
        );
      }

      return {
        ...newExperiment,
        type: "LFA" as const,
      };
    });

    res.status(201).json(clonedExperiment);
  } catch (error) {
    console.error("Error cloning LFA experiment:", error);
    res.status(500).json({ error: "Failed to clone LFA experiment" });
  }
}
