import {
  getDilutionDf,
  assignPlateWell,
  renumberReservoir,
  getWorklistFromRecipe,
  addPlateWellColumns,
  findPlateInfo,
  updateVolumeOnly,
  updatePlateWell,
  shiftPlate,
} from "../util";

describe("getDilutionDf", () => {
  it("should create correct dilution matrix for given targets", () => {
    // Test data matching the Python example
    const target = [
      "ABI-131-N1",
      "ABI-131-P1",
      "CS031",
      "CS033",
      "D001-N1",
      "D001-P1",
      "D002-N1",
      "D002-P1",
      "D003-N1",
      "D003-P1",
      "D004-N1",
      "D004-P1",
      "R007-N1",
      "R007-P1",
    ];
    const diluent = "water";
    const solDf = { water: 1 };
    const targetVolume = [
      660, 660, 88, 88, 660, 660, 660, 660, 660, 660, 660, 660, 660, 660,
    ];
    const tolerance = 0.01;

    const result = getDilutionDf(
      target,
      diluent,
      solDf,
      targetVolume,
      tolerance
    );

    // Check array structure
    expect(result).toHaveLength(target.length);

    // Check a few key values from the expected output
    const abiN1Row = result.find((row) => row.target === "ABI-131-N1")!;
    expect(abiN1Row["ABI-131-N1"]).toBe(660);
    expect(abiN1Row["ABI-131-P1"]).toBe(0);

    const cs031Row = result.find((row) => row.target === "CS031")!;
    expect(cs031Row["CS031"]).toBe(88);
    expect(cs031Row["CS033"]).toBe(0);

    const cs033Row = result.find((row) => row.target === "CS033")!;
    expect(cs033Row["CS033"]).toBe(88);
    expect(cs033Row["CS031"]).toBe(0);

    // Verify order is maintained
    expect(result.map((row) => row.target)).toEqual(target);
  });

  it("should use default target volume of 1 when not provided", () => {
    const target = ["A", "B"];
    const diluent = "water";
    const solDf = { water: 1 };

    const result = getDilutionDf(target, diluent, solDf);

    expect(result).toHaveLength(2);

    const rowA = result[0];
    expect(rowA.target).toBe("A");
    expect(rowA["A"]).toBe(1);
    expect(rowA["B"]).toBe(0);

    const rowB = result[1];
    expect(rowB.target).toBe("B");
    expect(rowB["A"]).toBe(0);
    expect(rowB["B"]).toBe(1);
  });

  it("should handle -0 values correctly", () => {
    const target = ["A"];
    const diluent = "water";
    const solDf = { water: 1 };
    const targetVolume = [-0];

    const result = getDilutionDf(target, diluent, solDf, targetVolume);

    expect(result).toHaveLength(1);
    expect(result[0].target).toBe("A");
    expect(result[0]["A"]).toBe(0);
  });
});

describe("assignPlateWell", () => {
  const plateInfo = [
    {
      plate: "ivl_1_flat_v1",
      volume_well: 40000,
      nrow: 1,
      ncol: 1,
      volume_holdover: 800,
      volume_usable: 39200,
    },
    {
      plate: "ivl_96_dw_v1",
      volume_well: 1000,
      nrow: 8,
      ncol: 12,
      volume_holdover: 60,
      volume_usable: 940,
    },
    {
      plate: "ivl_384_flat_v1",
      volume_well: 90,
      nrow: 16,
      ncol: 24,
      volume_holdover: 40,
      volume_usable: 50,
    },
  ];

  it("should handle empty worklist", () => {
    const result = assignPlateWell([], plateInfo, "guid", false);
    expect(result).toEqual([]);
  });

  it("should assign plate and well numbers correctly", () => {
    const worklist = [
      {
        guid: "guid1",
        volume_ul: 100,
        source: "source1",
      },
      {
        guid: "guid2",
        volume_ul: 200,
        source: "source2",
      },
    ];

    const result = assignPlateWell(worklist, plateInfo, "guid", false);

    expect(result).toHaveLength(2);

    // First entry
    expect(result[0].guid).toBe("guid1");
    expect(result[0].plate).toBe("ivl_384_flat_v1");
    expect(result[0].plate_number).toBe(1);
    expect(result[0].well_number).toBe(1);

    // Second entry
    expect(result[1].guid).toBe("guid2");
    expect(result[1].plate).toBe("ivl_384_flat_v1");
    expect(result[1].plate_number).toBe(1);
    expect(result[1].well_number).toBe(2);
  });

  it("should handle multiple plates when needed", () => {
    // Create worklist with more entries than wells in first plate
    const worklist = Array.from({ length: 385 }, (_, i) => ({
      guid: `guid${i + 1}`,
      volume_ul: 100,
      source: `source${i + 1}`,
    }));

    const result = assignPlateWell(worklist, plateInfo, "guid", false);

    // Check entries spanning multiple plates
    expect(result[0].plate_number).toBe(1);
    expect(result[383].plate_number).toBe(1);
    expect(result[384].plate_number).toBe(2);
  });
});

