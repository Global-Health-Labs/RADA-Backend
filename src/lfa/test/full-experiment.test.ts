import {
  makeWorklistFull2D,
  fullFromRunWorklist,
  get_source,
  get_sol_df,
  get_dilution_df,
  WorklistStep,
} from "../full-experiment";

describe("Worklist Functions", () => {
  test("makeWorklistFull2D should generate a worklist", () => {
    const inputDict = {
      exp_input: [
        {
          step: "conjugate",
          dx: 13,
          dz: 0.2,
          volume: 1,
          liquid_class: "water",
          time: -1,
          source: "CS031, CS033",
        },
        {
          step: "sample",
          dx: 0,
          dz: 1.0,
          volume: 75,
          liquid_class: "pbst",
          time: 1200,
          source: "D001-N1",
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
      ],
      delimiter_cell: ",",
      delimiter_col: "_",
      coord0: "0_6",
      coord1: "1_6",
      output_dir: "output_run_assay_worklist",
      nsub0: 6,
      nsub1: 16,
      nrep: 4,
      npergroup: 8,
      reverse_var: 1,
      dispense_type: "Jet_Empty",
      asp_mixing: 0,
      nzfill: 4,
      assay_plate_prefix: "IVL_Plate_v3_96cassettes_ABformat",
      nplate: 1,
      nperplate: 96,
      ncol: 6,
      sort_by_col: 0,
      plate_df: [],
      export_intermediate: 1,
      time_df: [],
      prefix: "factorial_experiment",
    };

    const result = makeWorklistFull2D(inputDict);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      step: "conjugate",
      dx: 13,
      dz: 0.2,
      volume: 1,
      liquid_class: "water",
      time: -1,
      source: "CS031, CS033",
    });
  });

  test("fullFromRunWorklist should generate a full worklist", () => {
    const runWorklist = [
      {
        step: "conjugate",
        diluent: "water",
        volume: 100,
        tipSize: [50],
        reservoirTag: "ivl_1",
        assayPlateTag: "IVL_Plate_",
        nPerGroup: 8,
        nzFill: 4,
      },
      {
        step: "sample",
        diluent: "water",
        volume: 200,
        tipSize: [300],
        reservoirTag: "ivl_1",
        assayPlateTag: "IVL_Plate_",
        nPerGroup: 8,
        nzFill: 4,
      },
      {
        step: "imaging",
        diluent: "water",
        volume: 0,
        tipSize: [1000],
        reservoirTag: "ivl_1",
        assayPlateTag: "IVL_Plate_",
        nPerGroup: 8,
        nzFill: 4,
      },
    ];

    const result = fullFromRunWorklist(
      runWorklist,
      "water",
      {},
      [],
      [],
      "ivl_1",
      "IVL_Plate_",
      [50, 300, 1000],
      8,
      4
    );
    expect(result.worklist).toHaveLength(3);
    expect(result.user_solution).toEqual([]);
    expect(result.user_labware).toEqual([]);
    expect(result.user_tip).toEqual([]);
  });
});

describe("Leaf Node Functions", () => {
  test("get_source should return correct sources", () => {
    const worklist = [
      {
        from_plate: "Plate1",
        from_well: "A1",
        volume_ul: 100,
        source: "Source1",
      },
      {
        from_plate: "Plate1",
        from_well: "A1",
        volume_ul: 200,
        source: "Source2",
      },
    ];
    const plate_df = [{ plate: "Plate1", type: "Type1" }];

    const result = get_source(worklist, plate_df);
    expect(result).toHaveLength(1);
    expect(result[0].source).toContain("Source1");
  });

  test("get_sol_df should return DataFrame of solutions", async () => {
    const sol_df = await get_sol_df("path/to/solution_file.xlsx");
    expect(sol_df).toBeDefined();
    expect(sol_df).toHaveLength(1);
    expect(sol_df[0]).toHaveProperty("water", "water");
    expect(sol_df[0]).toHaveProperty("concentration", 1);
  });

  test("get_dilution_df should return correct dilution DataFrame", () => {
    const target = "TargetSolution";
    const diluent = "Water";
    const sol_df = [
      { solution: "Solution1", concentration: 1 },
      { solution: "Solution2", concentration: 2 },
    ];

    const result = get_dilution_df(target, diluent, sol_df);
    expect(result).toBeDefined();
    expect(result).toHaveLength(1);
  });
});
