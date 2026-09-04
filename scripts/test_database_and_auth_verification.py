"""
Verification script for Q-Knee Database Connection, Health Detector, and Authentication.
"""
import sys
import requests
import json

BASE_URL = "http://localhost:3001"

def test_suite():
    passed = 0
    failed = 0

    def assert_test(condition, name, details=""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name} - {details}")
            failed += 1

    print("==================================================")
    print("Q-KNEE FINAL VERIFICATION: DATABASE & AUTH SUITE")
    print("==================================================")

    # 1. GET /health
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        data = r.json()
        assert_test(
            r.status_code == 200 and data.get("status") == "ok" and data.get("service") == "qknee-api" and "database" in data and "mode" in data["database"],
            "GET /health schema & status",
            f"Status: {r.status_code}, Body: {data}"
        )
        assert_test(
            data["database"]["mode"] in ["postgresql", "fallback"] and isinstance(data["database"]["connected"], bool),
            f"GET /health database detector (mode={data['database']['mode']}, connected={data['database']['connected']})",
            f"Data: {data}"
        )
    except Exception as e:
        assert_test(False, "GET /health endpoint reachable", str(e))

    # 2. GET /api/health/db
    try:
        r = requests.get(f"{BASE_URL}/api/health/db", timeout=5)
        data = r.json()
        assert_test(
            r.status_code == 200 and data.get("status") == "ok" and "database" in data,
            "GET /api/health/db diagnostic endpoint",
            f"Status: {r.status_code}, Body: {data}"
        )
        assert_test(
            "password" not in json.dumps(data).lower() and "postgres:" not in json.dumps(data).lower(),
            "GET /api/health/db contains zero credentials or secrets",
            f"Data: {data}"
        )
    except Exception as e:
        assert_test(False, "GET /api/health/db endpoint reachable", str(e))

    # 3. Test Unknown Email Login
    try:
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "nonexistent_user_999@test.com", "password": "password123"}, timeout=5)
        assert_test(r.status_code == 401, "Login with unknown email returns 401 Unauthorized", f"Status: {r.status_code}")
    except Exception as e:
        assert_test(False, "Login with unknown email test", str(e))

    # 4. Test Invalid Password Login
    try:
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "researcher@qknee.ai", "password": "wrong_password_xyz"}, timeout=5)
        assert_test(r.status_code == 401, "Login with wrong password returns 401 Unauthorized", f"Status: {r.status_code}")
    except Exception as e:
        assert_test(False, "Login with wrong password test", str(e))

    # 5. Test Valid Login
    token = None
    try:
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "researcher@qknee.ai", "password": "password123"}, timeout=5)
        data = r.json()
        token = data.get("token")
        assert_test(
            r.status_code == 200 and token and data.get("user", {}).get("email") == "researcher@qknee.ai",
            "Login with valid credentials returns 200 & JWT token",
            f"Status: {r.status_code}, Body: {data}"
        )
    except Exception as e:
        assert_test(False, "Login with valid credentials test", str(e))

    # 6. Test /api/auth/me with Valid Token
    try:
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=5)
        data = r.json()
        assert_test(
            r.status_code == 200 and data.get("user", {}).get("email") == "researcher@qknee.ai",
            "GET /api/auth/me with valid JWT returns user payload",
            f"Status: {r.status_code}, Body: {data}"
        )
    except Exception as e:
        assert_test(False, "GET /api/auth/me test", str(e))

    # 7. Test /api/auth/me with Invalid Token
    try:
        headers = {"Authorization": "Bearer invalid.token.signature"}
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=5)
        assert_test(r.status_code == 401, "GET /api/auth/me with invalid JWT returns 401", f"Status: {r.status_code}")
    except Exception as e:
        assert_test(False, "GET /api/auth/me invalid JWT test", str(e))

    # 8. Test /api/auth/me with Missing Token
    try:
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=5)
        assert_test(r.status_code == 401, "GET /api/auth/me without token returns 401", f"Status: {r.status_code}")
    except Exception as e:
        assert_test(False, "GET /api/auth/me missing token test", str(e))

    # 9. Test Signup New User
    import time
    test_email = f"doctor_{int(time.time())}@qknee.org"
    try:
        r = requests.post(f"{BASE_URL}/api/auth/signup", json={"email": test_email, "password": "SecurePassword123!", "role": "researcher"}, timeout=5)
        data = r.json()
        new_token = data.get("token")
        assert_test(
            r.status_code == 201 and new_token and data.get("user", {}).get("email") == test_email,
            f"Signup new user ({test_email}) returns 201 and token",
            f"Status: {r.status_code}, Body: {data}"
        )
    except Exception as e:
        assert_test(False, "Signup new user test", str(e))

    # 10. Test Duplicate Signup (Must return 409 Conflict)
    try:
        r = requests.post(f"{BASE_URL}/api/auth/signup", json={"email": test_email, "password": "SecurePassword123!", "role": "researcher"}, timeout=5)
        assert_test(r.status_code == 409, "Duplicate signup with same email returns 409 Conflict", f"Status: {r.status_code}, Body: {r.text}")
    except Exception as e:
        assert_test(False, "Duplicate signup test", str(e))

    # 11. Test Protected Endpoints (Dashboard stats & Study Prediction)
    try:
        headers = {"Authorization": f"Bearer {token}"}
        r_stats = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers, timeout=5)
        assert_test(r_stats.status_code == 200, "GET /api/dashboard/stats returns 200", f"Status: {r_stats.status_code}")

        r_pred = requests.post(f"{BASE_URL}/api/studies/study_001/predict", json={"model_type": "quantum"}, headers=headers, timeout=15)
        assert_test(r_pred.status_code == 200, "POST /api/studies/:id/predict executes inference & returns 200", f"Status: {r_pred.status_code}")
    except Exception as e:
        assert_test(False, "Protected study & stats endpoints test", str(e))

    print("==================================================")
    print(f"TEST SUMMARY: {passed} PASSED, {failed} FAILED")
    print("==================================================")
    return failed == 0

if __name__ == "__main__":
    success = test_suite()
    sys.exit(0 if success else 1)
