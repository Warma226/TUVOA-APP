import numpy as np
from scipy.io import wavfile
def write(path, data, sr, subtype=None):
    d = np.clip(np.asarray(data), -1, 1)
    wavfile.write(str(path), sr, (d * 32767).astype(np.int16))
