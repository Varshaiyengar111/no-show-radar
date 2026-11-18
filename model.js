// No-Show Radar: made-up clinic data + a small, explainable prediction model.
// No outside libraries. Everything here is generated, not real patient data.

// ---------- 1. Made-up data ----------
// A seeded random generator so the numbers are the same every run.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOTS = ["Morning", "Afternoon", "Evening"];
const SPECIALTIES = ["General medicine", "Dermatology", "Orthopaedics", "ENT", "Ophthalmology"];

function makeAppointment(rand, id) {
  const age = Math.round(18 + rand() * 62);
  const appt = {
    id,
    age,
    age_group: age <= 30 ? "18-30" : age <= 50 ? "31-50" : "51+",
    lead_days: Math.round(Math.pow(rand(), 1.6) * 45),
    prior_no_shows: rand() < 0.6 ? 0 : rand() < 0.6 ? 1 : rand() < 0.7 ? 2 : 3,
    distance_km: Math.round(1 + Math.pow(rand(), 1.4) * 39),
    reminder_sent: rand() < 0.55,
    first_visit: false,
    day: DAYS[Math.floor(rand() * DAYS.length)],
    slot: SLOTS[Math.floor(rand() * SLOTS.length)],
    specialty: SPECIALTIES[Math.floor(rand() * SPECIALTIES.length)],
  };
  // A first visit has no history of missed visits.
  appt.first_visit = rand() < 0.3;
  if (appt.first_visit) appt.prior_no_shows = 0;
  // The "true" behaviour of this made-up clinic. The model never sees this formula;
  // it has to learn the pattern from the examples.
  const z =
    -2.4 +
    0.045 * appt.lead_days +
    0.65 * appt.prior_no_shows +
    0.035 * appt.distance_km -
    0.8 * (appt.reminder_sent ? 1 : 0) +
    0.45 * (appt.first_visit ? 1 : 0) +
    0.35 * (appt.slot === "Evening" ? 1 : 0) +
    0.25 * (appt.day === "Mon" ? 1 : 0) -
    0.012 * (age - 40) +
    (rand() - 0.5) * 1.2;
  appt.no_show = rand() < 1 / (1 + Math.exp(-z));
  return appt;
}

export function makeData(n, seed) {
  const rand = rng(seed);
  return Array.from({ length: n }, (_, i) => makeAppointment(rand, i + 1));
}

// ---------- 2. Features the model uses ----------
// Each has a plain-language reason shown to clinic staff.
// Age is deliberately NOT used as a feature (see README: fairness).
const FEATURES = [
  { key: "lead_days", reason: (a) => `booked ${a.lead_days} days ahead`, value: (a) => a.lead_days },
  { key: "prior_no_shows", reason: (a) => `missed ${a.prior_no_shows} visit${a.prior_no_shows === 1 ? "" : "s"} before`, value: (a) => a.prior_no_shows },
  { key: "distance_km", reason: (a) => `lives ${a.distance_km} km away`, value: (a) => a.distance_km },
  { key: "no_reminder", reason: () => "no reminder sent yet", value: (a) => (a.reminder_sent ? 0 : 1) },
  { key: "first_visit", reason: () => "first visit to the clinic", value: (a) => (a.first_visit ? 1 : 0) },
  { key: "evening", reason: () => "evening slot", value: (a) => (a.slot === "Evening" ? 1 : 0) },
  { key: "monday", reason: () => "Monday appointment", value: (a) => (a.day === "Mon" ? 1 : 0) },
];

