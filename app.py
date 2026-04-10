# app.py – DEXTER AI Chatbot Backend
# Flask server with Auth (Login/Register), Admin Panel, and Gemini API integration

import re
import time
import os
import json
import zipfile
import io
import base64
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
from google import genai
from google.genai import types
from sentiment import analyze_sentiment
from PIL import Image

# ─── Config ──────────────────────────────────────────────────────────────────

load_dotenv()

app = Flask(__name__, static_folder="frontend", static_url_path="")
app.secret_key = os.getenv("SECRET_KEY", "dexter-ai-secret-key-change-in-production")
CORS(app, supports_credentials=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
MAX_WAIT_SECONDS = 35

# ─── Persistence ─────────────────────────────────────────────────────────────

ANALYTICS_FILE = "analytics.json"
HISTORY_FILE   = "history.json"
USERS_FILE     = "users.json"

def load_json(filename, default):
    if os.path.exists(filename):
        try:
            with open(filename, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Persistence] Error loading {filename}: {e}")
    return default

def save_json(filename, data):
    try:
        with open(filename, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"[Persistence] Error saving {filename}: {e}")

# Initialise data
analytics      = load_json(ANALYTICS_FILE, {"total_messages": 0, "total_response_time": 0.0, "sentiment_counts": {"positive": 0, "negative": 0, "neutral": 0}})
search_history = load_json(HISTORY_FILE, [])
users_db       = load_json(USERS_FILE, {})

# Seed default admin account if it doesn't exist
if "admin" not in users_db:
    users_db["admin"] = {
        "username":   "admin",
        "email":      "admin@dexter.ai",
        "password":   generate_password_hash("admin123"),
        "role":       "admin",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "message_count": 0,
        "last_active": None,
    }
    save_json(USERS_FILE, users_db)
    print("[Auth] Default admin created: admin / admin123")

# Per-session conversation history
def get_conversation():
    username = session.get("username")
    if not username:
        return []
    if not hasattr(app, "_conversations"):
        app._conversations = {}
    if username not in app._conversations:
        app._conversations[username] = []
    return app._conversations[username]

def clear_conversation():
    username = session.get("username")
    if username and hasattr(app, "_conversations"):
        app._conversations.pop(username, None)

# ─── Auth decorators ─────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "username" not in session:
            return jsonify({"error": "Not authenticated", "redirect": "/login.html"}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "username" not in session:
            return jsonify({"error": "Not authenticated", "redirect": "/login.html"}), 401
        user = users_db.get(session["username"])
        if not user or user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated

# ─── Language prompts ─────────────────────────────────────────────────────────

LANGUAGE_PROMPTS = {
    "english":  "You are DEXTER, a helpful and friendly AI assistant. Always respond in clear English.",
    "hindi":    "Aap DEXTER hain, ek sahayak AI assistant. Hamesha Hindi mein jawab dein.",
    "hinglish": "You are DEXTER, a friendly AI assistant. Respond in Hinglish (mix of Hindi and English).",
}

# ─── Gemini helpers ───────────────────────────────────────────────────────────

def parse_retry_delay(err_str: str) -> int:
    match = re.search(r"retryDelay['\"\s:]+(\d+)s", err_str)
    return min(int(match.group(1)), MAX_WAIT_SECONDS) if match else 5

def handle_api_error(e):
    err_str = str(e)
    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
        return "⚠️ I've reached my API quota limit for now. Please wait a moment and try again later."
    if "401" in err_str or "AUTH_ERROR" in err_str:
        return "⚠️ API Key error. Please check your .env configuration."
    return f"⚠️ Encountered an error: {err_str[:200]}"

def call_model(model, contents, system_prompt, temperature):
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=system_prompt, temperature=temperature, max_output_tokens=4096),
    )
    return response.text

