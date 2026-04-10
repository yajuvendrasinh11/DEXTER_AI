// app.js – DEXTER AI Chatbot
// Core chat logic: sending messages, rendering bubbles, typing indicator,
// sidebar navigation, theme toggle, quick replies, LocalStorage history

/* ──────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────── */
const API_URL        = "/chat";
const CLEAR_URL      = "/clear";
const HISTORY_KEY    = "amdox_chat_history";
const THEME_KEY      = "amdox_theme";
const BOT_NAME       = "DEXTER AI";
const USER_NAME      = "You";

/* ──────────────────────────────────────────────────────────────
   UI Helpers
   ────────────────────────────────────────────────────────────── */
function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "error" ? "⚠️" : "✨";
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/* ──────────────────────────────────────────────────────────────
   DOM references
   ────────────────────────────────────────────────────────────── */
const messagesEl   = document.getElementById("messages");
const inputEl      = document.getElementById("chat-input");
const sendBtn      = document.getElementById("send-btn");
const clearBtn     = document.getElementById("btn-clear-chat");
const hamburger    = document.getElementById("hamburger");
const sidebar      = document.getElementById("sidebar");
const overlay      = document.getElementById("overlay");
const themeToggle  = document.getElementById("theme-toggle");
const topbarTitle  = document.getElementById("topbar-title-text");
const micBtn      = document.getElementById("btn-voice-search");
const attachBtn   = document.getElementById("btn-attach");
const generateBtn = document.getElementById("btn-generate-img");
const fileInput   = document.getElementById("file-input");
const attachPreview = document.getElementById("attachment-preview");
const previewName   = document.getElementById("preview-name");
const removeAttachBtn = document.getElementById("btn-remove-attachment");

/* ──────────────────────────────────────────────────────────────
   Voice Recognition & Control
   ────────────────────────────────────────────────────────────── */
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

