import numpy as np

def get_tip_type(volume, types=[0, 50, 300, 1000]):
    # Convert single value to array if needed
    volume = np.array([volume]) if np.isscalar(volume) else np.array(volume)
    types = np.array(types)
    compatible = volume[:, np.newaxis] <= types[np.newaxis, :]
    ind = (1 - compatible).sum(axis=1)
    tip_type = types[ind]
    return tip_type[0] if len(tip_type) == 1 else tip_type  # Return scalar if input was scalar

# Test with default types [0, 50, 300, 1000]
print("Testing with default types [0, 50, 300, 1000]:")
print(f"getTipType(1) = {get_tip_type(1)}")
print(f"getTipType(50) = {get_tip_type(50)}")
print(f"getTipType(51) = {get_tip_type(51)}")
print(f"getTipType(300) = {get_tip_type(300)}")
print(f"getTipType(301) = {get_tip_type(301)}")
print(f"getTipType(1000) = {get_tip_type(1000)}")
print(f"getTipType(1001) = {get_tip_type(1001)}")

# Test with custom tip types
types = [0, 40, 1950]  # ivl_2_384pp_v3 and ivl_1_reservoir
print("\nTesting with custom types [0, 40, 1950]:")
print(f"getTipType(1, types) = {get_tip_type(1, types)}")
print(f"getTipType(40, types) = {get_tip_type(40, types)}")
print(f"getTipType(41, types) = {get_tip_type(41, types)}")
print(f"getTipType(1950, types) = {get_tip_type(1950, types)}")
print(f"getTipType(2000, types) = {get_tip_type(2000, types)}")

# Test the specific case from assign_src.test.ts
volume1 = 1  # Conjugate step
volume75 = 75  # Sample step
print("\nTesting specific cases:")
print(f"getTipType({volume1}, {types}) = {get_tip_type(volume1, types)}")
print(f"getTipType({volume75}, {types}) = {get_tip_type(volume75, types)}")