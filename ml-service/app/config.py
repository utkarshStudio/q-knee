import os
from pathlib import Path

class Config:
    ML_PORT: int = int(os.getenv("ML_PORT", "8000"))
    MODEL_DIR: str = os.getenv("MODEL_DIR", str(Path(__file__).parent.parent / "models"))
    RSNA_DATA_DIR: str = os.getenv("RSNA_DATA_DIR", "")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", str(Path(__file__).parent.parent.parent / "storage" / "uploads"))
    PCA_COMPONENTS: int = int(os.getenv("PCA_COMPONENTS", "4"))
    QUANTUM_QUBITS: int = int(os.getenv("QUANTUM_QUBITS", "4"))
    QUANTUM_DEPTH: int = int(os.getenv("QUANTUM_DEPTH", "2"))
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")

    @property
    def dataset_configured(self) -> bool:
        return bool(self.RSNA_DATA_DIR and self.RSNA_DATA_DIR not in ("", "/path/to/rsna/knee/dataset"))

    @property
    def current_mode(self) -> str:
        return "REAL" if self.dataset_configured else "DEMO"

config = Config()