function speakResponse(text) {
  const settings = window.SettingsManager?.loadSettings() ?? {};
  if (!settings.voiceEnabled || !window.speechSynthesis) return;
  
  // Clean text from markdown for better speech
  const cleanText = text.replace(/[*_#`]/g, "").replace(/\[.*?\]\(.*?\)/g, "");
  
  const utterance = new SpeechSynthesisUtterance(cleanText);
  // Pick a nice voice if available
  const voices = window.speechSynthesis.getVoices();
  
  // Attempt to match language
  const langMap = { "english": "en-US", "hindi": "hi-IN", "hinglish": "hi-IN" };
  utterance.lang = langMap[settings.language] || "en-US";

  const preferred = voices.find(v => v.lang.includes(utterance.lang.split("-")[0]));
  if (preferred) utterance.voice = preferred;
  
  window.speechSynthesis.speak(utterance);
}

function handleVoiceCommand(transcript) {
  const cmd = transcript.toLowerCase().trim();
  console.log("[Voice Command]:", cmd);

  if (cmd.includes("clear chat") || cmd.includes("reset chat") || cmd.includes("delete chat")) {
    document.getElementById("btn-clear-chat")?.click();
    return true;
  }
  if (cmd.includes("open analytics") || cmd.includes("show analytics")) {
    switchTab("analytics");
    return true;
  }
  if (cmd.includes("open history") || cmd.includes("show history")) {
    switchTab("history");
    return true;
  }
  if (cmd.includes("open settings") || cmd.includes("show settings")) {
    switchTab("settings");
    return true;
  }
  if (cmd.includes("sign out") || cmd.includes("log out")) {
    document.getElementById("btn-logout")?.click();
    return true;
  }

  return false; // Not a command, just text
}

/* ──────────────── Attachment Logic ─────────────────────────── */
let selectedFile = null;

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate size (e.g., 10MB)
  if (file.size > 15 * 1024 * 1024) {
    showToast("File is too large (max 15MB)", "error");
    fileInput.value = "";
    return;
  }

  selectedFile = file;
  previewName.textContent = file.name;
  attachPreview.style.display = "block";
  inputEl.focus();
}

function removeAttachment() {
  selectedFile = null;
  fileInput.value = "";
  attachPreview.style.display = "none";
}

attachBtn?.addEventListener("click", () => fileInput.click());
fileInput?.addEventListener("change", handleFileSelect);
removeAttachBtn?.addEventListener("click", removeAttachment);

/* ──────────────── Image Generation Logic ──────────────────── */
async function generateImage() {
  const prompt = inputEl.value.trim();
  if (!prompt) {
    showToast("Please enter a description for the image first!", "info");
    inputEl.placeholder = "Describe the image you want me to create...";
    inputEl.focus();
    return;
  }

  isSending = true;
  generateBtn.disabled = true;
  generateBtn.classList.add("listening"); // reuse animation

  const time = formatTime();
  renderMessage({ role: "user", content: `🎨 Generate image: ${prompt}`, time });
  inputEl.value = "";
  inputEl.style.height = "auto";
  
  showTyping();

  try {
    const res = await fetch("/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    
    const data = await res.json();
    hideTyping();

    if (!res.ok) throw new Error(data.error || "Generation failed");

    const botTime = formatTime();
    const wrapper = renderMessage({
      role: "bot",
      content: `Here is the image I generated for: "${prompt}"`,
      time: botTime,
      sentiment: { label: "positive" }
    });

    // Append image to the bubble
    const bubble = wrapper.querySelector(".bubble");
    const img = document.createElement("img");
    img.src = data.image_url;
    img.className = "generated-image";
    img.alt = prompt;
    img.onclick = () => window.open(data.image_url, "_blank");
    bubble.appendChild(img);

  } catch (err) {
    hideTyping();
    renderMessage({
      role: "bot", 
      content: `⚠️ Image Error: ${err.message}`, 
      time: formatTime(), 
      sentiment: { label: "negative" } 
    });
  } finally {
    isSending = false;
    generateBtn.disabled = false;
    generateBtn.classList.remove("listening");
  }
}

generateBtn?.addEventListener("click", generateImage);
/* ──────────────── State ────────────────────────────────────── */
let isSending = false;

/* ══════════════════════════════════════════════════════════════
   THEME
   ══════════════════════════════════════════════════════════════ */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.textContent = theme === "dark" ? "🌙" : "☀️";
  // Refresh charts so colours update
  if (window.AnalyticsManager) window.AnalyticsManager.refreshChartsOnThemeChange();
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

/* ══════════════════════════════════════════════════════════════
   SIDEBAR NAVIGATION
   ══════════════════════════════════════════════════════════════ */
const TABS = ["chat", "history", "analytics", "settings", "about"];
const TAB_TITLES = {
  chat:      "Chat",
  history:   "Search History",
  analytics: "Analytics Dashboard",
  settings:  "Settings",
  about:     "About",
};

function switchTab(tabId) {
  // Hide all panels, deactivate all nav items
  TABS.forEach(t => {
    document.getElementById(`panel-${t}`)?.classList.remove("active");
    document.getElementById(`nav-${t}`)?.classList.remove("active");
    document.getElementById(`nav-${t}`)?.setAttribute("aria-selected", "false");
  });

  // Show selected panel
  const panel = document.getElementById(`panel-${tabId}`);
  const nav   = document.getElementById(`nav-${tabId}`);
  if (panel) panel.classList.add("active");
  if (nav)   { nav.classList.add("active"); nav.setAttribute("aria-selected","true"); }

  // Update topbar title
  if (topbarTitle) topbarTitle.textContent = TAB_TITLES[tabId] ?? tabId;

  // Actions when switching to tabs
  if (tabId === "analytics" && window.AnalyticsManager) {
    window.AnalyticsManager.fetch();
  }
  if (tabId === "history") {
    renderPermanentHistory();
  }

  // Close sidebar on mobile
  closeSidebar();
}

TABS.forEach(t => {
  document.getElementById(`nav-${t}`)?.addEventListener("click", () => switchTab(t));
});

/* ──────────────── Mobile sidebar toggle ──────────────────────── */
function openSidebar()  { sidebar?.classList.add("open"); overlay?.classList.add("visible"); hamburger?.setAttribute("aria-expanded","true"); }
function closeSidebar() { sidebar?.classList.remove("open"); overlay?.classList.remove("visible"); hamburger?.setAttribute("aria-expanded","false"); }

hamburger?.addEventListener("click", () => {
  sidebar?.classList.contains("open") ? closeSidebar() : openSidebar();
});
overlay?.addEventListener("click", closeSidebar);

/* ══════════════════════════════════════════════════════════════
   CHAT HISTORY (LocalStorage)
   ══════════════════════════════════════════════════════════════ */
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch { return []; }
}
function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-100))); 
}

