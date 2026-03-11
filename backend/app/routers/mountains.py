from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional

from app.models.mountain import Mountain
from app.services.overpass_service import search_peaks, search_peaks_by_name, get_peak

router = APIRouter()


@router.get("/search", response_model=List[Mountain])
async def search_mountains(
    lat: float = Query(..., description="Center latitude"),
    lon: float = Query(..., description="Center longitude"),
    radius_km: float = Query(25, ge=1, le=100, description="Search radius in km"),
    query: Optional[str] = Query(None, description="Name filter"),
):
    """Search for mountain peaks near a coordinate using OpenStreetMap Overpass API."""
    mountains = await search_peaks(lat, lon, radius_km, query)
    return mountains


@router.get("/search/global", response_model=List[Mountain])
async def search_mountains_global(
    query: str = Query(..., min_length=2, description="Peak name to search globally"),
):
    """Search for mountain peaks by name globally (no location constraint)."""
    mountains = await search_peaks_by_name(query)
    return mountains


@router.get("/{osm_id}", response_model=Mountain)
async def get_mountain(osm_id: str):
    """Get details for a specific mountain peak by OSM ID."""
    mountain = await get_peak(osm_id)
    if not mountain:
        raise HTTPException(status_code=404, detail="Mountain not found")
    return mountain
