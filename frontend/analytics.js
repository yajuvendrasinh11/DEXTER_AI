// analytics.js – DEXTER AI Chatbot
// Fetches analytics data from the Flask backend and renders Chart.js charts

let sentimentChart = null;
let barChart       = null;

/* ──────────────────────────────────────────────────────────────
   Fetch analytics from API and update UI
   ────────────────────────────────────────────────────────────── */
async function fetchAnalytics() {
  try {
    const res  = await fetch("/analytics");
    const data = await res.json();
    renderAnalytics(data);
  } catch (err) {
    console.error("[Analytics] Fetch error:", err);
  }
}

/* ──────────────────────────────────────────────────────────────
   Render stat cards + charts from API data
   ────────────────────────────────────────────────────────────── */
function renderAnalytics(data) {
  // Stat card values
  document.getElementById("stat-total").textContent = data.total_messages ?? 0;
  document.getElementById("stat-rt").textContent    = (data.avg_response_time ?? 0) + "s";
  document.getElementById("stat-pos").textContent   = data.sentiment_counts?.positive ?? 0;
  document.getElementById("stat-neg").textContent   = data.sentiment_counts?.negative ?? 0;

  const pos  = data.sentiment_counts?.positive ?? 0;
  const neg  = data.sentiment_counts?.negative ?? 0;
  const neut = data.sentiment_counts?.neutral  ?? 0;

  renderSentimentChart(pos, neg, neut);
  renderBarChart(pos, neg, neut);
}

/* ──────────────────────────────────────────────────────────────
   Doughnut chart: sentiment breakdown
   ────────────────────────────────────────────────────────────── */
function renderSentimentChart(pos, neg, neut) {
  const ctx = document.getElementById("chart-sentiment")?.getContext("2d");
  if (!ctx) return;

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const textColor = isDark ? "#94a3b8" : "#4b5563";

  if (sentimentChart) sentimentChart.destroy();

  sentimentChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Positive 😊", "Negative 😟", "Neutral 😐"],
      datasets: [{
        data: [pos, neg, neut],
        backgroundColor: [
          "rgba(74,222,128,0.85)",
          "rgba(248,113,113,0.85)",
          "rgba(148,163,184,0.85)",
        ],
        borderColor: ["#4ade80","#f87171","#94a3b8"],
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: textColor, font: { size: 12, family: "Inter" }, padding: 14, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} message${ctx.raw !== 1 ? "s" : ""}`,
          },
        },
      },
    },
  });
}

/* ──────────────────────────────────────────────────────────────
   Bar chart: messages per sentiment
   ────────────────────────────────────────────────────────────── */
function renderBarChart(pos, neg, neut) {
  const ctx = document.getElementById("chart-bar")?.getContext("2d");
  if (!ctx) return;

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const textColor  = isDark ? "#94a3b8" : "#4b5563";
  const gridColor  = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Positive", "Negative", "Neutral"],
      datasets: [{
        label: "Messages",
        data: [pos, neg, neut],
        backgroundColor: [
          "rgba(74,222,128,0.7)",
          "rgba(248,113,113,0.7)",
          "rgba(148,163,184,0.7)",
        ],
        borderColor:  ["#4ade80","#f87171","#94a3b8"],
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw} message${ctx.raw !== 1 ? "s" : ""}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: "Inter" } },
          grid:  { color: gridColor },
        },
        y: {
          ticks: { color: textColor, font: { family: "Inter" }, stepSize: 1, precision: 0 },
          grid:  { color: gridColor },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ──────────────────────────────────────────────────────────────
   Rebuild charts on theme change (so colours stay correct)
   ────────────────────────────────────────────────────────────── */
function refreshChartsOnThemeChange() {
  fetchAnalytics();
}

/* ──────────────────────────────────────────────────────────────
   Reset analytics via API
   ────────────────────────────────────────────────────────────── */
async function resetAnalytics() {
  try {
    await fetch("/reset-analytics", { method: "POST" });
    renderAnalytics({ total_messages: 0, avg_response_time: 0, sentiment_counts: { positive:0, negative:0, neutral:0 }});
  } catch (err) {
    console.error("[Analytics] Reset error:", err);
  }
}

/* ──────────────────────────────────────────────────────────────
   Init
   ────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-refresh-analytics")?.addEventListener("click", fetchAnalytics);
  document.getElementById("btn-reset-analytics")?.addEventListener("click", resetAnalytics);
});

// Export for use in app.js
window.AnalyticsManager = { fetch: fetchAnalytics, refreshChartsOnThemeChange };
