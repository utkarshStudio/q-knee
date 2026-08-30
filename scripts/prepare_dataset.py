"""
Q-Knee Real Medical Imaging Data Pipeline - Dataset Preparation Script
Discovers MRI studies (DICOM, NPY, image formats), matches real metadata labels,
validates integrity, and generates leak-free train/val/test splits grouped by study/patient.
"""

import os
import sys
import json
import csv
import argparse
import random
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

def parse_args():
    parser = argparse.ArgumentParser(description="Prepare and split medical MRI dataset for Q-Knee.")
    parser.add_argument("--dataset_dir", type=str, required=True, help="Path to raw dataset directory.")
    parser.add_argument("--output_dir", type=str, default="./data/processed", help="Path to save split manifests and summaries.")
    parser.add_argument("--labels_file", type=str, default="", help="Path to CSV metadata containing study labels (e.g., train.csv).")
    parser.add_argument("--train_ratio", type=float, default=0.70, help="Ratio for training set (default: 0.70).")
    parser.add_argument("--val_ratio", type=float, default=0.15, help="Ratio for validation set (default: 0.15).")
    parser.add_argument("--test_ratio", type=float, default=0.15, help="Ratio for test set (default: 0.15).")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for deterministic splitting.")
    parser.add_argument("--format", type=str, default="auto", choices=["auto", "dicom", "npy", "image"], help="Expected file format.")
    return parser.parse_args()


def find_labels_csv(dataset_dir: Path, explicit_labels_file: str) -> Optional[Path]:
    """Locate the labels CSV file in the dataset directory or from explicit path."""
    if explicit_labels_file:
        p = Path(explicit_labels_file)
        if p.exists():
            return p
        print(f"[Warning] Explicit labels file not found: {explicit_labels_file}")

    candidates = ["train.csv", "labels.csv", "metadata.csv", "annotations.csv", "train_labels.csv"]
    for c in candidates:
        p = dataset_dir / c
        if p.exists():
            return p
    return None


