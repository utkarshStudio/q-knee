"""RSNA dataset service: discover studies and load ACL labels."""
import os
import csv
from pathlib import Path
from app.config import config

def get_study_files(study_instance_uid: str) -> list:
    """Find all DICOM files for a given study UID in RSNA_DATA_DIR."""
    if not config.dataset_configured:
        return []
    base = Path(config.RSNA_DATA_DIR) / "train_series" / study_instance_uid
    if not base.exists():
        return []
    dcm_files = sorted(base.rglob("*.dcm"))
    return [str(f) for f in dcm_files]

def load_acl_labels() -> dict:
    """
    Load ACL abnormality labels from RSNA train.csv.
    Returns dict: {study_instance_uid: int (1=abnormal, 0=normal)}
    Note: Labels are report-derived, NOT clinical diagnoses.
    """
    if not config.dataset_configured:
        return {}
    train_csv = Path(config.RSNA_DATA_DIR) / "train.csv"
    if not train_csv.exists():
        return {}
    labels = {}
    with open(train_csv, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            uid = row.get("study_id") or row.get("StudyInstanceUID") or row.get("study_instance_uid", "")
            acl_val = row.get("acl_tear") or row.get("ACL") or ""
            if uid and acl_val:
                try:
                    labels[uid] = int(acl_val)
                except ValueError:
                    pass
    return labels

def list_studies(max_n: int = 100) -> list:
    """List available study UIDs in the RSNA dataset."""
    if not config.dataset_configured:
        return []
    base = Path(config.RSNA_DATA_DIR) / "train_series"
    if not base.exists():
        return []
    studies = [d.name for d in base.iterdir() if d.is_dir()]
    return studies[:max_n]