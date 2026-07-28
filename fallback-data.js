// Offline fallback fixtures for the three data sources.
//
// These mirror the three Google Sheets described in ARCHITECTURE.md — session
// and new-student data, NPS responses, and AM sentiment plus notes. They are
// used when no published-CSV URL is configured in config.js, or when a live
// fetch fails, so the dashboard always renders something.
//
// All clients, people, and numbers are fictional.
//
// Note the deliberate data quality problems in here — they are not mistakes,
// they exist so the reconciliation stage has something real to catch:
//   - The NPS source contains a row for c015, a client that is not in the
//     master client list (an offboarded account whose row was never removed).
//   - The AM sentiment source has no row for c006, so that client has neither
//     a sentiment rating nor an estimated NPS.
// Both are the everyday failure mode of joining separate spreadsheets by hand.

// --- Source 1: sessions and new students (the master client list) ----------

const FALLBACK_SESSIONS_ROWS = [
  { client_id: "c001", client_name: "Meridian Learning Co-op", segment: "Mid-Market", account_owner: "J. Alvarez", actual_sessions: 142, expected_sessions: 120, new_students_actual: 6, new_students_target: 8, previous_total_score: 88 },
  { client_id: "c002", client_name: "Brightpath Tutoring", segment: "Enterprise", account_owner: "R. Chen", actual_sessions: 310, expected_sessions: 300, new_students_actual: 15, new_students_target: 15, previous_total_score: 85 },
  { client_id: "c003", client_name: "Northgate Homeschool Network", segment: "SMB", account_owner: "J. Alvarez", actual_sessions: 40, expected_sessions: 60, new_students_actual: 2, new_students_target: 5, previous_total_score: 68 },
  { client_id: "c004", client_name: "Cascade STEM Academy", segment: "Mid-Market", account_owner: "M. Okafor", actual_sessions: 55, expected_sessions: 110, new_students_actual: 1, new_students_target: 6, previous_total_score: 52 },
  { client_id: "c005", client_name: "Solstice Learning Group", segment: "Enterprise", account_owner: "R. Chen", actual_sessions: 420, expected_sessions: 400, new_students_actual: 20, new_students_target: 18, previous_total_score: 95 },
  { client_id: "c006", client_name: "Ivy Row Learning Center", segment: "SMB", account_owner: "M. Okafor", actual_sessions: 48, expected_sessions: 50, new_students_actual: 3, new_students_target: 4, previous_total_score: 66 },
  { client_id: "c007", client_name: "Harborview Prep Tutors", segment: "Mid-Market", account_owner: "J. Alvarez", actual_sessions: 70, expected_sessions: 140, new_students_actual: 0, new_students_target: 5, previous_total_score: 38 },
  { client_id: "c008", client_name: "Golden Oak Academy", segment: "Enterprise", account_owner: "R. Chen", actual_sessions: 250, expected_sessions: 350, new_students_actual: 10, new_students_target: 12, previous_total_score: 72 },
  { client_id: "c009", client_name: "Riverbend Online School", segment: "SMB", account_owner: "M. Okafor", actual_sessions: 65, expected_sessions: 55, new_students_actual: 5, new_students_target: 4, previous_total_score: 90 },
  { client_id: "c010", client_name: "Fernwood Learning Collective", segment: "Mid-Market", account_owner: "J. Alvarez", actual_sessions: 100, expected_sessions: 130, new_students_actual: 4, new_students_target: 7, previous_total_score: 67 },
  { client_id: "c011", client_name: "Pinecrest Virtual Academy", segment: "Enterprise", account_owner: "R. Chen", actual_sessions: 180, expected_sessions: 380, new_students_actual: 2, new_students_target: 14, previous_total_score: 59 },
  { client_id: "c012", client_name: "Cobblestone Tutors Co.", segment: "SMB", account_owner: "M. Okafor", actual_sessions: 30, expected_sessions: 25, new_students_actual: 3, new_students_target: 3, previous_total_score: 89 },
  { client_id: "c013", client_name: "Alder Grove Learning Hub", segment: "Mid-Market", account_owner: "J. Alvarez", actual_sessions: 90, expected_sessions: 150, new_students_actual: 4, new_students_target: 6, previous_total_score: 58 },
  { client_id: "c014", client_name: "Timberline Academy Network", segment: "Enterprise", account_owner: "R. Chen", actual_sessions: 500, expected_sessions: 450, new_students_actual: 22, new_students_target: 20, previous_total_score: 90 }
];

