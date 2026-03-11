import json
import uuid
from fastapi import APIRouter, HTTPException
from typing import List

from app.models.track import Track, TrackCreate
from app.database import get_db

router = APIRouter()


@router.post("", response_model=Track, status_code=201)
async def create_track(body: TrackCreate):
    """Store a parsed GPS track with its GeoJSON geometry."""
    track_id = str(uuid.uuid4())
    geojson_str = json.dumps(body.geojson)
    with get_db() as conn:
        conn.execute(
            """INSERT INTO tracks (id, name, date, file_type, distance_m, duration_sec, max_alt_m, geojson)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (track_id, body.name, body.date, body.file_type, body.distance_m,
             body.duration_sec, body.max_alt_m, geojson_str),
        )
    return Track(id=track_id, **body.model_dump())


@router.get("", response_model=List[Track])
async def list_tracks():
    """List all stored tracks (sorted newest first by date)."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM tracks ORDER BY date DESC").fetchall()
    return [_row_to_track(r) for r in rows]


@router.get("/{track_id}", response_model=Track)
async def get_track(track_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Track not found")
    return _row_to_track(row)


@router.delete("/{track_id}", status_code=204)
async def delete_track(track_id: str):
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM tracks WHERE id = ?", (track_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Track not found")


def _row_to_track(row) -> Track:
    return Track(
        id=row["id"],
        name=row["name"],
        date=row["date"],
        file_type=row["file_type"],
        distance_m=row["distance_m"],
        duration_sec=row["duration_sec"],
        max_alt_m=row["max_alt_m"],
        geojson=json.loads(row["geojson"]),
    )
