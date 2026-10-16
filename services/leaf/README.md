# Leaf Diagnosis

Leaf Diagnosis is an image-only 17-class Apple, Potato, and Tomato classifier served by the existing local FastAPI process at `POST /v1/leaf/predict`. It uses an ImageNet-initialized MobileNetV3-Small and a versioned RGB 224 × 224 preprocessing path. Soil, zone, crop-selection, and satellite context are not request fields.

The API accepts one JPEG or PNG image up to 10 MiB, checks its signature and decoded dimensions, removes metadata before inference, and does not save the upload. Scores are uncalibrated softmax outputs; the versioned review policy requires manual review for every result. The model has no supported-domain detector, severity output, or treatment advice.

## Data source and attribution

Training uses the color configuration from [PlantVillage-Dataset](https://github.com/spMohanty/PlantVillage-Dataset), downloaded from its [Hugging Face mirror](https://huggingface.co/datasets/mohanty/PlantVillage) at revision `9e97599868962bd0079b8db4b7f1efa9185fa1e7`. The pinned archive SHA-256 is `fba30c6a7965e49be94b47a62f8aff6cfb1c35c27f475f22092b56db41745e84`. The dataset card declares CC BY-SA 3.0. The downloader keeps only the 17 supported color folders under the ignored local `data/plantvillage/` directory and writes a hash, class, group, and split manifest.

Please cite Mohanty, Hughes, and Salathé, “Using Deep Learning for Image-Based Plant Disease Detection,” *Frontiers in Plant Science* (2016), [DOI 10.3389/fpls.2016.01419](https://doi.org/10.3389/fpls.2016.01419). The model metadata records the pinned dataset revision, archive digest, split counts, evaluation metrics, and model-artifact digest.

## Prepare and train

From the repository root, the GPU training environment uses the same Keras/PyTorch versions as the API and the CUDA 13.0 PyTorch wheel:

```powershell
python -m venv services/leaf/.venv
.\services\leaf\.venv\Scripts\python.exe -m pip install -r services/leaf/requirements-training-gpu.txt
.\services\leaf\.venv\Scripts\python.exe -m services.leaf.download_dataset
.\services\leaf\.venv\Scripts\python.exe -m services.leaf.train
```

The archive is about 2.18 GB before the script removes it after extracting supported color classes. The train script starts from PlantVillage's official leaf-disjoint test split, then excludes ten images in five groups that the audit found crossing the source train/test boundary. Validation groups are drawn only from official training images. The audited source contains 23,483 supported images before those exclusions; 18,820 train and 4,653 test images remain. Training fits a new classifier head, fine-tunes the last non-BatchNorm backbone layers, and evaluates on the remaining held-out test images. It writes `models/leaf_mobilenetv3_small.keras` and `models/metadata.json`.

The held-out 4,653-image PlantVillage test result is 92.97% accuracy and 93.52% macro-F1 (macro precision 93.14%, macro recall 94.22%). The metadata contains per-class precision/recall/F1 and support, accuracy, macro-F1, NLL, Brier score, 15-bin expected calibration error, and a majority-class baseline. Those measures describe the PlantVillage split only; they do not establish field-photo or farm performance. PlantDoc has not been evaluated. Softmax outputs are not calibrated probabilities and every API result requires manual review. The API checks the model's class map, preprocessing version, input/output shape, and SHA-256 before first inference. Missing or invalid weights return `503`.

## Verification

From `services/zoning`, run the backend suite (including the leaf API/resource-limit tests):

```powershell
python -m pytest tests -q
```

From the repository root, run frontend contract tests and typecheck:

```powershell
npm test
npm run typecheck
```
