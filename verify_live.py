import requests

base = "http://127.0.0.1:5000"
session = requests.Session()

# 1. Test homepage
r = session.get(base)
assert r.status_code == 200, f"Homepage failed: {r.status_code}"
assert "bramhastra26" in r.text, "Brand name not found in homepage"
print("OK: Homepage loaded with bramhastra26 branding")

# 2. Test status
r = session.get(f"{base}/api/status")
data = r.json()
assert data["free_limit"] == 20, "Free limit mismatch"
assert data["price_per_question"] == 5, "Price per question mismatch"
print(f"OK: Status endpoint: {data}")

# 3. Test empathetic chat
r = session.post(f"{base}/api/chat", json={"message": "I had a really hard day today and I feel sad."})
data = r.json()
assert r.status_code == 200, f"Chat failed: {r.status_code} {r.text}"
assert data["emotion"] in ["Empathetic", "Supportive"], f"Unexpected emotion: {data.get('emotion')}"
print(f"OK: Empathetic response: emotion={data.get('emotion')}, query_count={data.get('query_count')}")

# 4. Test image query
r = session.post(f"{base}/api/chat", json={"message": "Show me a picture of an Indian tiger"})
data = r.json()
assert r.status_code == 200
assert data.get("image_url") is not None, "Image URL was not returned"
print(f"OK: Image generation: {data.get('image_url')}")

# 5. Test translation
r = session.post(f"{base}/api/translate", json={"text": "Hello, how are you?", "target_language": "Hindi"})
data = r.json()
assert r.status_code == 200
assert "translated_text" in data
print("OK: Translation endpoint succeeded and returned translated text")

# 6. Test limit handling (20 queries)
session_limit = requests.Session()
# Set query count to 20 by making queries or hitting limit
for i in range(20):
    res = session_limit.post(f"{base}/api/chat", json={"message": f"Query number {i+1}"})
    assert res.status_code == 200

# 21st query should be blocked with 403 requires_upgrade
r21 = session_limit.post(f"{base}/api/chat", json={"message": "21st question"})
assert r21.status_code == 403
data21 = r21.json()
assert data21["error"] == "LIMIT_EXCEEDED"
assert data21["requires_upgrade"] is True
assert "₹5" in data21["message"]
print("OK: 20-question limit reached. Blocked 21st question with message: " + data21['message'].encode('ascii', 'replace').decode('ascii'))

# 7. Test upgrade
upg = session_limit.post(f"{base}/api/upgrade", json={"pack": "pack_10"})
upg_data = upg.json()
assert upg.status_code == 200
assert upg_data["is_premium"] is True
assert upg_data["premium_credits"] == 10
print(f"OK: Premium upgrade activated! Credits: {upg_data['premium_credits']}")

# 8. Query now succeeds on premium
r_after = session_limit.post(f"{base}/api/chat", json={"message": "21st question after recharge"})
assert r_after.status_code == 200
print("OK: Query succeeds after recharging premium credits!")

print("\n=== ALL SERVER VERIFICATION CHECKS PASSED SUCCESSFULLY! ===")
