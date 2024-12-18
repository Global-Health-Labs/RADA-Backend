import { assignSrc, PlateInfo } from "../assign_src";
import { WorklistWithDst } from "../assign_destination";

describe("assignSrc", () => {
  it("should correctly assign sources to worklist based on volume", () => {
    const worklist: WorklistWithDst[] = [
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
        to_plate: "IVL_Plate_v3_96cassettes_ABformat_0001",
        to_well: 1,
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
        to_plate: "IVL_Plate_v3_96cassettes_ABformat_0001",
        to_well: 2,
      },
      {
        step: "imaging",
        dx: 0,
        dz: 0,
        volume: 0,
        liquid_class: "",
        time: 0,
        source: "image",
        step_index: 3,
        step_group_index: 3,
        previous_step_index: 2,
        destination: 2,
        destination_group: 1,
        group: 14,
        previous_group: 13,
        to_plate: "IVL_Plate_v3_96cassettes_ABformat_0001",
        to_well: 2,
      },
    ];

    const plateInfo: PlateInfo[] = [
      {
        plate: "ivl_1_reservoir",
        volume_well: 2000,
        volume_holdover: 50,
        nrow: 8,
        ncol: 1,
      },
      {
        plate: "ivl_2_384pp_v3",
        volume_well: 55,
        volume_holdover: 15,
        nrow: 16,
        ncol: 24,
      },
    ];

    const result = assignSrc(worklist, plateInfo, 4);

    // Check worklist length
    expect(result.worklist.length).toBe(3);

    // Check source assignments based on volume
    // For volume=1, should use ivl_2_384pp_v3 (volume_usable=40)
    expect(result.worklist[0].from_plate).toBe("ivl_2_384pp_v3_0001");
    expect(result.worklist[0].from_well).toBe(1);

    // For volume=75, should use ivl_1_reservoir (volume_usable=1950)
    expect(result.worklist[1].from_plate).toBe("ivl_1_reservoir_0001");
    expect(result.worklist[1].from_well).toBe(1);

    // Check imaging step
    expect(result.worklist[2].from_plate).toBe(
      "IVL_Plate_v3_96cassettes_ABformat_0001"
    );
    expect(result.worklist[2].from_well).toBe(2);

    // Check source_df
    expect(result.source_df.length).toBe(2); // Only non-zero volume sources
    expect(result.source_df[0].source).toBe("ABI-131-N1");
    expect(result.source_df[1].source).toBe("CS031");
  });
});
