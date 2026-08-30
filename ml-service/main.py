"""ML Service entry point."""
import uvicorn
from dotenv import load_dotenv
import os
from pathlib import Path

# Load .env from project root
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

if __name__ == "__main__":
    port = int(os.getenv("ML_PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)