def get_gemini_response(user_message, language="english", temperature=0.7, conversation=[]):
    if not client:
        return "Gemini API key not configured. Please check your .env file."
    system_prompt = LANGUAGE_PROMPTS.get(language.lower(), LANGUAGE_PROMPTS["english"])
    contents = list(conversation)
    for model in MODELS:
        for attempt in range(2):
            try:
                return call_model(model, contents, system_prompt, temperature)
            except Exception as e:
                err_str = str(e)
                is_quota = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower()
                if is_quota:
                    wait = parse_retry_delay(err_str)
                    if attempt == 0:
                        print(f"[Gemini] {model} quota hit → waiting {wait}s …")
                        time.sleep(wait)
                        continue
                    break
                return f"Sorry, I encountered an error: {err_str[:150]}"
    return "All Gemini models are currently quota-limited. Please try again later."

def get_image_info(image_bytes, user_prompt, language="english"):
    if not client:
        return "Gemini API key not configured."
    
    img = Image.open(io.BytesIO(image_bytes))
    
    # Use gemini-2.0-flash which supports vision
    system_prompt = LANGUAGE_PROMPTS.get(language.lower(), LANGUAGE_PROMPTS["english"])
    prompt = user_prompt if user_prompt else "Describe this image in detail."
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt, img],
            config=types.GenerateContentConfig(system_instruction=system_prompt)
        )
        return response.text
    except Exception as e:
        return handle_api_error(e)

def process_zip(zip_bytes, user_prompt, language="english"):
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
            file_list = z.namelist()
            info_text = f"This ZIP file contains {len(file_list)} files: {', '.join(file_list[:10])}"
            if len(file_list) > 10:
                info_text += " ..."
            
            # Read first few text files to give context
            text_context = ""
            for name in file_list:
                if name.endswith(('.txt', '.md', '.py', '.js', '.html', '.css', '.json')):
                    with z.open(name) as f:
                        content = f.read().decode('utf-8', errors='ignore')
                        text_context += f"\n--- File: {name} ---\n{content[:500]}\n"
                        if len(text_context) > 5000: break
            
            full_prompt = f"The user uploaded a zip file. Files: {file_list}\n\nContent snippets:\n{text_context}\n\nUser Question: {user_prompt}"
            
            return get_gemini_response(full_prompt, language=language)
    except Exception as e:
        return handle_api_error(e)

@app.route("/generate-image", methods=["POST"])
@login_required
def generate_image_route():
    data = request.get_json(silent=True) or {}
    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
    
    if not client:
        return jsonify({"error": "Gemini API key not configured"}), 500
        
    try:
        # Using Imagen 3 via google-genai
        response = client.models.generate_image(
            model="imagen-3.0-generate-001",
            prompt=prompt,
            config=types.GenerateImageConfig(
                number_of_images=1,
                include_rai_reasoning=True,
                output_mime_type="image/png"
            )
        )
        
        # The library returns images as bytes in response.generated_images
        if not response.generated_images:
            return jsonify({"error": "No image generated"}), 500
            
        img_bytes = response.generated_images[0].image_bytes
        img_base64 = base64.b64encode(img_bytes).decode("utf-8")
        
        return jsonify({"image_url": f"data:image/png;base64,{img_base64}"})
    except Exception as e:
        # Fallback if imagen is not enabled for the key or model name is different
        return jsonify({"error": f"Image generation failed: {str(e)}"}), 500

# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/register", methods=["POST"])
def register():
    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    email    = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required."}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if username in users_db:
        return jsonify({"error": "Username already taken."}), 409
    if any(u["email"] == email for u in users_db.values()):
        return jsonify({"error": "Email already registered."}), 409

    users_db[username] = {
        "username": username,
        "email": email,
        "password": generate_password_hash(password),
        "role": "user",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "message_count": 0,
        "last_active": None,
    }
    save_json(USERS_FILE, users_db)
    return jsonify({"message": "Account created! Please log in."}), 201


