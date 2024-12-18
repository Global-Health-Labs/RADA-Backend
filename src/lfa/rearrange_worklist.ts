import _ from "lodash";
import { WorklistRow } from "./types";

interface ExpTime {
  step: string;
  exp_time: number;
}

export function reorderGroups(
  worklist: WorklistRow[],
  expTime: ExpTime[]
): WorklistRow[] {
  // Create smaller array for timing
  const timeWorklist = _.uniqBy(
    worklist.map((row) => ({
      step: row.step,
      time: row.time,
      step_index: row.step_index,
      step_group_index: row.step_group_index,
      previous_step_index: row.previous_step_index,
      destination_group: row.destination_group,
      group: row.group,
      previous_group: row.previous_group,
    })),
    (row) => JSON.stringify(row)
  );

  // Convert expTime array to a map for faster lookups
  const expTimeMap = new Map(expTime.map((et) => [et.step, et.exp_time]));

  // Get unique groups and their steps
  const groups = _.groupBy(timeWorklist, "group");
  const uniqueGroups = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b);

  // Initialize group order map
  const groupOrder = new Map<number, number>();
  let currentOrder = 1;

  // Process groups in order
  while (groupOrder.size < uniqueGroups.length) {
    for (const group of uniqueGroups) {
      if (groupOrder.has(group)) continue;

      const groupRows = groups[group];
      const prevGroups = new Set(groupRows.map((row) => row.previous_group));
      prevGroups.delete(0); // Remove 0 as it's not a real dependency

      // Check if all previous groups are processed
      if (Array.from(prevGroups).every((pg) => groupOrder.has(pg))) {
        // Calculate total time for the group
        const totalTime = Math.max(
          ...groupRows.map((row) => expTimeMap.get(row.step) || 0)
        );

        groupOrder.set(group, currentOrder);
        currentOrder++;
      }
    }
  }

  // Apply new group order to worklist
  const orderedWorklist = [...worklist].sort((a, b) => {
    const orderA = groupOrder.get(a.group) || 0;
    const orderB = groupOrder.get(b.group) || 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.destination - b.destination;
  });

  //   console.log("Ordered worklist:\n", JSON.stringify(orderedWorklist, null, 2));

  return orderedWorklist;
}
