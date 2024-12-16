import fs from "fs";
import path from "path";
import * as glob from "glob";
import * as csv from "fast-csv"; // For CSV reading and writing
import { makeWorklistFull2D } from "./full-experiment"; // Assuming this is a TypeScript module
// import { /*getSolDf,*/ updateLiquidClass, fullFromRunWorklist } from "./util"; // Assuming these utilities are implemented in TypeScript

interface InputDict {
  [key: string]: any;
}

async function readCsv(filePath: string): Promise<any[]> {
  const rows: any[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv.parse({ headers: true }))
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", (error) => reject(error));
  });
}

async function writeCsv(filePath: string, data: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    csv
      .write(data, { headers: true })
      .pipe(writeStream)
      .on("finish", resolve)
      .on("error", reject);
  });
}

async function main() {
  const inputDf = await readCsv("input_master.csv");

  const dictVal = inputDf.map((row: any) => {
    const numericValue = parseInt(row["value"], 10);
    return isNaN(numericValue) ? row["value"] : numericValue;
  });

  const inputDict: InputDict = Object.fromEntries(
    inputDf.map((row: any, index: number) => [row["key"], dictVal[index]])
  );

  inputDict["exp_input"] = await readCsv(inputDict["exp_input_file"]);
  inputDict["plate_df"] = await readCsv(inputDict["plate_df_file"]);
  inputDict["time_df"] = await readCsv(inputDict["time_df_file"]);
  //   inputDict["sol_df"] = await getSolDf(inputDict["sol_df_file"]);
  inputDict["sol_df"] = ["water", "1"];
  inputDict["liquid_type_df"] = await readCsv(inputDict["liquid_type_df_file"]);
  inputDict["tip_size"] = inputDict["tip_size_string"]
    .split(",")
    .map((val: string) => parseInt(val, 10));
  inputDict["n_per_group"] = inputDict["npergroup"];

  const fullDir = inputDict["full_dir"];

  // Create directories
  for (const eachDir of [inputDict["output_dir"], inputDict["full_dir"]]) {
    if (!fs.existsSync(eachDir)) {
      fs.mkdirSync(eachDir, { recursive: true });
    }
  }

  // Make assay worklists
  const makeWorklistKeys = Object.keys(makeWorklistFull2D);
  const makeWorklistValues = makeWorklistKeys.map((key) => inputDict[key]);
  const makeWorklistInput = Object.fromEntries(
    makeWorklistKeys.map((key, index) => [key, makeWorklistValues[index]])
  );

  makeWorklistFull2D(makeWorklistInput);

  // Make full worklists
  const fullFromRunKeys = Object.keys(fullFromRunWorklist).filter(
    (key) => key !== "run_worklist_input"
  );
  const fullFromRunValues = fullFromRunKeys.map((key) => inputDict[key]);
  const fullFromRunInput = Object.fromEntries(
    fullFromRunKeys.map((key, index) => [key, fullFromRunValues[index]])
  );

  const runWorklistFiles = glob.sync(
    path.join(inputDict["output_dir"], "*_worklist.csv")
  );

  for (const eachFile of runWorklistFiles) {
    const runWorklist = await readCsv(eachFile);
    const full = fullFromRunWorklist(runWorklist, fullFromRunInput);

    // Update liquid class
    full["worklist"] = updateLiquidClass(
      full["worklist"],
      inputDict["liquid_type_df"]
    );

    const baseName = path.basename(eachFile).replace("worklist.csv", "");
    await writeCsv(
      path.join(fullDir, `${baseName}full_worklist.csv`),
      full["worklist"]
    );
    await writeCsv(
      path.join(fullDir, `${baseName}full_user_solution.csv`),
      full["user_solution"]
    );
    await writeCsv(
      path.join(fullDir, `${baseName}full_user_labware.csv`),
      full["user_labware"]
    );
    await writeCsv(
      path.join(fullDir, `${baseName}full_user_tip.csv`),
      full["user_tip"]
    );
  }
}

main().catch((error) => {
  console.error("Error in execution:", error);
});
