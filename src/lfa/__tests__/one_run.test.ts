import {
  patchInput,
  getPermutations,
  getWorklistFromPermutations,
  getWorklistFullFactorial,
  ExperimentStep,
} from "../one_run";
import { getPlateType } from "../utils";

describe("LFA One Run Functions", () => {
  describe("getPlateType", () => {
    it("should remove the last segment after underscore", () => {
      expect(getPlateType("plate_type_1")).toBe("plate_type");
      expect(getPlateType("test_plate_123")).toBe("test_plate");
    });
  });

  describe("patchInput", () => {
    it("should correctly add step indices to experiment steps", () => {
      const testInput: ExperimentStep[] = [
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
          source: "D001-N1,D001-P1,D002-N1,D002-P1,D003-N1,D003-P...",
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

      const result = patchInput(testInput);

      // Test length remains the same
      expect(result.length).toBe(testInput.length);

      // Test step indices are added correctly
      expect(result[0].step_index).toBe(1);
      expect(result[1].step_index).toBe(2);
      expect(result[2].step_index).toBe(3);

      // Test step group indices are added correctly
      expect(result[0].step_group_index).toBe(1);
      expect(result[1].step_group_index).toBe(2);
      expect(result[2].step_group_index).toBe(3);

      // Test previous step indices are calculated correctly
      expect(result[0].previous_step_index).toBe(0); // time <= 0
      expect(result[1].previous_step_index).toBe(0); // first step with time > 0
      expect(result[2].previous_step_index).toBe(2); // time > 0

      // Test original data is not mutated
      expect(testInput[0]).not.toHaveProperty("step_index");
      expect(testInput[0]).not.toHaveProperty("step_group_index");
      expect(testInput[0]).not.toHaveProperty("previous_step_index");
    });
  });

  describe("getPermDf", () => {
    it("should generate correct permutations with source combinations", () => {
      const testInput: ExperimentStep[] = [
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

      const result = getPermutations(testInput, 4, ",", "_", 1);

      // Test basic structure
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(96); // 2 CS sources * 12 samples * 4 repetitions

      // Test first row
      expect(result[0]).toEqual({
        rep: 0,
        "0_12": "CS031",
        "1_12": "ABI-131-N1",
        destination: 1,
      });

      // Test last row
      expect(result[95]).toEqual({
        rep: 3,
        "0_12": "CS033",
        "1_12": "R007-P1",
        destination: 96,
      });

      // Test repetition structure
      expect(result.filter((row) => row.rep === 0).length).toBe(24); // 2 CS sources * 12 samples
      expect(result.filter((row) => row.rep === 1).length).toBe(24);
      expect(result.filter((row) => row.rep === 2).length).toBe(24);
      expect(result.filter((row) => row.rep === 3).length).toBe(24);

      // Test sorting (reverseVar = 1)
      const firstRepRows = result.filter((row) => row.rep === 0);
      expect(firstRepRows[0]["0_12"]).toBe("CS031"); // Should start with CS031
      expect(firstRepRows[12]["0_12"]).toBe("CS033"); // Should switch to CS033 halfway
    });
  });

  describe("getWorklistFromPerm", () => {
    it("should generate correct worklist from permutation data", () => {
      const testInput: ExperimentStep[] = [
        {
          step: "conjugate",
          dx: 13,
          dz: 0.2,
          volume: 1,
          liquid_class: "water",
          time: -1,
          source: "CS031,CS033",
          step_index: 1,
          step_group_index: 1,
          previous_step_index: 0,
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
          step_index: 2,
          step_group_index: 2,
          previous_step_index: 0,
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
        },
      ];

      const permDf = getPermutations(testInput, 4, ",", "_", 1);
      const result = getWorklistFromPermutations(testInput, permDf, 8, "_");

      // Test basic structure
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(288); // 96 each for conjugate, sample, and imaging

      // Test first conjugate step
      expect(result[0]).toEqual({
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
      });

      // Test first sample step
      const firstSample = result.find(
        (row) => row.step === "sample" && row.destination === 1
      );
      expect(firstSample).toEqual({
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
        group: 97,
        previous_group: 0,
      });

      // Test first imaging step
      const firstImaging = result.find(
        (row) => row.step === "imaging" && row.destination === 1
      );
      expect(firstImaging).toEqual({
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
        group: 193,
        previous_group: 13,
      });

      // Test sorting
      const sortedCorrectly = result.every((row, i) => {
        if (i === 0) return true;
        const prev = result[i - 1];

        // Check primary sort by step_group_index
        if (row.step_group_index !== prev.step_group_index) {
          return (row.step_group_index ?? 0) > (prev.step_group_index ?? 0);
        }

        // Check secondary sort by destination_group
        if (row.destination_group !== prev.destination_group) {
          return (row.destination_group ?? 0) > (prev.destination_group ?? 0);
        }

        // Check tertiary sort by step_index
        if (row.step_index !== prev.step_index) {
          return (row.step_index ?? 0) > (prev.step_index ?? 0);
        }

        // Check final sort by destination
        return (row.destination ?? 0) >= (prev.destination ?? 0);
      });

      expect(sortedCorrectly).toBe(true);
    });
  });

  describe("getWorklistFullFactorial", () => {
    it("should generate correct worklist with dummy steps removed", () => {
      const testInput: ExperimentStep[] = [
        {
          step: "conjugate",
          dx: 13,
          dz: 0.2,
          volume: 1,
          liquid_class: "water",
          time: -1,
          source: "CS031,CS033",
          step_index: 1,
          step_group_index: 1,
          previous_step_index: 0,
        },
        {
          step: "dummy",
          dx: 0,
          dz: 0,
          volume: 0,
          liquid_class: "dummy",
          time: 0,
          source: "dummy",
          step_index: 2,
          step_group_index: 2,
          previous_step_index: 0,
        },
        {
          step: "sample",
          dx: 0,
          dz: 1.0,
          volume: 75,
          liquid_class: "pbst",
          time: 1200,
          source: "D001-N1,D001-P1",
          step_index: 3,
          step_group_index: 3,
          previous_step_index: 0,
        },
      ];

      const result = getWorklistFullFactorial(testInput, 4, 8, ",", "_", 1);

      // Test basic structure
      expect(result).toBeDefined();
      expect(result.worklist).toBeDefined();
      expect(result.permDf).toBeDefined();
      expect(result.expInput).toBeDefined();

      // Test dummy step removal
      expect(result.expInput.length).toBe(2); // Original 3 - 1 dummy
      expect(result.expInput.every((step) => step.step !== "dummy")).toBe(true);

      // Test permutation data structure
      const firstPerm = result.permDf[0];
      expect(firstPerm).toHaveProperty("0_2"); // First step source
      expect(firstPerm).toHaveProperty("1_2"); // Third step source (now second after dummy removal)
      expect(firstPerm).not.toHaveProperty("2_2"); // Dummy step removed

      // Test worklist generation
      expect(result.worklist.length).toBeGreaterThan(0);
      expect(result.worklist[0]).toMatchObject({
        step: "conjugate",
        source: expect.any(String),
        destination: expect.any(Number),
        destination_group: expect.any(Number),
        group: expect.any(Number),
        previous_group: expect.any(Number),
      });
    });
  });
});