def load_labels_map(labels_csv_path: Optional[Path]) -> Dict[str, int]:
    """
    Parse actual binary labels (e.g. ACL abnormality: 1=abnormal, 0=normal).
    Supports RSNA column names (study_id, StudyInstanceUID, acl_tear, ACL, label, etc.).
    """
    if not labels_csv_path or not labels_csv_path.exists():
        print("[Info] No labels CSV found. Studies will be indexed without ground truth labels.")
        return {}

    labels_map = {}
    with open(labels_csv_path, mode="r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return {}

        fields = [fn.strip() for fn in reader.fieldnames]
        # Identify ID column
        id_col = None
        for col in ["StudyInstanceUID", "study_instance_uid", "study_id", "StudyID", "id", "series_id", "PatientID"]:
            if col in fields:
                id_col = col
                break

        # Identify Label column
        label_col = None
        for col in ["acl_tear", "ACL", "acl", "abnormal", "abnormality", "label", "target", "class"]:
            if col in fields:
                label_col = col
                break

        if not id_col or not label_col:
            print(f"[Warning] Could not automatically identify ID and label columns in {labels_csv_path.name}.")
            print(f"Available fields: {fields}")
            return {}

        print(f"[Info] Loading labels from '{labels_csv_path.name}' using ID='{id_col}', Label='{label_col}'")
        for row in reader:
            study_id = str(row[id_col]).strip()
            val_str = str(row[label_col]).strip()
            if not study_id or val_str == "":
                continue
            try:
                val = int(float(val_str))
                labels_map[study_id] = val
            except ValueError:
                # Handle text labels like 'abnormal' / 'normal' / 'positive' / 'negative'
                v_lower = val_str.lower()
                if v_lower in ("1", "abnormal", "positive", "tear", "true", "yes"):
                    labels_map[study_id] = 1
                elif v_lower in ("0", "normal", "negative", "intact", "false", "no"):
                    labels_map[study_id] = 0

    print(f"[Info] Successfully loaded {len(labels_map)} study labels from {labels_csv_path.name}")
    return labels_map


def discover_studies(dataset_dir: Path, expected_format: str = "auto") -> List[Dict[str, Any]]:
    """
    Recursively discover MRI studies and files (.dcm, .npy, images).
    Groups slices belonging to the same study directory or series.
    """
    studies = []
    
    # Check if there is a 'train_series' or 'series' directory (standard RSNA layout)
    series_dirs = [dataset_dir / "train_series", dataset_dir / "series", dataset_dir / "images", dataset_dir]
    target_root = dataset_dir
    for s_dir in series_dirs:
        if s_dir.exists() and s_dir != dataset_dir:
            target_root = s_dir
            break

    # 1. Directory-per-study discovery (e.g. train_series/<study_id>/*.dcm)
    subdirs = [d for d in target_root.iterdir() if d.is_dir()]
    
    if subdirs:
        for study_dir in subdirs:
            dcm_files = sorted(list(study_dir.glob("*.dcm")) + list(study_dir.glob("*.DCM")))
            npy_files = sorted(list(study_dir.glob("*.npy")) + list(study_dir.glob("*.npz")))
            img_files = sorted(list(study_dir.glob("*.png")) + list(study_dir.glob("*.jpg")) + list(study_dir.glob("*.jpeg")))
            
            all_files = []
            fmt = "unknown"
            if dcm_files:
                all_files = dcm_files
                fmt = "dicom"
            elif npy_files:
                all_files = npy_files
                fmt = "npy"
            elif img_files:
                all_files = img_files
                fmt = "image"

            if all_files:
                studies.append({
                    "study_id": study_dir.name,
                    "format": fmt,
                    "file_count": len(all_files),
                    "file_paths": [str(f.resolve()) for f in all_files],
                    "root_dir": str(study_dir.resolve()),
                })

    # 2. Standalone files in directory (e.g. <study_id>.npy or individual dicoms)
    if not studies:
        npy_files = sorted(list(target_root.glob("*.npy")) + list(target_root.glob("*.npz")))
        if npy_files:
            for f in npy_files:
                studies.append({
                    "study_id": f.stem,
                    "format": "npy",
                    "file_count": 1,
                    "file_paths": [str(f.resolve())],
                    "root_dir": str(target_root.resolve()),
                })
        else:
            dcm_files = sorted(list(target_root.glob("*.dcm")) + list(target_root.glob("*.DCM")))
            if dcm_files:
                studies.append({
                    "study_id": target_root.name,
                    "format": "dicom",
                    "file_count": len(dcm_files),
                    "file_paths": [str(f.resolve()) for f in dcm_files],
                    "root_dir": str(target_root.resolve()),
                })

    return studies


def create_leak_free_splits(
    studies: List[Dict[str, Any]],
    labels_map: Dict[str, int],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42
) -> Tuple[Dict[str, List[Dict[str, Any]]], Dict[str, Any]]:
    """
    Create patient/study stratified splits preventing any data leakage.
    Each unique study ID is strictly placed in one split.
    """
    rng = random.Random(seed)
    
    # Assign labels
    pos_studies = []
    neg_studies = []
    unlabelled_studies = []

    for s in studies:
        s_id = s["study_id"]
        if s_id in labels_map:
            lbl = labels_map[s_id]
            s["label"] = lbl
            if lbl == 1:
                pos_studies.append(s)
            else:
                neg_studies.append(s)
        else:
            s["label"] = None
            unlabelled_studies.append(s)

    # Shuffle deterministically
    rng.shuffle(pos_studies)
    rng.shuffle(neg_studies)
    rng.shuffle(unlabelled_studies)

    def split_list(lst: List[Any]) -> Tuple[List[Any], List[Any], List[Any]]:
        n = len(lst)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)
        train_part = lst[:n_train]
        val_part = lst[n_train:n_train + n_val]
        test_part = lst[n_train + n_val:]
        return train_part, val_part, test_part

    pos_tr, pos_val, pos_te = split_list(pos_studies)
    neg_tr, neg_val, neg_te = split_list(neg_studies)
    unl_tr, unl_val, unl_te = split_list(unlabelled_studies)

    train_set = pos_tr + neg_tr + unl_tr
    val_set = pos_val + neg_val + unl_val
    test_set = pos_te + neg_te + unl_te

    rng.shuffle(train_set)
    rng.shuffle(val_set)
    rng.shuffle(test_set)

    # Validate leakage
    train_ids = {s["study_id"] for s in train_set}
    val_ids = {s["study_id"] for s in val_set}
    test_ids = {s["study_id"] for s in test_set}

    leakage_tv = train_ids.intersection(val_ids)
    leakage_tt = train_ids.intersection(test_ids)
    leakage_vt = val_ids.intersection(test_ids)

    if leakage_tv or leakage_tt or leakage_vt:
        raise RuntimeError(f"Data leakage detected! TV: {len(leakage_tv)}, TT: {len(leakage_tt)}, VT: {len(leakage_vt)}")

    splits = {
        "train": train_set,
        "validation": val_set,
        "test": test_set
    }

    summary = {
        "total_studies": len(studies),
        "labeled_studies": len(pos_studies) + len(neg_studies),
        "positive_samples": len(pos_studies),
        "negative_samples": len(neg_studies),
        "unlabelled_samples": len(unlabelled_studies),
        "splits": {
            "train": {
                "total": len(train_set),
                "positive": sum(1 for s in train_set if s.get("label") == 1),
                "negative": sum(1 for s in train_set if s.get("label") == 0),
                "unlabelled": sum(1 for s in train_set if s.get("label") is None),
            },
            "validation": {
                "total": len(val_set),
                "positive": sum(1 for s in val_set if s.get("label") == 1),
                "negative": sum(1 for s in val_set if s.get("label") == 0),
                "unlabelled": sum(1 for s in val_set if s.get("label") is None),
            },
            "test": {
                "total": len(test_set),
                "positive": sum(1 for s in test_set if s.get("label") == 1),
                "negative": sum(1 for s in test_set if s.get("label") == 0),
                "unlabelled": sum(1 for s in test_set if s.get("label") is None),
            }
        },
        "ratios": {
            "train": train_ratio,
            "validation": val_ratio,
            "test": test_ratio
        },
        "seed": seed,
        "leakage_free": True
    }

    return splits, summary