@app.route("/login", methods=["POST"])
def login():
    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "")

    user = users_db.get(username)
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid username or password."}), 401

    session.permanent = True
    session["username"] = username
    session["role"]     = user["role"]

    # Update last active
    users_db[username]["last_active"] = time.strftime("%Y-%m-%d %H:%M:%S")
    save_json(USERS_FILE, users_db)

    return jsonify({"message": "Login successful.", "username": username, "role": user["role"]}), 200


@app.route("/logout", methods=["POST"])
def logout():
    clear_conversation()
    session.clear()
    return jsonify({"message": "Logged out."}), 200


@app.route("/me", methods=["GET"])
def me():
    if "username" not in session:
        return jsonify({"authenticated": False}), 200
    user = users_db.get(session["username"], {})
    return jsonify({
        "authenticated": True,
        "username": session["username"],
        "role": session.get("role", "user"),
        "email": user.get("email", ""),
    }), 200


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/admin/users", methods=["GET"])
@admin_required
def admin_get_users():
    safe_users = []
    for u in users_db.values():
        safe_users.append({
            "username":      u["username"],
            "email":         u["email"],
            "role":          u["role"],
            "created_at":    u.get("created_at", "—"),
            "last_active":   u.get("last_active", "Never"),
            "message_count": u.get("message_count", 0),
        })
    return jsonify(safe_users), 200


@app.route("/admin/delete-user/<username>", methods=["DELETE"])
@admin_required
def admin_delete_user(username):
    if username == "admin":
        return jsonify({"error": "Cannot delete admin."}), 403
    if username not in users_db:
        return jsonify({"error": "User not found."}), 404
    del users_db[username]
    save_json(USERS_FILE, users_db)
    return jsonify({"message": f"User '{username}' deleted."}), 200


@app.route("/admin/stats", methods=["GET"])
@admin_required
def admin_stats():
    total = analytics["total_messages"]
    avg_rt = round(analytics["total_response_time"] / total, 3) if total > 0 else 0
    return jsonify({
        "total_users":    len(users_db),
        "total_messages": total,
        "avg_response_time": avg_rt,
        "sentiment_counts": analytics["sentiment_counts"],
    }), 200


@app.route("/admin/reset-analytics", methods=["POST"])
@admin_required
def admin_reset_analytics():
    analytics["total_messages"]      = 0
    analytics["total_response_time"] = 0.0
    analytics["sentiment_counts"]    = {"positive": 0, "negative": 0, "neutral": 0}
    save_json(ANALYTICS_FILE, analytics)
    return jsonify({"message": "Analytics reset."}), 200


# ═══════════════════════════════════════════════════════════════════════════════
# PROTECTED CHAT ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/chat", methods=["POST"])
@login_required
def chat():
    data         = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    language     = data.get("language", "english")
    temperature  = float(data.get("temperature", 0.7))

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    username = session["username"]

    # Save to permanent search history
    should_skip = data.get("skip_history", False)
    if not should_skip:
        entry = {"query": user_message, "time": time.strftime("%Y-%m-%d %H:%M:%S"), "user": username}
        search_history.insert(0, entry)
        if len(search_history) > 100:
            search_history.pop()
        save_json(HISTORY_FILE, search_history)

    # Build conversation context
    conversation = get_conversation()
    conversation.append(types.Content(role="user", parts=[types.Part(text=user_message)]))

    start_time = time.time()
    reply      = get_gemini_response(user_message, language, temperature, conversation)
    elapsed    = round(time.time() - start_time, 3)

    conversation.append(types.Content(role="model", parts=[types.Part(text=reply)]))

    sentiment = analyze_sentiment(user_message)

    # Update analytics
    analytics["total_messages"]      += 1
    analytics["total_response_time"] += elapsed
    analytics["sentiment_counts"][sentiment["label"]] += 1
    save_json(ANALYTICS_FILE, analytics)

    # Update user stats
    users_db[username]["message_count"] = users_db[username].get("message_count", 0) + 1
    users_db[username]["last_active"]   = time.strftime("%Y-%m-%d %H:%M:%S")
    save_json(USERS_FILE, users_db)

    return jsonify({"reply": reply, "sentiment": sentiment, "response_time": elapsed})


