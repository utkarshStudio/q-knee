"""
Q-Knee Real Medical Imaging Data Pipeline - Feature Extraction Script
Extracts 512-dimensional ResNet18 embeddings for all studies in a dataset/split manifest.
Applies deterministic slice sampling, consistent normalization, and feature caching.
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional
import numpy as np

# Add project root and ml-service to path
project_root = Path(__file__).parent.parent.resolve()
ml_service_dir = project_root / "ml-service"
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_service_dir))

from app.services.dicom_service import load_study_slices, select_representative_slices
from app.pipeline.feature_extractor import extract_features_from_batch, aggregate_slice_features, get_device

def parse_args():
    parser = argparse.ArgumentParser(description="Extract 512D ResNet18 features for MRI studies.")
    parser.add_argument("--splits_file", type=str, default="./data/processed/splits.json", help="Path to splits.json manifest.")
    parser.add_argument("--dataset_dir", type=str, default="", help="Optional: raw dataset directory if splits.json not generated.")
    parser.add_argument("--output_dir", type=str, default="./data/features", help="Directory to save cached feature arrays and manifest.")
    parser.add_argument("--image_size", type=int, default=128, help="Slice image resolution (default: 128).")
    parser.add_argument("--max_slices", type=int, default=16, help="Maximum representative slices per study (default: 16).")
    parser.add_argument("--aggregation", type=str, default="mean", choices=["mean", "max"], help="Slice aggregation strategy.")
    parser.add_argument("--force_recompute", action="store_true", help="Force recomputation even if cached features exist.")
    parser.add_argument("--device", type=str, default="auto", choices=["auto", "cpu", "cuda"], help="Computation device.")
    return parser.parse_args()


def process_study(
    study: Dict[str, Any],
    max_slices: int = 16,
    aggregation: str = "mean",
    device = None
) -> Optional[Dict[str, Any]]:
    """Load slices for a single study, extract features, and aggregate to a 512D vector."""
    file_paths = study.get("file_paths", [])
    if not file_paths:
        return None

    try:
        slices = load_study_slices(file_paths)
        if not slices:
            return None

        rep_slices = select_representative_slices(slices, max_slices=max_slices)
        slice_feats = extract_features_from_batch(rep_slices, device=device)
        study_feat = aggregate_slice_features(slice_feats, strategy=aggregation)

        return {
            "study_id": study["study_id"],
            "label": study.get("label"),
            "features": study_feat,
            "slice_count": len(slices),
            "sampled_slices": len(rep_slices),
            "file_paths": file_paths,
            "format": study.get("format", "unknown")
        }
    except Exception as e:
        print(f"[Warning] Error processing study {study.get('study_id')}: {e}")
        return None


def extract_split_features(
    split_name: str,
    studies: List[Dict[str, Any]],
    output_dir: Path,
    max_slices: int = 16,
    aggregation: str = "mean",
    force_recompute: bool = False,
    device = None
) -> Dict[str, Any]:
    """Extract and cache features for an entire split (train, validation, test)."""
    npz_path = output_dir / f"{split_name}_features.npz"

    if npz_path.exists() and not force_recompute:
        print(f"[Info] Found cached features for '{split_name}' at {npz_path.name}. Loading...")
        data = np.load(npz_path, allow_pickle=True)
        return {
            "X": data["X"],
            "y": data["y"],
            "study_ids": data["study_ids"].tolist(),
            "cached": True,
            "npz_path": str(npz_path)
        }

    print(f"\n[Info] Extracting features for '{split_name}' ({len(studies)} studies)...")
    start_time = time.time()
    
    extracted_features = []
    labels = []
    study_ids = []
    metadata_list = []
    failed_count = 0

    for i, study in enumerate(studies, 1):
        res = process_study(study, max_slices=max_slices, aggregation=aggregation, device=device)
        if res is not None:
            extracted_features.append(res["features"])
            labels.append(res["label"] if res["label"] is not None else -1)
            study_ids.append(res["study_id"])
            metadata_list.append({
                "study_id": res["study_id"],
                "label": res["label"],
                "slice_count": res["slice_count"],
                "sampled_slices": res["sampled_slices"],
                "source_files": res["file_paths"][:3],  # sample paths
                "format": res["format"]
            })
        else:
            failed_count += 1

        if i % 10 == 0 or i == len(studies):
            elapsed = time.time() - start_time
            rate = i / elapsed if elapsed > 0 else 0
            print(f"  [{split_name}] Processed {i}/{len(studies)} ({rate:.1f} studies/sec)")

    if extracted_features:
        X = np.stack(extracted_features, axis=0).astype(np.float32)
        y = np.array(labels, dtype=np.int32)
        s_ids = np.array(study_ids)

        np.savez_compressed(
            npz_path,
            X=X,
            y=y,
            study_ids=s_ids
        )
    else:
        X = np.empty((0, 512), dtype=np.float32)
        y = np.empty((0,), dtype=np.int32)
        s_ids = np.empty((0,), dtype=object)

    elapsed = time.time() - start_time
    print(f"[Done] '{split_name}' completed in {elapsed:.1f}s. Saved {len(extracted_features)} feature vectors to {npz_path.name}")
    if failed_count > 0:
        print(f"  [Warning] {failed_count} studies failed during extraction.")

    return {
        "X": X,
        "y": y,
        "study_ids": study_ids,
        "metadata": metadata_list,
        "npz_path": str(npz_path),
        "failed_count": failed_count,
        "cached": False
    }


def main():
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    import torch
    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(args.device)

    print("=" * 60)
    print("Q-KNEE RESNET18 FEATURE EXTRACTION PIPELINE")
    print("=" * 60)
    print(f"Output Directory:   {output_dir}")
    print(f"Slice Resolution:   {args.image_size}x{args.image_size}")
    print(f"Max Slices/Study:   {args.max_slices}")
    print(f"Aggregation Method: {args.aggregation}")
    print(f"Computation Device: {device}")
    print(f"Force Recompute:    {args.force_recompute}")

    splits_file = Path(args.splits_file).resolve()
    if not splits_file.exists():
        if args.dataset_dir:
            print(f"[Info] splits.json not found at {splits_file}. Auto-running prepare_dataset.py...")
            from scripts.prepare_dataset import discover_studies, load_labels_map, find_labels_csv, create_leak_free_splits
            d_dir = Path(args.dataset_dir).resolve()
            l_map = load_labels_map(find_labels_csv(d_dir, ""))
            studies = discover_studies(d_dir)
            splits, _ = create_leak_free_splits(studies, l_map)
        else:
            print(f"[Error] Neither splits_file ({splits_file}) nor --dataset_dir was found.")
            sys.exit(1)
    else:
        with open(splits_file, "r", encoding="utf-8") as f:
            splits = json.load(f)

    manifest = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "image_size": args.image_size,
        "max_slices": args.max_slices,
        "aggregation": args.aggregation,
        "device": str(device),
        "splits": {}
    }

    all_metadata = []

    for split_name in ["train", "validation", "test"]:
        if split_name not in splits:
            continue
        res = extract_split_features(
            split_name=split_name,
            studies=splits[split_name],
            output_dir=output_dir,
            max_slices=args.max_slices,
            aggregation=args.aggregation,
            force_recompute=args.force_recompute,
            device=device
        )
        X, y = res["X"], res["y"]
        pos = int(np.sum(y == 1))
        neg = int(np.sum(y == 0))
        unl = int(np.sum(y == -1))

        manifest["splits"][split_name] = {
            "feature_file": res["npz_path"],
            "num_samples": len(X),
            "feature_dim": int(X.shape[1]) if len(X) > 0 else 512,
            "positive_count": pos,
            "negative_count": neg,
            "unlabelled_count": unl
        }
        if "metadata" in res:
            all_metadata.extend(res["metadata"])

    # Save features manifest
    manifest_path = output_dir / "features_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("\n" + "=" * 60)
    print("FEATURE EXTRACTION SUMMARY")
    print("=" * 60)
    for s_name, s_info in manifest["splits"].items():
        print(f"Split [{s_name.upper():<10}]: {s_info['num_samples']} vectors of dim {s_info['feature_dim']} "
              f"(+:{s_info['positive_count']}, -:{s_info['negative_count']}, unlabelled:{s_info['unlabelled_count']})")
    print(f"Manifest written to: {manifest_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