/* ──────────────── Permanent Query History (Backend) ────────── */
async function renderPermanentHistory() {
  const listEl = document.getElementById("history-items");
  if (!listEl) return;
  
  try {
    const res = await fetch("/history");
    const history = await res.json();
    
    if (!history || history.length === 0) {
      listEl.innerHTML = `
        <div class="history-empty">
          <p>Your search history is empty.</p>
          <span style="font-size: 0.8rem; opacity: 0.7;">(Searches start appearing here as you chat.)</span>
        </div>`;
      return;
    }
    
    listEl.innerHTML = history.map(item => {
      const escaped = item.query.replace(/'/g, "\\'");
      return `
        <div class="history-card" onclick="switchTab('chat'); sendMessage('${escaped}', true)">
          <div class="history-info">
            <div class="history-query">${escapeHtml(item.query)}</div>
            <div class="history-time">${item.time}</div>
          </div>
          <button class="btn-delete-item" onclick="event.stopPropagation(); deleteHistoryItem('${escaped}', '${item.time}')" title="Delete this search">
            🗑️
          </button>
        </div>`;
    }).join("");
  } catch (err) {
    console.error("[History] Fetch error:", err);
  }
}

document.getElementById("btn-clear-permanent-history")?.addEventListener("click", async () => {
  if (confirm("Clear all search history from the server?")) {
    try {
      await fetch("/clear-history", { method: "POST" });
      renderPermanentHistory();
    } catch {}
  }
});

async function deleteHistoryItem(query, time) {
  if (!confirm("Delete this history item?")) return;
  try {
    const res = await fetch("/delete-history-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, time })
    });
    if (res.ok) renderPermanentHistory();
  } catch (err) {
    console.error("[History] Delete error:", err);
  }
}


/* ══════════════════════════════════════════════════════════════
   TIMESTAMP
   ══════════════════════════════════════════════════════════════ */
function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ══════════════════════════════════════════════════════════════
   RENDER MESSAGES
   ══════════════════════════════════════════════════════════════ */
