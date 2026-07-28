// Dashboard rendering + cross-filtering.
// config.js, fallback-data.js, adapters.js, pipeline.js and scoring.js all
// load before this file (see index.html).
//
// Client data is no longer a hardcoded array — it comes from runPipeline(),
// which loads three independent sources, validates them, and joins them.

let scoredClients = [];
let lastPipelineResult = null;

const filterState = {
  tier: null,      // "green" | "yellow" | "red" | null
  segment: null,   // string | null
  accountOwner: null, // string | null
  search: ""
};

// Client names, segments and owners now arrive from an external sheet rather
// than a hardcoded array, so anything interpolated into markup gets escaped.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    <button type="button" class="card-header ${client.tier}">
      <div class="card-header-top">
        <div>
          <p class="client-name">${escapeHtml(client.clientName)}</p>
          <p class="client-meta">${escapeHtml(client.segment)} · ${escapeHtml(client.accountOwner)}</p>
        </div>
        <div class="card-header-right">
          <div class="score-block">
            <div class="score-number ${client.tier}">${client.totalScore}</div>
            ${trendMarkup(client)}
          </div>
          <span class="expand-chevron" aria-hidden="true">▾</span>
        </div>
      </div>
    </button>
    <div class="card-body">
      ${gaugeRow("AM Sentiment", client.amSentimentPoints, 30)}
      ${gaugeRow("Platform Sessions", client.platformSessionsPoints, 30)}
      ${gaugeRow("NPS", client.npsPoints, 30)}
      ${gaugeRow("New Students", client.newStudentsPoints, 10)}
      <span class="status-flag">${client.npsStatusFlag}</span>
      <p class="driver-line">${primaryDriverText(client)}</p>
      ${
        client.amNotes
          ? `<div class="am-notes">
               <span class="am-notes-label">AM notes</span>
               <p class="am-notes-body"></p>
             </div>`
          : ""
      }
      <div class="playbook-banner${client.tier === "red" ? " visible" : ""}">${
        client.tier === "red" ? "🚨 Playbook triggered: schedule a save call within 3 business days." : ""
      }</div>
      <div class="ai-summary" id="ai-summary-${client.id}"></div>
    </div>
  `;
  // Notes are free text typed into a spreadsheet by an AM — treat as untrusted
  // and set as text, never as markup.
  if (client.amNotes) {
    div.querySelector(".am-notes-body").textContent = client.amNotes;
  }

  div.querySelector(".card-header").addEventListener("click", () => {
    div.classList.toggle("expanded");
  });
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

function renderDataSources(result) {
  const container = document.getElementById("sourceList");
  container.innerHTML = "";

  result.sources.forEach((source) => {
    const item = document.createElement("div");
    item.className = `source-item ${source.mode}`;
    const time = source.fetchedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    item.innerHTML = `
      <span class="source-dot"></span>
      <div class="source-meta">
        <span class="source-name"></span>
        <span class="source-detail">${source.validRows} records · ${
          source.mode === "live" ? "live sheet" : "bundled fallback"
        } · ${time}</span>
      </div>
    `;
    item.querySelector(".source-name").textContent = source.label;
    container.appendChild(item);
  });

  const issuesBox = document.getElementById("dataIssues");
  issuesBox.innerHTML = "";

  if (result.issues.length === 0) {
    issuesBox.innerHTML = `<p class="issues-clean">No data quality issues found across all three sources.</p>`;
    return;
  }

  const errors = result.issues.filter((i) => i.severity === "error").length;
  const warnings = result.issues.length - errors;

  const summary = document.createElement("button");
  summary.type = "button";
  summary.className = "issues-toggle";
  summary.textContent = `${result.issues.length} data quality ${
    result.issues.length === 1 ? "issue" : "issues"
  } found (${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${
    warnings === 1 ? "" : "s"
  }) — show detail`;

  const list = document.createElement("ul");
  list.className = "issues-list";
  result.issues.forEach((issue) => {
    const li = document.createElement("li");
    li.className = `issue ${issue.severity}`;
    const tag = document.createElement("span");
    tag.className = `issue-tag ${issue.severity}`;
    tag.textContent = issue.severity;
    const text = document.createElement("span");
    text.textContent = `${issue.source}${issue.clientId ? ` · ${issue.clientId}` : ""} — ${issue.message}`;
    li.appendChild(tag);
    li.appendChild(text);
    list.appendChild(li);
  });

  summary.addEventListener("click", () => {
    list.classList.toggle("visible");
  });

  issuesBox.appendChild(summary);
  issuesBox.appendChild(list);
}

function renderAll() {
  renderKpiRow(scoredClients);
  renderTierBar(scoredClients, filterState, toggleTierFilter);
  renderScoreChart(scoredClients);
  renderCategoryChart(scoredClients);
  render();
}

async function loadAndRender() {
  const btn = document.getElementById("refreshDataBtn");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Loading...";

  try {
    lastPipelineResult = await runPipeline();
    scoredClients = scoreAllClients(lastPipelineResult.clients);
    renderDataSources(lastPipelineResult);
    renderAll();
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

async function init() {
  document.getElementById("generateInsightsBtn").addEventListener("click", generateAllInsights);
  document.getElementById("refreshDataBtn").addEventListener("click", loadAndRender);

  await loadAndRender();

  // Filter dropdowns are populated from the loaded data, so they're wired up
  // after the first successful load rather than before it.
  setupFilterControls();
  showExampleInsights();
}

init();
