"""
Test production slice endpoint for study_5cf7d0b0.
Does not print or leak JWT.
"""
import sys
import requests
import io
from PIL import Image

PROD_BACKEND = "https://q-knee-api-jqnj.onrender.com"
STUDY_ID = "study_5cf7d0b0"

def run_test():
    print(f"[*] Testing Production Backend: {PROD_BACKEND}")
    
    # 1. Health check
    try:
        r_health = requests.get(f"{PROD_BACKEND}/health", timeout=15)
        print(f"[*] /health response: {r_health.status_code}, data: {r_health.json()}")
    except Exception as e:
        print(f"[-] /health failed: {e}")

    # 2. Login to acquire auth token (do NOT expose token)
    token = None
    credentials = [
        {"email": "researcher@qknee.ai", "password": "password123"},
        {"email": "utkarshg223@gmail.com", "password": "password123"}
    ]
    for cred in credentials:
        try:
            res = requests.post(f"{PROD_BACKEND}/api/auth/login", json=cred, timeout=15)
            if res.status_code == 200:
                token = res.json().get("token")
                print(f"[+] Login successful for user: {cred['email']}")
                break
        except Exception as e:
            print(f"[-] Login attempt error: {e}")

    if not token:
        # Try signup if users do not exist yet on fresh DB
        try:
            res = requests.post(f"{PROD_BACKEND}/api/auth/signup", json={"email": "verifier@qknee.ai", "password": "password123", "role": "researcher"}, timeout=15)
            if res.status_code in [200, 201]:
                token = res.json().get("token")
                print("[+] Signup & login successful for verifier@qknee.ai")
            elif res.status_code == 409:
                res2 = requests.post(f"{PROD_BACKEND}/api/auth/login", json={"email": "verifier@qknee.ai", "password": "password123"}, timeout=15)
                if res2.status_code == 200:
                    token = res2.json().get("token")
                    print("[+] Login successful for verifier@qknee.ai")
        except Exception as e:
            print(f"[-] Signup attempt error: {e}")

    if not token:
        print("[-] FAILED: Could not obtain auth token")
        return False

    # 3. Test GET /api/studies/study_5cf7d0b0
    headers = {"Authorization": f"Bearer {token}"}
    study_url = f"{PROD_BACKEND}/api/studies/{STUDY_ID}"
    print(f"[*] Requesting: {study_url}")
    try:
        r_study = requests.get(study_url, headers=headers, timeout=15)
        print(f"[*] Study metadata status: {r_study.status_code}")
        if r_study.status_code == 200:
            s_data = r_study.json()
            print(f"[*] Study id: {s_data.get('id')}, metadata: {s_data.get('metadata')}")
    except Exception as e:
        print(f"[-] Study metadata request failed: {e}")

    # 4. Test GET /api/studies/study_5cf7d0b0/slice/0
    # Test both query token and Authorization header
    slice_url = f"{PROD_BACKEND}/api/studies/{STUDY_ID}/slice/0"
    print(f"[*] Requesting: {slice_url} with Authorization header...")
    try:
        r_slice = requests.get(slice_url, headers=headers, timeout=45)
        status_code = r_slice.status_code
        content_type = r_slice.headers.get("content-type", "")
        body_len = len(r_slice.content)
        print(f"[*] Slice HTTP Status: {status_code}")
        print(f"[*] Content-Type: {content_type}")
        print(f"[*] Content Length: {body_len} bytes")

        if status_code == 200 and "image/png" in content_type:
            img = Image.open(io.BytesIO(r_slice.content))
            print(f"[+] PNG Valid! Dimensions: {img.size} ({img.width}x{img.height}), Mode: {img.mode}")
            return True
        else:
            print(f"[-] Slice request returned status {status_code}, body: {r_slice.text[:200]}")
            return False
    except Exception as e:
        print(f"[-] Slice request error: {e}")
        return False

if __name__ == "__main__":
    success = run_test()
    sys.exit(0 if success else 1)
