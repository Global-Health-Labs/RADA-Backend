export const DISPENSE_TYPES = {
  JET_EMPTY: 'Jet_Empty',
  SURFACE_EMPTY: 'Surface_Empty',
} as const;

export type DispenseType = typeof DISPENSE_TYPES[keyof typeof DISPENSE_TYPES];
