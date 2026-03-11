from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional

from app.models.mountain import Mountain
from app.services.overpass_service import search_peaks, search_peaks_by_name, get_peak

router = APIRouter()


@router.get("/search", response_model=List[Mountain])
async def search_mountains(
    lat: float = Query(..., ge=-90, le=90, description="Center latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Center longitude"),
    radius_km: float = Query(25, ge=1, le=100, description="Search radius in km"),
    query: Optional[str] = Query(None, max_length=100, description="Name filter"),
):
    """Search for mountain peaks near a coordinate using OpenStreetMap Overpass API."""
    try:
        mountains = await search_peaks(lat, lon, radius_km, query)
        return mountains
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Overpass API error: {e}")


@router.get("/by-name", response_model=List[Mountain])
async def search_by_name(
    name: str = Query(..., min_length=1, max_length=100, description="Peak name to search"),
    limit: int = Query(20, ge=1, le=50, description="Max results"),
):
    """Search for mountain peaks globally by name (no coordinates needed)."""
    try:
        mountains = await search_peaks_by_name(name, limit)
        return mountains
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Overpass API error: {e}")


@router.get("/{osm_id}", response_model=Mountain)
async def get_mountain(osm_id: str):
    """Get details for a specific mountain peak by OSM ID."""
    mountain = await get_peak(osm_id)
    if not mountain:
        raise HTTPException(status_code=404, detail="Mountain not found")
    return mountain
