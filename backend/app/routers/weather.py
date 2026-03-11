from fastapi import APIRouter, Query, HTTPException
from app.services.weather_service import fetch_weather

router = APIRouter()


@router.get("")
async def get_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    elevation: float = Query(0, ge=-500, le=9000, description="Elevation in meters (improves forecast accuracy)"),
    days: int = Query(3, ge=1, le=7),
):
    """
    Get comprehensive weather forecast for a coordinate.
    Includes: current conditions, hourly/daily forecast, wind profiles at multiple altitudes,
    thermal assessment, avalanche risk, UV index, freezing level, and safety alerts.
    Uses Open-Meteo (free, no API key required).
    """
    try:
        return await fetch_weather(lat, lon, elevation, days)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather service error: {e}")


@router.get("/alerts")
async def get_weather_alerts(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    elevation: float = Query(0, ge=-500, le=9000),
):
    """
    Get only the safety alerts for a coordinate (lighter endpoint).
    Returns storm, wind, avalanche, UV, visibility alerts.
    """
    try:
        data = await fetch_weather(lat, lon, elevation, days=1)
        return {
            "lat": lat,
            "lon": lon,
            "alerts": data.get("alerts", []),
            "avalanche_risk": data.get("avalanche_risk"),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather service error: {e}")
