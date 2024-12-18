import { getTipType } from "../cleanup_worklist";

describe("getTipType", () => {
  it("should correctly assign tip types based on volume", () => {
    // Test with default types [0, 50, 300, 1000]
    expect(getTipType(1)).toBe(50);     // First compatible tip size
    expect(getTipType(50)).toBe(50);    // Exact match
    expect(getTipType(51)).toBe(300);   // Next size up
    expect(getTipType(300)).toBe(300);  // Exact match
    expect(getTipType(301)).toBe(1000); // Next size up
    expect(getTipType(1000)).toBe(1000); // Exact match
    expect(getTipType(1001)).toBe(1000); // Use largest when exceeding all sizes
  });

  it("should work with custom tip types", () => {
    // Test with volume_usable values from plates
    const types = [0, 50, 940, 39200];  // Real plate volumes
    expect(getTipType(1, types)).toBe(50);    // Small volume uses first non-zero
    expect(getTipType(48, types)).toBe(50);   // Just under 50
    expect(getTipType(600, types)).toBe(940); // Medium volume
    expect(getTipType(940, types)).toBe(940); // Exact match
    expect(getTipType(1000, types)).toBe(39200); // Next size up
  });

  it("should match Python's behavior for plate assignments", () => {
    // Test with actual plate volumes [0, 40, 1950]
    const types = [0, 40, 1950];
    expect(getTipType(1, types)).toBe(40);    // Small volume uses first non-zero
    expect(getTipType(40, types)).toBe(40);   // Exact match
    expect(getTipType(75, types)).toBe(1950); // Medium volume uses next size up
    expect(getTipType(1950, types)).toBe(1950); // Large volume exact match
    expect(getTipType(2000, types)).toBe(1950); // Over maximum uses largest
  });
});
