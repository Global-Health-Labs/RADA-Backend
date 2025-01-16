export type PlateInfo = {
  plate: string;
  volume_well: number;
  volume_holdover: number;
  nrow: number;
  ncol: number;
};

export type TimeInfo = {
  step: string;
  exp_time: number;
};

export type ExperimentStep = {
  step: string;
  dx: number;
  dz: number;
  volume: number;
  liquid_class: string;
  time: number;
  source: string;
};

export type WorklistRow = {
  step_index: number;
  step_group_index: number;
  previous_step_index: number;
  destination: number;
  destination_group: number;
  group: number;
  previous_group: number;
} & ExperimentStep;

export type CleanedWorklistRow = {
  step: string;
  dx: number;
  dz: number;
  volume_ul: number;
  liquid_class: string;
  timer_delta: number;
  source: string;
  step_index: number;
  destination: number;
  group_number: number;
  timer_group_check: number;
  guid: number;
  from_path: string;
  asp_mixing: 0 | 1;
  dispense_type: string;
  tip_type: number;
  touchoff_dis: number;
};

/**
 * Base worklist row interface containing common fields
 */
export interface BaseWorklistRow {
  step: string;
  dx: number;
  dz: number;
  volume: number;
  liquid_class: string;
  time: number;
  source: string;
  step_index: number;
  step_group_index: number;
  previous_step_index: number;
  destination: number;
  destination_group: number;
  group: number;
  previous_group: number;
}

export type WorklistWithDestination = {
  to_plate: string;
  to_well: number;
} & CleanedWorklistRow;

/**
 * Final worklist row with source assignment
 */
export type WorklistWithSrc = {
  from_plate: string;
  from_well: number;
} & WorklistWithDestination;

/**
 * Worklist row with target assignment
 */
export type WorklistWithTarget = {
  target: string;
  liquid_type: string;
} & Omit<WorklistWithSrc, "step_index" | "destination">;

export type SourceInfo = {
  source: string;
  volume_ul: number;
  step_index: number;
  step: string;
  volume_usable?: number;
  plate?: string;
  plate_well?: number;
  plate_index?: number;
  from_plate?: string;
  from_well?: number;
  nrow?: number;
  ncol?: number;
};

/**
 * Plate info with well information
 */
export type PlateWellInfo = PlateInfo & {
  plate_well: string;
  plate_index?: string;
};

/**
 * Worklist with plate well columns
 */
export type WorklistWithPlateWellColumns = WorklistWithSrc;

/**
 * Worklist with plate well columns and index
 */
export type WorklistWithIndex = WorklistWithPlateWellColumns & {
  index: number;
};

/**
 * Plate info with plate number
 */
export type PlateWithNumber = {
  plate: string;
  plate_number: number;
  well_number: number;
  from_plate_well?: string;
  to_plate_well?: string;
};

/**
 * Result of volume update operation
 */
export type VolumeUpdateResult = {
  worklist: WorklistWithSrc;
  hasChanges: boolean;
};

/**
 * Solution user input information
 */
export interface SolutionUserInput {
  solution: string;
  plate_well: string;
  user_input: number;
}

/**
 * Volume information for plate wells
 */
export interface VolumeInfo {
  plate_well: string;
  vol_from: number;
  vol_to: number;
  volume_need: number;
  plate_index: string;
  well: string;
  plate: string;
  volume_holdover: number;
  user_input: number;
}
