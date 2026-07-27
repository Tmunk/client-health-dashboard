// Synthetic client data for the Client Health Dashboard rebuild.
// Fictional EdTech tutoring platform, fictional companies and people only.
//
// This is the "raw" layer — the numbers you'd actually pull from a CRM/product
// database before any scoring math runs. scoring.js turns these into points.
//
// Field notes:
//   npsSurveyScore     — real 0–10 survey response for the period, or null if no
//                        response came in (this is the "H2" cell in the original
//                        formula)
//   npsAmEstimatePoints — the AM's own estimate of NPS, already expressed on the
//                        0–30 point scale (this is the "J2" cell) — always present,
//                        used only when npsSurveyScore is null
//   expectedSessions / newStudentsTarget — usage benchmarks sized to the account,
//                        not fixed platform-wide targets

const CLIENTS = [
  {
    id: "c001",
    clientName: "Meridian Learning Co-op",
    accountOwner: "J. Alvarez",
    segment: "Mid-Market",
    amSentimentRating: 5,
    actualSessions: 142,
    expectedSessions: 120,
    npsSurveyScore: 8,
    npsAmEstimatePoints: 24,
    newStudentsActual: 6,
    newStudentsTarget: 8,
    previousTotalScore: 88
  },
  {
    id: "c002",
    clientName: "Brightpath Tutoring",
    accountOwner: "R. Chen",
    segment: "Enterprise",
    amSentimentRating: 4,
    actualSessions: 310,
    expectedSessions: 300,
    npsSurveyScore: null,
    npsAmEstimatePoints: 27,
    newStudentsActual: 15,
    newStudentsTarget: 15,
    previousTotalScore: 85
  },
  {
    id: "c003",
    clientName: "Northgate Homeschool Network",
    accountOwner: "J. Alvarez",
    segment: "SMB",
    amSentimentRating: 3,
    actualSessions: 40,
    expectedSessions: 60,
    npsSurveyScore: 6,
    npsAmEstimatePoints: 20,
    newStudentsActual: 2,
    newStudentsTarget: 5,
    previousTotalScore: 68
  },
  {
    id: "c004",
    clientName: "Cascade STEM Academy",
    accountOwner: "M. Okafor",
    segment: "Mid-Market",
    amSentimentRating: 2,
    actualSessions: 55,
    expectedSessions: 110,
    npsSurveyScore: null,
    npsAmEstimatePoints: 9,
    newStudentsActual: 1,
    newStudentsTarget: 6,
    previousTotalScore: 52
  },
  {
    id: "c005",
    clientName: "Solstice Learning Group",
    accountOwner: "R. Chen",
    segment: "Enterprise",
    amSentimentRating: 5,
    actualSessions: 420,
    expectedSessions: 400,
    npsSurveyScore: 9,
    npsAmEstimatePoints: 27,
    newStudentsActual: 20,
    newStudentsTarget: 18,
    previousTotalScore: 95
  },
  {
    id: "c006",
    clientName: "Ivy Row Learning Center",
    accountOwner: "M. Okafor",
    segment: "SMB",
    amSentimentRating: 3,
    actualSessions: 48,
    expectedSessions: 50,
    npsSurveyScore: null,
    npsAmEstimatePoints: 15,
    newStudentsActual: 3,
    newStudentsTarget: 4,
    previousTotalScore: 66
  },
  {
    id: "c007",
    clientName: "Harborview Prep Tutors",
    accountOwner: "J. Alvarez",
    segment: "Mid-Market",
    amSentimentRating: 1,
    actualSessions: 70,
    expectedSessions: 140,
    npsSurveyScore: 3,
    npsAmEstimatePoints: 10,
    newStudentsActual: 0,
    newStudentsTarget: 5,
    previousTotalScore: 38
  },
  {
    id: "c008",
    clientName: "Golden Oak Academy",
    accountOwner: "R. Chen",
    segment: "Enterprise",
    amSentimentRating: 4,
    actualSessions: 250,
    expectedSessions: 350,
    npsSurveyScore: 5,
    npsAmEstimatePoints: 18,
    newStudentsActual: 10,
    newStudentsTarget: 12,
    previousTotalScore: 72
  },
  {
    id: "c009",
    clientName: "Riverbend Online School",
    accountOwner: "M. Okafor",
    segment: "SMB",
    amSentimentRating: 5,
    actualSessions: 65,
    expectedSessions: 55,
    npsSurveyScore: null,
    npsAmEstimatePoints: 26,
    newStudentsActual: 5,
    newStudentsTarget: 4,
    previousTotalScore: 90
  },
  {
    id: "c010",
    clientName: "Fernwood Learning Collective",
    accountOwner: "J. Alvarez",
    segment: "Mid-Market",
    amSentimentRating: 3,
    actualSessions: 100,
    expectedSessions: 130,
    npsSurveyScore: 7,
    npsAmEstimatePoints: 21,
    newStudentsActual: 4,
    newStudentsTarget: 7,
    previousTotalScore: 67
  },
  {
    id: "c011",
    clientName: "Pinecrest Virtual Academy",
    accountOwner: "R. Chen",
    segment: "Enterprise",
    amSentimentRating: 2,
    actualSessions: 180,
    expectedSessions: 380,
    npsSurveyScore: null,
    npsAmEstimatePoints: 12,
    newStudentsActual: 2,
    newStudentsTarget: 14,
    previousTotalScore: 59
  },
  {
    id: "c012",
    clientName: "Cobblestone Tutors Co.",
    accountOwner: "M. Okafor",
    segment: "SMB",
    amSentimentRating: 4,
    actualSessions: 30,
    expectedSessions: 25,
    npsSurveyScore: 9,
    npsAmEstimatePoints: 25,
    newStudentsActual: 3,
    newStudentsTarget: 3,
    previousTotalScore: 89
  },
  {
    id: "c013",
    clientName: "Alder Grove Learning Hub",
    accountOwner: "J. Alvarez",
    segment: "Mid-Market",
    amSentimentRating: 3,
    actualSessions: 90,
    expectedSessions: 150,
    npsSurveyScore: 6,
    npsAmEstimatePoints: 16,
    newStudentsActual: 4,
    newStudentsTarget: 6,
    previousTotalScore: 58
  },
  {
    id: "c014",
    clientName: "Timberline Academy Network",
    accountOwner: "R. Chen",
    segment: "Enterprise",
    amSentimentRating: 4,
    actualSessions: 500,
    expectedSessions: 450,
    npsSurveyScore: null,
    npsAmEstimatePoints: 28,
    newStudentsActual: 22,
    newStudentsTarget: 20,
    previousTotalScore: 90
  }
];
