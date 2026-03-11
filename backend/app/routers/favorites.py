from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

from app.database import get_db

router = APIRouter()


class FavoriteCreate(BaseModel):
    osm_id: str
    name: str
    lat: float
    lon: float
    elevation: Optional[float] = None
    type: str = "peak"
    notes: str = ""


class Favorite(FavoriteCreate):
    id: int
    created_at: str


@router.post("", response_model=Favorite, status_code=201)
async def add_favorite(body: FavoriteCreate):
    """Add a mountain peak to favorites."""
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM favorites WHERE osm_id = ?", (body.osm_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Already in favorites")
        conn.execute(
            """INSERT INTO favorites (osm_id, name, lat, lon, elevation, type, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (body.osm_id, body.name, body.lat, body.lon, body.elevation, body.type, body.notes),
        )
        row = conn.execute(
            "SELECT * FROM favorites WHERE osm_id = ?", (body.osm_id,)
        ).fetchone()
    return dict(row)


@router.get("", response_model=List[Favorite])
async def list_favorites():
    """List all favorite peaks."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM favorites ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.delete("/{osm_id}", status_code=204)
async def remove_favorite(osm_id: str):
    """Remove a peak from favorites."""
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM favorites WHERE osm_id = ?", (osm_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")


@router.get("/check/{osm_id}")
async def check_favorite(osm_id: str):
    """Check if a peak is in favorites."""
    with get_db() as conn:
        row = conn.execute("SELECT id FROM favorites WHERE osm_id = ?", (osm_id,)).fetchone()
    return {"is_favorite": row is not None}
