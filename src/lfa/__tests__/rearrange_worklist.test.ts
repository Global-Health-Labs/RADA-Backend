import { WorklistRow, ExperimentStep } from '../one_run';
import { reorderGroups } from '../rearrange_worklist';

describe('reorderGroups', () => {
    it('should correctly reorder groups based on dependencies and timing', () => {
        // Sample input worklist
        const worklist: WorklistRow[] = [
            { step: 'conjugate', dx: 13, dz: 0.2, volume: 1, liquid_class: 'water', time: -1, source: 'CS031', step_index: 1, step_group_index: 1, previous_step_index: 0, destination_group: 1, group: 1, previous_group: 0, destination: 1 },
            { step: 'conjugate', dx: 13, dz: 0.2, volume: 1, liquid_class: 'water', time: -1, source: 'CS031', step_index: 1, step_group_index: 1, previous_step_index: 0, destination_group: 1, group: 1, previous_group: 0, destination: 2 },
            { step: 'sample', dx: 0, dz: 1.0, volume: 75, liquid_class: 'pbst', time: 1200, source: 'D001-N1', step_index: 2, step_group_index: 2, previous_step_index: 0, destination_group: 1, group: 2, previous_group: 0, destination: 1 },
            { step: 'sample', dx: 0, dz: 1.0, volume: 75, liquid_class: 'pbst', time: 1200, source: 'D001-P1', step_index: 2, step_group_index: 2, previous_step_index: 0, destination_group: 1, group: 2, previous_group: 0, destination: 2 },
            { step: 'imaging', dx: 24, dz: 0.0, volume: 0, liquid_class: 'imaging', time: 600, source: 'camera', step_index: 3, step_group_index: 3, previous_step_index: 2, destination_group: 1, group: 3, previous_group: 2, destination: 1 },
            { step: 'imaging', dx: 24, dz: 0.0, volume: 0, liquid_class: 'imaging', time: 600, source: 'camera', step_index: 3, step_group_index: 3, previous_step_index: 2, destination_group: 1, group: 3, previous_group: 2, destination: 2 }
        ];

        // Sample experiment timing data
        const expTime = [
            { step: 'conjugate', exp_time: 120 },
            { step: 'sample', exp_time: 120 },
            { step: 'imaging', exp_time: 20 }
        ];

        const result = reorderGroups(worklist, expTime);

        // Test the order of groups
        expect(result[0].group).toBe(1); // Conjugate should be first (no dependencies)
        expect(result[2].group).toBe(2); // Sample should be second
        expect(result[4].group).toBe(3); // Imaging should be last (depends on sample)

        // Test that destinations within groups are ordered
        expect(result[0].destination).toBeLessThan(result[1].destination);
        expect(result[2].destination).toBeLessThan(result[3].destination);
        expect(result[4].destination).toBeLessThan(result[5].destination);

        // Test that step properties are preserved
        expect(result[0].step).toBe('conjugate');
        expect(result[2].step).toBe('sample');
        expect(result[4].step).toBe('imaging');

        // Test that group dependencies are respected
        const imagingRows = result.filter(row => row.step === 'imaging');
        imagingRows.forEach(row => {
            expect(row.previous_group).toBe(2); // Imaging depends on sample (group 2)
        });
    });

    it('should handle complex dependencies between groups', () => {
        const baseStep: Partial<WorklistRow> = {
            dx: 0, dz: 0, volume: 0, liquid_class: 'test', time: -1, source: 'test'
        };

        const worklist: WorklistRow[] = [
            // Group 1 (no dependencies)
            { ...baseStep, step: 'step1', step_index: 1, step_group_index: 1, previous_step_index: 0, destination_group: 1, group: 1, previous_group: 0, destination: 1 },
            // Group 2 (depends on 1)
            { ...baseStep, step: 'step2', step_index: 2, step_group_index: 2, previous_step_index: 1, destination_group: 1, group: 2, previous_group: 1, destination: 1 },
            // Group 3 (depends on 1)
            { ...baseStep, step: 'step3', step_index: 3, step_group_index: 3, previous_step_index: 1, destination_group: 1, group: 3, previous_group: 1, destination: 1 },
            // Group 4 (depends on 2 and 3)
            { ...baseStep, step: 'step4', step_index: 4, step_group_index: 4, previous_step_index: 2, destination_group: 1, group: 4, previous_group: 2, destination: 1 },
            { ...baseStep, step: 'step4', step_index: 4, step_group_index: 4, previous_step_index: 3, destination_group: 1, group: 4, previous_group: 3, destination: 2 }
        ] as WorklistRow[];

        const expTime = [
            { step: 'step1', exp_time: 10 },
            { step: 'step2', exp_time: 20 },
            { step: 'step3', exp_time: 15 },
            { step: 'step4', exp_time: 25 }
        ];

        const result = reorderGroups(worklist, expTime);

        // Group 1 should be first (no dependencies)
        expect(result[0].group).toBe(1);

        // Groups 2 and 3 can be in either order (both depend only on 1)
        const group2Index = result.findIndex(row => row.group === 2);
        const group3Index = result.findIndex(row => row.group === 3);
        expect(group2Index).toBeLessThan(result.findIndex(row => row.group === 4));
        expect(group3Index).toBeLessThan(result.findIndex(row => row.group === 4));

        // Group 4 should be last (depends on 2 and 3)
        expect(result[result.length - 1].group).toBe(4);
    });

    it('should preserve all original properties', () => {
        const originalRow: WorklistRow = {
            step: 'test',
            dx: 0,
            dz: 0,
            volume: 0,
            liquid_class: 'test',
            time: 100,
            source: 'test',
            step_index: 1,
            step_group_index: 1,
            previous_step_index: 0,
            destination_group: 1,
            group: 1,
            previous_group: 0,
            destination: 1
        };

        const worklist = [originalRow];
        const expTime = [{ step: 'test', exp_time: 10 }];

        const result = reorderGroups(worklist, expTime);
        const resultRow = result[0];

        // Check that all original properties are preserved
        Object.keys(originalRow).forEach(key => {
            expect(resultRow[key as keyof WorklistRow]).toBe(originalRow[key as keyof WorklistRow]);
        });
    });

    it('should correctly reorder a full factorial worklist', () => {
        // Create a sample of the full factorial worklist
        const conjugateStep: Partial<WorklistRow> = {
            step: "conjugate",
            dx: 13,
            dz: 0.2,
            volume: 1,
            liquid_class: "water",
            time: -1,
            step_index: 1,
            step_group_index: 1,
            previous_step_index: 0,
            previous_group: 0
        };

        const sampleStep: Partial<WorklistRow> = {
            step: "sample",
            dx: 0,
            dz: 1.0,
            volume: 75,
            liquid_class: "pbst",
            time: 1200,
            step_index: 2,
            step_group_index: 2,
            previous_step_index: 0,
            previous_group: 0
        };

        const imagingStep: Partial<WorklistRow> = {
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
            previous_group: 13
        };

        // Create a representative sample of the worklist
        const worklist: WorklistRow[] = [
            // Group 1 (Conjugate)
            { ...conjugateStep, source: "CS031", group: 1, destination_group: 1, destination: 1 },
            { ...conjugateStep, source: "CS031", group: 1, destination_group: 1, destination: 2 },
            // Group 13 (Sample)
            { ...sampleStep, source: "D001-N1", group: 13, destination_group: 1, destination: 1 },
            { ...sampleStep, source: "D001-P1", group: 13, destination_group: 1, destination: 2 },
            // Group 25 (Imaging)
            { ...imagingStep, group: 25, destination_group: 1, destination: 1 },
            { ...imagingStep, group: 25, destination_group: 1, destination: 2 }
        ] as WorklistRow[];

        const expTime = [
            { step: "conjugate", exp_time: 120 },
            { step: "capture", exp_time: 120 },
            { step: "sample", exp_time: 120 },
            { step: "rb", exp_time: 60 },
            { step: "imaging", exp_time: 20 }
        ];

        const result = reorderGroups(worklist, expTime);

        // Verify the order of steps
        expect(result[0].step).toBe("conjugate"); // Conjugate should be first
        expect(result[2].step).toBe("sample");    // Sample should be second
        expect(result[4].step).toBe("imaging");   // Imaging should be last

        // Verify group dependencies
        expect(result.find(row => row.step === "imaging")?.previous_group).toBe(13); // Imaging depends on Sample group

        // Verify destinations are maintained within groups
        const conjugateGroup = result.filter(row => row.step === "conjugate");
        expect(conjugateGroup[0].destination).toBeLessThan(conjugateGroup[1].destination);

        const sampleGroup = result.filter(row => row.step === "sample");
        expect(sampleGroup[0].destination).toBeLessThan(sampleGroup[1].destination);

        const imagingGroup = result.filter(row => row.step === "imaging");
        expect(imagingGroup[0].destination).toBeLessThan(imagingGroup[1].destination);

        // Verify all properties are preserved
        const firstRow = result[0];
        expect(firstRow).toMatchObject({
            step: "conjugate",
            dx: 13,
            dz: 0.2,
            volume: 1,
            liquid_class: "water",
            time: -1,
            step_index: 1,
            step_group_index: 1,
            previous_step_index: 0
        });
    });
});
