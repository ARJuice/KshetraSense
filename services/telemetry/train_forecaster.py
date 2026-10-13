from __future__ import annotations

import os

os.environ.setdefault("KERAS_BACKEND", "torch")

from .app.dataset import load_replay_dataset
from .app.forecast import train_forecaster


if __name__ == "__main__":
    result = train_forecaster(load_replay_dataset())
    print(f"Saved {result['modelVersion']} with {result['sampleCounts']['test']} held-out windows.")