describe("renumberReservoir", () => {
  it("should handle empty worklist", () => {
    const result = renumberReservoir([], "reservoir");
    expect(result).toEqual([]);
  });

  it("should renumber wells for reservoir plates within groups", () => {
    const worklist = [
      {
        group_number: 1,
        to_plate: "reservoir_1",
        to_well: 0,
      },
      {
        group_number: 1,
        to_plate: "reservoir_1",
        to_well: 0,
      },
      {
        group_number: 1,
        to_plate: "other_plate",
        to_well: 5,
      },
      {
        group_number: 2,
        to_plate: "reservoir_1",
        to_well: 0,
      },
    ] as WorklistWithSrc[];

    const result = renumberReservoir(worklist, "reservoir");

    // Check group 1 reservoir wells
    expect(result[0].to_well).toBe(1);
    expect(result[1].to_well).toBe(2);

    // Check non-reservoir well is unchanged
    expect(result[2].to_well).toBe(5);

    // Check group 2 reservoir well
    expect(result[3].to_well).toBe(1);
  });

  it("should handle wells beyond 8 by wrapping around", () => {
    const worklist = Array.from({ length: 10 }, (_, i) => ({
      group_number: 1,
      to_plate: "reservoir_1",
      to_well: 0,
    })) as WorklistWithSrc[];

    const result = renumberReservoir(worklist, "reservoir");

    // Check wrapping behavior
    expect(result[0].to_well).toBe(1);
    expect(result[7].to_well).toBe(8);
    expect(result[8].to_well).toBe(1);
    expect(result[9].to_well).toBe(2);
  });
});

describe("getWorklistFromRecipe", () => {
  const plateInfo = [
    {
      plate: "ivl_1_flat_v1",
      volume_well: 40000,
      nrow: 1,
      ncol: 1,
      volume_holdover: 800,
    },
    {
      plate: "ivl_384_flat_v1",
      volume_well: 90,
      nrow: 16,
      ncol: 24,
      volume_holdover: 40,
    },
  ];

  const liquidTypeInfo = [
    { solution: "water", liquid_type: "water" },
    { solution: "CS031", liquid_type: "water" },
    { solution: "CS033", liquid_type: "water" },
  ];

  const params = {
    diluent: "water",
    solutionInfo: {},
    liquidTypeInfo,
    plateInfo,
    reservoirTag: "reservoir",
    ignoreTag: "assay",
    tipSize: [50, 300, 1000],
    nPerGroup: 8,
    nzfill: 4,
  };

  it("should handle empty solution df", () => {
    const result = getWorklistFromRecipe([], params);
    expect(result).toEqual([]);
  });

  it("should create worklist from solution recipe", () => {
    const makeSolutionDf = [
      {
        target: "CS031",
        CS031: 88,
        CS033: 0,
        water: 0,
      },
      {
        target: "CS033",
        CS031: 0,
        CS033: 88,
        water: 0,
      },
    ];

    const result = getWorklistFromRecipe(makeSolutionDf, params);

    // Check basic structure
    expect(result.length).toBe(2);

    // Check first transfer
    const cs031Transfer = result.find((r) => r.target === "CS031")!;
    expect(cs031Transfer.source).toBe("CS031");
    expect(cs031Transfer.volume_ul).toBe(88);
    expect(cs031Transfer.liquid_type).toBe("water");
    expect(cs031Transfer.tip_type).toBe(50);

    // Check second transfer
    const cs033Transfer = result.find((r) => r.target === "CS033")!;
    expect(cs033Transfer.source).toBe("CS033");
    expect(cs033Transfer.volume_ul).toBe(88);
    expect(cs033Transfer.liquid_type).toBe("water");
    expect(cs033Transfer.tip_type).toBe(50);

    // Check group numbers are different
    expect(cs031Transfer.group_number).not.toBe(cs033Transfer.group_number);
  });

  it("should assign correct tip types based on volume", () => {
    const makeSolutionDf = [
      {
        target: "Test1",
        source1: 40, // Should use 50µL tip
        target: "Test1",
      },
      {
        target: "Test2",
        source2: 200, // Should use 300µL tip
        target: "Test2",
      },
      {
        target: "Test3",
        source3: 800, // Should use 1000µL tip
        target: "Test3",
      },
    ];

    const result = getWorklistFromRecipe(makeSolutionDf, params);

    const volumes = result.map((r) => ({
      volume: r.volume_ul,
      tip: r.tip_type,
    }));

    expect(volumes).toEqual([
      { volume: 40, tip: 50 },
      { volume: 200, tip: 300 },
      { volume: 800, tip: 1000 },
    ]);
  });
});

