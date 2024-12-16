import map from "lodash/map";
import * as path from "path";

interface MakeWorklistFull2DParams {
  expInput: any;
  delimiterCell: string;
  delimiterCol: string;
  coord0: string;
  coord1: string;
  outputDir: string;
  nsub0: number;
  nsub1: number;
  nrep: number;
  npergroup: number;
  reverseVar: boolean;
  dispenseType: string;
  aspMixing: boolean;
  nzfill: number;
  assayPlatePrefix: string;
  nplate: number;
  nperplate: number;
  ncol: number;
  sortByCol: boolean;
  plateDf: any;
  exportIntermediate: boolean;
  timeDf: any;
  prefix: string;
}

export interface WorklistStep {
  step: string;
  diluent: string;
  volume: number;
  tipSize: number[];
  reservoirTag: string;
  assayPlateTag: string;
  nPerGroup: number;
  nzFill: number;
}

interface PlateConfig {
  sourcePlates: any; // Define the type of sourcePlates
}

interface ExpInput {
  step: string;
  dx: number;
  dz: number;
  volume: number;
  liquid_class: string;
  time: number;
  source: string;
}

interface Plate {
  plate: string;
  volume_well: number;
  nrow: number;
  ncol: number;
  volume_holdover: number;
  volume_usable: number;
}

interface TimeStep {
  step: string;
  exp_time: number;
}

interface InputDict {
  exp_input: ExpInput[];
  delimiter_cell: string;
  delimiter_col: string;
  coord0: string;
  coord1: string;
  output_dir: string;
  nsub0: number;
  nsub1: number;
  nrep: number;
  npergroup: number;
  reverse_var: number;
  dispense_type: string;
  asp_mixing: number;
  nzfill: number;
  assay_plate_prefix: string;
  nplate: number;
  nperplate: number;
  ncol: number;
  sort_by_col: number;
  plate_df: Plate[];
  export_intermediate: number;
  time_df: TimeStep[];
  prefix: string;
}

interface GroupByValue {
  volume_ul: number;
  source: string[];
}

export function fullFromRunWorklist(
  runWorklistInput: WorklistStep[],
  diluent: string,
  solDf: any,
  liquidTypeDf: any,
  plateDf: PlateConfig["sourcePlates"],
  reservoirTag: string,
  assayPlateTag: string,
  tipSize: number[],
  nPerGroup: number,
  nzFill: number
): {
  worklist: WorklistStep[];
  user_solution: any;
  user_labware: any;
  user_tip: any;
} {
  const runWorklist = [...runWorklistInput]; // Copy the input worklist

  // Example logic to generate a full worklist
  const worklist: WorklistStep[] = [];
  for (const step of runWorklist) {
    worklist.push({
      step: step.step,
      diluent,
      volume: step.volume,
      tipSize: tipSize,
      reservoirTag,
      assayPlateTag,
      nPerGroup,
      nzFill,
    });
  }

  // Ensure this function returns a value
  return {
    worklist,
    user_solution: [],
    user_labware: [],
    user_tip: [],
  };
}

export function makeWorklistFull2D(inputDict: InputDict): any[] {
  const worklist: any[] = [];
  const { exp_input } = inputDict;

  // Example logic to iterate through exp_input
  for (const step of exp_input) {
    // Process each step and create worklist entries
    worklist.push({
      step: step.step,
      dx: step.dx,
      dz: step.dz,
      volume: step.volume,
      liquid_class: step.liquid_class,
      time: step.time,
      source: step.source,
    });
  }

  console.log("Generated worklist:", worklist);
  return worklist;
}

export function get_source(worklist: any[], plate_df: any[]): any[] {
  // Logic for getting sources from worklist
  const groupby_df: Record<string, GroupByValue> = worklist.reduce(
    (acc, curr) => {
      const key = `${curr.from_plate}_${curr.from_well}`;
      acc[key] = acc[key] || ({ volume_ul: 0, source: [] } as GroupByValue);
      acc[key].volume_ul += curr.volume_ul;
      acc[key].source.push(curr.source);
      return acc;
    },
    {} as Record<string, GroupByValue>
  );

  console.log("Getting sources from worklist:", groupby_df);
  return map(groupby_df, (value, key) => ({
    plate: key.split("_")[0],
    volume_ul: value.volume_ul,
    source: [...new Set(value.source)],
  }));
  //   return Object.entries(groupby_df).map(
  //     ([key, value]: [string, GroupByValue]) => ({
  //       plate: key.split("_")[0],
  //       volume_ul: value.volume_ul,
  //       source: [...new Set(value.source)],
  //     })
  //   );
}

export function get_sol_df(sol_filename: string): any[] {
  //TODO the following is a placeholder, it will have to be read from the options
  return ["water", 1];
}

export function get_dilution_df(
  target: string,
  diluent: string,
  sol_df: any[],
  target_volume: number = 0,
  tolerance: number = 0.01
): any[] {
  // Logic for dilution calculation
  return []; // Placeholder return
}