@app.route("/upload", methods=["POST"])
@login_required
def upload():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    user_prompt = request.form.get("message", "").strip()
    language = request.form.get("language", "english")
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    file_bytes = file.read()
    filename = file.filename.lower()
    
    start_time = time.time()
    
    if filename.endswith(('.png', '.jpg', '.jpeg', '.webp')):
        reply = get_image_info(file_bytes, user_prompt, language)
    elif filename.endswith('.zip'):
        reply = process_zip(file_bytes, user_prompt, language)
    else:
        return jsonify({"error": "Unsupported file type. Please upload an image or a ZIP file."}), 400
    
    elapsed = round(time.time() - start_time, 3)
    sentiment = analyze_sentiment(user_prompt if user_prompt else reply[:50])
    
    # Update analytics & user stats (similar to /chat)
    username = session["username"]
    analytics["total_messages"] += 1
    analytics["total_response_time"] += elapsed
    analytics["sentiment_counts"][sentiment["label"]] += 1
    save_json(ANALYTICS_FILE, analytics)
    
    users_db[username]["message_count"] = users_db[username].get("message_count", 0) + 1
    users_db[username]["last_active"] = time.strftime("%Y-%m-%d %H:%M:%S")
    save_json(USERS_FILE, users_db)
    
    return jsonify({"reply": reply, "sentiment": sentiment, "response_time": elapsed})


@app.route("/clear", methods=["POST"])
@login_required
def clear_history():
    clear_conversation()
    return jsonify({"message": "Conversation context cleared."})


@app.route("/history", methods=["GET"])
@login_required
def get_history():
    username = session["username"]
    role     = session.get("role", "user")
    if role == "admin":
        return jsonify(search_history)  # admins see all
    user_history = [h for h in search_history if h.get("user") == username]
    return jsonify(user_history)


@app.route("/clear-history", methods=["POST"])
@login_required
def clear_perm_history():
    username = session["username"]
    role     = session.get("role", "user")
    if role == "admin":
        search_history.clear()
    else:
        to_remove = [h for h in search_history if h.get("user") == username]
        for h in to_remove:
            search_history.remove(h)
    save_json(HISTORY_FILE, search_history)
    return jsonify({"message": "History cleared."})


@app.route("/delete-history-item", methods=["POST"])
@login_required
def delete_history_item():
    data    = request.get_json(silent=True) or {}
    query   = data.get("query")
    time_s  = data.get("time")
    username = session["username"]

    found = None
    for h in search_history:
        if h.get("query") == query and h.get("time") == time_s and h.get("user") == username:
            found = h
            break
    
    if found:
        search_history.remove(found)
        save_json(HISTORY_FILE, search_history)
        return jsonify({"message": "Item deleted."}), 200
    
    return jsonify({"error": "Item not found."}), 404


@app.route("/analytics", methods=["GET"])
@login_required
def get_analytics():
    total  = analytics["total_messages"]
    avg_rt = round(analytics["total_response_time"] / total, 3) if total > 0 else 0
    return jsonify({
        "total_messages":    total,
        "avg_response_time": avg_rt,
        "sentiment_counts":  analytics["sentiment_counts"],
    })




# ─── Static file routes ───────────────────────────────────────────────────────

@app.route("/")
def serve_index():
    return send_from_directory("frontend", "index.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("frontend", path)


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  DEXTER AI Chatbot - Backend Starting")
    print("  URL: http://localhost:5000")
    print(f"  Users: {len(users_db)} | Messages: {analytics['total_messages']}")
    print(f"  Admin: admin / admin123")
    print("=" * 55)
    app.run(debug=True, host="0.0.0.0", port=5000, use_reloader=False)
