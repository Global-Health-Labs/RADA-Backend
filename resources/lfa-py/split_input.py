import numpy as np
import pandas as pd
import os


def get_sub_indices(n, nsub):
    """
    split indices of range(n) into sub lists based on nsub, with the remainders in the last sublist
    :param n: total number of indices
    :param nsub: number indices in each sublist
    :return: list of list
    """
    out = np.arange(nsub*np.ceil(n/nsub)).reshape(-1, nsub).astype(int)
    out = [list(each[each < n]) for each in out]
    return out


def get_perm_ind(n0, n1, nsub0, nsub1):
    """
    split permutations of n0 and n1 into sublists using nsub0 and nsub1, to split a big experiment into smaller ones
    :param n0: total number in dimension 0
    :param n1: total number in dimension 1
    :param nsub0: sub-number in dimension 0
    :param nsub1: sub-number in dimension 1
    :return: list of list
    """
    ilist = [get_sub_indices(n, nsub) for n, nsub in zip([n0, n1], [nsub0, nsub1])]
    perm_ind = [[each0, each1] for each0 in ilist[0] for each1 in ilist[1]]
    return perm_ind


def get_option_df(exp_input, coord0, coord1, nsub0, nsub1, delimiter_cell, delimiter_col):
    """
    get options based on experimental setup, split into sub experiments
    :param exp_input: dataframe describing experimental setup
    :param coord0: coordinate of the primary variable
    :param coord1: coordinate of the secondary variable
    :param nsub0: sub-number of options for the primary variable
    :param nsub1: sub-number of options for the secondary variable
    :param delimiter_cell: delimiter to separate options of a variable
    :param delimiter_col: delimiter to separate row and col indices of the coordinate, to use in column name of options
    :return: dataframe of permutations
    """
    # print('coord0', coord0, 'coord1', coord1)
    # print('tuple(np.array(coord0.split(delimiter_col)).astype(int))',tuple(np.array(coord0.split(delimiter_col)).astype(int)))
    string0 = exp_input.iloc[tuple(np.array(coord0.split(delimiter_col)).astype(int))]
    # print('string0', string0)
    option0 = np.array(string0.replace(' ', '').split(delimiter_cell))
    # print('option0', option0)
    n0 = len(option0)

    string1 = exp_input.iloc[tuple(np.array(coord1.split(delimiter_col)).astype(int))]
    # print('string1', string1)
    option1 = np.array(string1.replace(' ', '').split(delimiter_cell))
    # print('option1', option1)
    n1 = len(option1)

    perm_ind = get_perm_ind(n0, n1, nsub0, nsub1)
    # print('n0', n0, 'n1', n1, 'nsub0', nsub0, 'nsub1', nsub1, 'perm_ind', perm_ind)
    option_list = [[delimiter_cell.join(option0[each[0]]), delimiter_cell.join(option1[each[1]])] for each in perm_ind]
    option_df = pd.DataFrame(data=option_list, columns=[coord0, coord1])
    # print('option_list', option_list)
    # print('option_df', option_df)
    # print('exp_input', exp_input.to_string())
    return option_df


def get_sub_exp_input(exp_input, option_row, delimiter_col):
    """
    generate exp_input dataframes for sub experiments
    :param exp_input: dataframe describing experimental setup
    :param option_row: row of options
    :param delimiter_col: delimiter to separate row and col indices of the coordinate, to use in column name of options
    :return:
    """
    # print('option_row', option_row.index.values)
    out = exp_input.copy()
    for each in option_row.index.values:
        out.iloc[tuple(np.array(each.split(delimiter_col)).astype(int))] = option_row[each]
    return out


def get_sub_exp_input_list(exp_input, coord0, coord1, nsub0, nsub1, delimiter_cell, delimiter_col):
    """
    get list of dataframes for subexperiments
    :param exp_input: dataframe describing experimental setup
    :param coord0: coordinate of the primary variable
    :param coord1: coordinate of the secondary variable
    :param nsub0: sub-number of options for the primary variable
    :param nsub1: sub-number of options for the secondary variable
    :param delimiter_cell: delimiter to separate options of a variable
    :param delimiter_col: delimiter to separate row and col indices of the coordinate, to use in column name of options
    :return: list of dataframes for subexperiments
    """
    option_df = get_option_df(exp_input, coord0, coord1, nsub0, nsub1, delimiter_cell, delimiter_col)
    # print('option_df.shape', option_df.shape[0])
    # print('option_df', option_df.to_string())
    sub_exp_input_list = [get_sub_exp_input(exp_input, option_df.iloc[i, :], delimiter_col)
                          for i in range(option_df.shape[0])]
    # print('sub_exp_input_list', sub_exp_input_list)
    return sub_exp_input_list


def write_sub_exp_input_list(sub_exp_input_list, output_dir, prefix):
    """
    write sub experimental setup dataframes
    :param sub_exp_input_list: list of sub experimental setup dataframes
    :param output_dir: output directory
    :param prefix: prefix of filenames
    :return: list of paths
    """
    if not os.path.isdir(output_dir):
        os.mkdir(output_dir)

    nzfill = len(str(len(sub_exp_input_list)))

    path_list = []

    for i, each in enumerate(sub_exp_input_list):
        filename = os.path.join(output_dir, prefix + str(i).zfill(nzfill) + '.csv')
        each.to_csv(filename, index=False)
        path_list = path_list + [filename]

    return path_list
