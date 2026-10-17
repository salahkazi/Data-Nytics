# Data-Nytics — full project starter

React + Vite frontend and FastAPI backend for CSV/Excel/JSON upload, dataset profiling, interactive charts, preview editing, and report export.

## Run backend
```bash
cd backend
python -m venv .venv
# activate the environment, then:
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
API docs: http://127.0.0.1:8000/docs

## Run frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://127.0.0.1:5173

Current limitations: dataset storage is in memory; authentication, persistent PostgreSQL storage, LLM agents, forecasting, and production deployment are not implemented in this starter. Do not use with sensitive data before adding security controls.
