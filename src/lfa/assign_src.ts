import { getTipType } from "./cleanup_worklist";
import {
  PlateInfo,
  SourceInfo,
  WorklistWithDestination,
  WorklistWithSrc,
} from "./types";

export interface AssignSrcResult {
  worklist: WorklistWithSrc[];
  source_df: SourceInfo[];
}

/**
 * Group and sum volume by source
 */
function groupBySource(worklist: WorklistWithDestination[]): SourceInfo[] {
  const sourceMap = new Map<string, SourceInfo>();

  worklist.forEach((row) => {
    const key = row.source;
    if (!sourceMap.has(key)) {
      sourceMap.set(key, {
        source: key,
        volume_ul: 0,
        step_index: row.step_index || 0,
        step: row.step,
      });
    }
    const info = sourceMap.get(key)!;
    info.volume_ul += row.volume_ul;
  });

  return Array.from(sourceMap.values())
    .filter((info) => info.volume_ul > 0)
    .sort((a, b) => a.source.localeCompare(b.source));
}

/**
 * Assign sources to worklist
 */
export function assignSrc(
  worklist: WorklistWithDestination[],
  plateInfo: PlateInfo[],
  nzfill: number
): AssignSrcResult {
  // First tally up the total volume
  let sourceDf = groupBySource(worklist);

  // Prepare plate info with volume_usable
  const plates = plateInfo.map((plate) => ({
    ...plate,
    volume_usable: plate.volume_well - plate.volume_holdover,
  }));

  // Sort plates by volume_usable (this affects the order of volume types)
  const sortedPlates = [...plates].sort(
    (a, b) => a.volume_usable! - b.volume_usable!
  );

  // Create volume types array from sorted plates (like Python)
  const volumeUsableValues = [0, ...sortedPlates.map((p) => p.volume_usable!)];

  // Assign plates using the sorted volume types
  sourceDf = sourceDf.map((source) => ({
    ...source,
    volume_usable: getTipType(source.volume_ul, volumeUsableValues) as number,
  }));

  // Merge with plate info using sorted plates
  sourceDf = sourceDf.map((source) => {
    const matchingPlate = sortedPlates.find(
      (p) => p.volume_usable === source.volume_usable
    );
    return matchingPlate ? { ...source, ...matchingPlate } : source;
  });

  // Assign wells
  sourceDf = sourceDf.map((source) => ({ ...source, plate_well: 0 }));

  // Go through each step, plate combo and assign well numbers
  const steps = [...new Set(sourceDf.map((s) => s.step))];
  const plateNames = [...new Set(sourceDf.map((s) => s.plate).filter(Boolean))];

  steps.forEach((step) => {
    plateNames.forEach((plate) => {
      if (!plate) return;

      // Get all sources for this step and plate
      let subDf = sourceDf.filter((s) => s.step === step && s.plate === plate);
      if (subDf.length === 0) return;

      const plateData = plates.find((p) => p.plate === plate);
      if (!plateData) return;

      // Sort sources by their original order in the worklist
      subDf.sort((a, b) => {
        const aIndex = worklist.findIndex((w) => w.source === a.source);
        const bIndex = worklist.findIndex((w) => w.source === b.source);
        return aIndex - bIndex;
      });
      // Calculate well numbers based on plate dimensions
      const nwellsPerPlate = plateData.nrow * plateData.ncol;

      subDf.forEach((source, index) => {
        const idx = sourceDf.findIndex(
          (s) =>
            s.source === source.source &&
            s.step === source.step &&
            s.plate === source.plate
        );
        if (idx !== -1) {
          // Python: well_df.loc[sub.index.values, 'well_number'] = plate_well % nwellperplate + 1
          const wellNumber = (index % nwellsPerPlate) + 1;
          sourceDf[idx].plate_well = wellNumber;
          // Python: well_df.loc[sub.index.values, 'plate_number'] = np.floor(plate_well / nwellperplate) + 1
          sourceDf[idx].plate_index = Math.floor(index / nwellsPerPlate) + 1;
        }
      });
    });
  });

  // Calculate plate indices and format plate names
  const plateGroups = new Map<string, SourceInfo[]>();
  sourceDf.forEach((source) => {
    if (!source.plate) return;
    if (!plateGroups.has(source.plate)) {
      plateGroups.set(source.plate, []);
    }
    plateGroups.get(source.plate)!.push(source);
  });

  // Process each plate group
  plateGroups.forEach((sources, plate) => {
    sources.sort((a, b) => (a.plate_well || 0) - (b.plate_well || 0));
    const plateInfo = plates.find((p) => p.plate === plate);
    if (!plateInfo) return;

    sources.forEach((source) => {
      source.from_plate = `${source.plate}_${String(
        source.plate_index
      ).padStart(nzfill, "0")}`;
      source.from_well = source.plate_well;
    });
  });

  // Create output worklist
  const sourceLookup = new Map(
    sourceDf.map((s) => [
      s.source,
      { from_plate: s.from_plate, from_well: s.from_well },
    ])
  );

  let outWorklist = worklist.map((row, index) => {
    const sourceInfo = sourceLookup.get(row.source);
    return {
      ...row,
      from_plate: sourceInfo?.from_plate || "",
      from_well: sourceInfo?.from_well || 0,
    };
  });

  // Special case for imaging
  outWorklist = outWorklist.map((row) => {
    if (row.step === "imaging") {
      return {
        ...row,
        from_plate: row.to_plate,
        from_well: row.to_well,
      };
    }
    return row;
  });

  return {
    worklist: outWorklist,
    source_df: sourceDf,
  };
}
