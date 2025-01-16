import { WorklistWithSrc, WorklistWithTarget } from "./types";

interface SourceInfo {
  fromPlate: string;
  fromWell: number;
  volumeUl: number;
  source: string;
  plate: string;
  volumeUserInput: number;
  nrow: number;
  ncol: number;
  volumeWell: number;
  volumeHoldover: number;
  volumeUsable: number;
}

interface UserSolution {
  solution: string;
  volume: number;
  plate: string;
  well: number;
}

interface UserLabware {
  plate: string;
  type: string;
}

interface UserTip {
  size: number;
  count: number;
}

interface WorklistResult {
  worklist: WorklistRow[];
  user_solution: UserSolution[];
  user_labware: UserLabware[];
  user_tip: UserTip[];
}

interface SolutionDf {
  [key: string]: number;
}

interface DilutionRow {
  [key: string]: number | string;
  target: string;
}

interface PlateWellRow {
  [key: string]: string | number;
  plate: string;
  plate_number: number;
  well_number: number;
}

interface WorklistRow {
  [key: string]: string | number | undefined;
  volume_ul?: number;
}

interface LiquidTypeInfo {
  solution: string;
  liquid_type: string;
}

interface WorklistFromRecipeParams {
  diluent: string;
  solutionInfo: Record<string, any>;
  liquidTypeInfo: LiquidTypeInfo[];
  plateInfo: PlateInfo[];
  reservoirTag: string;
  ignoreTag: string;
  tipSize: number[];
  nPerGroup: number;
  nzfill: number;
}

type WorklistWithPlateWellColumns = {
  from_plate_well: string;
  to_plate_well: string;
  index: number;
} & WorklistWithSrc;

interface PlateWellInfo {
  plate: string;
  plate_well: string;
  plate_index: string;
  nrow: number;
  ncol: number;
  volume_well: number;
  volume_holdover: number;
}

interface VolumeUpdateResult {
  worklist: WorklistWithSrc[];
  hasChanges: boolean;
}

interface WorklistWithIndex extends WorklistWithSrc {
  index: number;
}

interface PlateWithNumber {
  plate: string;
  plate_number: number;
  well_number: number;
}

interface SolutionUserInput {
  solution: string;
  plate_well: string;
  user_input: number;
}

