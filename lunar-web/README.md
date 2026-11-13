# Lunar Navigator website

FastAPI + Plotly natural-satellite explorer powered by JPL Horizons.

## Run locally

From this directory:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://localhost:8000 for the interactive website or http://localhost:8000/docs for the API.

## Render

The repository root's `render.yaml` configures this directory as a Docker service. In Render choose **New > Blueprint** and connect this repository. This only configures deployment; it doesn't deploy automatically just by pushing code.

A live network connection to Horizons is required. This is a scientific demo, not flight-qualified navigation software.
