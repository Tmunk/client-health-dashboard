// Source adapters.
//
// Every data source is read through one contract, so the dashboard never knows
// or cares where a source physically lives. Two implementations ship here:
// a published Google Sheet (CSV over HTTP) and bundled static rows. Adding a
// REST API or database source later means writing a third adapter with the
// same shape, not touching the pipeline or the UI.
//
// Contract: every adapter exposes `key`, `label`, and `async load()` which
// resolves to a SourceResult. load() never rejects — an unreachable source
// degrades to fallback rows with an error message attached.
//
// @typedef {Object} SourceResult
// @property {string} key          - source key, e.g. "sessions"
// @property {string} label        - human-readable source name
// @property {'live'|'fallback'} mode
// @property {Array<Object>} rows  - raw rows, values may be strings
// @property {string|null} error   - why a live fetch failed, if it did
// @property {Date} fetchedAt

// --- CSV parsing -----------------------------------------------------------

// Minimal RFC-4180-ish parser: handles quoted fields, embedded commas, escaped
// double quotes, and both line ending styles. Not a general CSV library, but
// correct for what published Google Sheets emit.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Swallow the \n of a \r\n pair.
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  // Trailing field/row with no newline at end of file.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] === undefined ? "" : cells[i].trim();
    });
    return obj;
  });
}

// --- Adapters --------------------------------------------------------------

function createStaticAdapter(key, label, rows) {
  return {
    key,
    label,
    async load() {
      return {
        key,
        label,
        mode: "fallback",
        rows: rows.slice(),
        error: null,
        fetchedAt: new Date()
      };
    }
  };
}

function createGoogleSheetsAdapter(key, label, csvUrl, fallbackRows) {
  return {
    key,
    label,
    async load() {
      try {
        const response = await fetch(csvUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        const rows = csvToObjects(text);
        if (rows.length === 0) {
          throw new Error("Published sheet returned no rows");
        }
        return { key, label, mode: "live", rows, error: null, fetchedAt: new Date() };
      } catch (err) {
        // A source being unreachable should degrade the dashboard, not break
        // it — fall back to bundled rows and report why.
        return {
          key,
          label,
          mode: "fallback",
          rows: fallbackRows.slice(),
          error: err.message,
          fetchedAt: new Date()
        };
      }
    }
  };
}

// Picks the right adapter per source based on whether a URL is configured.
function buildAdapters() {
  const specs = [
    { key: "sessions", config: SOURCE_CONFIG.sessions, fallback: FALLBACK_SESSIONS_ROWS },
    { key: "nps", config: SOURCE_CONFIG.nps, fallback: FALLBACK_NPS_ROWS },
    { key: "amSentiment", config: SOURCE_CONFIG.amSentiment, fallback: FALLBACK_AM_SENTIMENT_ROWS }
  ];

  return specs.map(({ key, config, fallback }) =>
    config.csvUrl
      ? createGoogleSheetsAdapter(key, config.label, config.csvUrl, fallback)
      : createStaticAdapter(key, config.label, fallback)
  );
}
