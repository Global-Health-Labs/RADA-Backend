/**
 * Get plate type by removing the plate index
 * @param plate - Input plate string
 * @returns Plate string without index
 */
export function getPlateType(plate: string): string {
  const plateSplit = plate.split("_");
  const plateType = plateSplit.slice(0, -1).join("_");
  return plateType;
}
