import pandas as pd
import numpy as np


def reorder_groups(worklist, exp_time):
    """
    reorder the worklist to satisfy timing requirements
    :param worklist: input worklist
    :param exp_time: dataframe describing how long each type of operation takes
    :return: new worklist
    """
    # smaller df for timing
    # print('exp_time\n', exp_time.to_string())
    time_worklist = worklist[['step', 'time', 'step_index', 
                              'step_group_index', 'previous_step_index', 'destination_group', 
                              'group', 'previous_group']].drop_duplicates().reset_index(drop=True)
    time_worklist = time_worklist.merge(exp_time, how='left')

    # # TODO: get back to this method of rearranging
    # time_worklist.loc[time_worklist['time'] < time_worklist['exp_time'], 'time'] = time_worklist['exp_time']
    # time_worklist['wait_time'] = time_worklist['time'] - time_worklist['exp_time']
    # sub_dst = time_worklist[time_worklist['destination_group'] == 1]
    # sub_dst = sub_dst[['destination_group', 'group', 'time', 'exp_time']]
    # sub_dst['clock_0'] = np.append(0, sub_dst['time'].values[:-1].cumsum())
    # sub_dst['clock_1'] = sub_dst['clock_0'] + sub_dst['exp_time']
    # sub_dst = sub_dst[['destination_group', 'group', 'clock_0', 'clock_1']]
    #
    # master_schedule = sub_dst.copy()
    #
    # sub_dst = time_worklist[time_worklist['destination_group'] == 2]
    # sub_dst = sub_dst[['destination_group', 'group', 'time', 'exp_time']]
    # sub_dst['clock_0'] = np.append(0, sub_dst['time'].values[:-1].cumsum())
    # sub_dst['clock_1'] = sub_dst['clock_0'] + sub_dst['exp_time']
    # sub_dst = sub_dst[['destination_group', 'group', 'clock_0', 'clock_1']]
    #
    # schedule0 = master_schedule.copy()
    # schedule1 = sub_dst.copy()
    #
    # free = np.hstack([np.arange(schedule0.iloc[irow]['clock_1'] + 1, schedule0.iloc[irow + 1]['clock_0'])
    #                   for irow in range(schedule0.shape[0]-1)])
    # free = np.append(free, schedule0['clock_1'].values[-1] + 1)
    #
    # for shift in free:
    #     schedule1a = schedule1.copy()
    #     schedule1a.loc[:, ['clock_0', 'clock_1']] += shift
    #     schedule_new = pd.concat([schedule0, schedule1a]).sort_values('clock_0')
    #     time_OK = all(schedule_new['clock_1'].values[:-1] < schedule_new['clock_0'].values[1:])
    #     if time_OK:
    #         break
    #
    # print(schedule_new)

    # add next_group
    next_df = pd.DataFrame() # rearranged queue, to execute each strip first
    for dst_group in np.sort(time_worklist['destination_group'].unique()):
        sub = time_worklist[time_worklist['destination_group'] == dst_group].sort_values('group')
        sub['group_forward'] = np.append(sub['group'].values[1:], [0]).astype(np.int64)
        sub['group_backward'] = np.append([0], sub['group'].values[:-1]).astype(np.int64)
        next_df = pd.concat([next_df, sub], ignore_index=True, sort=False)
    # original queue of actions, merged with next_df to have group_forward and group_backward
    time_worklist = time_worklist.merge(next_df)

    # go through and rearrange
    time_new = pd.DataFrame() # rearranged queue of actions
    current_group = time_worklist['group'].min()

    while time_worklist.shape[0] > 0:
        sub = time_worklist[time_worklist['group'] == current_group]
        
        if sub.empty:
            # If no rows found for current group, move to the next available group
            current_group = time_worklist['group'].min()
            continue

        # adjust exp_time in case there is some waiting involved
        # note that if there is no waiting, previous_group = 0
        previous_group = sub['previous_group'].values[0]
        if previous_group > 0:
            sub_previous = time_new[time_new['group'] == previous_group]
            if not sub_previous.empty:
                # current_clock = time_new['clock_1'].max()
                delta = time_new['clock_1'].max() - sub_previous['clock_0'].values[0]
                wait_time = sub_previous['time'].values[0] - delta
                if wait_time < 0:
                    wait_time = 0
                sub.loc[:, 'exp_time'] = sub.loc[:, 'exp_time'] + wait_time

        time_new = pd.concat([time_new, sub], ignore_index=True, sort=False)
        time_worklist = time_worklist.drop(sub.index.values)

        if time_worklist.shape[0] == 0:
            break
        else:
            # finding the requirements of each group
            time_new.loc[:, 'clock_1'] = time_new['exp_time'].cumsum()  # clock when the action finishes
            time_new.loc[:, 'clock_0'] = time_new['clock_1'] - time_new['exp_time']  # clock when the action starts
            time_new['time_late'] = time_new['clock_0'] + time_new['time'] - time_new['clock_1'].max()
            # Convert to boolean mask explicitly
            mask = (time_new['time'] == -1) | (time_new['time_late'] > 0)
            time_new.loc[:, 'alarm_quiet'] = mask

            # Get groups that need attention (not alarm_quiet)
            active_groups = time_new[~mask]
            if not active_groups.empty:
                next_group = active_groups['group_forward'].values
                next_group = next_group[next_group > 0]  # Remove 0 values
                next_group = np.setdiff1d(next_group, time_new['group'].unique())  # remove groups already in queue
            else:
                next_group = np.array([])
            
            if len(next_group) > 0:
                # Create a copy to avoid SettingWithCopyWarning
                group_late = time_worklist[time_worklist['group'].isin(next_group)].copy()
                if not group_late.empty:
                    # Get next steps safely
                    next_steps = []
                    for each in group_late['group_backward'].values:
                        group_steps = time_worklist[time_worklist['group'] == each]
                        if not group_steps.empty:
                            next_steps.append(group_steps['step'].values[0])
                        else:
                            next_steps.append('')
                    
                    # Calculate time_late for group_late
                    group_late.loc[:, 'time_late'] = time_new['time_late'].min() if not time_new.empty else 0
                    group_late.loc[:, 'next_step'] = next_steps
                    group_late.loc[:, 'priority'] = 2
                    group_late.loc[group_late['next_step'] == 'imaging', 'priority'] = 1
                    group_late.loc[group_late['time'] == 0, 'priority'] = 0
                    
                    # Sort only by priority if time_late is all the same
                    if group_late['time_late'].nunique() == 1:
                        group_late = group_late.sort_values('priority')
                    else:
                        group_late = group_late.sort_values(['priority', 'time_late'])
                    
                    if not group_late.empty:
                        current_group = group_late['group_forward'].values[0]
                    else:
                        current_group = time_worklist['group'].min()
                else:
                    current_group = time_worklist['group'].min()
            else:
                current_group = time_worklist['group'].min()
    time_new.loc[:, 'clock_1'] = time_new['exp_time'].cumsum()  # clock when the action finishes
    time_new.loc[:, 'clock_0'] = time_new['clock_1'] - time_new['exp_time']

    # go back to worklist to rearrange
    time_new.loc[:, 'group_order'] = np.arange(time_new.shape[0])
    worklist = worklist.merge(time_new[['group', 'group_order']], how='left').\
        sort_values('group_order').drop('group_order', axis=1)

    worklist = reset_group(worklist).sort_values(['group', 'destination'])
    # print('worklist\n', worklist.to_string())
    return worklist


def reset_group(worklist):
    """
    reset the group numbers, including the dependent ones
    :param worklist: input worklist
    :return: output worklist
    """
    group_unique = worklist['group'].unique()
    group_new = np.arange(group_unique.shape[0]) + 1
    group_map = pd.DataFrame.from_dict({'group': group_unique, 'group_new': group_new})
    group_map_previous = group_map.copy()
    group_map_previous.columns = ['previous_group', 'previous_group_new']

    worklist = worklist.merge(group_map, how='left').merge(group_map_previous, how='left').\
        drop(['group', 'previous_group'], axis=1).\
        rename(columns={'group_new': 'group', 'previous_group_new': 'previous_group'})
    worklist.loc[:, 'previous_group'] = worklist.loc[:, 'previous_group'].fillna(0)

    return worklist
