# No-Show Radar

**Help a clinic's front desk call the right patients first, so fewer appointments go to waste.**

### ▶ [Try the online demo](https://varshaiyengar111.github.io/no-show-radar/)
No install needed. Made-up data.

A small AI product prototype in health tech. It learns from past appointments which ones are likely to be missed, ranks tomorrow's list, explains each flag in plain words, and checks whether the model treats age groups fairly.

> Portfolio demo. All data is made up and generated in `model.js`. No real patients.

---

## The problem

Missed appointments are common in outpatient clinics. Each one is a lost slot that another patient could have used, idle doctor time, and often a patient whose care is delayed. Front-desk staff can only make so many reminder calls a day, so they call everyone briefly or no one at all.

## Who it's for

| User | What they need |
|---|---|
| **Front-desk coordinator** (primary): makes reminder calls | A short, ranked call list with a reason for each name |
| **Clinic manager**: owns utilisation | Fewer empty slots without extra staff |
| **Patients**: get the call | A timely reminder, never a penalty for being flagged |

## Scope (v0.1)

**In scope**
- Made-up history of 3,000 appointments (booking lead time, past missed visits, distance, reminder sent, first visit, slot, day)
- A logistic regression model trained on 80% and tested on the 20% it hasn't seen
- Dashboard: tomorrow's 36 appointments ranked by risk, with the top 3 reasons for each
- A slider for "how many calls can you make?" that shows the trade-off live
- Model transparency (what it pays attention to) and a fairness check by age group
- Runs fully offline, free, no API key, no outside libraries

**Out of scope (on purpose)**
- Overbooking or refusing patients based on a score. A flag only ever means "call to confirm"
- Sending SMS or WhatsApp reminders
- Connecting to a real hospital system or real patient data

## Product decisions

- **The simplest model that works.** This is a ranking problem on a table of numbers, so a large language model would be slower, costlier and harder to explain. Logistic regression trains in under a second and every flag can be explained.
- **Reasons, not just scores.** Staff see "missed 2 visits before, booked 30 days ahead, no reminder sent yet", which also tells them what to say on the call.
- **Design for staff capacity.** The real question is "who should I call with the 20 minutes I have?", so the main control is "flag the top X%", not a probability cut-off.
- **Sensitive traits stay out.** Age, gender, religion, caste and income are not model inputs.
- **…and then check anyway.** Leaving age out did *not* make outcomes equal: in this made-up clinic, younger patients miss slightly more visits but get fewer calls (about 33% of their no-shows caught vs 42% for 51+). Because the model can't see age, it relies on other signals that happen to point more at older patients. The dashboard shows this openly rather than hiding it.

## Results on the 600 held-out appointments

| | Value |
|---|---|
| Actual no-show rate | 32% |
| AUC (how well it ranks; 0.5 = guessing) | 0.71 |
| Calling the top 20%: share who really would miss | 61% (1.9× better than random) |
| Calling the top 20%: share of all no-shows reached | 38% |

These are deliberately modest. With made-up data and a simple model, the goal is to show the method and the trade-offs, not a headline number.

## Success metrics for a real pilot

| Metric | Target | How to measure |
|---|---|---|
| No-show rate | 20% relative drop vs control weeks | A/B by week or by clinic session |
| Slots refilled | ≥ 30% of confirmed cancellations rebooked | Booking system |
| Calls per avoided no-show | Falls over time | Call log + attendance |
| Staff time | ≤ 20 minutes a day | Self-reported |
| Fairness | Gap in no-shows caught between age groups ≤ 5 points | The built-in fairness check, monthly |

**Guardrail metric:** zero cases of a patient being refused, delayed or double-booked because of a flag.

## Try the demo

You need [Node.js](https://nodejs.org) 20.12 or newer. There is nothing to install.

```bash
npm start
```

Open http://localhost:3004. Move the slider to see the trade-off change, and mark patients as **Called**.

**Online demo:** `npm run build:pages` saves the model's results into `docs/` so the dashboard runs on GitHub Pages with no server.

## How it works

- `model.js`: generates the made-up clinic data, trains the model, measures it (AUC, precision and recall at a call budget, fairness by age group) and scores tomorrow's list
- `server.js`: a tiny Node server that trains once at start-up and serves the dashboard
- `public/index.html`: the whole dashboard in one file

## What I'd do next

1. **Close the fairness gap**: try per-group call quotas, or add a signal that better captures what's behind younger patients' no-shows (for example, work-hour slots), then re-run the check.
2. **Act on the reasons**: suggest the action, not just the risk. "Lives far away" → offer a teleconsult; "booked 30 days ahead" → send a reminder 2 days before.
3. **Calibrate on real data** from one clinic, with consent and de-identification, and compare against a simple rule (e.g. "missed before + no reminder").
4. **WhatsApp reminders** for low-risk patients, so staff calls go only to the high-risk group.
5. **Measure causally**: a controlled pilot to show calls actually reduce no-shows, not just predict them.