interface VolumeInfo {
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

/**
 * Get dataframe showing how the solution is made from sources
 * @param target Array of target solution names
 * @param diluent Diluent name (e.g. 'water')
 * @param solDf Solution definitions dataframe
 * @param targetVolume Array of target volumes
 * @param tolerance Tolerance for concentrations
 * @returns Array of rows describing how to make each solution
 */
export function getDilutionDf(
  target: string[],
  diluent: string,
  solDf: SolutionDf,
  targetVolume?: number[],
  tolerance: number = 0.01
): DilutionRow[] {
  // Handle default target volume - use array of ones if not provided
  if (!targetVolume || targetVolume.some(v => v === undefined)) {
    targetVolume = new Array(target.length).fill(1);
  }

  // Create array to hold solution rows
  const listEachMakeDf: DilutionRow[] = [];

  // Process each target and volume pair
  target.forEach((eachTarget, index) => {
    const eachVolume = targetVolume![index];

    // Get target solution composition
    const targetDf = { [eachTarget]: solDf[eachTarget] || {} };
    
    // Filter to keep only columns where values > 0
    const ingredients = Object.entries(targetDf[eachTarget] || {})
      .filter(([_, value]) => value > 0)
      .map(([key]) => key);

    // Initialize make row with target volume
    const eachMakeDf: DilutionRow = {
      target: eachTarget,
    };
    target.forEach(t => eachMakeDf[t] = 0);

    // Check if ingredients exist and are in solDf (including diluent)
    if (ingredients.length > 0 && 
        [...ingredients, diluent].every(ing => ing in solDf)) {
      
      // Find stock solutions that have target ingredients
      const stockSolutions = Object.entries(solDf)
        .filter(([name, solution]) => {
          if (name === eachTarget) return false;
          
          // Has any target ingredient
          const hasIngredient = ingredients.some(ing => 
            (solution[ing] || 0) > 0
          );
          
          // Only has target ingredients (excluding volume)
          const onlyHasIngredients = Object.entries(solution)
            .filter(([ing]) => !ingredients.includes(ing))
            .every(([_, val]) => val === 0);
            
          return hasIngredient && onlyHasIngredients;
        })
        .map(([name]) => name);

      if (stockSolutions.length > 0) {
        // Prepare matrices for NNLS
        const targetMatrix = ingredients.map(ing => 
          targetDf[eachTarget][ing] || 0
        );
        targetMatrix.push(1); // Add volume column

        const stockMatrix = stockSolutions.map(stock => {
          const row = ingredients.map(ing => 
            solDf[stock][ing] || 0
          );
          row.push(1); // Add volume column
          return row;
        });

        // Add diluent row
        const diluentRow = ingredients.map(() => 0);
        diluentRow.push(1);
        stockMatrix.push(diluentRow);

        try {
          // TODO: Implement or import NNLS solver
          // For now using placeholder that will need to be replaced
          const solution = solveNNLS(stockMatrix, targetMatrix);
          
          // Verify solution
          const verify = multiplyMatrices(stockMatrix, solution);
          const withinTolerance = verify.every((val, i) => 
            Math.abs((val - targetMatrix[i]) / targetMatrix[i]) <= tolerance
          );

          if (withinTolerance) {
            // Create solution row with calculated volumes
            [...stockSolutions, diluent].forEach((stock, i) => {
              eachMakeDf[stock] = solution[i] * eachVolume;
            });
          } else {
            eachMakeDf[eachTarget] = eachVolume;
          }
        } catch {
          eachMakeDf[eachTarget] = eachVolume;
        }
      } else {
        eachMakeDf[eachTarget] = eachVolume;
      }
    } else {
      eachMakeDf[eachTarget] = eachVolume;
    }

    // Round values and handle -0 case
    Object.keys(eachMakeDf).forEach((key) => {
      if (typeof eachMakeDf[key] === "number") {
        eachMakeDf[key] = Number(eachMakeDf[key].toFixed(2));
        if (eachMakeDf[key] === -0 || Object.is(eachMakeDf[key], -0)) {
          eachMakeDf[key] = 0;
        }
      }
    });

    listEachMakeDf.push(eachMakeDf);
  });

  return listEachMakeDf;
}

// Helper function to solve non-negative least squares
// This needs to be implemented or replaced with a proper NNLS solver
function solveNNLS(A: number[][], b: number[]): number[] {
  // Placeholder - needs actual NNLS implementation
  return b.map(() => 0);
}

// Helper function to multiply matrices
function multiplyMatrices(A: number[][], x: number[]): number[] {
  return A.map(row => 
    row.reduce((sum, val, i) => sum + val * x[i], 0)
  );
}

/**
 * Get source information
 * @param worklist Worklist data
 * @param plateInfo Array of plate information
 * @returns Array of source information
 */
function getSource(
  worklist: WorklistWithSrc[] | WorklistWithTarget[],
  plateInfo: PlateInfo[]
): SourceInfo[] {
  // Create a map to store aggregated data
  const sourceMap = new Map<
    string,
    {
      from_plate: string;
      from_well: number;
      source: string;
      volume_ul: number;
    }
  >();

  // Aggregate volumes by unique combination of from_plate, from_well, and source
  worklist.forEach((row) => {
    if (!row.volume_ul || !row.from_plate || row.from_well === undefined)
      return;

    const key = `${row.from_plate}_${row.from_well}_${row.source}`;
    if (!sourceMap.has(key)) {
      sourceMap.set(key, {
        from_plate: row.from_plate,
        from_well: row.from_well,
        source: row.source,
        volume_ul: 0,
      });
    }
    const entry = sourceMap.get(key)!;
    entry.volume_ul += row.volume_ul;
  });

  // Convert to array and add plate information
  const sourceReal: SourceInfo[] = Array.from(sourceMap.values())
    .filter((entry) => entry.volume_ul > 0)
    .map((entry) => {
      // Extract base plate name (remove the index suffix)
      const plate = entry.from_plate.split("_").slice(0, -1).join("_");
      const plateData = plateInfo.find((p) => p.plate === plate);

      if (!plateData) {
        console.warn(`No plate data found for plate: ${plate}`);
        return null;
      }

      return {
        fromPlate: entry.from_plate,
        fromWell: entry.from_well,
        source: entry.source,
        volumeUl: entry.volume_ul,
        plate,
        nrow: plateData.nrow,
        ncol: plateData.ncol,
        volumeWell: plateData.volume_well,
        volumeHoldover: plateData.volume_holdover,
        volumeUsable: plateData.volume_well - plateData.volume_holdover,
        volumeUserInput: entry.volume_ul + plateData.volume_holdover,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => {
      // Sort by from_plate first, then by from_well
      if (a.fromPlate !== b.fromPlate) {
        return a.fromPlate.localeCompare(b.fromPlate);
      }
      return a.fromWell - b.fromWell;
    });

  console.log("Source real:", sourceReal);
  return sourceReal;
}

/**
 * Assign plate and well numbers to worklist entries
 * @param worklist Worklist data
 * @param plateDfInput Plate definitions
 * @param colname Column to group by
 * @param useHoldover Whether to use holdover volume
 * @returns Array of rows with plate and well assignments
 */
export function assignPlateWell(
  worklist: WorklistRow[],
  plateDfInput: PlateInfo[],
  colname: string,
  useHoldover: boolean = false
): PlateWellRow[] {
  // If worklist is empty, return empty array
  if (worklist.length === 0) {
    return [];
  }

  // First tally up the total volume by grouping
  const volumeGroups = new Map<string, number>();
  worklist.forEach((row) => {
    const key = row[colname];
    if (row.volume_ul && key !== undefined) {
      volumeGroups.set(
        String(key),
        (volumeGroups.get(String(key)) || 0) + row.volume_ul
      );
    }
  });

  // Create well_df equivalent
  let wellDf = Array.from(volumeGroups.entries())
    .filter(([_, volume]) => volume > 0)
    .map(([key, volume]) => ({
      [colname]: key,
      volume_ul: volume,
    }));

  // If no valid entries, return empty array
  if (wellDf.length === 0) {
    return [];
  }

  // Sort plates by volume capacity (ascending)
  const plateDf = [...plateDfInput].sort((a, b) => {
    // Calculate usable volume considering useHoldover flag
    const volumeA = a.volume_well - (useHoldover ? a.volume_holdover : 0);
    const volumeB = b.volume_well - (useHoldover ? b.volume_holdover : 0);
    return volumeA - volumeB;
  });

  // Assign plates and wells
  const result: PlateWellRow[] = wellDf.map((row, index) => {
    const key = row[colname];
    const plate = plateDf[0]; // Use first plate for now
    const nwellsPerPlate = plate.nrow * plate.ncol;

    return {
      [colname]: key,
      plate: plate.plate,
      plate_number: Math.floor(index / nwellsPerPlate) + 1,
      well_number: (index % nwellsPerPlate) + 1,
    };
  });

  return result;
}

/**
 * Renumber wells for reservoir plates
 * @param worklist Input worklist
 * @param reservoirTag Tag for reservoirs
 * @returns Updated worklist with renumbered wells
 */
export function renumberReservoir(
  worklist: WorklistWithSrc[] | WorklistWithTarget[],
  reservoirTag: string
): WorklistWithSrc[] | WorklistWithTarget[] {
  // If worklist is empty, return empty array
  if (worklist.length === 0) {
    return [];
  }

  // Create a deep copy of the worklist
  const out = worklist.map((row) => ({ ...row }));

  // Get unique group numbers
  const groupNumbers = [...new Set(out.map((row) => row.group_number))];

  // Process each group
  groupNumbers.forEach((group) => {
    // Handle to_plate (destination)
    const reservoirRows = out.filter(
      (row) =>
        row.group_number === group &&
        row.to_plate &&
        row.to_plate.includes(reservoirTag)
    );

    if (reservoirRows.length > 0) {
      reservoirRows.forEach((row, index) => {
        const idx = out.findIndex((r) => r === row);
        if (idx !== -1) {
          out[idx].to_well = (index % 8) + 1;
        }
      });
    }
  });

  return out;
}

/**
 * Get worklist from recipe
 * @param makeSolutionDf Solution recipe dataframe
 * @param params Parameters for worklist generation
 * @returns Generated worklist
 */
function getWorklistFromRecipe(
  makeSolutionDf: DilutionRow[],
  params: WorklistFromRecipeParams
): WorklistWithTarget[] {
  // First turn df into transfer list
  const worklist: WorklistWithTarget[] = [];

  // Convert makeSolutionDf into transfer list format
  makeSolutionDf.forEach((row) => {
    const target = row.target as string;
    Object.entries(row).forEach(([source, volume]) => {
      if (source !== "target" && typeof volume === "number" && volume > 0) {
        // Skip if target and source are the same
        if (target === source) return;

        worklist.push({
          target,
          source,
          volume_ul: volume,
          // Default values matching Python
          asp_mixing: 0,
          dispense_type: "Jet_Empty",
          dx: 0,
          dz: 0,
          step: "solution",
          timer_delta: 0,
          timer_group_check: 0,
          touchoff_dis: 1,
          from_path: `${source} --> ${target}`,
          tip_type: 0,
          liquid_type: "pbst", // Default liquid type
          liquid_class: "",
          group_number: 0,
          from_well: 0,
          from_plate: "",
          guid: target,
          to_well: 0,
          to_plate: "",
        });
      }
    });
  });

  // If no valid transfers, return empty array
  if (worklist.length === 0) {
    return [];
  }

  // Get liquid type for each source
  worklist.forEach((row) => {
    const liquidInfo = params.liquidTypeInfo.find(
      (info) => info.solution === row.source
    );
    if (liquidInfo) {
      row.liquid_type = liquidInfo.liquid_type;
    }
  });

  // Assign tip types based on volume
  worklist.forEach((row) => {
    const tipType = getTipType(row.volume_ul, params.tipSize);
    if (tipType !== undefined) {
      row.tip_type = tipType;
      // Set liquid class
      row.liquid_class = `ivl_tip${tipType}_${
        row.liquid_type
      }_${row.dispense_type.replace(/[^a-zA-Z]+/g, "")}`;
    }
  });

  // Group by target, liquid class, and touchoff
  let groupNumber = 0;
  const groups = new Map<string, number[]>();
  worklist.forEach((row) => {
    const key = `${row.guid}_${row.liquid_class}_${row.touchoff_dis}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(worklist.indexOf(row));
  });

  // Assign group numbers based on n_per_group
  groups.forEach((indices) => {
    indices.forEach((index, i) => {
      worklist[index].group_number =
        Math.floor(i / params.nPerGroup) + 1 + groupNumber;
    });
    groupNumber = Math.max(
      ...indices.map((i) => worklist[i].group_number || 0)
    );
  });

  // Assign wells for source and destination
  const plateDstRows = assignPlateWell(
    worklist,
    params.plateInfo,
    "guid",
    false
  );
  const plateSrcRows = assignPlateWell(
    worklist,
    params.plateInfo,
    "source",
    true
  );

  // Shift plate numbers
  const [newDstRows, newSrcRows] = shiftPlate([plateDstRows, plateSrcRows]);

  // Update source plates and wells
  newSrcRows.forEach((row, i) => {
    worklist[i].from_well = row.well_number;
    worklist[i].from_plate = `${row.plate}_${String(row.plate_number).padStart(
      params.nzfill,
      "0"
    )}`;
  });

  // Update destination plates and wells
  newDstRows.forEach((row, i) => {
    worklist[i].to_well = row.well_number;
    worklist[i].to_plate = `${row.plate}_${String(row.plate_number).padStart(
      params.nzfill,
      "0"
    )}`;
  });

  // Renumber reservoir wells
  return renumberReservoir(
    worklist,
    params.reservoirTag
  ) as WorklistWithTarget[];
}

/**
 * Get appropriate tip type for volume
 * @param volume Volume to dispense
 * @param tipSizes Available tip sizes
 * @returns Selected tip type
 */
function getTipType(volume: number, tipSizes: number[]): number | undefined {
  const sortedSizes = [...tipSizes].sort((a, b) => a - b);
  return sortedSizes.find((size) => volume <= size);
}

/**
 * Add plate_well columns to worklist
 * @param worklist Input worklist
 * @param reservoirTag Tag for reservoirs (default 'ivl_1')
 * @returns Updated worklist with plate_well columns
 */
export function addPlateWellColumns(
  worklist: WorklistWithSrc[],
  reservoirTag = "ivl_1"
): WorklistWithPlateWellColumns[] {
  // Create a deep copy
  const worklistCopy = worklist.map((row) => ({ ...row }));

  // Create temporary well numbers for handling reservoirs
  return worklist.map((row, index) => {
    let tempToWell = row.to_well;
    let tempFromWell = row.from_well;

    // Set well number to 1 for reservoir plates
    if (reservoirTag.toLowerCase() !== "none") {
      if (row.to_plate.includes("ivl_1")) {
        tempToWell = 1;
      }
      if (row.from_plate.includes("ivl_1")) {
        tempFromWell = 1;
      }
    }

    // Add plate_well columns
    return {
      ...row,
      index,
      to_plate_well: `${row.to_plate}|${tempToWell}`,
      from_plate_well: `${row.from_plate}|${tempFromWell}`,
    };
  });
}

/**
 * Find plate information for given plate_well values
 * @param plateWells Array of plate_well strings or single plate_well string
 * @param plateDf Array of plate information
 * @returns Array of plate info with well information or single plate info
 */
export function findPlateInfo(
  plateWells: string[] | string,
  plateDf: PlateInfo[]
): PlateWellInfo[] | PlateInfo | undefined {
  // Handle single plate well case
  if (typeof plateWells === "string") {
    const [plateIndex, well] = plateWells.split("|");
    const plate = plateIndex.split("_").slice(0, -1).join("_");
    const plateInfo = plateDf.find((p) => p.plate === plate);
    if (plateInfo) {
      return {
        ...plateInfo,
        well: parseInt(well),
      };
    }
    return undefined;
  }

  // Handle array of plate wells
  return plateWells.map((plateWell) => {
    const [plateIndex] = plateWell.split("|");
    const plate = plateIndex.split("_").slice(0, -1).join("_");
    const plateInfo = plateDf.find((p) => p.plate === plate);
    if (!plateInfo) {
      throw new Error(`Plate ${plate} not found in plate info`);
    }

    return {
      ...plateInfo,
      plate_well: plateWell,
      plate_index: plateIndex,
      well: parseInt(plateWell.split("|")[1]),
    };
  });
}

/**
 * Update volumes only, to account for holdover volumes
 * @param worklistInput Input worklist
 * @param plateDf Array of plate information
 * @param reservoirTag Tag for reservoirs
 * @returns Tuple of [updated worklist, whether changes were made]
 */
export function updateVolumeOnly(
  worklistInput: WorklistWithSrc[],
  plateDf: PlateInfo[],
  reservoirTag: string
): VolumeUpdateResult {
  let hasChanges = false;

  // Create deep copy and add plate_well columns
  const worklist = addPlateWellColumns(worklistInput, reservoirTag);

  // Filter for positive transfers only
  const positiveTransfers = worklist.filter((row) => row.volume_ul > 0);

  // Get plate info for from_plate_well
  const fromPlateInfo = findPlateInfo(
    positiveTransfers.map((row) => row.from_plate_well),
    plateDf
  );

  // Process transfers from bottom up
  for (let i = positiveTransfers.length - 1; i >= 0; i--) {
    const row = positiveTransfers[i];
    const currentPlateWell = row.from_plate_well;

    // Find matching plate info
    const plateInfo = fromPlateInfo.find(
      (info) => info.plate_well === currentPlateWell
    );
    if (!plateInfo) continue;

    // Get all transfers in/out of current plate well
    const transfersOut = positiveTransfers.filter(
      (r) => r.from_plate_well === currentPlateWell && r.index <= row.index
    );
    const transfersIn = positiveTransfers.filter(
      (r) => r.to_plate_well === currentPlateWell && r.index <= row.index
    );

    // Calculate volumes
    if (transfersIn.length > 0) {
      const volumeOut = transfersOut.reduce((sum, r) => sum + r.volume_ul, 0);
      const volumeIn = transfersIn.reduce((sum, r) => sum + r.volume_ul, 0);

      // Scale up input volumes if necessary
      const volumeScale = (volumeOut + plateInfo.volume_holdover) / volumeIn;
      if (volumeScale > 1 && volumeOut > 0) {
        transfersIn.forEach((transfer) => {
          const index = worklist.findIndex((r) => r.index === transfer.index);
          if (index !== -1) {
            worklist[index].volume_ul *= volumeScale;
          }
        });
        hasChanges = true;
      }
    }
  }

  // Remove temporary index property and renumber reservoir wells
  const result = renumberReservoir(
    worklist.map(({ index, ...rest }) => rest),
    reservoirTag
  );

  return { worklist: result, hasChanges };
}

/**
 * Update plates and wells
 * @param worklistInput Input worklist
 * @param plateDf Array of plate information
 * @param nzfill Number of digits to fill to using leading zeroes
 * @param ignoreTag Tag to ignore (default 'none')
 * @param reservoirTag Tag for reservoirs (default 'none')
 * @returns Updated worklist
 */
export function updatePlateWell(
  worklistInput: WorklistWithSrc[],
  plateDf: PlateInfo[],
  nzfill: number,
  ignoreTag = "none",
  reservoirTag = "none"
): WorklistWithSrc[] {
  const worklist = [...worklistInput];
  const worklistWithPlateWell = addPlateWellColumns(worklist, reservoirTag);

  // Get unique plate wells
  const plateWells = new Set<string>();
  worklistWithPlateWell.forEach((row) => {
    if (row.from_plate_well) plateWells.add(row.from_plate_well);
    if (row.to_plate_well) plateWells.add(row.to_plate_well);
  });

  // Process each unique plate well
  Array.from(plateWells).forEach((plateWell) => {
    // Get rows with this plate well
    const rows = worklistWithPlateWell.filter(
      (row) =>
        row.from_plate_well === plateWell || row.to_plate_well === plateWell
    );

    // Skip if plate well is in ignore tag
    if (
      rows.some(
        (row) =>
          (row.from_plate && row.from_plate.includes(ignoreTag)) ||
          (row.to_plate && row.to_plate.includes(ignoreTag))
      )
    ) {
      return;
    }

    // Find plate info
    const plateInfo = findPlateInfo(plateWell, plateDf);
    if (!plateInfo) return;

    // Update plate and well in worklist
    rows.forEach((row) => {
      if (row.from_plate_well === plateWell) {
        row.from_plate = `${plateInfo.plate}_${String(
          plateInfo.plate_number
        ).padStart(nzfill, "0")}`;
        row.from_well = plateInfo.well;
      }
      if (row.to_plate_well === plateWell) {
        row.to_plate = `${plateInfo.plate}_${String(
          plateInfo.plate_number
        ).padStart(nzfill, "0")}`;
        row.to_well = plateInfo.well;
      }
    });
  });

  return worklistWithPlateWell;
}

/**
 * Shift the plate indices up to make the deck tidier
 * @param plateList List of plate arrays to shift
 * @returns New list of shifted plates
 */
export function shiftPlate(plateList: PlateInfo[][]): PlateInfo[][] {
  // Deep copy input arrays
  const newPlateList = plateList.map((arr) => arr.map((obj) => ({ ...obj })));

  // Process each plate array after the first one
  for (let i = 1; i < newPlateList.length; i++) {
    const currentPlates = newPlateList[i];
    const previousPlates = newPlateList.slice(0, i).flat();

    // Get unique plate types in current array
    const uniquePlates = Array.from(new Set(currentPlates.map((p) => p.plate)));

    // For each plate type, shift numbers based on previous max
    uniquePlates.forEach((plateType) => {
      const currentPlatesOfType = currentPlates.filter(
        (p) => p.plate === plateType
      );
      const maxPrevious = Math.max(
        0,
        ...previousPlates
          .filter((p) => p.plate === plateType)
          .map((p) => p.plate_number)
      );
      const minCurrent = Math.min(
        ...currentPlatesOfType.map((p) => p.plate_number)
      );

      // Update plate numbers
      currentPlatesOfType.forEach((plate) => {
        plate.plate_number += maxPrevious - minCurrent + 1;
      });
    });
  }

  return newPlateList;
}

/**
 * Shift plate indices considering 2 worklists
 * @param worklist0Input First worklist
 * @param worklist1Input Second worklist
 * @returns Tuple of updated worklists
 */
export function shiftPlateWorklist(
  worklist0Input: WorklistWithSrc[],
  worklist1Input: WorklistWithSrc[]
): [WorklistWithSrc[], WorklistWithSrc[]] {
  const worklist0 = [...worklist0Input];
  const worklist1 = [...worklist1Input];

  // Get plate type numbers for both worklists
  const [to0, nTo0] = getPlateTypeNumber(
    worklist0.map((w) => ({ to_plate: w.to_plate }))
  );
  const [from0, nFrom0] = getPlateTypeNumber(
    worklist0.map((w) => ({ from_plate: w.from_plate }))
  );
  const [to1, nTo1] = getPlateTypeNumber(
    worklist1.map((w) => ({ to_plate: w.to_plate }))
  );
  const [from1, nFrom1] = getPlateTypeNumber(
    worklist1.map((w) => ({ from_plate: w.from_plate }))
  );

  // Shift plates
  const shiftedPlates = shiftPlate([to0, from0, to1, from1]);
  const [newTo0, newFrom0, newTo1, newFrom1] = shiftedPlates;

  // Update plate numbers in worklists
  worklist0.forEach((row, i) => {
    if (newTo0[i]) {
      row.to_plate = `${newTo0[i].plate}_${String(
        newTo0[i].plate_number
      ).padStart(nTo0, "0")}`;
    }
    if (newFrom0[i]) {
      row.from_plate = `${newFrom0[i].plate}_${String(
        newFrom0[i].plate_number
      ).padStart(nFrom0, "0")}`;
    }
  });

  worklist1.forEach((row, i) => {
    if (newTo1[i]) {
      row.to_plate = `${newTo1[i].plate}_${String(
        newTo1[i].plate_number
      ).padStart(nTo1, "0")}`;
    }
    if (newFrom1[i]) {
      row.from_plate = `${newFrom1[i].plate}_${String(
        newFrom1[i].plate_number
      ).padStart(nFrom1, "0")}`;
    }
  });

  return [worklist0, worklist1];
}

/**
 * Make from and to match for imaging steps
 * @param worklistInput Input worklist
 * @returns Updated worklist
 */
export function matchFromToImaging(
  worklistInput: WorklistWithSrc[]
): WorklistWithSrc[] {
  const worklist = [...worklistInput];

  worklist.forEach((row) => {
    if (row.command?.toLowerCase() === "imaging") {
      row.from_plate = row.to_plate;
      row.from_well = row.to_well;
    }
  });

  return worklist;
}

/**
 * Make worklist to link worklists to make solutions and to run assays
 * @param solWorklist Worklist to make solutions
 * @param runWorklist Worklist to run assays
 * @param tipSize List of tip sizes
 * @param nPerGroup Number of steps per group
 * @returns Link worklist
 */
export function getLinkSolRun(
  solWorklist: WorklistWithSrc[],
  runWorklist: WorklistWithSrc[],
  tipSize: number[],
  nPerGroup: number
): WorklistWithSrc[] {
  // Get source information
  const source = getSource(runWorklist, []);
  const solSource = getSource(solWorklist, []);

  // Create link worklist
  const linkWorklist: WorklistWithSrc[] = [];
  let groupNumber = Math.max(
    ...solWorklist.map((row) => row.group_number || 0),
    ...runWorklist.map((row) => row.group_number || 0)
  );

  source.forEach((src) => {
    const matchingSol = solSource.find(
      (sol) => sol.source === src.source && sol.plate === src.plate
    );

    if (matchingSol) {
      const volume = src.volumeUserInput;
      const maxTip = Math.max(...tipSize);
      const volumes = splitTransfer(volume, maxTip);

      volumes.forEach((vol, i) => {
        linkWorklist.push({
          command: "transfer",
          volume_ul: vol,
          from_plate: matchingSol.fromPlate,
          from_well: matchingSol.fromWell,
          to_plate: src.plate,
          to_well: src.fromWell,
          liquid_class: `ivl_tip${getTipType(vol, tipSize)}_default_Surface`,
          tip_type: getTipType(vol, tipSize),
          group_number: Math.floor(i / nPerGroup) + 1 + groupNumber,
        });
      });

      groupNumber = Math.max(
        ...linkWorklist.map((row) => row.group_number || 0)
      );
    }
  });

  return linkWorklist;
}

/**
 * Concatenate worklists
 * @param worklist0Input First worklist
 * @param worklist1Input Second worklist
 * @returns Concatenated worklist
 */
export function worklistConcat(
  worklist0Input: WorklistWithSrc[],
  worklist1Input: WorklistWithSrc[]
): WorklistWithSrc[] {
  return [...worklist0Input, ...worklist1Input];
}

/**
 * Consolidate transfer steps
 * @param worklistInput Input worklist
 * @param keepTag Tag to keep untouched
 * @param reservoirTag Tag for reservoirs
 * @returns Updated worklist
 */
export function consolidateTransfer(
  worklistInput: WorklistWithSrc[],
  keepTag: string,
  reservoirTag: string
): WorklistWithSrc[] {
  const worklistWithPlateWell = addPlateWellColumns(
    worklistInput,
    reservoirTag
  );
  const result: WorklistWithSrc[] = [];

  // Group by from and to plate wells
  const groups = new Map<string, number[]>();
  worklistWithPlateWell.forEach((row, i) => {
    if (
      row.command?.toLowerCase() === "transfer" &&
      !row.to_plate?.includes(keepTag)
    ) {
      const key = `${row.from_plate_well}|${row.to_plate_well}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(i);
    } else {
      result.push(row);
    }
  });

  // Consolidate transfers
  groups.forEach((indices) => {
    const totalVolume = indices.reduce(
      (sum, i) => sum + (worklistWithPlateWell[i].volume_ul || 0),
      0
    );

    const baseRow = { ...worklistWithPlateWell[indices[0]] };
    baseRow.volume_ul = totalVolume;
    result.push(baseRow);
  });

  return result.sort((a, b) => (a.index || 0) - (b.index || 0));
}

/**
 * Squeeze the plate indices down, to consolidate
 * @param worklistInput Input worklist
 * @param nzfill Number of digits to fill to using leading zeroes
 * @returns Updated worklist
 */
export function squeezePlateIndex(
  worklistInput: WorklistWithSrc[],
  nzfill: number
): WorklistWithSrc[] {
  const worklist = [...worklistInput];

  // Get unique plates and renumber them
  const plates = new Set<string>();
  worklist.forEach((row) => {
    if (row.from_plate) {
      const basePlate = row.from_plate.split("_")[0];
      plates.add(basePlate);
    }
    if (row.to_plate) {
      const basePlate = row.to_plate.split("_")[0];
      plates.add(basePlate);
    }
  });

  const plateMap = new Map<string, number>();
  Array.from(plates)
    .sort()
    .forEach((plate, i) => {
      plateMap.set(plate, i + 1);
    });

  // Update plate numbers
  worklist.forEach((row) => {
    if (row.from_plate) {
      const [basePlate] = row.from_plate.split("_");
      const newNumber = plateMap.get(basePlate);
      if (newNumber !== undefined) {
        row.from_plate = `${basePlate}_${String(newNumber).padStart(
          nzfill,
          "0"
        )}`;
      }
    }
    if (row.to_plate) {
      const [basePlate] = row.to_plate.split("_");
      const newNumber = plateMap.get(basePlate);
      if (newNumber !== undefined) {
        row.to_plate = `${basePlate}_${String(newNumber).padStart(
          nzfill,
          "0"
        )}`;
      }
    }
  });

  return worklist;
}

interface FullFromRunWorklistParams {
  worklist: WorklistWithSrc[];
  diluent: string;
  solDf: SolutionDf;
  liquidTypeDf: LiquidTypeInfo[];
  plateDf: PlateInfo[];
  reservoirTag: string;
  assayPlateTag: string;
  tipSize: number[];
  nPerGroup: number;
  nzfill: number;
}

/**
 * Make full worklist from run worklist
 * @param params Parameters for generating full worklist
 * @returns Dictionary with worklist and user information
 */
export function fullFromRunWorklist(
  params: FullFromRunWorklistParams
): WorklistResult {
  let runWorklist = [...params.worklist];

  // Get source information
  const source = getSource(runWorklist, params.plateDf);

  // Get unique solutions with summed volumes
  const sourceUnique = source.reduce((acc: SolutionInput[], curr) => {
    const existingIndex = acc.findIndex(
      (item) => item.solution[0] === curr.source
    );
    if (existingIndex >= 0) {
      acc[existingIndex].volume[0] += curr.volumeUserInput;
    } else {
      acc.push({
        solution: [curr.source],
        volume: [curr.volumeUserInput],
      });
    }
    return acc;
  }, [] as SolutionInput[]);

  // Make solution worklist
  const solutionOutput = makeSolutionWorklist({
    solutionInput: {
      solution: sourceUnique.map((s) => s.solution[0]),
      volume: sourceUnique.map((s) => s.volume[0]),
    },
    diluent: params.diluent,
    solDf: params.solDf,
    liquidTypeDf: params.liquidTypeDf,
    plateDf: params.plateDf,
    reservoirTag: params.reservoirTag,
    ignoreTag: params.assayPlateTag,
    tipSize: params.tipSize,
    nPerGroup: 8,
    nzfill: 4,
  });

  let worklist: WorklistWithSrc[];

  if (solutionOutput.worklist.length > 0) {
    let solWorklist = [...solutionOutput.worklist] as WorklistWithSrc[];

    // Shift plates and update worklists
    [runWorklist, solWorklist] = shiftPlateWorklist(runWorklist, solWorklist);
    runWorklist = matchFromToImaging(runWorklist);

    // Get link worklist and combine all worklists
    const linkWorklist = getLinkSolRun(
      solWorklist,
      runWorklist,
      params.tipSize,
      params.nPerGroup
    );

    let worklistCombo = worklistConcat(solWorklist, linkWorklist);
    worklistCombo = worklistConcat(worklistCombo, runWorklist);

    // Process combined worklist
    worklist = consolidateTransfer(
      worklistCombo,
      params.assayPlateTag,
      params.reservoirTag
    );

    worklist = updateHoldoverVolumePlateTip(
      worklist,
      params.plateDf,
      params.nzfill,
      params.assayPlateTag,
      params.reservoirTag,
      params.tipSize
    );

    worklist = updateDispenseType(
      worklist,
      params.assayPlateTag,
      params.reservoirTag
    );

    worklist = squeezePlateIndex(worklist, params.nzfill);
  } else {
    worklist = runWorklist;
  }

  // Get user information
  // const userSolution = solutionUserInput(
  //   worklist,
  //   params.plateDf,
  //   'source',
  //   params.reservoirTag
  // );
  // const userLabware = getLabware(worklist, params.reservoirTag);
  // const userTip = getTipCount(worklist);

  return {
    worklist,
    user_solution: [],
    user_labware: [],
    user_tip: [],
    // user_solution: userSolution.map(s => ({
    //   solution: s.solution,
    //   volume: s.user_input,
    //   plate: s.plate_well.split('|')[0],
    //   well: parseInt(s.plate_well.split('|')[1])
    // })),
    // user_labware: userLabware,
    // user_tip: userTip
  };
}

/**
 * Update dispense type
 * @param worklistInput Input worklist
 * @param ignoreTag Tag to ignore
 * @param reservoirTag Tag for the reservoir
 * @returns Updated worklist
 */
export function updateDispenseType(
  worklistInput: WorklistWithSrc[],
  ignoreTag: string,
  reservoirTag: string
): WorklistWithSrc[] {
  let worklist = [...worklistInput];
  const originalColumns = Object.keys(worklist[0] || {});
  const worklistWithPlateWell = addPlateWellColumns(worklist, reservoirTag);

  // Go top down; change to surface empty if dispense into non-empty wells and to plate is not assay plate
  // Assumption: no dispense onto stocks
  worklistWithPlateWell.forEach((row, irow) => {
    if (!row.to_plate?.includes(ignoreTag)) {
      const currentPlateWell = row.to_plate_well;
      const vIn = worklistWithPlateWell
        .slice(0, irow)
        .filter((r) => r.to_plate_well === currentPlateWell)
        .reduce((sum, r) => sum + (r.volume_ul || 0), 0);

      if (vIn > 0) {
        row.dispense_type = (row.dispense_type || "").replace("Jet", "Surface");
        row.liquid_class = (row.liquid_class || "").replace("Jet", "Surface");
      }
    }
  });

  // Ensure dispense type is the same in each group, with Jet favored over Surface
  const groups = new Map<number, number[]>();
  worklistWithPlateWell.forEach((row, i) => {
    if (row.group_number !== undefined) {
      if (!groups.has(row.group_number)) {
        groups.set(row.group_number, []);
      }
      groups.get(row.group_number)!.push(i);
    }
  });

  groups.forEach((indices) => {
    const groupRows = indices.map((i) => worklistWithPlateWell[i]);
    const hasJet = groupRows.some((r) => r.dispense_type?.includes("Jet"));
    const hasSurface = groupRows.some((r) =>
      r.dispense_type?.includes("Surface")
    );

    if (hasJet && hasSurface) {
      indices.forEach((i) => {
        const row = worklistWithPlateWell[i];
        row.dispense_type = (row.dispense_type || "").replace("Surface", "Jet");
        row.liquid_class = (row.liquid_class || "").replace("Surface", "Jet");
      });
    }
  });

  // Return only original columns
  return worklistWithPlateWell.map((row) => {
    const newRow: { [key: string]: any } = {};
    originalColumns.forEach((col) => {
      newRow[col] = row[col as keyof typeof row];
    });
    return newRow as WorklistWithSrc;
  });
}

interface SolutionInput {
  solution: string[];
  volume: number[];
}

interface MakeSolutionParams {
  solutionInput: SolutionInput;
  diluent: string;
  solDf: SolutionDf;
  liquidTypeDf: LiquidTypeInfo[];
  plateDf: PlateInfo[];
  reservoirTag: string;
  ignoreTag: string;
  tipSize: number[];
  nPerGroup: number;
  nzfill: number;
}

/**
 * Make solution worklist
 * @param params Parameters for making solution worklist
 * @returns Dictionary with worklist and user information
 */
export function makeSolutionWorklist(
  params: MakeSolutionParams
): WorklistResult {
  const makeSolutionDf = getDilutionDf(
    params.solutionInput.solution,
    params.diluent,
    params.solDf,
    params.solutionInput.volume
  );

  let worklist: WorklistWithSrc[];

  if (makeSolutionDf.length > 0) {
    let solWorklist = [...makeSolutionDf] as WorklistWithSrc[];

    // Update plate and well
    solWorklist = updatePlateWell(
      solWorklist,
      params.plateDf,
      params.nzfill,
      params.ignoreTag,
      params.reservoirTag
    );

    // Update volume only
    const result = updateVolumeOnly(solWorklist, params.plateDf, params.reservoirTag);
    solWorklist = result.worklist;

    // Update tip size
    solWorklist = updateTipSize(solWorklist, params.tipSize);

    // Update dispense type
    solWorklist = updateDispenseType(solWorklist, params.ignoreTag, params.reservoirTag);

    // Get user information
    const userSolution = solutionUserInput(
      solWorklist,
      params.plateDf,
      "source",
      params.reservoirTag
    );
    const userLabware = []; // getLabware(solWorklist, params.reservoirTag);
    const userTip = []; //getTipCount(solWorklist);

    worklist = solWorklist;
  } else {
    worklist = [];
  }

  return {
    worklist,
    user_solution: userSolution.map((s) => ({
      solution: s.solution,
      volume: s.user_input,
      plate: s.plate_well.split("|")[0],
      well: parseInt(s.plate_well.split("|")[1]),
    })),
    user_labware: userLabware,
    user_tip: userTip,
  };
}

interface PlateInfo {
  plate: string;
  plate_number: number;
}

/**
 * Get plate type and number from plate name
 * @param plateDf Array of objects with plate names
 * @returns Tuple of [plate info array, number of digits in plate number]
 */
export function getPlateTypeNumber(
  plateDf: { [key: string]: string }[]
): [PlateInfo[], number] {
  // Split plate name into base name and number
  const plateInfo: PlateInfo[] = plateDf.map((row) => {
    const firstKey = Object.keys(row)[0];
    const plateName = row[firstKey];
    const [plate, plateNumber] = plateName.split("_").slice(-2);
    return {
      plate,
      plate_number: parseInt(plateNumber),
    };
  });

  // Get max length of plate numbers for zero padding
  const nzfill = Math.max(
    ...plateInfo.map((row) => row.plate_number.toString().length)
  );

  return [plateInfo, nzfill];
}

/**
 * Update volumes, plates, and tips, to account for hold over volumes
 * @param worklistInput Input worklist
 * @param plateDf Array of plate information
 * @param nzfill Number of digits to fill to using leading zeros
 * @param ignoreTag Tag to ignore
 * @param reservoirTag Tag for the reservoir
 * @param tipSize Tip sizes, usually [50, 300, 1000]
 * @param nIterMax Number of maximum iterations
 * @returns Updated worklist
 */
export function updateHoldoverVolumePlateTip(
  worklistInput: WorklistWithSrc[],
  plateDf: PlateInfo[],
  nzfill: number,
  ignoreTag: string,
  reservoirTag: string,
  tipSize: number[],
  nIterMax: number = 3
): WorklistWithSrc[] {
  let worklist = [...worklistInput];
  let { worklist: updatedWorklist, hasChanges: volChange } = updateVolumeOnly(
    worklist,
    plateDf,
    reservoirTag
  );
  worklist = updatedWorklist;

  let nIterRemaining = nIterMax;
  while (volChange && nIterRemaining > 0) {
    // Update plate and well
    worklist = updatePlateWell(
      worklist,
      plateDf,
      nzfill,
      ignoreTag,
      reservoirTag
    );
    const result = updateVolumeOnly(worklist, plateDf, reservoirTag);
    worklist = result.worklist;
    volChange = result.hasChanges;
    nIterRemaining--;
  }

  // Update tip size
  worklist = updateTipSize(worklist, tipSize);

  let error = "none";
  if (nIterRemaining === 0 && volChange === true) {
    error = `cannot update volumes and plates after ${1 + nIterMax} iterations`;
  }
  if (worklist.some((row) => (row.volume_ul || 0) > Math.max(...tipSize))) {
    error = "volume exceeds max tip volume, manually update worklist";
  }

  if (error !== "none") {
    console.error("error in updateHoldoverVolumePlateTip = " + error);
  }

  return worklist;
}

/**
 * Update tip size
 * @param worklistInput Input worklist
 * @param tipSize Tip sizes
 * @returns Updated worklist
 */
function updateTipSize(
  worklistInput: WorklistWithSrc[],
  tipSize: number[]
): WorklistWithSrc[] {
  const worklist = [...worklistInput];

  worklist.forEach((row) => {
    const tipType = getTipType(row.volume_ul, tipSize);
    if (tipType !== undefined) {
      row.tip_type = tipType;
      row.liquid_class = `ivl_tip${tipType}_${
        row.liquid_type
      }_${row.dispense_type.replace(/[^a-zA-Z]+/g, "")}`;
    }
  });

  return worklist;
}
