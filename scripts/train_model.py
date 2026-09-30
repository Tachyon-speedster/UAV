import pandas as pd
import numpy as np
import json
import os
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from xgboost import XGBClassifier

OUT = "results"
MODELS_OUT = "public/models"
os.makedirs(OUT, exist_ok=True)
os.makedirs(MODELS_OUT, exist_ok=True)

df = pd.read_csv("dataset/uav_piston_engine_dataset.csv")
print(f"Loaded {len(df):,} rows across {df.run_id.nunique():,} runs")

gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
train_idx, test_idx = next(gss.split(df, groups=df["run_id"]))
train_df, test_df = df.iloc[train_idx].copy(), df.iloc[test_idx].copy()

le = LabelEncoder()
y_train = le.fit_transform(train_df["fault_type"])
y_test = le.transform(test_df["fault_type"])
class_names = list(le.classes_)
print("Classes (in ONNX output order):", class_names)

RAW_FEATURES = [
    "rpm", "egt", "cht", "oil_pressure", "oil_temperature", "fuel_flow",
    "vibration", "throttle_cmd", "altitude_ft", "ambient_temp_c",
]
RESIDUAL_COLS = ["residual_rpm", "residual_egt", "residual_cht", "residual_oil_pressure", "residual_vibration"]
PHYSICS_FEATURES = RAW_FEATURES + RESIDUAL_COLS + ["twin_sync_pct"]
print("Feature order (must match browser inference exactly):", PHYSICS_FEATURES)

RESIDUAL_SCALE = {"rpm": 400, "egt": 60, "cht": 45, "oil_pressure": 25, "vibration": 3}

def noisy_copy(base_df, frac, seed):
    rng = np.random.default_rng(seed)
    g = base_df.copy()
    for ch in RESIDUAL_SCALE:
        sigma = frac * RESIDUAL_SCALE[ch]
        delta = rng.normal(0, sigma, size=len(g)) if sigma > 0 else 0
        g[ch] = g[ch] + delta
        g[f"residual_{ch}"] = g[f"residual_{ch}"] + delta
    return g

def augmented_training_set(base_df, levels, seed_base=100):
    parts = [noisy_copy(base_df, frac, seed=seed_base + i) for i, frac in enumerate(levels)]
    return pd.concat(parts, ignore_index=True)

TRAIN_NOISE_LEVELS = [0.0, 0.15, 0.3, 0.5]

train_aug = augmented_training_set(train_df, TRAIN_NOISE_LEVELS)
y_train_aug = np.tile(y_train, len(TRAIN_NOISE_LEVELS))

model = XGBClassifier(
    n_estimators=300, max_depth=6, learning_rate=0.1,
    subsample=0.9, colsample_bytree=0.9,
    objective="multi:softprob", eval_metric="mlogloss",
    random_state=42, n_jobs=-1,
)
# Fit on plain numpy arrays (not a DataFrame) so XGBoost's internal feature
# names default to f0..fN, which onnxmltools' converter requires.
X_train_aug = train_aug[PHYSICS_FEATURES].to_numpy(dtype=np.float32)
model.fit(X_train_aug, y_train_aug)

X_test = test_df[PHYSICS_FEATURES].to_numpy(dtype=np.float32)
pred = model.predict(X_test)
acc = accuracy_score(y_test, pred)
prec, rec, f1, support = precision_recall_fscore_support(y_test, pred, labels=range(len(class_names)), zero_division=0)
print(f"\nClean test accuracy: {acc*100:.2f}%")
for i, cname in enumerate(class_names):
    print(f"  {cname:26s} precision={prec[i]*100:5.1f}%  recall={rec[i]*100:5.1f}%  f1={f1[i]*100:5.1f}%")

# Noise-robustness check (sanity, not exhaustive re-plot here — see report for full figures)
for frac in [0.0, 0.3, 0.6, 1.0]:
    test_noisy = noisy_copy(test_df, frac, seed=int(frac * 1000) + 1)
    a = accuracy_score(y_test, model.predict(test_noisy[PHYSICS_FEATURES].to_numpy(dtype=np.float32)))
    print(f"  noise={frac*100:4.0f}%  accuracy={a*100:5.1f}%")

# ---------------------------------------------------------------------------
# Export to ONNX for browser (onnxruntime-web) inference — this is what makes
# the dashboard's live ML panel and CSV-import feature actually run the real
# trained model, client-side, with no backend.
# ---------------------------------------------------------------------------
from onnxmltools.convert import convert_xgboost
from onnxmltools.convert.common.data_types import FloatTensorType

initial_type = [("input", FloatTensorType([None, len(PHYSICS_FEATURES)]))]
onnx_model = convert_xgboost(model, initial_types=initial_type)
onnx_path = f"{MODELS_OUT}/fault_classifier.onnx"
with open(onnx_path, "wb") as f:
    f.write(onnx_model.SerializeToString())
print(f"\nSaved ONNX model: {onnx_path} ({os.path.getsize(onnx_path)/1024:.1f} KB)")

# Metadata the browser needs: exact feature order + class label order.
with open(f"{MODELS_OUT}/model_meta.json", "w") as f:
    json.dump({
        "featureOrder": PHYSICS_FEATURES,
        "classLabels": class_names,
        "modelType": "xgboost-multiclass",
        "trainedOn": "uav_piston_engine_dataset.csv (323,100 rows, noise-augmented)",
        "testAccuracyClean": round(acc * 100, 2),
    }, f, indent=2)
print(f"Saved metadata: {MODELS_OUT}/model_meta.json")

# ---------------------------------------------------------------------------
# Verify the ONNX model gives the same predictions as the sklearn model
# (sanity check before trusting it in the browser).
# ---------------------------------------------------------------------------
import onnxruntime as ort
sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
sample = test_df[PHYSICS_FEATURES].iloc[:200].to_numpy().astype(np.float32)
onnx_pred = sess.run(None, {"input": sample})[0]
sklearn_pred = model.predict(sample)
match = (onnx_pred == sklearn_pred).mean()
print(f"ONNX vs sklearn prediction agreement on 200-row sample: {match*100:.1f}%")

with open(f"{OUT}/metrics_summary.txt", "w") as f:
    f.write("UAV-DT ML Model — Training & ONNX Export Summary\n")
    f.write("=" * 55 + "\n\n")
    f.write(f"Dataset: {len(df):,} rows, {df.run_id.nunique():,} runs\n")
    f.write(f"Clean test accuracy: {acc*100:.2f}%\n")
    f.write(f"ONNX vs sklearn agreement: {match*100:.1f}%\n")
    f.write(f"Feature order: {PHYSICS_FEATURES}\n")
    f.write(f"Class order: {class_names}\n")

print("\nDone.")
