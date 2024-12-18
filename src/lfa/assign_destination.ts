import { CleanedWorklistRow, WorklistWithDestination } from "./types";

export interface AssayAreaRow {
  plate: string;
  well: number;
  col: number;
  destination: number;
}

/**
 * Get dataframe about the assay area
 * @param assayPlatePrefix Prefix of assay plate
 * @param nplate Number of plates
 * @param nperplate Number of strips per plate
 * @param ncol Number of columns
 * @param nzfill Number to add leading zeros
 * @param sortByCol Sort by column
 * @returns Array describing the assay area
 */
export function getAssayAreaDf(
  assayPlatePrefix: string,
  nplate: number,
  nperplate: number,
  ncol: number,
  nzfill: number,
  sortByCol: boolean
): AssayAreaRow[] {
  // Generate plate names with padded numbers
  const plates = Array.from(
    { length: nplate },
    (_, i) => `${assayPlatePrefix}_${String(i + 1).padStart(nzfill, "0")}`
  );

  // Generate wells (1 to nperplate)
  const wells = Array.from({ length: nperplate }, (_, i) => i + 1);

  // Create cartesian product of plates and wells
  const assayArea: AssayAreaRow[] = [];
  plates.forEach((plate) => {
    wells.forEach((well) => {
      assayArea.push({
        plate,
        well,
        col: ((well - 1) % ncol) + 1,
        destination: 0, // Will be set after sorting
      });
    });
  });

  // Sort based on sortByCol flag
  assayArea.sort((a, b) => {
    if (a.plate !== b.plate) return a.plate.localeCompare(b.plate);
    if (sortByCol) {
      if (a.col !== b.col) return a.col - b.col;
      return a.well - b.well;
    }
    return a.well - b.well;
  });

  // Assign destinations (1-based index)
  assayArea.forEach((row, index) => {
    row.destination = index + 1;
  });

  return assayArea;
}

/**
 * Assign destinations to worklist
 * @param worklist Input worklist
 * @param assayPlatePrefix Prefix of assay plate
 * @param nplate Number of plates
 * @param nperplate Number of strips per plate
 * @param ncol Number of columns
 * @param nzfill Number to add leading zeros
 * @param sortByCol Sort by column
 * @returns Worklist with assigned destinations (strip locations)
 */
export function assignDestination(
  worklist: CleanedWorklistRow[],
  assayPlatePrefix: string,
  nplate: number,
  nperplate: number,
  ncol: number,
  nzfill: number,
  sortByCol: boolean
): WorklistWithDestination[] {
  // Get assay area mapping
  const assayArea = getAssayAreaDf(
    assayPlatePrefix,
    nplate,
    nperplate,
    ncol,
    nzfill,
    sortByCol
  );

  // Create mapping from destination to plate/well
  const destToPlateWell = new Map(
    assayArea.map((row) => [
      row.destination,
      { to_plate: row.plate, to_well: row.well },
    ])
  );

  // Map each worklist row to include plate and well info
  return worklist.map((row, index) => {
    const plateWell = destToPlateWell.get(row.destination);
    if (!plateWell) {
      throw new Error(`No mapping found for destination ${row.destination}`);
    }
    return {
      ...row,
      ...plateWell,
    };
  });
}
