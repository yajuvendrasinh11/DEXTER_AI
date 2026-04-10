# test_backend.py – DEXTER AI Chatbot
# Quick smoke tests for the Flask API.
# Run: python test_backend.py  (while app.py is running)

import requests
import sys

BASE = "http://localhost:5000"
PASS = "[OK]"
FAIL = "[FAIL]"
errors = 0

# Use a session to persist login
session = requests.Session()

def test(name, fn):
    global errors
    try:
        fn()
        print(f"  {PASS} {name}")
    except AssertionError as e:
        print(f"  {FAIL} {name}: {e}")
        errors += 1
    except Exception as e:
        print(f"  {FAIL} {name}: {type(e).__name__}: {e}")
        errors += 1

def login():
    print(f"  Logging in as 'admin'...")
    res = session.post(f"{BASE}/login", json={"username": "admin", "password": "admin123"}, timeout=10)
    assert res.status_code == 200, f"Login failed: {res.status_code}"
    print(f"  {PASS} Login successful")

print("\n--- Backend Smoke Tests ---")
print("=" * 40)

# 0. Login
try:
    login()
except Exception as e:
    print(f"  {FAIL} Initial Login failed: {e}")
    sys.exit(1)

# 1. POST /chat
def test_chat():
    res = session.post(f"{BASE}/chat", json={"message": "Hello!"}, timeout=30)
    assert res.status_code == 200, f"Status {res.status_code}"
    body = res.json()
    assert "reply" in body,     "Missing 'reply' key"
    assert "sentiment" in body, "Missing 'sentiment' key"
    assert body["sentiment"]["label"] in ("positive","negative","neutral"), "Bad sentiment label"
    print(f"       Reply preview: {body['reply'][:60]}…")

# 2. POST /chat — empty message should return 400
def test_chat_empty():
    res = session.post(f"{BASE}/chat", json={"message": ""}, timeout=10)
    assert res.status_code == 400, f"Expected 400, got {res.status_code}"

# 3. GET /analytics
def test_analytics():
    res = session.get(f"{BASE}/analytics", timeout=10)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    body = res.json()
    assert "total_messages"    in body
    assert "avg_response_time" in body
    assert "sentiment_counts"  in body
    sc = body["sentiment_counts"]
    assert "positive" in sc and "negative" in sc and "neutral" in sc

# 4. POST /clear
def test_clear():
    res = session.post(f"{BASE}/clear", timeout=10)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert "message" in res.json()

# 5. POST /admin/reset-analytics
def test_reset_analytics():
    # Note: route in app.py is /admin/reset-analytics
    res = session.post(f"{BASE}/admin/reset-analytics", timeout=10)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"

test("POST /chat with valid message",  test_chat)
test("POST /chat with empty message -> 400", test_chat_empty)
test("GET  /analytics structure",      test_analytics)
test("POST /clear",                    test_clear)
test("POST /admin/reset-analytics",    test_reset_analytics)

print("=" * 40)
if errors == 0:
    print(f"All tests passed! (done)\n")
else:
    print(f"{errors} test(s) failed.\n")
    sys.exit(1)
