import { Request, Response } from "express";
import { db } from "../db";
import { experimentalPlans } from "../db/schema";
import { v4 as uuidv4 } from 'uuid';

interface LFAStep {
  step: string;
  dx: number;
  dz: number;
  volume: number;
  liquid_class: string;
  time: number;
  source: string;
}

interface LFAExperiment {
  id: string;
  nameOfExperimentalPlan: string;
  numOfSampleConcentrations: number;
  numOfTechnicalReplicates: number;
  plateName: string;
  plateSize: string;
  type: 'LFA';
  steps?: LFAStep[];
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
}

// Initialize with example experiment from lfa-py
const lfaExperiments: LFAExperiment[] = [
  {
    id: '1',
    nameOfExperimentalPlan: 'Factorial Experiment',
    numOfSampleConcentrations: 6, // From nsub0 in input_master.csv
    numOfTechnicalReplicates: 4,  // From nrep in input_master.csv
    plateName: 'IVL_Plate_v3_96cassettes_ABformat', // From assay_plate_prefix in input_master.csv
    plateSize: '96', // From nperplate in input_master.csv
    type: 'LFA',
    steps: [
      {
        step: 'conjugate',
        dx: 13,
        dz: 0.2,
        volume: 1,
        liquid_class: 'water',
        time: -1,
        source: 'CS031, CS033'
      },
      {
        step: 'sample',
        dx: 0,
        dz: 1,
        volume: 75,
        liquid_class: 'pbst',
        time: 1200,
        source: 'D001-N1, D001-P1, D002-N1, D002-P1, D003-N1, D003-P1, R007-N1, R007-P1, D004-N1, D004-P1, ABI-131-N1, ABI-131-P1'
      },
      {
        step: 'imaging',
        dx: 24,
        dz: 0,
        volume: 0,
        liquid_class: 'imaging',
        time: 600,
        source: 'camera'
      }
    ],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ownerId: 'system'
  }
];

export async function createExperiment(req: Request, res: Response) {
  try {
    const { nameOfExperimentalPlan, numOfSampleConcentrations, numOfTechnicalReplicates, plateName, plateSize } = req.body;
    
    const experiment: LFAExperiment = {
      id: uuidv4(),
      nameOfExperimentalPlan,
      numOfSampleConcentrations,
      numOfTechnicalReplicates,
      plateName,
      plateSize,
      type: 'LFA',
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerId: (req as any).user.id
    };

    lfaExperiments.push(experiment);
    res.json(experiment);
  } catch (error) {
    console.error("Error creating LFA experiment:", error);
    res.status(500).json({ error: "Failed to create LFA experiment" });
  }
}

export async function updateExperimentSteps(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { steps } = req.body;

    const experimentIndex = lfaExperiments.findIndex(exp => exp.id === id);
    if (experimentIndex === -1) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    // Update the experiment
    lfaExperiments[experimentIndex] = {
      ...lfaExperiments[experimentIndex],
      steps,
      updatedAt: new Date()
    };

    res.json(lfaExperiments[experimentIndex]);
  } catch (error) {
    console.error("Error updating LFA steps:", error);
    res.status(500).json({ error: "Failed to update LFA steps" });
  }
}

export async function getExperimentSteps(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const experiment = lfaExperiments.find(exp => exp.id === id);

    if (!experiment) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    res.json(experiment.steps || []);
  } catch (error) {
    console.error("Error fetching LFA steps:", error);
    res.status(500).json({ error: "Failed to fetch LFA steps" });
  }
}

export const getExperiment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const experiment = lfaExperiments.find(exp => exp.id === id);

    if (!experiment) {
      return res.status(404).json({ message: 'Experiment not found' });
    }

    // Return experiment with steps
    return res.status(200).json(experiment);
  } catch (error) {
    console.error('Error getting experiment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