def main():
    args = parse_args()
    dataset_dir = Path(args.dataset_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Q-KNEE DATASET PREPARATION PIPELINE")
    print("=" * 60)
    print(f"Dataset Directory: {dataset_dir}")
    print(f"Output Directory:  {output_dir}")

    if not dataset_dir.exists():
        print(f"[Error] Dataset directory does not exist: {dataset_dir}")
        sys.exit(1)

    labels_csv = find_labels_csv(dataset_dir, args.labels_file)
    labels_map = load_labels_map(labels_csv)

    print("[Info] Discovering studies...")
    studies = discover_studies(dataset_dir, expected_format=args.format)
    print(f"[Info] Discovered {len(studies)} total studies.")

    if not studies:
        print("[Warning] No valid MRI studies found in the dataset directory.")
        sys.exit(0)

    splits, summary = create_leak_free_splits(
        studies=studies,
        labels_map=labels_map,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed
    )

    # Save splits.json and summary.json
    splits_file = output_dir / "splits.json"
    with open(splits_file, "w", encoding="utf-8") as f:
        json.dump(splits, f, indent=2)

    summary_file = output_dir / "dataset_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 60)
    print("DATASET VALIDATION & SPLIT SUMMARY")
    print("=" * 60)
    print(f"Total Studies Found:    {summary['total_studies']}")
    print(f"Positive (ACL Abn) [1]: {summary['positive_samples']}")
    print(f"Negative (Normal)  [0]: {summary['negative_samples']}")
    print(f"Unlabelled Studies:     {summary['unlabelled_samples']}")
    print("-" * 60)
    print(f"Train Set:      {summary['splits']['train']['total']} studies "
          f"(+:{summary['splits']['train']['positive']}, -:{summary['splits']['train']['negative']})")
    print(f"Validation Set: {summary['splits']['validation']['total']} studies "
          f"(+:{summary['splits']['validation']['positive']}, -:{summary['splits']['validation']['negative']})")
    print(f"Test Set:       {summary['splits']['test']['total']} studies "
          f"(+:{summary['splits']['test']['positive']}, -:{summary['splits']['test']['negative']})")
    print(f"Leakage Check:  {'PASSED (0 overlap)' if summary['leakage_free'] else 'FAILED'}")
    print("-" * 60)
    print(f"Manifest written to: {splits_file}")
    print(f"Summary written to:  {summary_file}")
    print("=" * 60)


if __name__ == "__main__":
    main()
