import requests
import sys

sys.stdout.reconfigure(encoding='utf-8')
BASE_URL = "http://127.0.0.1:5000"
session = requests.Session()

def run_tests():
    print("=== Testing Bramhastra26 Payment & Query Verification ===")

    # 1. Reset
    r = session.post(f"{BASE_URL}/api/reset")
    assert r.status_code == 200, f"Reset failed: {r.text}"
    print("[PASS] 1. Reset successful")

    # 2. Check initial status
    r = session.get(f"{BASE_URL}/api/status")
    data = r.json()
    assert data["query_count"] == 0
    assert data["remaining_free"] == 20
    assert data["can_recharge"] == False
    assert data["free_queries_active"] == True
    print(f"[PASS] 2. Status initial check passed: {data['remaining_free']} free queries remaining")

    # 3. Attempt payment while free queries are active (MUST BE REJECTED)
    r = session.post(f"{BASE_URL}/api/upgrade", json={"pack": "pack_10", "utr": "123456789012"})
    assert r.status_code == 400, f"Expected 400, got {r.status_code}"
    data = r.json()
    assert data.get("error") == "FREE_QUERIES_ACTIVE"
    assert "You still have 20 free queries left" in data.get("message")
    print(f"[PASS] 3. Payment rejected during free queries: '{data['message']}'")

    # 4. Simulate queries reaching 20
    r = session.post(f"{BASE_URL}/api/set-query-count", json={"count": 20})
    assert r.status_code == 200
    print("[PASS] 4. Set query count to 20")

    # 5. Check status at 20 queries
    r = session.get(f"{BASE_URL}/api/status")
    data = r.json()
    assert data["query_count"] == 20
    assert data["remaining_free"] == 0
    assert data["can_recharge"] == True
    print(f"[PASS] 5. Status when queries expired: can_recharge={data['can_recharge']}")

    # 6. Attempt chat when queries expired (MUST BE BLOCKED with scanner url)
    r = session.post(f"{BASE_URL}/api/chat", json={"message": "What is Python?"})
    assert r.status_code == 403, f"Expected 403, got {r.status_code}"
    data = r.json()
    assert data.get("error") == "LIMIT_EXCEEDED"
    assert "upi_scanner.jpg" in data.get("scanner_url")
    assert "Your 20 free queries have expired" in data.get("message")
    print(f"[PASS] 6. Chat blocked on 20 queries with scanner prompt: '{data['message']}'")

    # 7. Now payment SHOULD be accepted (Koushik MR scanner recharge)
    r = session.post(f"{BASE_URL}/api/upgrade", json={"pack": "pack_10", "utr": "425199882211"})
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data["success"] == True
    assert data["added_credits"] == 10
    assert data["premium_credits"] == 10
    print(f"[PASS] 7. Scanner payment accepted after expiry: {data['message']}")

    # 8. Verify status after recharge
    r = session.get(f"{BASE_URL}/api/status")
    data = r.json()
    assert data["is_premium"] == True
    assert data["premium_credits"] == 10
    print(f"[PASS] 8. Status shows premium active with {data['premium_credits']} extra query chances")

    # 9. Verify chat works with extra credits
    r = session.post(f"{BASE_URL}/api/chat", json={"message": "Hello bramhastra26"})
    assert r.status_code == 200, f"Chat failed: {r.text}"
    data = r.json()
    assert "response" in data
    assert data["premium_credits"] == 9
    print(f"[PASS] 9. Extra query chat successful! Credits remaining: {data['premium_credits']}")

    # Reset back for clean state
    session.post(f"{BASE_URL}/api/reset")
    print("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