describe("addPlateWellColumns", () => {
  it("should add plate_well columns to worklist", () => {
    const worklist = [
      {
        from_plate: "source_plate1",
        from_well: 1,
        to_plate: "dest_plate1",
        to_well: 2,
      },
      {
        from_plate: "ivl_1_plate",
        from_well: 3,
        to_plate: "dest_plate2",
        to_well: 4,
      },
      {
        from_plate: "source_plate2",
        from_well: 5,
        to_plate: "ivl_1_plate",
        to_well: 6,
      },
    ] as WorklistWithSrc[];

    const result = addPlateWellColumns(worklist);

    // Check original worklist is unchanged
    expect(worklist[0]).not.toHaveProperty("from_plate_well");
    expect(worklist[0]).not.toHaveProperty("to_plate_well");

    // Check plate_well columns are added correctly
    expect(result[0].from_plate_well).toBe("source_plate1|1");
    expect(result[0].to_plate_well).toBe("dest_plate1|2");

    // Check reservoir plates have well number set to 1
    expect(result[1].from_plate_well).toBe("ivl_1_plate|1");
    expect(result[1].to_plate_well).toBe("dest_plate2|4");

    expect(result[2].from_plate_well).toBe("source_plate2|5");
    expect(result[2].to_plate_well).toBe("ivl_1_plate|1");
  });

  it("should handle reservoirTag='none'", () => {
    const worklist = [
      {
        from_plate: "ivl_1_plate",
        from_well: 3,
        to_plate: "ivl_1_plate",
        to_well: 4,
      },
    ] as WorklistWithSrc[];

    const result = addPlateWellColumns(worklist, "none");

    // Check reservoir wells are not set to 1
    expect(result[0].from_plate_well).toBe("ivl_1_plate|3");
    expect(result[0].to_plate_well).toBe("ivl_1_plate|4");
  });
});

describe("findPlateInfo", () => {
  const plateDf = [
    {
      plate: "ivl_1_flat",
      volume_well: 40000,
      nrow: 1,
      ncol: 1,
      volume_holdover: 800,
    },
    {
      plate: "ivl_384_flat",
      volume_well: 90,
      nrow: 16,
      ncol: 24,
      volume_holdover: 40,
    },
  ];

  it("should find plate info for given plate_well values", () => {
    const plateWells = ["ivl_1_flat_1|1", "ivl_384_flat_1|24"];
    const result = findPlateInfo(plateWells, plateDf);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      plate: "ivl_1_flat",
      plate_well: "ivl_1_flat_1|1",
      plate_index: "ivl_1_flat_1",
      volume_well: 40000,
      volume_holdover: 800,
    });
    expect(result[1]).toMatchObject({
      plate: "ivl_384_flat",
      plate_well: "ivl_384_flat_1|24",
      plate_index: "ivl_384_flat_1",
      volume_well: 90,
      volume_holdover: 40,
    });
  });

  it("should throw error for unknown plate", () => {
    const plateWells = ["unknown_plate_1|1"];
    expect(() => findPlateInfo(plateWells, plateDf)).toThrow(
      "Plate unknown_plate not found in plate info"
    );
  });
});

describe("updateVolumeOnly", () => {
  const plateDf = [
    {
      plate: "source",
      volume_well: 1000,
      nrow: 8,
      ncol: 12,
      volume_holdover: 100,
    },
  ];

  it("should scale up volumes when necessary", () => {
    const worklist = [
      {
        from_plate: "source_1",
        from_well: 1,
        to_plate: "dest_1",
        to_well: 1,
        volume_ul: 500,
      },
      {
        from_plate: "dest_1",
        from_well: 1,
        to_plate: "final_1",
        to_well: 1,
        volume_ul: 600, // Needs more volume than input
      },
    ] as WorklistWithSrc[];

    const result = updateVolumeOnly(worklist, plateDf, "none");

    expect(result.hasChanges).toBe(true);
    expect(result.worklist[0].volume_ul).toBeGreaterThan(500); // Should be scaled up
  });

  it("should not modify volumes when sufficient", () => {
    const worklist = [
      {
        from_plate: "source_1",
        from_well: 1,
        to_plate: "dest_1",
        to_well: 1,
        volume_ul: 1000,
      },
      {
        from_plate: "dest_1",
        from_well: 1,
        to_plate: "final_1",
        to_well: 1,
        volume_ul: 500, // Less than input volume
      },
    ] as WorklistWithSrc[];

    const result = updateVolumeOnly(worklist, plateDf, "none");

    expect(result.hasChanges).toBe(false);
    expect(result.worklist[0].volume_ul).toBe(1000); // Should remain unchanged
  });

  it("should handle empty worklist", () => {
    const result = updateVolumeOnly([], plateDf, "none");
    expect(result.hasChanges).toBe(false);
    expect(result.worklist).toEqual([]);
  });
});

