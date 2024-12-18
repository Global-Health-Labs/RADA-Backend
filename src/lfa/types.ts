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
export interface WorklistWithSrc extends WorklistWithDestination {
  from_plate: string;
  from_well: number;
}
