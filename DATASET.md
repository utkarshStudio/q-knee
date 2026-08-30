# Q-Knee Dataset Specification & Pipeline

## Dataset Overview

The Q-Knee diagnostic pipeline is engineered for knee magnetic resonance imaging (MRI) volumes formatted as:
1. **DICOM Series** (`.dcm`, `.dicom`)
2. **3D NumPy Arrays** (`.npy` containing $(D, H, W)$ or $(H, W, D)$ volume arrays)
3. **2D Representative Image Slices** (`.png`, `.jpg`, `.jpeg`)

---

## Data Ingestion & Preprocessing

```
Raw Series / Volume
       ↓
Physical Slice Sorting (ImagePositionPatient / InstanceNumber)
       ↓
Window / Level Contrast Normalization (DICOM Rescale Slope & Intercept)
       ↓
Representative Slice Sampling (Centered & anatomical coverage)
       ↓
Spatial Resizing (128 × 128 Bilinear Interpolation)
       ↓
Tensor Standardization (PyTorch ImageNet Mean & Std)
```

---

## Leak-Free Dataset Partitioning

To ensure scientific integrity and eliminate patient-level data leakage, dataset splitting strictly groups all slices belonging to the same study/patient prior to partitioning:

- **Train Split (70%)**: Used exclusively for fitting PCA components, tuning SVM hyperparameters, and training VQC variational weights.
- **Validation Split (15%)**: Used for hyperparameter selection and early stopping.
- **Test Split (15%)**: **Untouched test partition** evaluated only during final benchmarking.

The partitioning schema is stored in `data/splits.json`.

---

## Directory Organization

```
data/
├── quantum_features/           # Stored 4D PCA features and split labels
│   ├── train_pca_features.npy
│   ├── train_labels.npy
│   ├── test_pca_features.npy
│   ├── test_labels.npy
│   ├── vqc_weights.npy         # Trained 4-qubit VQC variational parameters
│   └── vqc_config.json
├── sample_mri_dataset/         # Sample real MRI studies for local verification
│   └── train_series/
│       ├── study_001/volume.npy
│       └── study_002/volume.npy
├── splits.json                 # Patient-level partition metadata
└── README.md
```

---

## Licensing & Data Attribution

- **Reference Dataset**: Knee MRI clinical datasets (e.g. MRNet / RSNA Knee Challenge datasets).
- **Usage Restrictions**: Academic, research, and hackathon evaluation only.
- **De-Identification**: All DICOM and NPY arrays must be stripped of protected health information (PHI) prior to upload.
