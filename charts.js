// Portfolio-level data visualizations. Plain HTML/CSS bars, no chart library.
// Colors come from the dataviz reference palette's fixed status/sequential
// values (validated for colorblind-safety and contrast), not eyeballed.

const CHART_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
  sequential: "#2a78d6"
};

function tierColor(tier) {
  if (tier === "green") return CHART_COLORS.good;
  if (tier === "yellow") return CHART_COLORS.warning;
  return CHART_COLORS.critical;
}

// --- shared tooltip ---------------------------------------------------

let tooltipEl = null;

function getTooltip() {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "chart-tooltip";
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(target, valueText, labelText) {
  const tip = getTooltip();
  tip.innerHTML = "";
  const value = document.createElement("div");
  value.className = "chart-tooltip-value";
  value.textContent = valueText;
  const label = document.createElement("div");
  label.className = "chart-tooltip-label";
  label.textContent = labelText;
  tip.appendChild(value);
  tip.appendChild(label);

  const rect = target.getBoundingClientRect();
  tip.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
  tip.style.top = `${rect.top + window.scrollY}px`;
  tip.classList.add("visible");
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove("visible");
}

function attachTooltip(el, valueText, labelText) {
  el.addEventListener("mouseenter", () => showTooltip(el, valueText, labelText));
  el.addEventListener("mouseleave", hideTooltip);
  el.addEventListener("focus", () => showTooltip(el, valueText, labelText));
  el.addEventListener("blur", hideTooltip);
}

// --- KPI row ------------------------------------------------------------

function renderKpiRow(clients) {
  const container = document.getElementById("kpiRow");
  container.innerHTML = "";

  const avgScore = clients.reduce((sum, c) => sum + c.totalScore, 0) / clients.length;
  const avgPrevScore = clients.reduce((sum, c) => sum + c.previousTotalScore, 0) / clients.length;
  const avgDelta = avgScore - avgPrevScore;
  const improving = clients.filter((c) => c.trendDelta > 0.5).length;
  const declining = clients.filter((c) => c.trendDelta < -0.5).length;

  const tiles = [
    {
      label: "Average score",
      value: avgScore.toFixed(1),
      deltaText: `${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(1)} vs last period`,
      deltaClass: avgDelta >= 0 ? "good" : "bad"
    },
    {
      label: "Accounts improving",
      value: String(improving),
      deltaText: `of ${clients.length} accounts`,
      deltaClass: "neutral"
    },
    {
      label: "Accounts declining",
      value: String(declining),
      deltaText: `of ${clients.length} accounts`,
      deltaClass: "neutral"
    }
  ];

  tiles.forEach((t) => {
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    tile.innerHTML = `
      <div class="stat-label">${t.label}</div>
      <div class="stat-value">${t.value}</div>
      <div class="stat-delta ${t.deltaClass}">${t.deltaText}</div>
    `;
    container.appendChild(tile);
  });
}

// --- tier distribution bar (also the tier filter control) ---------------

function renderTierBar(clients, filterState, onToggle) {
  const container = document.getElementById("tierBar");
  container.innerHTML = "";

  const counts = { green: 0, yellow: 0, red: 0 };
  clients.forEach((c) => counts[c.tier]++);
  const total = clients.length;

  const order = [
    { tier: "green", label: "Green", color: CHART_COLORS.good },
    { tier: "yellow", label: "Yellow", color: CHART_COLORS.warning },
    { tier: "red", label: "Red", color: CHART_COLORS.critical }
  ];

  const track = document.createElement("div");
  track.className = "tier-bar-track";

  order.forEach(({ tier, color }) => {
    const count = counts[tier];
    if (count === 0) return;
    const seg = document.createElement("button");
    seg.type = "button";
    seg.className = "tier-bar-segment";
    seg.style.width = `${(count / total) * 100}%`;
    seg.style.background = color;
    if (filterState.tier === tier) seg.classList.add("active");
    attachTooltip(seg, `${count} account${count === 1 ? "" : "s"}`, `${tier[0].toUpperCase()}${tier.slice(1)} tier`);
    seg.addEventListener("click", () => onToggle(tier));
    track.appendChild(seg);
  });

  const legend = document.createElement("div");
  legend.className = "tier-bar-legend";
  order.forEach(({ tier, label, color }) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "tier-legend-item";
    if (filterState.tier === tier) item.classList.add("active");
    item.innerHTML = `<span class="tier-legend-dot" style="background:${color}"></span>${label}<span class="tier-legend-count">${counts[tier]}</span>`;
    item.addEventListener("click", () => onToggle(tier));
    legend.appendChild(item);
  });

  container.appendChild(track);
  container.appendChild(legend);
}

// --- score by account bar chart ------------------------------------------

function renderScoreChart(clients) {
  const container = document.getElementById("scoreChart");
  container.innerHTML = "";

  const sorted = clients.slice().sort((a, b) => a.totalScore - b.totalScore);

  sorted.forEach((c) => {
    const row = document.createElement("div");
    row.className = "hbar-row";

    const label = document.createElement("div");
    label.className = "hbar-label";
    label.textContent = c.clientName;
    label.title = c.clientName;

    const track = document.createElement("div");
    track.className = "hbar-track";

    const bar = document.createElement("div");
    bar.className = "hbar-fill";
    bar.style.width = `${c.totalScore}%`;
    bar.style.background = tierColor(c.tier);
    attachTooltip(bar, `${c.totalScore} / 100`, `${c.clientName} — ${c.tier} tier`);
    bar.tabIndex = 0;

    const value = document.createElement("span");
    value.className = "hbar-value";
    value.textContent = c.totalScore;

    track.appendChild(bar);
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    container.appendChild(row);
  });
}

// --- category breakdown bar chart -----------------------------------------

function renderCategoryChart(clients) {
  const container = document.getElementById("categoryChart");
  container.innerHTML = "";

  const categories = [
    { label: "AM Sentiment", key: "amSentimentPoints", max: 30 },
    { label: "Platform Sessions", key: "platformSessionsPoints", max: 30 },
    { label: "NPS", key: "npsPoints", max: 30 },
    { label: "New Students", key: "newStudentsPoints", max: 10 }
  ];

  categories.forEach((cat) => {
    const avgPct = (clients.reduce((sum, c) => sum + c[cat.key] / cat.max, 0) / clients.length) * 100;

    const row = document.createElement("div");
    row.className = "hbar-row";

    const label = document.createElement("div");
    label.className = "hbar-label";
    label.textContent = cat.label;

    const track = document.createElement("div");
    track.className = "hbar-track";

    const bar = document.createElement("div");
    bar.className = "hbar-fill";
    bar.style.width = `${avgPct}%`;
    bar.style.background = CHART_COLORS.sequential;
    attachTooltip(bar, `${avgPct.toFixed(0)}% of max`, `${cat.label} — portfolio average`);
    bar.tabIndex = 0;

    const value = document.createElement("span");
    value.className = "hbar-value";
    value.textContent = `${avgPct.toFixed(0)}%`;

    track.appendChild(bar);
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    container.appendChild(row);
  });
}
