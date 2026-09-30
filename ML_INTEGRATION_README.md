# UAV-DT — ML Integration + Real-Data Import

This update adds two things on top of the existing simulation/dashboard:

1. **A real trained ML model running live in the dashboard** — not a placeholder.
2. **A CSV import feature** — bring your own sensor data (from your instrumented
   rig, a real flight log, or anywhere else) and it runs through the exact
   same digital-twin comparison, health scoring, rule-based diagnosis, and
   ML model as the live simulation.

## What's new, file by file

| File | What it does |
|---|---|
| `scripts/generateDataset.ts` | Regenerates the 323,100-row training dataset directly from the project's own simulation code (unchanged from before). |
| `scripts/train_model.py` | Trains the XGBoost fault classifier with noise augmentation, **exports it to ONNX**, and verifies the ONNX output matches the original model exactly. |
| `scripts/smoke_test.ts` | A functional test (not just a type-check) proving the real-data evaluation pipeline gives correct diagnoses on known inputs. Run with `npx tsx scripts/smoke_test.ts` — see "Verification" below. |
| `public/models/fault_classifier.onnx` | The actual trained model weights, served as a static file — no backend, no API call. |
| `public/models/model_meta.json` | Feature order + class label order the model expects — read by the browser at runtime so the JS code can never drift out of sync with how the model was trained. |
| `src/ml/mlClassifier.ts` | Loads the ONNX model in-browser via `onnxruntime-web` (WASM backend) and runs inference. Fully client-side — fits the "air-gapped GCS" architecture from the project report. |
| `src/simulation/engineSimulation.ts` | Added `evaluateMeasuredTelemetry()` — compares *real* measured telemetry against the twin's prediction, without needing a synthetic fault object. This is what makes CSV import possible without duplicating any math. |
| `src/state/SimulationContext.tsx` | Runs ML inference once per simulation tick (live mode) and exposes `mlDiagnosis` to every page. |
| `src/components/AiMlPanel.tsx` | Replaced the old "future ML layer" placeholder with a real panel: predicted class, confidence, top-3 probabilities, and a rule-based-vs-ML agreement indicator. Shown on the Diagnostics page. |
| `src/pages/ImportData.tsx` | New page — upload a CSV, watch it get analyzed row-by-row, see a health-over-time chart, a per-row results table, and export the analyzed results as CSV. |

## How the CSV import works, in one paragraph

For each row, your operating conditions (throttle/altitude/ambient temp) are
fed into the **same digital twin equations** the live simulation uses, giving
a predicted healthy baseline. Your actual sensor readings for that row are
compared against that baseline to get residuals — from there it's the exact
same pipeline as live mode: subsystem health, overall health, rule-based
diagnosis, and the ONNX model's prediction. Nothing was reimplemented
separately for imported data; it reuses the real functions.

## Required CSV columns

`throttle_cmd, altitude_ft, ambient_temp_c, rpm, egt, cht, oil_pressure, vibration`

Optional (sensible defaults used if omitted): `t, oil_temperature, fuel_flow`.
Click "Download CSV Template" on the Import Data page for a ready-made
example file in the exact expected format.

## Verification — what's been checked, and what you should check yourself

I do not have a browser in my environment, so I could not literally click
through the running app. Here's exactly what was and wasn't verified, so you
know precisely what to double-check before a live demo:

**Verified, with evidence:**
- The ONNX model's predictions match the original Python/scikit-learn model
  **exactly** (100% agreement on a 200-row held-out sample) — see
  `results/metrics_summary.txt`.
- `npx tsc -b` passes clean — no TypeScript errors anywhere in the new code.
- `npx vite build` completes with no errors and produces a working production
  bundle.
- Every asset the built JS bundle references (`.wasm` file, `.onnx` model,
  `model_meta.json`) was confirmed reachable over HTTP with correct file
  sizes, by actually serving the production build (`vite preview`) and
  `curl`-ing each URL — no 404s.
- The CSV-import evaluation pipeline (`evaluateMeasuredTelemetry` +
  `diagnose`) was functionally tested with `scripts/smoke_test.ts` against
  four hand-built scenarios (exactly-healthy, overheating, lubrication
  degradation, and an isolated sensor fault) — **all four produce the
  correct diagnosis**. Run it yourself any time with:
  ```
  npx tsx scripts/smoke_test.ts
  ```

**Not yet verified (needs a real browser — please check this before a demo):**
- That `onnxruntime-web` actually loads and runs inference correctly inside
  a real browser tab. The library is extremely widely used and the WASM
  asset was confirmed to be the correct, non-CDN, same-origin file — but I
  could not click through and watch a live prediction appear with my own
  eyes.
- **What to check:** run `npm run dev`, open the **Diagnostics** page, and
  confirm the "ML MODEL PREDICTION" panel goes from "Loading model
  weights…" to showing a real predicted class + confidence bar within a
  second or two. Open your browser's dev tools → Network tab and confirm
  `fault_classifier.onnx` and the `.wasm` file both return `200`, not `404`.
  If anything shows an error, the panel itself will display it — screenshot
  that and it'll be a fast fix.
- Then try the **Import Data** page: download the CSV template, upload it
  as-is, and confirm it produces a health chart and a results table without
  errors.

## Running it

```
npm install
npm run dev
```

Then open the printed local URL. The Diagnostics page shows the live ML
panel; the new "Import Data" entry in the sidebar is the CSV import feature.

## Retraining

If you collect real rig data and want to retrain:

```
npx tsx scripts/generateDataset.ts     # regenerates the synthetic dataset (optional, already included)
python3 scripts/train_model.py          # retrains + re-exports public/models/fault_classifier.onnx
```

Mix real rig CSVs into `dataset/uav_piston_engine_dataset.csv` (same column
schema) before retraining to get a model that's learned from real sensor
noise, not just synthetic noise augmentation.
