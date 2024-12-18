import { cleanupWorklist } from "../cleanup_worklist";
import { WorklistRow } from "../one_run";

describe("cleanupWorklist", () => {
  it("should correctly clean worklist with Jet_Empty dispense type", () => {
    const input: WorklistRow[] = [
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
        previous_group: 0
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
        destination: 1,
        destination_group: 1,
        group: 13,
        previous_group: 0
      },
      {
        step: "imaging",
        dx: 24,
        dz: 0.0,
        volume: 0,
        liquid_class: "imaging",
        time: 600,
        source: "camera",
        step_index: 3,
        step_group_index: 3,
        previous_step_index: 2,
        destination: 1,
        destination_group: 1,
        group: 25,
        previous_group: 13
      }
    ];

    const dispenseType = "Jet_Empty";
    const aspMixing = "0";

    const result = cleanupWorklist(input, dispenseType, aspMixing);

    // Test length
    expect(result.length).toBe(3);

    // Test conjugate step
    expect(result[0]).toEqual({
      step: "conjugate",
      dx: 13,
      dz: 0.2,
      volume_ul: 1,
      liquid_class: "ivl_tip50_water_JetEmpty",
      timer_delta: -1,
      source: "CS031",
      group_number: 1,
      timer_group_check: 0,
      destination: 1,
      guid: 1,
      from_path: "some path",
      asp_mixing: "0",
      dispense_type: "Jet_Empty",
      tip_type: 50
    });

    // Test sample step
    expect(result[1]).toEqual({
      step: "sample",
      dx: 0,
      dz: 1.0,
      volume_ul: 75,
      liquid_class: "ivl_tip300_pbst_JetEmpty",
      timer_delta: 1200,
      source: "ABI-131-N1",
      group_number: 13,
      timer_group_check: 0,
      destination: 1,
      guid: 1,
      from_path: "some path",
      asp_mixing: "0",
      dispense_type: "Jet_Empty",
      tip_type: 300
    });

    // Test imaging step
    expect(result[2]).toEqual({
      step: "imaging",
      dx: 24,
      dz: 0.0,
      volume_ul: 0,
      liquid_class: "ivl_tip0_imaging_JetEmpty",
      timer_delta: 600,
      source: "camera",
      group_number: 25,
      timer_group_check: 13,
      destination: 1,
      guid: 1,
      from_path: "some path",
      asp_mixing: "0",
      dispense_type: "Jet_Empty",
      tip_type: 0
    });
  });
});
