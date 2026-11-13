from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .catalog import BODIES
from .horizons_service import get_state, get_trajectory, get_orbital_elements

app = FastAPI(
    title="Lunar & Natural Satellite Navigation API",
    version="1.0.0",
    description="Ephemeris reference data and derived state-vector calculations from JPL Horizons.",
)

# Restrict this list to your actual frontend origins before deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "name": "Lunar Navigation API",
        "docs": "/docs",
        "body_catalog": "/api/bodies",
    }

@app.get("/api/bodies")
def list_bodies():
    return [
        {
            "key": key,
            "name": body["name"],
            "parent": body["parent"],
            "horizons_id": body["id"],
        }
        for key, body in BODIES.items()
    ]

@app.get("/api/ephemeris/{body_key}")
def ephemeris(body_key: str, epoch: str | None = Query(default=None)):
    try:
        return get_state(body_key, epoch)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown body. See /api/bodies.")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Horizons query failed: {exc}")

@app.get("/api/trajectory/{body_key}")
def trajectory(
    body_key: str,
    start: str,
    stop: str,
    step: str = "10m",
):
    try:
        return get_trajectory(body_key, start, stop, step)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown body. See /api/bodies.")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Horizons query failed: {exc}")

@app.get("/api/orbit/{body_key}")
def orbit(body_key: str, epoch: str | None = Query(default=None)):
    try:
        return get_orbital_elements(body_key, epoch)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown body. See /api/bodies.")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Horizons query failed: {exc}")
