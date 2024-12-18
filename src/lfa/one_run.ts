import { ExperimentStep, WorklistRow } from "./types";

export type WorklistRowWithStepIndex = {
  step_index: number;
  step_group_index: number;
  previous_step_index: number;
} & ExperimentStep;

/**
 * Patches input data by adding step indices
 * @param expInput - Array of experiment steps
 * @returns Patched array with added step indices
 */
export function patchInput(
  expInput: ExperimentStep[]
): WorklistRowWithStepIndex[] {
  // Create a copy of the input array to avoid mutating the original
  const result: WorklistRowWithStepIndex[] = expInput.map((step, index) => ({
    ...step,
    // Add step_index (1-based index)
    step_index: index + 1,
    step_group_index: index + 1,
    previous_step_index: 0,
  }));

  // Add previous_step_index
  let lastValidStepIndex = 0;
  result.forEach((step, index) => {
    if (step.time <= 0) {
      // For steps with no time or negative time, set previous_step_index to 0
      // except for the last step
      step.previous_step_index =
        index === result.length - 1 ? result.length : 0;
    } else {
      // For steps with time > 0, set to last valid step index
      step.previous_step_index = lastValidStepIndex;
      lastValidStepIndex = step.step_index!;
    }
  });

  return result;
}

export interface PermutationRow {
  rep: number;
  [key: string]: string | number; // For dynamic column names like "0_6", "1_6"
  destination: number;
}

/**
 * Get permutations
 * @param stepsWithIndex - Input experiment steps
 * @param numReplicates - Number of repetitions
 * @param delimiterCell - Delimiter for cells
 * @param delimiterCol - Delimiter for columns
 * @param reverseVar - Reverse the order of variables to sort
 * @returns Permutation data with source combinations
 */

export function getPermutations(
  stepsWithIndex: WorklistRowWithStepIndex[],
  numReplicates: number,
  delimiterCell: string,
  delimiterCol: string,
  reverseVar: number
): PermutationRow[] {
  const countEachCell = (cellString: string): number => {
    return cellString.replace(/\s/g, "").split(delimiterCell).length;
  };

  // Get source strings from input data
  const sourceStrings = stepsWithIndex.map((row) => row.source);

  // Split source strings into arrays and get unique values
  const sourceSplitArrays = sourceStrings
    .map((str, index) => ({
      index,
      values: str.split(delimiterCell).map((s) => s.trim()),
    }))
    .filter((item) => item.values.length > 1); // Only keep items with multiple values

  // Sort the arrays
  sourceSplitArrays.forEach((item) => item.values.sort());

  // Create all possible combinations
  const result: PermutationRow[] = [];
  const maxLen = Math.max(
    ...sourceStrings.map((str) => str.split(delimiterCell).length)
  );

  // Get arrays for combination
  const arrays = sourceSplitArrays.map((item) => item.values);
  const indices = sourceSplitArrays.map((item) => item.index);

  // Calculate total combinations per rep
  const totalCombos = arrays.reduce((acc, arr) => acc * arr.length, 1);

  for (let rep = 0; rep < numReplicates; rep++) {
    for (let i = 0; i < totalCombos; i++) {
      const combo: any = { rep, destination: rep * totalCombos + i + 1 };

      // Calculate indices for this combination
      let remaining = i;
      for (let j = arrays.length - 1; j >= 0; j--) {
        const size = arrays[j].length;
        const index = remaining % size;
        remaining = Math.floor(remaining / size);
        combo[`${indices[j]}_${maxLen}`] = arrays[j][index];
      }

      result.push(combo as PermutationRow);
    }
  }

  // Sort the result if reverseVar is true
  if (reverseVar) {
    result.sort((a, b) => {
      const firstCol = `0_${maxLen}`;
      return (a[firstCol] as string).localeCompare(b[firstCol] as string);
    });
  }

  return result;
}

