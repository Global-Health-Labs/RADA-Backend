import { DataFrame } from "danfojs-node"; // Assuming danfo.js for DataFrame manipulations.
import * as itertools from "itertools"; // Assuming an itertools-like library for permutations

/**
 * Get plate type by removing the plate index.
 * @param plate - The input plate string.
 * @returns The plate type without the index.
 */
function getPlateType(plate: string): string {
  const plateSplit = plate.split("_");
  const plateType = plateSplit.slice(0, -1).join("_");
  return plateType;
}

/**
 * Get DataFrame of permutations based on experimental setup.
 * @param expInput DataFrame representing the experimental setup.
 * @param nRep Number of technical replicates.
 * @param reverseVar Boolean indicating whether to reverse the order of variables for sorting.
 * @param delimiterCell Delimiter separating options of a variable in a cell.
 * @param delimiterCol Delimiter separating row and column indices in column names.
 * @returns DataFrame of permutations.
 */
function getPermutations(
  expInput: DataFrame,
  nRep: number,
  reverseVar: boolean,
  delimiterCell = ",",
  delimiterCol = "_"
): DataFrame {
  // Helper function to count options in a cell
  const countEachCell = (cellString: string): number => {
    return cellString.trim().split(delimiterCell).length;
  };

  // Identify cells with variations
  const expInputCounts = expInput.values.map((row: any[]) =>
    row.map((cell: string) => countEachCell(cell))
  );

  const multiList: [number, number][] = [];
  expInputCounts.forEach((row, rowIndex) => {
    row.forEach((count, colIndex) => {
      if (count > 1) {
        multiList.push([rowIndex, colIndex]);
      }
    });
  });

  // Create lists to permutate
  const permList: string[][] = multiList.map(([rowIndex, colIndex]) => {
    const cellString = expInput.iloc(rowIndex, colIndex).toString();
    return cellString.trim().split(delimiterCell).sort();
  });

  const permCol: string[] = multiList.map(([rowIndex, colIndex]) => {
    return `${rowIndex}${delimiterCol}${colIndex}`;
  });

  // Add technical replicates to the permutation list
  permList.push(Array.from({ length: nRep }, (_, i) => i.toString()));
  permCol.push("rep");

  if (reverseVar) {
    // Reverse permList and permCol if reverseVar is true
    permList.reverse();
    permCol.reverse();
  }

  // Generate permutations using Cartesian product
  const permutations = Array.from(itertools.product(...permList));

  // Create the DataFrame from permutations
  const permDf = new DataFrame(permutations, { columns: permCol });

  // Add destination column
  permDf.addColumn(
    "destination",
    Array.from({ length: permDf.shape[0] }, (_, i) => i + 1)
  );

  return permDf;
}
/**
 * Patch exp_input with extra columns.
 * @param expInput DataFrame describing experimental setup.
 * @returns DataFrame with extra columns added.
 */
function patchInput(expInput: DataFrame): DataFrame {
  // Add step_index column: index + 1
  expInput.addColumn(
    "step_index",
    expInput.index.map((index) => index + 1)
  );

  // Initialize step_group_index with step_index
  expInput.addColumn("step_group_index", expInput["step_index"].values);

  // Determine step_group_index based on timing
  const timeValues = expInput["time"].values as number[];
  for (let i = 0; i < timeValues.length - 1; i++) {
    if (timeValues[i] === 0) {
      expInput.loc(
        { rows: [i + 1], columns: ["step_group_index"] },
        expInput["step_group_index"].iloc(i)
      );
    }
  }

  // Add previous_step_index column
  const stepIndexValues = expInput["step_index"].values as number[];
  const previousStepIndex = stepIndexValues.map((stepIndex) => stepIndex - 1);

  // Identify rows where time <= 0 and set previous_step_index to 0
  const noTimeIndex = stepIndexValues
    .map((_, idx) => idx)
    .filter((idx) => timeValues[idx] <= 0 && idx + 1 < stepIndexValues.length);

  noTimeIndex.forEach((idx) => {
    previousStepIndex[idx] = 0;
  });

  expInput.addColumn("previous_step_index", previousStepIndex);

  return expInput;
}

