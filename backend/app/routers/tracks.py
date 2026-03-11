from fastapi import APIRouter, HTTPException
from typing import List

from app.models.track import Track, TrackCreate

router = APIRouter()

# In-memory store for demonstration. Replace with a real DB in production.
_tracks: dict[str, Track] = {}


@router.post("", response_model=Track, status_code=201)
async def create_track(body: TrackCreate):
    """Store a parsed GPS track with its GeoJSON geometry."""
    track = Track(**body.model_dump())
    _tracks[track.id] = track
    return track


@router.get("", response_model=List[Track])
async def list_tracks():
    """List all stored tracks (sorted newest first by date)."""
    return sorted(_tracks.values(), key=lambda t: t.date, reverse=True)


@router.get("/{track_id}", response_model=Track)
async def get_track(track_id: str):
    if track_id not in _tracks:
        raise HTTPException(status_code=404, detail="Track not found")
    return _tracks[track_id]


@router.delete("/{track_id}", status_code=204)
async def delete_track(track_id: str):
    if track_id not in _tracks:
        raise HTTPException(status_code=404, detail="Track not found")
    del _tracks[track_id]