/**
 * Get worklist from permutation data
 * @param experimentWithStepIndex - Input experiment steps
 * @param permDf - Permutation data
 * @param transferStepsPerGroup - Number of items per group
 * @param delimiterCol - Delimiter for columns
 * @returns Worklist with all steps and destinations
 */
export function getWorklistFromPermutations(
  experimentWithStepIndex: WorklistRowWithStepIndex[],
  permDf: PermutationRow[],
  transferStepsPerGroup: number,
  delimiterCol: string
): WorklistRow[] {
  // Create worklist array
  const worklist: WorklistRow[] = [];

  // Process each experiment step
  experimentWithStepIndex.forEach((step) => {
    // For each permutation row
    permDf.forEach((perm) => {
      // Get the maximum length from the first permutation row
      const maxLen = Object.keys(permDf[0])
        .filter((key) => key.includes("_"))
        .map((key) => parseInt(key.split("_")[1]))
        .reduce((a, b) => Math.max(a, b), 0);

      // Find all permutation columns (excluding 'rep' and 'destination')
      const permCols = Object.keys(perm).filter((key) => key.includes("_"));

      // Create a new worklist row
      const worklistRow: WorklistRow = {
        ...step,
        destination: perm.destination,
        destination_group: Math.ceil(perm.destination / transferStepsPerGroup),
        group: worklist.length + 1,
        previous_group:
          step.previous_step_index === 0
            ? 0
            : Math.ceil(perm.destination / transferStepsPerGroup) + 12,
      };

      // Update source if there are permutation columns
      if (permCols.length > 0) {
        const stepIndex = step.step_index! - 1; // Convert to 0-based index
        const sourceCol = `${stepIndex}_${maxLen}`;
        if (perm[sourceCol]) {
          worklistRow.source = perm[sourceCol] as string;
        }
      }

      worklist.push(worklistRow);
    });
  });

  // Sort worklist
  return worklist.sort((a, b) => {
    // First by step_group_index
    if (a.step_group_index !== b.step_group_index) {
      return a.step_group_index! - b.step_group_index!;
    }
    // Then by destination_group
    if (a.destination_group !== b.destination_group) {
      return a.destination_group - b.destination_group;
    }
    // Then by step_index
    if (a.step_index !== b.step_index) {
      return a.step_index! - b.step_index!;
    }
    // Finally by destination
    return a.destination - b.destination;
  });
}

/**
 * Get worklist from full factorial design
 * @param expInput - Array of experiment steps
 * @param numReplicates - Number of technical replicates
 * @param transferStepsPerGroup - Number of strips per group
 * @param delimiterCell - Delimiter to separate options of a variable
 * @param delimiterCol - Delimiter to separate row and col indices of the coordinate
 * @param reverseVar - Reverse the order of variables to sort
 * @returns Object containing worklist, permutation data, and experiment input
 */
export function getWorklistFullFactorial(
  expInput: ExperimentStep[],
  numReplicates: number,
  transferStepsPerGroup: number,
  delimiterCell: string,
  delimiterCol: string,
  reverseVar: number
): {
  worklist: WorklistRow[];
  permDf: PermutationRow[];
  expInput: ExperimentStep[];
} {
  // Patch input with extra columns
  const experimentWithStepIndex = patchInput(expInput);

  // TODO First remove dummy steps from expInput - do we need this?
  const experimentWithoutDummySteps = experimentWithStepIndex.filter(
    (step) => step.step !== "dummy"
  );

  // Then get permutation data
  let permDf = getPermutations(
    experimentWithoutDummySteps,
    numReplicates,
    delimiterCell,
    delimiterCol,
    reverseVar
  );

  // Get worklist
  const worklist = getWorklistFromPermutations(
    experimentWithoutDummySteps,
    permDf,
    transferStepsPerGroup,
    delimiterCol
  );

  return {
    worklist,
    permDf,
    expInput,
  };
}