/**
 * Assign sources to the worklist based on plate configuration and volume requirements.
 * @param worklist - Input worklist.
 * @param plateDf - DataFrame describing plates on the instrument.
 * @param nzFill - Number to fill with leading zeros for plate index.
 * @returns An object containing the updated worklist and source dataframe.
 */
function assignSrc(
  worklist: DataFrame,
  plateDf: DataFrame,
  nzFill: number
): { worklist: DataFrame; sourceDf: DataFrame } {
  // Tally up the total volume by source
  let sourceDf = worklist
    .groupby(["source"])
    .agg({ volume_ul: "sum" })
    .resetIndex();
  const stepDf = worklist
    .select(["source", "step_index", "step"])
    .dropDuplicates();
  sourceDf = sourceDf.merge(stepDf, { on: "source" }).sortValues("source");
  sourceDf = sourceDf.filter((row: any) => row["volume_ul"] > 0);

  // Update plateDf with usable volume
  plateDf["volume_usable"] = plateDf["volume_well"].sub(
    plateDf["volume_holdover"]
  );
  plateDf = plateDf.sortValues("volume_usable");

  // Assign plate types based on volume
  sourceDf["volume_usable"] = getTipType(sourceDf["volume_ul"], [
    0,
    ...plateDf["volume_usable"].values,
  ]);
  sourceDf = sourceDf.merge(plateDf, { on: "volume_usable" });

  // Initialize plate well assignment
  sourceDf["plate_well"] = 0;

  // Assign wells for each step and plate
  sourceDf["step"].unique().forEach((eachStep: string) => {
    sourceDf["plate"].unique().forEach((eachPlate: string) => {
      const subDf = sourceDf.filter(
        (row: any) => row.step === eachStep && row.plate === eachPlate
      );

      if (subDf.length > 0) {
        const nRow = subDf["nrow"].iloc(0);
        let plateWell = Array.from({ length: subDf.length }, (_, i) => i + 1);

        if (eachPlate.includes("384")) {
          const nColEach = Math.ceil(subDf.length / nRow);
          const iWell = Array.from({ length: nRow * nColEach }, (_, i) => i)
            .reduce((acc, _, idx, arr) => {
              if (idx % 2 === 0) acc.push(arr.slice(idx, idx + 2));
              return acc;
            }, [])
            .flat();
          plateWell = iWell.map((val) => val + 1);
        }

        const shift =
          Math.ceil(
            sourceDf
              .filter((row: any) => row.plate === eachPlate)
              ["plate_well"].max() / nRow
          ) * nRow;
        plateWell = plateWell.map((well) => well + shift);

        subDf["plate_well"] = plateWell;
      }
    });
  });

  sourceDf["plate_well"] = sourceDf["plate_well"].astype("int");
  sourceDf["plate_index"] = sourceDf["plate_well"]
    .div(sourceDf["ncol"].mul(sourceDf["nrow"]))
    .ceil();
  sourceDf["from_plate"] = sourceDf["plate"].add(
    "_" + sourceDf["plate_index"].astype("string").padStart(nzFill, "0")
  );
  sourceDf["from_well"] = sourceDf["plate_well"];

  const sourceDfOut = sourceDf.copy();
  sourceDf = sourceDf[("source", "from_plate", "from_well")];

  worklist = worklist
    .resetIndex()
    .drop("index", { axis: 1 })
    .resetIndex()
    .merge(sourceDf, { how: "outer" })
    .sortValues("index")
    .drop("index", { axis: 1 });

  // Special case for imaging steps
  worklist = worklist.map((row: any) => {
    if (row.step === "imaging") {
      row.from_plate = row.to_plate;
      row.from_well = row.to_well;
    }
    return row;
  });

  // Special case for reservoirs
  worklist["group_number"].unique().forEach((eachGroup: number) => {
    const sub = worklist.filter((row: any) => row.group_number === eachGroup);
    if (sub.length > 0 && sub[0]["from_plate"].includes("ivl_1_")) {
      sub.forEach((row: any, idx: number) => {
        row.from_well = (idx % 8) + 1;
      });
    }
  });

  return {
    worklist,
    sourceDf: sourceDfOut,
  };
}
