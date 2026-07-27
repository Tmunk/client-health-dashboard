// AI insights layer — a single batch call, not one call per account.
//
// Calls the Claude API directly from the browser using a key the viewer
// supplies themselves (stored only in localStorage, never in this repo).
// This is a deliberate simplification for a static, backend-free demo —
// see the README for the tradeoffs and why a real product wouldn't do this.

const API_KEY_STORAGE_KEY = "clientHealthDashboard_apiKey";

// A static, pre-written example so a visitor with no API key still sees what
// the AI insights layer produces. Written by hand against the real computed
// scores below (not captured from a live API call — see README) — clicking
// "Generate AI Insights" with a real key replaces this with fresh output.
const EXAMPLE_INSIGHTS = {
  portfolio_summary:
    "The portfolio is holding at a 71 average, roughly flat versus last period, with three accounts in the red tier driven mainly by stalled new-student growth and platform usage well below target. Pinecrest Virtual Academy and Cascade STEM Academy are trending sharply downward and need immediate attention, while most of the yellow tier is being held back by soft NPS. Green-tier accounts are broadly stable to improving, with strong usage and sentiment across the board.",
  accounts: {
    c001: "Firing on all cylinders this period — a standard check-in is all that's needed.",
    c002: "Consistently strong; worth a call to explore an upsell or expansion opportunity.",
    c003: "New student onboarding has stalled — work with the AM to find referral or enrollment blockers.",
    c004: "Sharp decline from weak sentiment and stalled growth — schedule a risk review this week.",
    c005: "Top performer across every metric — a strong candidate for a case study or reference call.",
    c006: "Usage is healthy but NPS lags — follow up on recent support tickets or feedback.",
    c007: "Critical risk: sentiment, usage, and growth are all weak — prioritize a save call immediately.",
    c008: "New students are strong but NPS is soft — a satisfaction follow-up could clarify the gap.",
    c009: "Excellent trajectory with strong usage and growth — low risk, minimal AM time needed.",
    c010: "Sessions are healthy but new student growth is flat — check the enrollment pipeline.",
    c011: "Steepest decline in the portfolio — usage and growth have both collapsed; treat as top priority.",
    c012: "Small but consistently strong account — a good reference for similar-sized prospects.",
    c013: "AM sentiment is the weak point despite decent usage — worth a relationship check-in.",
    c014: "Large, stable account performing well across the board — maintain current cadence."
  }
};

// Populated after a successful generate (or the static example above);
// re-applied by app.js whenever the card grid re-renders (e.g. after
// changing a filter) so notes survive.
let aiInsightsByClientId = {};
let insightsAreExample = true;

function getStoredApiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
}

function setupApiKeyBar() {
  const input = document.getElementById("apiKeyInput");
  const status = document.getElementById("apiKeyStatus");
  const existing = getStoredApiKey();

  if (existing) {
    input.value = existing;
    status.textContent = "Key loaded from this browser's localStorage.";
  }

  document.getElementById("saveKeyBtn").addEventListener("click", () => {
    const value = input.value.trim();
    if (!value) {
      status.textContent = "Enter a key before saving.";
      return;
    }
    localStorage.setItem(API_KEY_STORAGE_KEY, value);
    status.textContent = "Key saved to this browser's localStorage.";
  });

  document.getElementById("clearKeyBtn").addEventListener("click", () => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    input.value = "";
    status.textContent = "Key cleared.";
  });
}

// One compact line per account keeps the prompt (and token cost) small
// even across 14 accounts, instead of the verbose per-account prompt this
// replaced.
function buildBatchPrompt(clients) {
  const lines = clients
    .map((c) => {
      const trend = `${c.trendDelta >= 0 ? "+" : ""}${Math.round(c.trendDelta)}`;
      return `${c.id}|${c.clientName}|tier:${c.tier}|score:${c.totalScore}|trend:${trend}|AM:${c.amSentimentPoints.toFixed(
        0
      )}/30|Sessions:${c.platformSessionsPoints.toFixed(0)}/30|NPS:${c.npsPoints.toFixed(0)}/30(${
        c.npsStatusFlag
      })|NewStudents:${c.newStudentsPoints.toFixed(0)}/10`;
    })
    .join("\n");

  return `You are a CS Ops assistant reviewing this period's health scores for ${clients.length} EdTech tutoring accounts. Score = AM Sentiment (30) + Platform Sessions (30) + NPS (30) + New Students (10).

${lines}

Respond with ONLY valid JSON, no markdown fences, no extra text, matching this exact shape:
{
  "portfolio_summary": "2-3 sentences: overall portfolio health, the biggest risk theme, and any notable trend across accounts",
  "accounts": [
    { "id": "c001", "note": "one short sentence: what's driving this account's score and one concrete next action, under 25 words" }
  ]
}
Include exactly one entry in "accounts" for every account id listed above.`;
}

function applyStoredInsights() {
  Object.entries(aiInsightsByClientId).forEach(([id, note]) => {
    const box = document.getElementById(`ai-summary-${id}`);
    if (box && note) {
      box.innerHTML = "";
      if (insightsAreExample) {
        const tag = document.createElement("span");
        tag.className = "example-tag";
        tag.textContent = "Example";
        box.appendChild(tag);
      }
      box.appendChild(document.createTextNode(note));
      box.classList.add("visible");
    }
  });
}

function showExampleInsights() {
  const banner = document.getElementById("portfolioSummaryBanner");
  banner.innerHTML = "";
  const tag = document.createElement("span");
  tag.className = "example-tag";
  tag.textContent = "Example";
  banner.appendChild(tag);
  banner.appendChild(document.createTextNode(EXAMPLE_INSIGHTS.portfolio_summary));
  banner.classList.add("visible");

  insightsAreExample = true;
  aiInsightsByClientId = { ...EXAMPLE_INSIGHTS.accounts };
  applyStoredInsights();
}

async function generateAllInsights() {
  const btn = document.getElementById("generateInsightsBtn");
  const banner = document.getElementById("portfolioSummaryBanner");
  const apiKey = getStoredApiKey();

  if (!apiKey) {
    banner.textContent = "Add your Claude API key at the top of the page to generate insights.";
    banner.classList.add("visible");
    return;
  }

  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generating...";
  banner.classList.remove("visible");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1200,
        messages: [{ role: "user", content: buildBatchPrompt(scoredClients) }]
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `Request failed (${response.status})`;
      throw new Error(message);
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    const raw = textBlock ? textBlock.text.trim() : "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    banner.textContent = parsed.portfolio_summary || "No summary returned.";
    banner.classList.add("visible");

    insightsAreExample = false;
    aiInsightsByClientId = {};
    (parsed.accounts || []).forEach((entry) => {
      if (entry && entry.id) aiInsightsByClientId[entry.id] = entry.note || "";
    });
    applyStoredInsights();
  } catch (err) {
    banner.textContent = `Couldn't generate insights: ${err.message}`;
    banner.classList.add("visible");
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

setupApiKeyBar();
