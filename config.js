// Data source configuration.
//
// Each of the three sources can be pointed at a published Google Sheet. Leave
// a csvUrl empty and that source falls back to the bundled fixture data in
// fallback-data.js, so the dashboard works with no setup at all.
//
// To connect a live sheet:
//   1. Open the sheet, File > Share > Publish to web
//   2. Choose the specific tab, and pick "Comma-separated values (.csv)"
//   3. Publish, copy the generated URL, paste it below
//
// Published sheets are cached by Google for a few minutes, so an edit shows up
// on the dashboard shortly after it is made rather than instantly. The original
// Looker Studio version behaved the same way — its Sheets connector polls on an
// interval rather than receiving pushed updates.
//
// Expected columns per source (header row must match these names):
//   sessions:    client_id, client_name, segment, account_owner,
//                actual_sessions, expected_sessions,
//                new_students_actual, new_students_target,
//                previous_total_score
//   nps:         client_id, nps_survey_score
//   amSentiment: client_id, am_sentiment_rating, am_nps_estimate_points, notes

const SOURCE_CONFIG = {
  sessions: {
    label: "Sessions & new students",
    csvUrl: ""
  },
  nps: {
    label: "NPS responses",
    csvUrl: ""
  },
  amSentiment: {
    label: "AM sentiment & notes",
    csvUrl: ""
  }
};