// ---------- 3. Train a logistic regression ----------
export function train(rows, { epochs = 400, rate = 0.1 } = {}) {
  const raw = rows.map((a) => FEATURES.map((f) => f.value(a)));
  const mean = FEATURES.map((_, j) => raw.reduce((t, r) => t + r[j], 0) / raw.length);
  const sd = FEATURES.map((_, j) => Math.sqrt(raw.reduce((t, r) => t + (r[j] - mean[j]) ** 2, 0) / raw.length) || 1);
  const X = raw.map((r) => r.map((v, j) => (v - mean[j]) / sd[j]));
  const y = rows.map((a) => (a.no_show ? 1 : 0));

  let w = FEATURES.map(() => 0);
  let b = 0;
  for (let e = 0; e < epochs; e++) {
    const gw = w.map(() => 0);
    let gb = 0;
    for (let i = 0; i < X.length; i++) {
      const p = 1 / (1 + Math.exp(-(b + X[i].reduce((t, v, j) => t + v * w[j], 0))));
      const err = p - y[i];
      for (let j = 0; j < w.length; j++) gw[j] += err * X[i][j];
      gb += err;
    }
    w = w.map((wj, j) => wj - (rate * gw[j]) / X.length);
    b -= (rate * gb) / X.length;
  }

  const model = {
    predict(a) {
      const x = FEATURES.map((f, j) => (f.value(a) - mean[j]) / sd[j]);
      const contributions = x.map((v, j) => v * w[j]);
      const risk = 1 / (1 + Math.exp(-(b + contributions.reduce((t, c) => t + c, 0))));
      const reasons = FEATURES.map((f, j) => ({ text: f.reason(a), c: contributions[j] }))
        .filter((r) => r.c > 0.1)
        .sort((p, q) => q.c - p.c)
        .slice(0, 3)
        .map((r) => r.text);
      return { risk, reasons };
    },
    weights: FEATURES.map((f, j) => ({ feature: f.key, weight: Number(w[j].toFixed(3)) })),
  };
  return model;
}

// ---------- 4. Measure how good it is ----------
export function auc(scored) {
  // Probability a random no-show is ranked above a random show.
  const pos = scored.filter((s) => s.label).map((s) => s.risk);
  const neg = scored.filter((s) => !s.label).map((s) => s.risk);
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

export function atTopShare(scored, share) {
  const sorted = [...scored].sort((p, q) => q.risk - p.risk);
  const k = Math.max(1, Math.round(sorted.length * share));
  const flagged = sorted.slice(0, k);
  const caught = flagged.filter((s) => s.label).length;
  const total = scored.filter((s) => s.label).length;
  return { flagged: k, precision: caught / k, recall: total ? caught / total : 0 };
}

// ---------- 5. Build everything the dashboard needs ----------
export function buildDashboard() {
  const history = makeData(3000, 42);
  const cut = Math.floor(history.length * 0.8);
  const trainRows = history.slice(0, cut);
  const testRows = history.slice(cut);
  const model = train(trainRows);

  const scored = testRows.map((a) => ({ risk: model.predict(a).risk, label: a.no_show, age_group: a.age_group }));
  const baseRate = testRows.filter((a) => a.no_show).length / testRows.length;

  const fairness = ["18-30", "31-50", "51+"].map((g) => {
    const group = scored.filter((s) => s.age_group === g);
    const sorted = [...scored].sort((p, q) => q.risk - p.risk);
    const cutoff = sorted[Math.round(sorted.length * 0.2) - 1].risk;
    const missed = group.filter((s) => s.label);
    const caught = missed.filter((s) => s.risk >= cutoff).length;
    return {
      group: g,
      appointments: group.length,
      no_show_rate: group.filter((s) => s.label).length / group.length,
      flagged_rate: group.filter((s) => s.risk >= cutoff).length / group.length,
      recall: missed.length ? caught / missed.length : 0,
    };
  });

  const tomorrow = makeData(36, 7).map((a, i) => {
    const { risk, reasons } = model.predict(a);
    const hour = a.slot === "Morning" ? 9 : a.slot === "Afternoon" ? 13 : 17;
    return {
      id: `A-${1001 + i}`,
      time: `${String(hour + (i % 4)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
      specialty: a.specialty,
      age_group: a.age_group,
      reminder_sent: a.reminder_sent,
      risk: Number(risk.toFixed(3)),
      reasons,
    };
  }).sort((p, q) => q.risk - p.risk);

  return {
    summary: {
      history_size: history.length,
      test_size: testRows.length,
      base_rate: baseRate,
      auc: auc(scored),
    },
    test: scored.map((s) => [Number(s.risk.toFixed(4)), s.label ? 1 : 0]),
    fairness,
    weights: model.weights,
    tomorrow,
  };
}