// --- Source 2: NPS responses reported by clients ---------------------------
// Only clients who actually responded this period appear here. A client with
// no row simply did not respond — that absence is what triggers the failsafe,
// exactly like a blank cell did in the original sheet.

const FALLBACK_NPS_ROWS = [
  { client_id: "c001", nps_survey_score: 8 },
  { client_id: "c003", nps_survey_score: 6 },
  { client_id: "c005", nps_survey_score: 9 },
  { client_id: "c007", nps_survey_score: 3 },
  { client_id: "c008", nps_survey_score: 5 },
  { client_id: "c010", nps_survey_score: 7 },
  { client_id: "c012", nps_survey_score: 9 },
  { client_id: "c013", nps_survey_score: 6 },
  // Orphan: this account offboarded last quarter but its NPS row was never
  // removed. It matches no client in the master list.
  { client_id: "c015", nps_survey_score: 7 }
];

// --- Source 3: AM sentiment ratings and notes ------------------------------
// Note that c006 is missing entirely — no sentiment rating and no estimated
// NPS, which means that client cannot be scored on 60 of the 100 points.

const FALLBACK_AM_SENTIMENT_ROWS = [
  { client_id: "c001", am_sentiment_rating: 5, am_nps_estimate_points: 24, notes: "Renewal conversation went well. Champion is pushing for a second cohort in the fall." },
  { client_id: "c002", am_sentiment_rating: 4, am_nps_estimate_points: 27, notes: "No survey response this period, but sentiment on calls is consistently positive." },
  { client_id: "c003", am_sentiment_rating: 3, am_nps_estimate_points: 20, notes: "Enrollment push stalled after their coordinator left. New hire starts next month." },
  { client_id: "c004", am_sentiment_rating: 2, am_nps_estimate_points: 9, notes: "Escalated twice about scheduling bugs. Trust is low right now." },
  { client_id: "c005", am_sentiment_rating: 5, am_nps_estimate_points: 27, notes: "Strongest account in the book. Open to being a reference." },
  { client_id: "c007", am_sentiment_rating: 1, am_nps_estimate_points: 10, notes: "At risk. Budget review underway and we are not tracking well against their goals." },
  { client_id: "c008", am_sentiment_rating: 4, am_nps_estimate_points: 18, notes: "Good relationship but usage has slipped since their term ended." },
  { client_id: "c009", am_sentiment_rating: 5, am_nps_estimate_points: 26, notes: "Small but extremely engaged. Onboarding new tutors ahead of schedule." },
  { client_id: "c010", am_sentiment_rating: 3, am_nps_estimate_points: 21, notes: "Steady. Enrollment pipeline is the thing to watch." },
  { client_id: "c011", am_sentiment_rating: 2, am_nps_estimate_points: 12, notes: "Usage collapsed after a leadership change. Need an exec-level conversation." },
  { client_id: "c012", am_sentiment_rating: 4, am_nps_estimate_points: 25, notes: "Consistent performer, low touch, no concerns." },
  { client_id: "c013", am_sentiment_rating: 3, am_nps_estimate_points: 16, notes: "Relationship is thinner since our main contact moved teams." },
  { client_id: "c014", am_sentiment_rating: 4, am_nps_estimate_points: 28, notes: "Large account, healthy usage. Worth a quarterly business review." }
];
