from datetime import datetime, timezone
import math
from pathlib import Path
from astropy.time import Time
from astroquery.jplhorizons import Horizons
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from .landing import router as landing_router

AU_KM = 149597870.7
BODIES = {
 "moon": ("Earth's Moon","301","Earth","500@399"),
 "phobos": ("Phobos","401","Mars","500@499"),
 "deimos": ("Deimos","402","Mars","500@499"),
 "io": ("Io","501","Jupiter","500@599"),
 "europa": ("Europa","502","Jupiter","500@599"),
 "ganymede": ("Ganymede","503","Jupiter","500@599"),
 "callisto": ("Callisto","504","Jupiter","500@599"),
 "enceladus": ("Enceladus","602","Saturn","500@699"),
 "titan": ("Titan","606","Saturn","500@699"),
 "triton": ("Triton","801","Neptune","500@899"),
}
app = FastAPI(title="Lunar Navigation Explorer")
app.include_router(landing_router)
INDEX = Path(__file__).parent.parent / "static" / "index.html"
SURFACE = Path(__file__).parent.parent / "static" / "surface.html"
LANDING = Path(__file__).parent.parent / "static" / "landing.html"

@app.get("/")
def home():
    return FileResponse(INDEX)

@app.get("/surface")
def surface():
    return FileResponse(SURFACE)

@app.get("/landing")
def landing():
    return FileResponse(LANDING)

@app.get("/health")
def health():
    return {"status":"ok"}

@app.get("/api/bodies")
def bodies():
    return [{"key":k,"name":v[0],"parent":v[2]} for k,v in BODIES.items()]

def lookup(key):
    body = BODIES.get(key)
    if not body:
        raise HTTPException(404, "Unknown moon")
    return body

def sample(row):
    p=[float(row[a])*AU_KM for a in ("x","y","z")]
    v=[float(row[a])*AU_KM/86400 for a in ("vx","vy","vz")]
    radius=math.sqrt(sum(x*x for x in p))
    speed=math.sqrt(sum(x*x for x in v))
    radial=sum(x*y for x,y in zip(p,v))/radius if radius else 0.0
    return {"position_km":p,"velocity_km_s":v,"distance_km":radius,
            "speed_km_s":speed,"radial_speed_km_s":radial}

def query(key,epochs):
    name,ident,parent,center=lookup(key)
    try:
        table=Horizons(id=ident,location=center,epochs=epochs).vectors(refplane="earth")
    except Exception as exc:
        raise HTTPException(502,"JPL Horizons query failed") from exc
    return name,parent,table

@app.get("/api/state/{key}")
def state(key:str,epoch:str|None=None):
    try:
        t=Time(epoch) if epoch else Time(datetime.now(timezone.utc))
    except Exception as exc:
        raise HTTPException(400,"Invalid epoch") from exc
    name,parent,table=query(key,float(t.tdb.jd))
    return {"name":name,"parent":parent,"epoch_utc":t.utc.isot,
            "frame":"Parent-centered, ICRF-aligned equatorial",
            **sample(table[0])}

@app.get("/api/trajectory/{key}")
def trajectory(key:str,start:str,stop:str,step_minutes:int=Query(60,ge=1,le=1440)):
    try:
        a,b=Time(start),Time(stop)
        duration=(b-a).to_value("min")
        if not 0 < duration <= 44640 or duration/step_minutes>300:
            raise ValueError()
    except Exception as exc:
        raise HTTPException(400,"Provide valid start/stop (max 31 days, 301 samples)") from exc
    name,parent,table=query(key,{"start":a.utc.strftime("%Y-%m-%d %H:%M"),
                                 "stop":b.utc.strftime("%Y-%m-%d %H:%M"),
                                 "step":f"{step_minutes}m"})
    return {"name":name,"parent":parent,"frame":"Parent-centered, ICRF-aligned equatorial",
            "points":[{"epoch_jd_tdb":float(row["datetime_jd"]),**sample(row)} for row in table],
            "source":"NASA/JPL Horizons via astroquery"}
