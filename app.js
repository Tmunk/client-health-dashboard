// Dashboard rendering + cross-filtering.
// scoring.js and data.js load before this file (see index.html).

const scoredClients = scoreAllClients(CLIENTS);

const filterState = {
  tier: null,      // "green" | "yellow" | "red" | null
  segment: null,   // string | null
  accountOwner: null, // string | null
  search: ""
};

function applyFilters(clients) {
  return clients.filter((c) => {
    if (filterState.tier && c.tier !== filterState.tier) return false;
    if (filterState.segment && c.segment !== filterState.segment) return false;
    if (filterState.accountOwner && c.accountOwner !== filterState.accountOwner) return false;
    if (filterState.search) {
      const q = filterState.search.toLowerCase();
      if (!c.clientName.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function trendMarkup(client) {
  const delta = client.trendDelta;
  if (Math.abs(delta) < 0.5) {
    return `<span class="trend flat">flat vs. last period</span>`;
  }
  const direction = delta > 0 ? "up" : "down";
  const arrow = delta > 0 ? "▲" : "▼";
  return `<span class="trend ${direction}">${arrow} ${Math.abs(Math.round(delta))} vs. last period</span>`;
}

// Rule-based, not AI — computed straight from the score breakdown, so it's
// free and instant. Identifies which category is furthest below its max
// (the primary drag on the score) and, when another category is genuinely
// strong (not just "less bad"), names that too.
function primaryDriverText(client) {
  const categories = [
    {
      ratio: client.amSentimentPoints / 30,
      weak: "AM sentiment is weak",
      strong: "AM sentiment is a strength"
    },
    {
      ratio: client.platformSessionsPoints / 30,
      weak: "platform usage is well below target",
      strong: "platform usage is running ahead of target"
    },
    {
      ratio: client.npsPoints / 30,
      weak: "NPS is dragging the score down",
      strong: "NPS is a strength"
    },
    {
      ratio: client.newStudentsPoints / 10,
      weak: "new student growth has stalled",
      strong: "new student growth is strong"
    }
  ];

  const weakest = categories.reduce((a, b) => (b.ratio < a.ratio ? b : a));

  if (weakest.ratio >= 0.75) {
    return "Consistently strong across every scoring category.";
  }

  const strongest = categories.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  const weakSentence = weakest.weak[0].toUpperCase() + weakest.weak.slice(1);

  if (strongest.ratio >= 0.75 && strongest !== weakest) {
    return `${weakSentence}; ${strongest.strong}.`;
  }
  return `${weakSentence}.`;
}

function gaugeRow(label, points, max) {
  const pct = Math.max(0, Math.min(100, (points / max) * 100));
  // Gauge fill color reflects how this single category is doing on its own
  // scale, independent of the account's overall tier.
  const ratio = points / max;
  const color = ratio >= 0.8 ? "green" : ratio >= 0.6 ? "yellow" : "red";
  return `
    <div class="gauge-row">
      <div class="gauge-label">
        <span>${label}</span>
        <span>${points.toFixed(1)} / ${max}</span>
      </div>
      <div class="gauge-track">
        <div class="gauge-fill ${color}" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

function renderCard(client) {
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <div class="card-header ${client.tier}">
      <div class="card-header-top">
        <div>
          <p class="client-name">${client.clientName}</p>
          <p class="client-meta">${client.segment} · ${client.accountOwner}</p>
        </div>
        <div class="score-block">
          <div class="score-number ${client.tier}">${client.totalScore}</div>
          ${trendMarkup(client)}
        </div>
      </div>
    </div>
    <div class="card-body">
      ${gaugeRow("AM Sentiment", client.amSentimentPoints, 30)}
      ${gaugeRow("Platform Sessions", client.platformSessionsPoints, 30)}
      ${gaugeRow("NPS", client.npsPoints, 30)}
      ${gaugeRow("New Students", client.newStudentsPoints, 10)}
      <span class="status-flag">${client.npsStatusFlag}</span>
      <p class="driver-line">${primaryDriverText(client)}</p>
      <div class="playbook-banner${client.tier === "red" ? " visible" : ""}">${
        client.tier === "red" ? "🚨 Playbook triggered: schedule a save call within 3 business days." : ""
      }</div>
      <div class="ai-summary" id="ai-summary-${client.id}"></div>
    </div>
  `;
  return div;
}

function render() {
  const grid = document.getElementById("clientGrid");
  grid.innerHTML = "";
  const visible = applyFilters(scoredClients);

  if (visible.length === 0) {
    grid.innerHTML = `<div class="empty-state">No accounts match the current filters.</div>`;
    return;
  }

  visible
    .slice()
    .sort((a, b) => a.totalScore - b.totalScore)
    .forEach((client) => grid.appendChild(renderCard(client)));

  applyStoredInsights();
}

function toggleTierFilter(tier) {
  filterState.tier = filterState.tier === tier ? null : tier;
  renderTierBar(scoredClients, filterState, toggleTierFilter);
  render();
}

function setupFilterControls() {
  const segmentSelect = document.getElementById("segmentFilter");
  const uniqueSegments = [...new Set(scoredClients.map((c) => c.segment))];
  uniqueSegments.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    segmentSelect.appendChild(opt);
  });
  segmentSelect.addEventListener("change", () => {
    filterState.segment = segmentSelect.value || null;
    render();
  });

  const amSelect = document.getElementById("amFilter");
  const uniqueAms = [...new Set(scoredClients.map((c) => c.accountOwner))];
  uniqueAms.forEach((am) => {
    const opt = document.createElement("option");
    opt.value = am;
    opt.textContent = am;
    amSelect.appendChild(opt);
  });
  amSelect.addEventListener("change", () => {
    filterState.accountOwner = amSelect.value || null;
    render();
  });

  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", () => {
    filterState.search = searchInput.value;
    render();
  });

  document.getElementById("clearFilters").addEventListener("click", () => {
    filterState.tier = null;
    filterState.segment = null;
    filterState.accountOwner = null;
    filterState.search = "";
    segmentSelect.value = "";
    amSelect.value = "";
    searchInput.value = "";
    renderTierBar(scoredClients, filterState, toggleTierFilter);
    render();
  });
}

document.getElementById("generateInsightsBtn").addEventListener("click", generateAllInsights);

setupFilterControls();
renderKpiRow(scoredClients);
renderTierBar(scoredClients, filterState, toggleTierFilter);
renderScoreChart(scoredClients);
renderCategoryChart(scoredClients);
render();
