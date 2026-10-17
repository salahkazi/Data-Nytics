from __future__ import annotations
from io import BytesIO
from uuid import uuid4
from typing import Any
import pandas as pd
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Data-Nytics API", version="1.0.0", description="Dataset profiling and analytics API for Data-Nytics.")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
DATASETS: dict[str, pd.DataFrame] = {}

def json_safe(v: Any):
    if pd.isna(v): return None
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)): return float(v) if np.isfinite(v) else None
    if isinstance(v, (np.bool_,)): return bool(v)
    if hasattr(v, "isoformat"): return v.isoformat()
    return v

def profile_df(df: pd.DataFrame):
    nrows, ncols = df.shape
    colnames = [str(c) for c in df.columns]
    missing = int(df.isna().sum().sum())
    numeric = [str(c) for c in df.select_dtypes(include=[np.number]).columns]
    text = [str(c) for c in df.columns if str(c) not in numeric]
    columns = []
    for c in df.columns:
        s = df[c]
        columns.append({"name": str(c), "dtype": str(s.dtype), "missing": int(s.isna().sum()), "missing_percent": round(float(s.isna().mean()*100), 2) if nrows else 0, "unique": int(s.nunique(dropna=True)), "sample": [json_safe(x) for x in s.dropna().head(3).tolist()]})
    return {"profile": {"rows": nrows, "columns": ncols, "column_names": colnames, "missing_values": missing, "missing_percentage": round(missing/(nrows*ncols)*100, 2) if nrows*ncols else 0, "duplicate_rows": int(df.duplicated().sum()), "memory_usage_bytes": int(df.memory_usage(deep=True).sum())}, "columns": {"numeric_columns": numeric, "text_columns": text, "details": columns}, "data": [{str(k): json_safe(v) for k,v in row.items()} for row in df.head(5000).to_dict(orient="records")]}

@app.get("/")
def root(): return {"name":"Data-Nytics API", "status":"ok", "docs":"/docs"}
@app.get("/health")
def health(): return {"status":"healthy"}
@app.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    name = (file.filename or "dataset.csv").lower()
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024: raise HTTPException(413, "File too large. Maximum size is 25 MB.")
    try:
        if name.endswith(".csv"):
            try: df = pd.read_csv(BytesIO(raw))
            except UnicodeDecodeError: df = pd.read_csv(BytesIO(raw), encoding="latin-1")
        elif name.endswith((".xlsx", ".xls")): df = pd.read_excel(BytesIO(raw))
        elif name.endswith(".json"): df = pd.read_json(BytesIO(raw))
        else: raise HTTPException(415, "Supported formats: CSV, XLSX, XLS, JSON.")
    except HTTPException: raise
    except Exception as e: raise HTTPException(400, f"Could not read dataset: {e}")
    if df.empty: raise HTTPException(400, "The uploaded dataset is empty.")
    df.columns = [str(c) for c in df.columns]
    df = df.replace({np.nan: None})
    dataset_id = str(uuid4())
    DATASETS[dataset_id] = df
    return {"dataset_id": dataset_id, "filename": file.filename, **profile_df(df)}

class DatasetUpdate(BaseModel):
    data: list[dict[str, Any]]

@app.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    df = DATASETS.get(dataset_id)
    if df is None: raise HTTPException(404, "Dataset not found. Upload it again if the API server restarted.")
    return {"dataset_id": dataset_id, **profile_df(df)}

@app.put("/datasets/{dataset_id}")
def update_dataset(dataset_id: str, payload: DatasetUpdate):
    if dataset_id not in DATASETS: raise HTTPException(404, "Dataset not found.")
    try: df = pd.DataFrame(payload.data)
    except Exception as e: raise HTTPException(400, str(e))
    DATASETS[dataset_id] = df
    return {"dataset_id": dataset_id, **profile_df(df)}

@app.get("/datasets/{dataset_id}/download")
def download_info(dataset_id: str):
    if dataset_id not in DATASETS: raise HTTPException(404, "Dataset not found.")
    return {"dataset_id": dataset_id, "rows": len(DATASETS[dataset_id]), "columns": list(DATASETS[dataset_id].columns), "note": "Use the frontend Download Data button to export the current preview."}
