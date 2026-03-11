from fastapi import APIRouter, Query, HTTPException
from app.services.weather_service import fetch_weather

router = APIRouter()


@router.get("")
async def get_weather(
    lat: float = Query(...),
    lon: float = Query(...),
    elevation: float = Query(0, description="Elevation in meters (improves forecast accuracy)"),
    days: int = Query(3, ge=1, le=7),
):
    """
    Get weather forecast for a coordinate.
    Includes current conditions, hourly forecast, and paragliding thermal assessment.
    Uses Open-Meteo (free, no API key required).
    """
    try:
        return await fetch_weather(lat, lon, elevation, days)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather service error: {e}")
