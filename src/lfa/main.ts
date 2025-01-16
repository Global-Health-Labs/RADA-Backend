import { makeWorklistFull2D } from "./full-experiment";
import { fullFromRunWorklist } from "./util";
import { ExperimentStep, PlateInfo, TimeInfo } from "./types";
import { makeWorklistOneRun } from "./make_worklist";

export interface LFAInputData {
  experimentInput: ExperimentStep[];
  plateInfo: PlateInfo[];
  timeInfo: TimeInfo[];
  solutionInfo: string[][];
  liquidTypeInfo: Array<{
    liquid_class: string;
    liquid_type: string;
  }>;
  tipSize: number[];
  nPerGroup: number;
}

export interface WorklistOutput {
  worklist: any[];
  userSolution: any[];
  userLabware: any[];
  userTip: any[];
}

export function generateWorklist(
  expInput: ExperimentStep[],
  numReplicates: number,
  transferStepsPerGroup: number,
  dispenseType: string,
  aspMixing: 0 | 1,
  nzfill: number,
  assayPlatePrefix: string,
  nplate: number,
  nperplate: number,
  ncol: number,
  sortByCol: boolean,
  plateInfo: PlateInfo[],
  timeInfo: TimeInfo[]
): WorklistOutput[] {
  // Generate worklist
  const { worklist } = makeWorklistOneRun(
    expInput,
    numReplicates,
    transferStepsPerGroup,
    dispenseType,
    aspMixing,
    nzfill,
    assayPlatePrefix,
    nplate,
    nperplate,
    ncol,
    sortByCol,
    plateInfo,
    timeInfo
  );

  // Generate full worklist
  // const fullWorklistParams = {
  //   plateInfo
  // };

  // Process each run worklist
  const outputs: WorklistOutput[] = [];
  const full = fullFromRunWorklist({
    worklist,
    diluent: "water",
    reservoirTag: "ivl_1",
    assayPlateTag: "IVL_Plate_",
    tipSize: [50, 300, 1000],
    nPerGroup: 8,
    nzfill: 4,
    solDf: [],
    liquidTypeDf: [],
    plateDf: plateInfo,
  });

  // Update liquid class
  // full.worklist = updateLiquidClass(full.worklist, input.liquidTypeInfo);

  outputs.push({
    worklist: full.worklist,
    userSolution: full.user_solution,
    userLabware: full.user_labware,
    userTip: full.user_tip,
  });

  return outputs;
}

// Sample experiment steps
const steps: ExperimentStep[] = [
  {
    step: "conjugate",
    dx: 13,
    dz: 0.2,
    volume: 1,
    liquid_class: "water",
    time: -1,
    source: "CS031,CS033",
  },
  {
    step: "sample",
    dx: 0,
    dz: 1.0,
    volume: 75,
    liquid_class: "pbst",
    time: 1200,
    source:
      "D001-N1,D001-P1,D002-N1,D002-P1,D003-N1,D003-P1,R007-N1,R007-P1,D004-N1,D004-P1,ABI-131-N1,ABI-131-P1",
  },
  {
    step: "imaging",
    dx: 24,
    dz: 0.0,
    volume: 0,
    liquid_class: "imaging",
    time: 600,
    source: "camera",
  },
];

const dispenseType = "Jet_Empty";
const aspMixing = 0;
const assayPlatePrefix = "IVL_Plate_v3_96cassettes_ABformat";
const nplate = 1;
const nperplate = 96;
const ncol = 6;
const nzfill = 4;
const sortByCol = false;

const plateInfo: PlateInfo[] = [
  {
    plate: "ivl_1_flat_v1",
    volume_well: 40000,
    nrow: 1,
    ncol: 1,
    volume_holdover: 800,
  },
  {
    plate: "ivl_96_dw_v1",
    volume_well: 1000,
    nrow: 8,
    ncol: 12,
    volume_holdover: 60,
  },
  {
    plate: "ivl_384_flat_v1",
    volume_well: 90,
    nrow: 16,
    ncol: 24,
    volume_holdover: 40,
  },
];

const timeInfo: TimeInfo[] = [
  { step: "conjugate", exp_time: 120 },
  { step: "capture", exp_time: 120 },
  { step: "sample", exp_time: 120 },
  { step: "rb", exp_time: 60 },
  { step: "imaging", exp_time: 20 },
];

const result = generateWorklist(
  steps,
  4,
  8,
  dispenseType,
  aspMixing,
  nzfill,
  assayPlatePrefix,
  nplate,
  nperplate,
  ncol,
  sortByCol,
  plateInfo,
  timeInfo
);
