"""
Weather service using Open-Meteo (free, no API key required).
https://open-meteo.com/
"""
import httpx
from typing import Optional

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT = 15.0

# WMO weather codes → human-readable
WMO_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm + slight hail", 99: "Thunderstorm + heavy hail",
}


def _thermal_assessment(
    temp_c: float,
    cloud_pct: float,
    wind_ms: float,
    hour: int,
) -> dict:
    """Simple thermal index for paragliding."""
    # Thermals are best: afternoon (11-16 local), warm, low clouds, light wind
    time_score = max(0.0, 1.0 - abs(hour - 13.5) / 6.0)
    temp_score = min(1.0, max(0.0, (temp_c - 5) / 25))
    cloud_score = max(0.0, 1.0 - cloud_pct / 100)
    wind_score = max(0.0, 1.0 - wind_ms / 12)

    index = round((time_score * 3 + temp_score * 3 + cloud_score * 2 + wind_score * 2) / 10 * 10)

    if index >= 7:
        conditions = "excellent"
    elif index >= 5:
        conditions = "good"
    elif index >= 3:
        conditions = "moderate"
    else:
        conditions = "poor"

    return {
        "thermal_index": index,
        "conditions": conditions,
        "thermal_height_m": max(300, temp_c * 80) if conditions != "poor" else None,
    }


async def fetch_weather(lat: float, lon: float, elevation: float, days: int) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "wind_speed_10m",
            "wind_direction_10m",
            "wind_gusts_10m",
            "surface_pressure",
            "cloud_cover",
            "weather_code",
        ],
        "hourly": [
            "temperature_2m",
            "wind_speed_10m",
            "wind_direction_10m",
            "precipitation",
            "cloud_cover",
        ],
        "forecast_days": days,
        "wind_speed_unit": "ms",
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    current = data.get("current", {})
    hourly = data.get("hourly", {})

    # Build hourly list
    times = hourly.get("time", [])
    hourly_list = [
        {
            "time": times[i],
            "temperature_c": hourly["temperature_2m"][i],
            "wind_speed_ms": hourly["wind_speed_10m"][i],
            "wind_direction_deg": hourly["wind_direction_10m"][i],
            "precipitation_mm": hourly["precipitation"][i],
            "cloud_cover_pct": hourly["cloud_cover"][i],
        }
        for i in range(len(times))
    ]

    # Get current hour for thermal assessment
    current_time_str = current.get("time", "T12:00")
    try:
        current_hour = int(current_time_str.split("T")[1][:2])
    except (IndexError, ValueError):
        current_hour = 12

    thermals = _thermal_assessment(
        temp_c=current.get("temperature_2m", 15),
        cloud_pct=current.get("cloud_cover", 50),
        wind_ms=current.get("wind_speed_10m", 5),
        hour=current_hour,
    )

    return {
        "lat": lat,
        "lon": lon,
        "elevation_m": elevation,
        "current": {
            "temperature_c": current.get("temperature_2m"),
            "wind_speed_ms": current.get("wind_speed_10m"),
            "wind_direction_deg": current.get("wind_direction_10m"),
            "wind_gusts_ms": current.get("wind_gusts_10m"),
            "pressure_hpa": current.get("surface_pressure"),
            "cloud_cover_pct": current.get("cloud_cover"),
            "weather_code": current.get("weather_code"),
            "weather_description": WMO_CODES.get(current.get("weather_code", 0), "Unknown"),
        },
        "hourly": hourly_list[:48],  # 48h max
        "thermals": thermals,
    }
