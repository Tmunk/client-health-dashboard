// AI summary layer.
//
// Calls the Claude API directly from the browser using a key the viewer
// supplies themselves (stored only in localStorage, never in this repo).
// This is a deliberate simplification for a static, backend-free demo —
// see the README for the tradeoffs and why a real product wouldn't do this.

const API_KEY_STORAGE_KEY = "clientHealthDashboard_apiKey";

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

function buildPrompt(client) {
  return `You are a CS Ops assistant summarizing one account's health score for an Account Manager.
Respond in 2-3 short sentences: what's driving the score, and one concrete next action. No headers, no bullet points, plain prose.

Account: ${client.clientName} (${client.segment})
Total score: ${client.totalScore}/100 (tier: ${client.tier})
Trend: ${client.trendDelta >= 0 ? "+" : ""}${Math.round(client.trendDelta)} vs. last period
Breakdown:
- AM Sentiment: ${client.amSentimentPoints.toFixed(1)}/30
- Platform Sessions: ${client.platformSessionsPoints.toFixed(1)}/30 (${client.actualSessions} actual vs ${client.expectedSessions} expected)
- NPS: ${client.npsPoints.toFixed(1)}/30 (${client.npsStatusFlag})
- New Students: ${client.newStudentsPoints.toFixed(1)}/10 (${client.newStudentsActual} actual vs ${client.newStudentsTarget} target)`;
}

// Rule-based, not AI — a real risk-scoring platform would wire this to an
// actual workflow tool (Slack, Salesforce task, etc). Here it's a simulated
// trigger fired purely off the tier, to show what the dashboard would kick
// off downstream.
function maybeShowPlaybookTrigger(client) {
  const banner = document.getElementById(`playbook-${client.id}`);
  if (client.tier === "red") {
    banner.textContent = "🚨 Playbook triggered: schedule a save call within 3 business days.";
    banner.classList.add("visible");
  } else {
    banner.classList.remove("visible");
    banner.textContent = "";
  }
}

async function generateAiSummary(client) {
  const summaryBox = document.getElementById(`ai-summary-${client.id}`);
  const button = document.querySelector(`.ai-btn[data-client-id="${client.id}"]`);
  const apiKey = getStoredApiKey();

  maybeShowPlaybookTrigger(client);

  if (!apiKey) {
    summaryBox.textContent = "Add your Claude API key at the top of the page to generate a summary.";
    summaryBox.classList.add("visible");
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Generating...";
  summaryBox.classList.remove("visible");

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
        max_tokens: 200,
        messages: [{ role: "user", content: buildPrompt(client) }]
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `Request failed (${response.status})`;
      throw new Error(message);
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    summaryBox.textContent = textBlock ? textBlock.text.trim() : "No summary returned.";
    summaryBox.classList.add("visible");
  } catch (err) {
    summaryBox.textContent = `Couldn't generate a summary: ${err.message}`;
    summaryBox.classList.add("visible");
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

setupApiKeyBar();
