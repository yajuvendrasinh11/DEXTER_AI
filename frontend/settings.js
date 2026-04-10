// settings.js – DEXTER AI Chatbot
// Manages user preferences (language, temperature, toggles) using localStorage

const SETTINGS_KEY = "amdox_settings";

// Default settings
const DEFAULT_SETTINGS = {
  language:           "english",
  temperature:        0.7,
  showSentiment:      true,
  showTimestamps:     true,
  voiceEnabled:       false,
};

/* ──────────────────────────────────────────────────────────────
   Load settings from localStorage (or use defaults)
   ────────────────────────────────────────────────────────────── */
function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/* ──────────────────────────────────────────────────────────────
   Save settings object to localStorage
   ────────────────────────────────────────────────────────────── */
function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/* ──────────────────────────────────────────────────────────────
   Get the current settings (reads from form elements)
   ────────────────────────────────────────────────────────────── */
function getCurrentSettings() {
  return {
    language:       document.getElementById("language-select")?.value    || "english",
    temperature:    parseFloat(document.getElementById("temp-slider")?.value) || 0.7,
    showSentiment:  document.getElementById("toggle-sentiment")?.checked  ?? true,
    showTimestamps: document.getElementById("toggle-timestamps")?.checked ?? true,
    voiceEnabled:   document.getElementById("toggle-voice")?.checked      ?? false,
  };
}

/* ──────────────────────────────────────────────────────────────
   Apply saved settings to the UI controls
   ────────────────────────────────────────────────────────────── */
function applySettingsToUI(settings) {
  const langEl    = document.getElementById("language-select");
  const tempEl    = document.getElementById("temp-slider");
  const tempVal   = document.getElementById("temp-value");
  const sentEl    = document.getElementById("toggle-sentiment");
  const tsEl      = document.getElementById("toggle-timestamps");
  const voiceEl   = document.getElementById("toggle-voice");

  if (langEl)  langEl.value    = settings.language;
  if (tempEl)  tempEl.value    = settings.temperature;
  if (tempVal) tempVal.textContent = settings.temperature;
  if (sentEl)  sentEl.checked  = settings.showSentiment;
  if (tsEl)    tsEl.checked    = settings.showTimestamps;
  if (voiceEl) voiceEl.checked = settings.voiceEnabled;
}

/* ──────────────────────────────────────────────────────────────
   Init: wire up settings controls
   ────────────────────────────────────────────────────────────── */
function initSettings() {
  const settings = loadSettings();
  applySettingsToUI(settings);

  // Live temperature label
  const tempEl  = document.getElementById("temp-slider");
  const tempVal = document.getElementById("temp-value");
  if (tempEl) {
    tempEl.addEventListener("input", () => {
      if (tempVal) tempVal.textContent = parseFloat(tempEl.value).toFixed(1);
    });
  }

  // Save button
  const saveBtn = document.getElementById("btn-save-settings");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const current = getCurrentSettings();
      saveSettings(current);

      // Visual feedback
      saveBtn.textContent = "✅ Saved!";
      saveBtn.style.background = "linear-gradient(135deg,#22c55e,#16a34a)";
      setTimeout(() => {
        saveBtn.textContent = "💾 Save Settings";
        saveBtn.style.background = "";
      }, 1800);
    });
  }
}

// Export utilities for use in other scripts
window.SettingsManager = { loadSettings, saveSettings, getCurrentSettings };

// Auto-init when DOM is ready
document.addEventListener("DOMContentLoaded", initSettings);