describe("updatePlateWell", () => {
  const plateDf = [
    {
      plate: "source",
      volume_well: 1000,
      nrow: 8,
      ncol: 12,
      volume_holdover: 100,
    },
    {
      plate: "dest",
      volume_well: 1000,
      nrow: 8,
      ncol: 12,
      volume_holdover: 100,
    },
  ];

  it("should update plate and well numbers", () => {
    const worklist = [
      {
        from_plate: "source_1",
        from_well: 1,
        to_plate: "dest_1",
        to_well: 1,
        volume_ul: 100,
      },
      {
        from_plate: "source_1",
        from_well: 2,
        to_plate: "dest_1",
        to_well: 2,
        volume_ul: 200,
      },
    ] as WorklistWithSrc[];

    const result = updatePlateWell(worklist, plateDf, 2);

    expect(result).toHaveLength(2);
    expect(result[0].from_plate).toMatch(/source_\d{2}/);
    expect(result[0].to_plate).toMatch(/dest_\d{2}/);
    expect(result[1].from_plate).toMatch(/source_\d{2}/);
    expect(result[1].to_plate).toMatch(/dest_\d{2}/);
  });

  it("should handle ignore tag", () => {
    const worklist = [
      {
        from_plate: "source_1",
        from_well: 1,
        to_plate: "ignore_1",
        to_well: 1,
        volume_ul: 100,
      },
      {
        from_plate: "source_1",
        from_well: 2,
        to_plate: "dest_1",
        to_well: 2,
        volume_ul: 200,
      },
    ] as WorklistWithSrc[];

    const result = updatePlateWell(worklist, plateDf, 2, "ignore");

    expect(result).toHaveLength(2);
    // Ignored plate should keep original values
    expect(result[0].to_plate).toBe("ignore_1");
    expect(result[0].to_well).toBe(1);
    // Non-ignored plate should be updated
    expect(result[1].to_plate).toMatch(/dest_\d{2}/);
  });

  it("should handle reservoir tag", () => {
    const worklist = [
      {
        from_plate: "ivl_1_1",
        from_well: 2,
        to_plate: "dest_1",
        to_well: 1,
        volume_ul: 100,
      },
    ] as WorklistWithSrc[];

    const result = updatePlateWell(worklist, plateDf, 2, "none", "ivl_1");

    expect(result).toHaveLength(1);
    // Reservoir well should be set to 1
    expect(result[0].from_well).toBe(1);
  });

  it("should handle empty worklist", () => {
    const result = updatePlateWell([], plateDf, 2);
    expect(result).toEqual([]);
  });
});

describe("shiftPlate", () => {
  it("should shift plate numbers correctly", () => {
    const plateList = [
      [
        { plate: "plate1", plate_number: 1, well_number: 1 },
        { plate: "plate1", plate_number: 2, well_number: 2 },
        { plate: "plate2", plate_number: 1, well_number: 1 },
      ],
      [
        { plate: "plate1", plate_number: 1, well_number: 3 },
        { plate: "plate2", plate_number: 1, well_number: 2 },
      ],
    ] as PlateWithNumber[][];

    const result = shiftPlate(plateList);

    // Check original array is unchanged
    expect(plateList[1][0].plate_number).toBe(1);

    // Check plate numbers are shifted up
    expect(result[1][0].plate_number).toBe(3); // plate1: max(1,2) + 1
    expect(result[1][1].plate_number).toBe(2); // plate2: max(1) + 1
  });

  it("should handle empty arrays", () => {
    const plateList = [[], []] as PlateWithNumber[][];
    const result = shiftPlate(plateList);
    expect(result).toEqual([[], []]);
  });

  it("should handle single array", () => {
    const plateList = [
      [
        { plate: "plate1", plate_number: 1, well_number: 1 },
        { plate: "plate1", plate_number: 2, well_number: 2 },
      ],
    ] as PlateWithNumber[][];

    const result = shiftPlate(plateList);
    expect(result[0]).toEqual(plateList[0]);
  });

  it("should handle new plate types", () => {
    const plateList = [
      [{ plate: "plate1", plate_number: 1, well_number: 1 }],
      [{ plate: "plate2", plate_number: 1, well_number: 1 }],
    ] as PlateWithNumber[][];

    const result = shiftPlate(plateList);

    // New plate type should start at 1
    expect(result[1][0].plate_number).toBe(1);
  });
});
