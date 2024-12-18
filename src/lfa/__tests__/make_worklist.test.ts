import { makeWorklistOneRun } from "../make_worklist";
import { ExperimentStep, PlateInfo, TimeInfo } from "../types";

describe("makeWorklistOneRun", () => {
  it("should generate correct worklist for given parameters", () => {
    // Sample experiment steps
    const steps: ExperimentStep[] = [
      {
        step: "conjugate",
        dx: 13,
        dz: 0.2,
        volume: 1,
        liquid_class: "water",
        time: -1,
        source: "CS031,CS033",
      },
      {
        step: "sample",
        dx: 0,
        dz: 1.0,
        volume: 75,
        liquid_class: "pbst",
        time: 1200,
        source:
          "D001-N1,D001-P1,D002-N1,D002-P1,D003-N1,D003-P1,R007-N1,R007-P1,D004-N1,D004-P1,ABI-131-N1,ABI-131-P1",
      },
      {
        step: "imaging",
        dx: 24,
        dz: 0.0,
        volume: 0,
        liquid_class: "imaging",
        time: 600,
        source: "camera",
      },
    ];

    const dispenseType = "Jet_Empty";
    const aspMixing = 0;
    const assayPlatePrefix = "IVL_Plate_v3_96cassettes_ABformat";
    const nplate = 1;
    const nperplate = 96;
    const ncol = 6;
    const nzfill = 4;
    const sortByCol = false;

    const plateInfo: PlateInfo[] = [
      {
        plate: "ivl_1_flat_v1",
        volume_well: 40000,
        nrow: 1,
        ncol: 1,
        volume_holdover: 800,
      },
      {
        plate: "ivl_96_dw_v1",
        volume_well: 1000,
        nrow: 8,
        ncol: 12,
        volume_holdover: 60,
      },
      {
        plate: "ivl_384_flat_v1",
        volume_well: 90,
        nrow: 16,
        ncol: 24,
        volume_holdover: 40,
      },
    ];

    const timeInfo: TimeInfo[] = [
      { step: "conjugate", exp_time: 120 },
      { step: "capture", exp_time: 120 },
      { step: "sample", exp_time: 120 },
      { step: "rb", exp_time: 60 },
      { step: "imaging", exp_time: 20 },
    ];

    const result = makeWorklistOneRun(
      steps,
      4,
      8,
      dispenseType,
      aspMixing,
      nzfill,
      assayPlatePrefix,
      nplate,
      nperplate,
      ncol,
      sortByCol,
      plateInfo,
      timeInfo
    );

    // Verify the result has the correct structure
    expect(result).toBeDefined();
    expect(Array.isArray(result.worklist)).toBe(true);
    // expect(result.worklist.length).toBe(steps.length);

    // Check first row has all required fields
    const firstRow = result.worklist[0];
    expect(firstRow).toHaveProperty("step");
    expect(firstRow).toHaveProperty("dx");
    expect(firstRow).toHaveProperty("dz");
    expect(firstRow).toHaveProperty("volume_ul");
    expect(firstRow).toHaveProperty("liquid_class");
    expect(firstRow).toHaveProperty("timer_delta");
    expect(firstRow).toHaveProperty("source");
    expect(firstRow).toHaveProperty("group_number");
    expect(firstRow).toHaveProperty("timer_group_check");
    expect(firstRow).toHaveProperty("destination");
    expect(firstRow).toHaveProperty("to_plate");
    expect(firstRow).toHaveProperty("to_well");
    expect(firstRow).toHaveProperty("from_plate");
    expect(firstRow).toHaveProperty("from_well");

    // Verify plate naming follows the pattern
    expect(firstRow.to_plate).toMatch(
      /^IVL_Plate_v3_96cassettes_ABformat_\d{4}$/
    );

    // Verify well numbers are within range
    expect(firstRow.to_well).toBeGreaterThan(0);
    expect(firstRow.to_well).toBeLessThanOrEqual(nperplate);
  });
});
