import { assignDestination } from "./assign_destination";
import { assignSrc } from "./assign_src";
import { cleanupWorklist } from "./cleanup_worklist";
import { getWorklistFullFactorial } from "./one_run";
import { reorderGroups } from "./rearrange_worklist";
import {
  ExperimentStep,
  PlateInfo,
  SourceInfo,
  TimeInfo,
  WorklistWithDestination,
  WorklistWithSrc,
} from "./types";
import { getPlateType } from "./utils";

export interface SourceReal {
  from_plate: string;
  from_well: number;
  volume_ul: number;
  source: string;
  plate: string;
  volume_well: number;
  volume_holdover: number;
  volume_user_input: number;
  nrow: number;
  ncol: number;
}

export interface WorklistOneRunResult {
  worklist: WorklistWithSrc[];
  source_df: SourceInfo[];
  source_real: SourceReal[];
}

/**
 * Make worklist for one run
 */
export function makeWorklistOneRun(
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
  plateDf: PlateInfo[],
  timeDf: TimeInfo[],
  reverseVar: boolean = true,
  delimiterCell: string = ",",
  delimiterCol: string = "_",
  exportIntermediate: boolean = true
): WorklistOneRunResult {
  // Get full factorial worklist
  const factorial = getWorklistFullFactorial(
    expInput,
    numReplicates,
    transferStepsPerGroup,
    delimiterCell,
    delimiterCol,
    reverseVar ? 1 : 0 // Convert boolean to number for Python compatibility
  );

  // Reorder groups based on timing
  const worklist = reorderGroups(factorial.worklist, timeDf);

  // Clean up worklist
  const cleanedWorklist = cleanupWorklist(worklist, dispenseType, aspMixing);
  // worklist.forEach((row) => (row.touchoff_dis = -1)); // Hard coded as it's always the case for LFAs

  // Assign destinations
  const worklistWithDestination = assignDestination(
    cleanedWorklist,
    assayPlatePrefix,
    nplate,
    nperplate,
    ncol,
    nzfill,
    sortByCol
  );

  // Assign sources
  const sourceOut = assignSrc(worklistWithDestination, plateDf, nzfill);
  const worklistWithSrc = sourceOut.worklist;
  const sourceDf = sourceOut.source_df;

  // Calculate source_real by grouping and aggregating
  const sourceReal: SourceReal[] = [];
  const sourceGroups = new Map<
    string,
    Map<number, { volume: number; source: string }>
  >();

  // Group by from_plate and from_well
  worklistWithSrc.forEach((row) => {
    if (
      !row.from_plate ||
      !row.from_well ||
      !row.volume_ul ||
      row.volume_ul <= 0
    ) {
      return;
    }

    if (!sourceGroups.has(row.from_plate)) {
      sourceGroups.set(row.from_plate, new Map());
    }
    const plateGroup = sourceGroups.get(row.from_plate)!;

    if (!plateGroup.has(row.from_well)) {
      plateGroup.set(row.from_well, { volume: 0, source: row.source });
    }
    const wellGroup = plateGroup.get(row.from_well)!;
    wellGroup.volume += row.volume_ul;
  });

  // Convert groups to source_real array
  sourceGroups.forEach((plateGroup, fromPlate) => {
    plateGroup.forEach((wellGroup, fromWell) => {
      if (wellGroup.volume <= 0) return;

      const plate = getPlateType(fromPlate);
      const plateInfo = plateDf.find((p) => p.plate === plate);
      if (plateInfo) {
        sourceReal.push({
          from_plate: fromPlate,
          from_well: fromWell,
          volume_ul: wellGroup.volume,
          source: wellGroup.source,
          // plate: plate,
          ...plateInfo,
          volume_user_input: wellGroup.volume + plateInfo.volume_holdover,
        });
      }
    });
  });

  // Export intermediate files if requested
  if (exportIntermediate) {
    // Note: File export functionality would need to be implemented separately
    // as it depends on the specific file system and format requirements
  }

  return {
    worklist: worklistWithSrc,
    source_df: sourceDf,
    source_real: sourceReal,
  };
}