function renderMessage({ role, content, time, sentiment, imageUrl }) {
  const settings = window.SettingsManager?.loadSettings() ?? { showTimestamps: true, showSentiment: true };
  const isUser   = role === "user";
  const wrapper  = document.createElement("div");
  wrapper.className = `message ${isUser ? "user" : "bot"}`;

  const header = `
    <div class="message-header">
      <div class="avatar">${isUser ? "👤" : "🤖"}</div>
      <span class="sender-name">${isUser ? USER_NAME : BOT_NAME}</span>
    </div>`;

  let bubbleContent = "";
  if (isUser) {
    bubbleContent = escapeHtml(content).replace(/\n/g, "<br/>");
  } else {
    // Sanitize and parse markdown for bot messages
    bubbleContent = typeof marked !== "undefined" ? marked.parse(content) : escapeHtml(content);
  }

  let bubbleHtml = `<div class="bubble">${bubbleContent}`;
  if (imageUrl) {
    bubbleHtml += `<img src="${imageUrl}" class="chat-image" onclick="window.open('${imageUrl}', '_blank')" />`;
  }
  bubbleHtml += `</div>`;

  let footer = "";
  const showTs   = settings.showTimestamps;
  const showSent = settings.showSentiment && !isUser && sentiment;

  if (showTs || showSent) {
    const tsHtml   = showTs ? `<span class="timestamp">${time || formatTime()}</span>` : "";
    const sentHtml = showSent
      ? `<span class="sentiment-badge ${sentiment.label}">${sentimentEmoji(sentiment.label)} ${sentiment.label}</span>`
      : "";
    footer = `<div class="message-footer">${tsHtml}${sentHtml}</div>`;
  }

  wrapper.innerHTML = header + bubbleHtml + footer;
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function sentimentEmoji(label) {
  return { positive: "😊", negative: "😟", neutral: "😐" }[label] ?? "";
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scrollToBottom() {
  const wrapper = document.getElementById("messages-wrapper");
  if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
}

/* ──────────────── Typing indicator ──────────────────────────── */
let typingEl = null;
function showTyping() {
  if (typingEl) return;
  typingEl = document.createElement("div");
  typingEl.className = "message bot";
  typingEl.innerHTML = `
    <div class="message-header">
      <div class="avatar">🤖</div>
      <span class="sender-name">${BOT_NAME}</span>
    </div>
    <div class="bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  messagesEl.appendChild(typingEl);
  scrollToBottom();
}
function hideTyping() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
}

/* ──────────────── Welcome message ───────────────────────────── */
function addWelcomeMessage() {
  renderMessage({
    role: "bot",
    content: "👋 Hello! I'm DEXTER AI, your intelligent assistant.\n\nI can help you with questions, coding, creative writing, and more. What's on your mind today?",
    time: formatTime(),
    sentiment: { label: "positive" },
  });
}

/* ══════════════════════════════════════════════════════════════
   SEND MESSAGE
   ══════════════════════════════════════════════════════════════ */
async function sendMessage(text, skipHistory = false) {
  const message = (text || inputEl.value).trim();
  if ((!message && !selectedFile) || isSending) return;

  isSending = true;
  sendBtn.disabled = true;

  const settings = window.SettingsManager?.loadSettings() ?? {};
  const time     = formatTime();

  // Render user message (include file info if present)
  let userDisplayContent = message;
  let localImageUrl = null;
  if (selectedFile) {
    if (selectedFile.type.startsWith("image/")) {
      localImageUrl = URL.createObjectURL(selectedFile);
    } else {
      userDisplayContent = (message ? message + "\n\n" : "") + `📎 [Attached File: ${selectedFile.name}]`;
    }
  }
  renderMessage({ role: "user", content: userDisplayContent, time, imageUrl: localImageUrl });

  // Hide quick replies after first message
  document.getElementById("quick-replies")?.style.setProperty("display","none");

  // Clear input
  if (!text) {
    inputEl.value = "";
    inputEl.style.height = "auto";
  }

  showTyping();

  try {
    let res;
    let data;

    if (selectedFile) {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("message", message);
      formData.append("language", settings.language ?? "english");
      
      res = await fetch("/upload", {
        method: "POST",
        body: formData, // No content-type header, browser sets it for FormData
      });
      removeAttachment(); // Clear preview after sending
    } else {
      res = await fetch(API_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          language:     settings.language    ?? "english",
          temperature:  settings.temperature ?? 0.7,
          skip_history: skipHistory,
        }),
      });
    }

    data = await res.json();
    hideTyping();

    if (!res.ok) {
      throw new Error(data.error || "Server error");
    }

    const botTime = formatTime();
    renderMessage({
      role:      "bot",
      content:   data.reply,
      time:      botTime,
      sentiment: data.sentiment,
    });

    // Speak response if enabled
    speakResponse(data.reply);

    // Refresh history tab if active
    if (document.getElementById("panel-history")?.classList.contains("active")) {
      renderPermanentHistory();
    }

    // Save to LocalStorage
    const history = loadHistory();
    history.push({ role:"user",      content: userDisplayContent,     time, sentiment: null });
    history.push({ role:"assistant", content: data.reply,  time: botTime, sentiment: data.sentiment });
    saveHistory(history);

  } catch (err) {
    hideTyping();
    renderMessage({
      role:    "bot",
      content: `⚠️ Error: ${err.message}. Please check your API key and backend connection.`,
      time:    formatTime(),
      sentiment: { label: "negative" },
    });
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

/* ──────────────── Input handlers ────────────────────────────── */
sendBtn.addEventListener("click", () => sendMessage());

inputEl.addEventListener("keydown", e => {
  // Send on Enter (no Shift)
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
});

/* ──────────────── Quick replies ─────────────────────────────── */
document.getElementById("quick-replies")?.addEventListener("click", e => {
  const btn = e.target.closest(".quick-btn");
  if (btn) sendMessage(btn.dataset.text);
});

/* ──────────────── Clear chat ────────────────────────────────── */
clearBtn?.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to clear the conversation?")) return;

  // Clear backend history
  try { await fetch(CLEAR_URL, { method: "POST" }); } catch {}

  // Clear frontend
  messagesEl.innerHTML = "";
  localStorage.removeItem(HISTORY_KEY);
  addWelcomeMessage();

  // Restore quick replies
  const qr = document.getElementById("quick-replies");
  if (qr) qr.style.removeProperty("display");
});

// Init handles everything now
document.addEventListener("DOMContentLoaded", async () => {
  // Apply saved theme first (before auth redirect to avoid flash)
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(savedTheme);

  // ── AUTH GUARD ──────────────────────────────────────────────
  let currentUser = null;
  try {
    const authRes = await fetch("/me");
    const authData = await authRes.json();
    if (!authData.authenticated) {
      window.location.href = "login.html";
      return;
    }
    currentUser = authData;
  } catch {
    window.location.href = "login.html";
    return;
  }

  // Show user in sidebar + topbar
  const sidebarUser    = document.getElementById("sidebar-user");
  const sidebarAvatar  = document.getElementById("sidebar-avatar");
  const loggedUserEl   = document.getElementById("logged-user");
  const loggedRoleEl   = document.getElementById("logged-role");
  const topbarUser     = document.getElementById("topbar-user");
  const topbarUsername = document.getElementById("topbar-username");

  if (sidebarUser)   sidebarUser.style.display = "flex";
  if (sidebarAvatar) sidebarAvatar.textContent  = currentUser.username[0].toUpperCase();
  if (loggedUserEl)  loggedUserEl.textContent    = currentUser.username;
  if (loggedRoleEl) {
    loggedRoleEl.textContent = currentUser.role === "admin" ? "⭐ Admin" : "User";
    if (currentUser.role === "admin") loggedRoleEl.style.color = "var(--accent-2, #a78bfa)";
  }
  if (topbarUser)     topbarUser.style.display   = "inline";
  if (topbarUsername) topbarUsername.textContent  = currentUser.username;

  // Show Admin link if admin
  if (currentUser.role === "admin") {
    const adminLink = document.getElementById("nav-admin");
    if (adminLink) adminLink.style.display = "flex";
  }

  // Logout button
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    try { await fetch("/logout", { method: "POST" }); } catch {}
    localStorage.removeItem(HISTORY_KEY);
    window.location.href = "login.html";
  });

  // Clear chat on refresh (per user request)
  localStorage.removeItem(HISTORY_KEY);
  try { await fetch(CLEAR_URL, { method: "POST" }); } catch {}
  
  // Show welcome message
  addWelcomeMessage();

  // ── VOICE INITIALIZATION ───────────────────────────────────
  if (SpeechRec && micBtn) {
    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => { micBtn.classList.add("listening"); };
    recognition.onend   = () => { micBtn.classList.remove("listening"); };
    recognition.onerror = (e) => { 
      micBtn.classList.remove("listening");
      console.error("[Voice] Error:", e.error);
      if (e.error === 'not-allowed') alert("Microphone access denied. Please allow it in browser settings.");
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      // Commands still execute immediately for control
      if (handleVoiceCommand(transcript)) return;
      
      if (inputEl) {
        inputEl.value = transcript;
        inputEl.focus();
        // sendMessage(); // Removed auto-send as per user request
      }
    };

    micBtn.addEventListener("click", () => {
      // Chrome/Edge require a user gesture to start recognition
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.warn("[Voice] Web Speech API usually requires HTTPS or localhost.");
      }

      try {
        if (micBtn.classList.contains("listening")) {
          recognition.stop();
        } else {
          // Sync language to recognition instance
          const currentSettings = window.SettingsManager?.loadSettings() ?? {};
          if (currentSettings.language === 'hindi') recognition.lang = 'hi-IN';
          else if (currentSettings.language === 'hinglish') recognition.lang = 'hi-IN';
          else recognition.lang = 'en-US';

          recognition.start();
        }
      } catch (err) {
        console.error("[Voice] Start failed:", err);
      }
    });
  } else if (micBtn) {
    micBtn.title = "Voice search not supported in this browser";
    micBtn.style.opacity = "0.4";
  }

  // Focus input
  inputEl?.focus();
});
