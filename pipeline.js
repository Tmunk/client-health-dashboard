// Ingestion pipeline: validate -> coerce -> join -> reconcile.
//
// The point of this layer is that a health score is only trustworthy if the
// data behind it is. A silently wrong number is worse than a missing one,
// because nobody questions it. So every problem found here gets surfaced in
// the UI rather than absorbed into a score.
//
// Issue shape: { severity: 'error'|'warning', source, clientId, message }

const SOURCE_SCHEMAS = {
  sessions: {
    label: "Sessions & new students",
    key: "client_id",
    fields: [
      { name: "client_id", type: "string", required: true },
      { name: "client_name", type: "string", required: true },
      { name: "segment", type: "string", required: false, default: "Unspecified" },
      { name: "account_owner", type: "string", required: false, default: "Unassigned" },
      { name: "actual_sessions", type: "number", required: true },
      { name: "expected_sessions", type: "number", required: true, positive: true },
      { name: "new_students_actual", type: "number", required: true },
      { name: "new_students_target", type: "number", required: true, positive: true },
      { name: "previous_total_score", type: "number", required: false, default: 0 }
    ]
  },
  nps: {
    label: "NPS responses",
    key: "client_id",
    fields: [
      { name: "client_id", type: "string", required: true },
      { name: "nps_survey_score", type: "number", required: true, min: 0, max: 10 }
    ]
  },
  amSentiment: {
    label: "AM sentiment & notes",
    key: "client_id",
    fields: [
      { name: "client_id", type: "string", required: true },
      { name: "am_sentiment_rating", type: "number", required: true, min: 1, max: 5 },
      { name: "am_nps_estimate_points", type: "number", required: true, min: 0, max: 30 },
      { name: "notes", type: "string", required: false, default: "" }
    ]
  }
};

