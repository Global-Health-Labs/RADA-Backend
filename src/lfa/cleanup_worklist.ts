import { CleanedWorklistRow, WorklistRow } from "./types";

/**
 * Get tip types for each volume in a volume list
 * @param volume Volume to get tip type for
 * @param types Array of tip sizes, sorted in ascending order (default [0, 50, 300, 1000])
 * @returns The first compatible tip type that can handle the volume
 */
export function getTipType(
  volume: number,
  types: number[] = [0, 50, 300, 1000]
): number {
  // Find the first tip size that can handle the volume (no sorting needed)
  for (let i = 0; i < types.length; i++) {
    if (volume <= types[i]) {
      return types[i];
    }
  }

  // If no compatible tip found, return the largest available
  return types[types.length - 1];
}

/**
 * Clean up worklist by renaming columns and adding required fields
 * @param worklist Input worklist
 * @param dispenseType Dispense type
 * @param aspMixing Mixing during aspiration
 * @returns Cleaned worklist
 */
export function cleanupWorklist(
  worklist: WorklistRow[],
  dispenseType: string,
  aspMixing: 0 | 1
): CleanedWorklistRow[] {
  return worklist.map((row) => {
    // Create base object with renamed fields
    const cleanedRow: CleanedWorklistRow = {
      step: row.step,
      dx: row.dx,
      dz: row.dz,
      volume_ul: Number(row.volume),
      liquid_class: row.liquid_class,
      timer_delta: row.time,
      source: row.source,
      step_index: row.step_index,
      group_number: row.group,
      timer_group_check: row.previous_group,
      destination: row.destination,
      guid: row.destination,
      from_path: "some path",
      asp_mixing: aspMixing,
      dispense_type: dispenseType,
      tip_type: getTipType(Number(row.volume)) as number,
      touchoff_dis: -1, // hard code here because it is always the case when dispensing on LFAs
    };

    // Create temporary dispense type without underscores
    const dispenseTypeTemp = dispenseType.replace(/_/g, "");

    // Construct liquid class string
    cleanedRow.liquid_class = `ivl_tip${cleanedRow.tip_type}_${cleanedRow.liquid_class}_${dispenseTypeTemp}`;
    return cleanedRow;
  });
}
