from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import mountains, terrain, weather, tracks

app = FastAPI(
    title="Mountain Explorer API",
    version="1.0.0",
    description="Backend for the 3D Mountain Explorer mobile app",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mountains.router, prefix="/mountains", tags=["mountains"])
app.include_router(terrain.router, prefix="/terrain", tags=["terrain"])
app.include_router(weather.router, prefix="/weather", tags=["weather"])
app.include_router(tracks.router, prefix="/tracks", tags=["tracks"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
