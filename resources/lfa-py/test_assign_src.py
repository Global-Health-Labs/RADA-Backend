import pandas as pd
import numpy as np
from one_run import assign_src
import json

# Create test worklist
worklist_data = [
    {
        'step': 'conjugate',
        'dx': 13,
        'dz': 0.2,
        'volume_ul': 1,
        'liquid_class': 'water',
        'time': -1,
        'source': 'CS031',
        'step_index': 1,
        'step_group_index': 1,
        'previous_step_index': 0,
        'destination': 1,
        'destination_group': 1,
        'group': 1,
        'group_number': 1,
        'previous_group': 0,
        'to_plate': 'IVL_Plate_v3_96cassettes_ABformat_0001',
        'to_well': 1
    },
    {
        'step': 'sample',
        'dx': 0,
        'dz': 1.0,
        'volume_ul': 75,
        'liquid_class': 'pbst',
        'time': 1200,
        'source': 'ABI-131-N1',
        'step_index': 2,
        'step_group_index': 2,
        'previous_step_index': 0,
        'destination': 2,
        'destination_group': 1,
        'group': 13,
        'group_number': 13,
        'previous_group': 0,
        'to_plate': 'IVL_Plate_v3_96cassettes_ABformat_0001',
        'to_well': 2
    },
    {
        'step': 'imaging',
        'dx': 0,
        'dz': 0,
        'volume_ul': 0,
        'liquid_class': '',
        'time': 0,
        'source': 'image',
        'step_index': 3,
        'step_group_index': 3,
        'previous_step_index': 2,
        'destination': 2,
        'destination_group': 1,
        'group': 14,
        'group_number': 14,
        'previous_group': 13,
        'to_plate': 'IVL_Plate_v3_96cassettes_ABformat_0001',
        'to_well': 2
    }
]

# Create test plate_df
plate_data = [
    {
        'plate': 'ivl_1_reservoir',
        'volume_well': 2000,
        'volume_holdover': 50,
        'nrow': 8,
        'ncol': 1
    },
    {
        'plate': 'ivl_2_384pp_v3',
        'volume_well': 55,
        'volume_holdover': 15,
        'nrow': 16,
        'ncol': 24
    }
]

worklist_df = pd.DataFrame(worklist_data)
plate_df = pd.DataFrame(plate_data)

# Run assign_src
result = assign_src(worklist_df, plate_df, 4)
print("\nFinal worklist result (raw):")
print(result)
#print(json.dumps(result, indent = 4))

