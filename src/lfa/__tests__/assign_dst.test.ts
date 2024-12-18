import { getAssayAreaDf, assignDestination } from "../assign_destination";
import { WorklistRow } from "../one_run";

describe("getAssayAreaDf", () => {
  it("should correctly generate assay area with given parameters", () => {
    const result = getAssayAreaDf(
      "IVL_Plate_v3_96cassettes_ABformat",
      1,
      96,
      6,
      4,
      false
    );

    // Check total number of rows
    expect(result.length).toBe(96); // 1 plate * 96 wells

    // Check first row
    expect(result[0]).toEqual({
      plate: "IVL_Plate_v3_96cassettes_ABformat_0001",
      well: 1,
      col: 1,
      destination: 1,
    });

    // Check last row
    expect(result[95]).toEqual({
      plate: "IVL_Plate_v3_96cassettes_ABformat_0001",
      well: 96,
      col: 6,
      destination: 96,
    });

    // Check column calculation
    expect(result[5]).toEqual({
      plate: "IVL_Plate_v3_96cassettes_ABformat_0001",
      well: 6,
      col: 6,
      destination: 6,
    });
  });
});

describe("assignDst", () => {
  it("should correctly assign destinations to worklist", () => {
    const worklist: WorklistRow[] = [
      {
        step: "conjugate",
        dx: 13,
        dz: 0.2,
        volume: 1,
        liquid_class: "water",
        time: -1,
        source: "CS031",
        step_index: 1,
        step_group_index: 1,
        previous_step_index: 0,
        destination: 1,
        destination_group: 1,
        group: 1,
        previous_group: 0,
      },
      {
        step: "sample",
        dx: 0,
        dz: 1.0,
        volume: 75,
        liquid_class: "pbst",
        time: 1200,
        source: "ABI-131-N1",
        step_index: 2,
        step_group_index: 2,
        previous_step_index: 0,
        destination: 2,
        destination_group: 1,
        group: 13,
        previous_group: 0,
      },
    ];

    const result = assignDestination(
      worklist,
      "IVL_Plate_v3_96cassettes_ABformat",
      1,
      96,
      6,
      4,
      false
    );

    // Check length
    expect(result.length).toBe(2);

    // Check first row
    expect(result[0]).toEqual({
      ...worklist[0],
      to_plate: "IVL_Plate_v3_96cassettes_ABformat_0001",
      to_well: 1,
    });

    // Check second row
    expect(result[1]).toEqual({
      ...worklist[1],
      to_plate: "IVL_Plate_v3_96cassettes_ABformat_0001",
      to_well: 2,
    });
  });
});