function coerceNumber(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  // Tolerate values pasted from spreadsheets: thousands separators, stray
  // whitespace, a trailing percent sign.
  const cleaned = raw.replace(/[,\s%]/g, "");
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

// Validates and type-coerces one source's rows against its schema. Rows that
// can't be salvaged are dropped and reported rather than passed downstream.
function validateSource(sourceKey, rows) {
  const schema = SOURCE_SCHEMAS[sourceKey];
  const issues = [];
  const valid = [];
  const seenKeys = new Set();

  rows.forEach((row, index) => {
    const rowLabel = `row ${index + 2}`; // +2: 1-indexed, plus header row
    const clean = {};
    let usable = true;

    for (const field of schema.fields) {
      const raw = row[field.name];
      const isBlank = raw === undefined || raw === null || String(raw).trim() === "";

      if (isBlank) {
        if (field.required) {
          issues.push({
            severity: "error",
            source: schema.label,
            clientId: row[schema.key] || rowLabel,
            message: `Missing required field "${field.name}" — row skipped.`
          });
          usable = false;
          break;
        }
        clean[field.name] = field.default;
        continue;
      }

      if (field.type === "number") {
        const num = coerceNumber(raw);
        if (num === null) {
          issues.push({
            severity: "error",
            source: schema.label,
            clientId: row[schema.key] || rowLabel,
            message: `Field "${field.name}" is not a number (got "${raw}") — row skipped.`
          });
          usable = false;
          break;
        }
        if (field.positive && num <= 0) {
          issues.push({
            severity: "error",
            source: schema.label,
            clientId: row[schema.key] || rowLabel,
            message: `Field "${field.name}" must be greater than zero (got ${num}) — row skipped.`
          });
          usable = false;
          break;
        }
        if (field.min !== undefined && num < field.min) {
          issues.push({
            severity: "warning",
            source: schema.label,
            clientId: row[schema.key],
            message: `Field "${field.name}" below expected minimum ${field.min} (got ${num}) — clamped.`
          });
          clean[field.name] = field.min;
          continue;
        }
        if (field.max !== undefined && num > field.max) {
          issues.push({
            severity: "warning",
            source: schema.label,
            clientId: row[schema.key],
            message: `Field "${field.name}" above expected maximum ${field.max} (got ${num}) — clamped.`
          });
          clean[field.name] = field.max;
          continue;
        }
        clean[field.name] = num;
      } else {
        clean[field.name] = String(raw).trim();
      }
    }

    if (!usable) return;

    const keyValue = clean[schema.key];
    if (seenKeys.has(keyValue)) {
      issues.push({
        severity: "warning",
        source: schema.label,
        clientId: keyValue,
        message: "Duplicate record for this client — first one kept, this one ignored."
      });
      return;
    }
    seenKeys.add(keyValue);
    valid.push(clean);
  });

  return { valid, issues };
}

// Joins the three validated sources into the shape scoring.js expects.
// The sessions source is the master client list: a client that isn't there
// doesn't exist, no matter what the other sources say about it.
function joinSources(sessionsRows, npsRows, amRows) {
  const issues = [];
  const npsById = new Map(npsRows.map((r) => [r.client_id, r]));
  const amById = new Map(amRows.map((r) => [r.client_id, r]));
  const masterIds = new Set(sessionsRows.map((r) => r.client_id));

  // Records that reference a client the master list has never heard of. This
  // is the classic stale-spreadsheet failure: an account offboards and its
  // rows linger in the other sheets.
  npsById.forEach((_, id) => {
    if (!masterIds.has(id)) {
      issues.push({
        severity: "warning",
        source: SOURCE_SCHEMAS.nps.label,
        clientId: id,
        message: "NPS response for a client not in the master list — ignored."
      });
    }
  });
  amById.forEach((_, id) => {
    if (!masterIds.has(id)) {
      issues.push({
        severity: "warning",
        source: SOURCE_SCHEMAS.amSentiment.label,
        clientId: id,
        message: "AM sentiment record for a client not in the master list — ignored."
      });
    }
  });

  const clients = [];

  sessionsRows.forEach((session) => {
    const am = amById.get(session.client_id);

    // AM sentiment carries 30 points directly, and the estimated NPS that the
    // failsafe depends on. Without it, up to 60 of 100 points are unknown, so
    // there is no honest score to show — flag it and leave the client out
    // rather than publish a number that looks real.
    if (!am) {
      issues.push({
        severity: "error",
        source: SOURCE_SCHEMAS.amSentiment.label,
        clientId: session.client_id,
        message: `No AM sentiment record for ${session.client_name} — excluded from scoring (sentiment and estimated NPS both unavailable).`
      });
      return;
    }

    const nps = npsById.get(session.client_id);

    clients.push({
      id: session.client_id,
      clientName: session.client_name,
      segment: session.segment,
      accountOwner: session.account_owner,
      actualSessions: session.actual_sessions,
      expectedSessions: session.expected_sessions,
      newStudentsActual: session.new_students_actual,
      newStudentsTarget: session.new_students_target,
      previousTotalScore: session.previous_total_score,
      amSentimentRating: am.am_sentiment_rating,
      npsAmEstimatePoints: am.am_nps_estimate_points,
      amNotes: am.notes,
      npsSurveyScore: nps ? nps.nps_survey_score : null
    });
  });

  return { clients, issues };
}

// Runs the whole thing: load every source in parallel, validate each, join,
// reconcile. Returns the client list plus everything the UI needs to explain
// where the data came from and what was wrong with it.
async function runPipeline() {
  const adapters = buildAdapters();
  const results = await Promise.all(adapters.map((a) => a.load()));
  const byKey = {};
  results.forEach((r) => {
    byKey[r.key] = r;
  });

  const allIssues = [];

  results.forEach((r) => {
    if (r.error) {
      allIssues.push({
        severity: "warning",
        source: r.label,
        clientId: null,
        message: `Live fetch failed (${r.error}) — using bundled fallback data.`
      });
    }
  });

  const sessions = validateSource("sessions", byKey.sessions.rows);
  const nps = validateSource("nps", byKey.nps.rows);
  const am = validateSource("amSentiment", byKey.amSentiment.rows);
  allIssues.push(...sessions.issues, ...nps.issues, ...am.issues);

  const joined = joinSources(sessions.valid, nps.valid, am.valid);
  allIssues.push(...joined.issues);

  return {
    clients: joined.clients,
    issues: allIssues,
    sources: [
      { ...byKey.sessions, validRows: sessions.valid.length },
      { ...byKey.nps, validRows: nps.valid.length },
      { ...byKey.amSentiment, validRows: am.valid.length }
    ]
  };
}
