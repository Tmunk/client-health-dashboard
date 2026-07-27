// Scoring engine for the Client Health Dashboard.
// Takes a raw client record from data.js and returns the same record
// with computed points, total score, tier, and trend attached.
//
// 100-point model: AM Sentiment 30 + Platform Sessions 30 + NPS 30 + New Students 10

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// NPS failsafe — mirrors the original Sheet formula:
//   =IF(ISBLANK(H2), J2, H2 * 3)
// H2 (npsSurveyScore) is a 0-10 single-question rating, so *3 puts a real
// survey response on the same 0-30 scale as the AM's estimate (J2). When no
// survey came in for the period, the AM's estimate is used as-is.
function scoreNps(client) {
  if (client.npsSurveyScore === null || client.npsSurveyScore === undefined) {
    return {
      points: client.npsAmEstimatePoints,
      statusFlag: "⚠️ AM Estimate"
    };
  }
  return {
    points: client.npsSurveyScore * 3,
    statusFlag: "✅ Actual Survey"
  };
}

function scoreClient(client) {
  const amSentimentPoints = (client.amSentimentRating / 5) * 30;
  const platformSessionsPoints = clamp(
    (client.actualSessions / client.expectedSessions) * 30,
    0,
    30
  );
  const { points: npsPoints, statusFlag } = scoreNps(client);
  const newStudentsPoints = clamp(
    (client.newStudentsActual / client.newStudentsTarget) * 10,
    0,
    10
  );

  const totalScore = Math.round(
    amSentimentPoints + platformSessionsPoints + npsPoints + newStudentsPoints
  );

  let tier;
  if (totalScore >= 80) tier = "green";
  else if (totalScore >= 60) tier = "yellow";
  else tier = "red";

  const trendDelta = totalScore - client.previousTotalScore;

  return {
    ...client,
    amSentimentPoints,
    platformSessionsPoints,
    npsPoints,
    npsStatusFlag: statusFlag,
    newStudentsPoints,
    totalScore,
    tier,
    trendDelta
  };
}

function scoreAllClients(clients) {
  return clients.map(scoreClient);
}
