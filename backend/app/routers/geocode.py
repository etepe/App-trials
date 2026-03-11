from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional

from app.services.geocoding_service import GeocodingResult, geocode_search, reverse_geocode

router = APIRouter()


@router.get("/search", response_model=List[GeocodingResult])
async def search_places(
    q: str = Query(..., min_length=1, max_length=200, description="Place name to search"),
    limit: int = Query(10, ge=1, le=20, description="Maximum results"),
    lang: str = Query("tr", max_length=5, description="Language code"),
):
    """Search for places by name using geocoding (Nominatim)."""
    try:
        results = await geocode_search(q, limit=limit, language=lang)
        return results
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Geocoding error: {e}")


@router.get("/reverse", response_model=Optional[GeocodingResult])
async def reverse_geocode_endpoint(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    lang: str = Query("tr", max_length=5),
):
    """Get place name from coordinates (reverse geocoding)."""
    try:
        result = await reverse_geocode(lat, lon, language=lang)
        if not result:
            raise HTTPException(status_code=404, detail="No place found at these coordinates")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Reverse geocoding error: {e}")
