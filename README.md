# 🤖 AMDOX AI : Premium Intelligent Chatbot (DEXTER)

[![Python](https://img.shields.io/badge/Backend-Python%203.10%2B-blue?style=for-the-badge&logo=python)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Framework-Flask-black?style=for-the-badge&logo=flask)](https://flask.palletsprojects.com/)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-orange?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**DEXTER AI** is a premium, feature-rich conversational AI platform designed to provide intelligent, contextual, and multi-modal interactions. Powered by Google's Gemini models, it goes beyond simple chat by offering image generation, vision-based analysis, ZIP file processing, and real-time sentiment tracking with a beautifully crafted administrative dashboard.

---

## ✨ Key Features

### 🧠 Intelligent Conversations
*   **Gemini-Powered:** Leveraging Google's Gemini 2.0 & 1.5 models for high-speed, accurate responses.
*   **Contextual Memory:** Remembers past messages in a session for coherent long-form discussions.
*   **Multi-Language Support:** Fluently speaks **English**, **Hindi**, and **Hinglish**.

### 🎨 Multi-Modal Capabilities
*   **🖼️ Vision Analysis:** Upload images (PNG, JPG, WebP) for DEXTER to describe or answer questions about.
*   **✨ Image Generation:** Generate stunning visuals directly within the chat using Imagen 3.
*   **📦 ZIP Processing:** Upload ZIP archives; DEXTER analyzes the contents and code snippets within.

### 📊 Advanced Analytics & Sentiment
*   **Mood Tracking:** Real-time sentiment analysis (Positive, Neutral, Negative) for every user message using VADER NLP.
*   **Interactive Charts:** Dashboard visualisations (using Chart.js) showing sentiment breakdowns and message statistics.
*   **Admin Panel:** Secure management interface to monitor users, system stats, and API performance.

### 🛠️ User Experience
*   **Voice Integration:** Built-in Text-to-Speech (TTS) and Voice Search (STT) capabilities.
*   **Customisable UI:** Dark/Light mode support with a sleek, glassmorphic design.
*   **Secure Auth:** Full Login/Register system with password hashing and session management.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10 or higher
- A Google Gemini API Key ([Get one here](https://aistudio.google.com/))

### Installation

1. **Clone the project:**
   ```bash
   git clone https://github.com/your-username/amdox-ai-chatbot.git
   cd "AMDOX AI CHATBOT"
   ```

2. **Setup Virtual Environment (Optional but Recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add:
   ```env
   GEMINI_API_KEY=your_api_key_here
   SECRET_KEY=your_random_secret_key
   ```

### Running the App

Start the Flask server:
```bash
python app.py
```
Open your browser and navigate to `http://localhost:5000`.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Python, Flask, Flask-Cors, Flask-Login |
| **Frontend** | HTML5, CSS3 (Vanilla), JavaScript (ES6+), Chart.js |
| **AI Models** | Google Gemini (2.0 Flash, 1.5 Flash), Imagen 3 |
| **NLP** | VADER Sentiment Analysis |
| **Storage** | Persistent JSON-based Database |

---

## 📁 Project Structure

```text
AMDOX-AI-CHATBOT/
├── frontend/             # Frontend assets (HTML, CSS, JS)
│   ├── index.html        # Main Chat UI
│   ├── admin.html        # Admin Dashboard
│   ├── login.html        # Authentication
│   ├── app.js            # Core Chat Logic
│   └── style.css         # Premium UI Styling
├── app.py                # Main Flask Backend & API
├── sentiment.py          # Sentiment Analysis Engine
├── requirements.txt      # Project Dependencies
├── users.json            # User Persistence
├── history.json          # Global Chat History
└── analytics.json        # System Performance Data
```

---

## 🛡️ Admin Access
Default admin credentials (for development only):
- **Username:** `admin`
- **Password:** `admin123`

Access the dashboard at `/admin.html` after logging in.

---

## 📜 License
Internal Project - All Rights Reserved. (Or MIT if you prefer).

---

Built with ❤️ by  **DEXTER AI TEAM**
