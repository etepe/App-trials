"""
Weather service using Open-Meteo (free, no API key required).
https://open-meteo.com/

Provides:
- Current conditions + hourly forecast
- Wind profiles at multiple altitudes (10m, 80m, 120m)
- Thermal assessment for paragliding
- Freezing level height
- UV index
- Mountain safety alerts (storm, high wind, avalanche risk)
"""
import httpx
from typing import Optional

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT = 15.0

# WMO weather codes → human-readable (Turkish)
WMO_CODES = {
    0: "Açık", 1: "Çoğunlukla açık", 2: "Parçalı bulutlu", 3: "Kapalı",
    45: "Sisli", 48: "Kırağılı sis",
    51: "Hafif çisenti", 53: "Orta çisenti", 55: "Yoğun çisenti",
    61: "Hafif yağmur", 63: "Orta yağmur", 65: "Şiddetli yağmur",
    71: "Hafif kar", 73: "Orta kar", 75: "Yoğun kar",
    80: "Hafif sağanak", 81: "Orta sağanak", 82: "Şiddetli sağanak",
    95: "Gök gürültülü fırtına", 96: "Fırtına + hafif dolu", 99: "Fırtına + şiddetli dolu",
}

# Severity levels for alerts
ALERT_CRITICAL = "critical"
ALERT_WARNING = "warning"
ALERT_INFO = "info"


def _thermal_assessment(
    temp_c: float,
    cloud_pct: float,
    wind_ms: float,
    hour: int,
) -> dict:
    """Simple thermal index for paragliding."""
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
        "best_window_start": 11 if conditions != "poor" else None,
        "best_window_end": 16 if conditions != "poor" else None,
    }


def _avalanche_risk(
    temp_c: float,
    snowfall_cm: float,
    wind_ms: float,
    slope_indicator: float = 35.0,
) -> dict:
    """
    Simple avalanche risk assessment based on weather conditions.
    Real avalanche forecasting requires snowpack analysis — this is an approximation.
    """
    risk_score = 0.0

    # Recent heavy snowfall increases risk significantly
    if snowfall_cm > 30:
        risk_score += 4
    elif snowfall_cm > 15:
        risk_score += 3
    elif snowfall_cm > 5:
        risk_score += 2
    elif snowfall_cm > 0:
        risk_score += 1

    # Rapid warming (temp near 0°C with recent snow)
    if -2 <= temp_c <= 3 and snowfall_cm > 0:
        risk_score += 2

    # Strong wind causes wind slab formation
    if wind_ms > 15:
        risk_score += 3
    elif wind_ms > 10:
        risk_score += 2
    elif wind_ms > 6:
        risk_score += 1

    # Map to 1-5 European Avalanche Danger Scale
    if risk_score >= 8:
        level = 5
        label = "Çok yüksek"
        description = "Kendiliğinden büyük çığlar beklenir"
    elif risk_score >= 6:
        level = 4
        label = "Yüksek"
        description = "Zayıf tetiklemelerle bile çığ olası"
    elif risk_score >= 4:
        level = 3
        label = "Belirgin"
        description = "Dikkatli rota seçimi gerekli"
    elif risk_score >= 2:
        level = 2
        label = "Orta"
        description = "Dik yamaçlarda dikkatli olun"
    else:
        level = 1
        label = "Düşük"
        description = "Genel olarak güvenli koşullar"

    return {
        "level": level,
        "label": label,
        "description": description,
        "risk_score": round(risk_score, 1),
    }


def _generate_alerts(
    current: dict,
    hourly: dict,
    daily: dict,
) -> list[dict]:
    """Generate mountain safety alerts from weather data."""
    alerts = []

    # --- Storm alert ---
    weather_code = current.get("weather_code", 0)
    if weather_code >= 95:
        alerts.append({
            "type": "storm",
            "severity": ALERT_CRITICAL,
            "title": "Fırtına Uyarısı",
            "message": f"Aktif gök gürültülü fırtına. Zirve ve sırtlardan uzak durun.",
            "icon": "thunderstorm",
        })
    elif weather_code >= 80:
        alerts.append({
            "type": "heavy_rain",
            "severity": ALERT_WARNING,
            "title": "Şiddetli Yağış",
            "message": "Şiddetli sağanak yağış. Sel ve heyelan riski.",
            "icon": "rain",
        })

    # --- High wind alert ---
    wind_gusts = current.get("wind_gusts_10m", 0) or 0
    wind_speed = current.get("wind_speed_10m", 0) or 0
    if wind_gusts > 25:  # > 90 km/h
        alerts.append({
            "type": "extreme_wind",
            "severity": ALERT_CRITICAL,
            "title": "Aşırı Rüzgar",
            "message": f"Rüzgar hızı {round(wind_gusts * 3.6)} km/h. Dışarı çıkmayın.",
            "icon": "wind",
        })
    elif wind_gusts > 15:  # > 54 km/h
        alerts.append({
            "type": "high_wind",
            "severity": ALERT_WARNING,
            "title": "Kuvvetli Rüzgar",
            "message": f"Rüzgar hızı {round(wind_gusts * 3.6)} km/h. Sırt ve zirvelerde dikkat.",
            "icon": "wind",
        })

    # --- Freezing level ---
    freezing_height = current.get("freezinglevel_height")
    if freezing_height is not None and freezing_height < 1500:
        alerts.append({
            "type": "low_freezing",
            "severity": ALERT_WARNING,
            "title": "Düşük Donma Seviyesi",
            "message": f"Donma seviyesi {round(freezing_height)}m. Buzlanma ve kar riski.",
            "icon": "snowflake",
        })

    # --- UV alert ---
    uv_index = current.get("uv_index", 0) or 0
    if uv_index >= 8:
        alerts.append({
            "type": "uv_extreme",
            "severity": ALERT_WARNING,
            "title": "Çok Yüksek UV",
            "message": f"UV indeks {round(uv_index, 1)}. Güneş koruması şart.",
            "icon": "sun",
        })
    elif uv_index >= 6:
        alerts.append({
            "type": "uv_high",
            "severity": ALERT_INFO,
            "title": "Yüksek UV",
            "message": f"UV indeks {round(uv_index, 1)}. Güneş kremi ve şapka kullanın.",
            "icon": "sun",
        })

    # --- Visibility alert ---
    visibility = current.get("visibility")
    if visibility is not None and visibility < 1000:
        alerts.append({
            "type": "low_visibility",
            "severity": ALERT_WARNING,
            "title": "Düşük Görüş Mesafesi",
            "message": f"Görüş mesafesi {round(visibility)}m. Navigasyon zorlaşabilir.",
            "icon": "fog",
        })

    # --- Snowfall check from daily ---
    daily_snowfall = daily.get("snowfall_sum", [])
    if daily_snowfall and daily_snowfall[0] and daily_snowfall[0] > 10:
        alerts.append({
            "type": "heavy_snow",
            "severity": ALERT_WARNING,
            "title": "Yoğun Kar Yağışı",
            "message": f"Bugün {round(daily_snowfall[0], 1)} cm kar bekleniyor.",
            "icon": "snow",
        })

    return alerts


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
            "relative_humidity_2m",
            "apparent_temperature",
            "visibility",
            "uv_index",
            "freezinglevel_height",
            "is_day",
        ],
        "hourly": [
            "temperature_2m",
            "wind_speed_10m",
            "wind_speed_80m",
            "wind_speed_120m",
            "wind_direction_10m",
            "wind_direction_80m",
            "wind_direction_120m",
            "wind_gusts_10m",
            "precipitation",
            "precipitation_probability",
            "snowfall",
            "cloud_cover",
            "visibility",
            "uv_index",
            "freezinglevel_height",
            "temperature_80m",
            "temperature_120m",
            "cape",
        ],
        "daily": [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "sunrise",
            "sunset",
            "uv_index_max",
            "precipitation_sum",
            "snowfall_sum",
            "wind_speed_10m_max",
            "wind_gusts_10m_max",
            "wind_direction_10m_dominant",
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
    daily = data.get("daily", {})

    # Build hourly list
    times = hourly.get("time", [])
    hourly_list = [
        {
            "time": times[i],
            "temperature_c": hourly["temperature_2m"][i],
            "wind_speed_ms": hourly["wind_speed_10m"][i],
            "wind_speed_80m_ms": hourly.get("wind_speed_80m", [None] * len(times))[i],
            "wind_speed_120m_ms": hourly.get("wind_speed_120m", [None] * len(times))[i],
            "wind_direction_deg": hourly["wind_direction_10m"][i],
            "wind_direction_80m_deg": hourly.get("wind_direction_80m", [None] * len(times))[i],
            "wind_direction_120m_deg": hourly.get("wind_direction_120m", [None] * len(times))[i],
            "wind_gusts_ms": hourly.get("wind_gusts_10m", [None] * len(times))[i],
            "precipitation_mm": hourly["precipitation"][i],
            "precipitation_probability_pct": hourly.get("precipitation_probability", [None] * len(times))[i],
            "snowfall_cm": hourly.get("snowfall", [None] * len(times))[i],
            "cloud_cover_pct": hourly["cloud_cover"][i],
            "visibility_m": hourly.get("visibility", [None] * len(times))[i],
            "uv_index": hourly.get("uv_index", [None] * len(times))[i],
            "freezing_level_m": hourly.get("freezinglevel_height", [None] * len(times))[i],
            "temp_80m_c": hourly.get("temperature_80m", [None] * len(times))[i],
            "temp_120m_c": hourly.get("temperature_120m", [None] * len(times))[i],
            "cape": hourly.get("cape", [None] * len(times))[i],
        }
        for i in range(len(times))
    ]

    # Build daily list
    daily_times = daily.get("time", [])
    daily_list = [
        {
            "date": daily_times[i],
            "weather_code": daily.get("weather_code", [None] * len(daily_times))[i],
            "weather_description": WMO_CODES.get(daily.get("weather_code", [0] * len(daily_times))[i], ""),
            "temp_max_c": daily.get("temperature_2m_max", [None] * len(daily_times))[i],
            "temp_min_c": daily.get("temperature_2m_min", [None] * len(daily_times))[i],
            "sunrise": daily.get("sunrise", [None] * len(daily_times))[i],
            "sunset": daily.get("sunset", [None] * len(daily_times))[i],
            "uv_index_max": daily.get("uv_index_max", [None] * len(daily_times))[i],
            "precipitation_sum_mm": daily.get("precipitation_sum", [None] * len(daily_times))[i],
            "snowfall_sum_cm": daily.get("snowfall_sum", [None] * len(daily_times))[i],
            "wind_speed_max_ms": daily.get("wind_speed_10m_max", [None] * len(daily_times))[i],
            "wind_gusts_max_ms": daily.get("wind_gusts_10m_max", [None] * len(daily_times))[i],
            "wind_direction_dominant_deg": daily.get("wind_direction_10m_dominant", [None] * len(daily_times))[i],
        }
        for i in range(len(daily_times))
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

    # Avalanche risk from today's snowfall and current conditions
    today_snowfall = daily.get("snowfall_sum", [0])[0] or 0
    avalanche = _avalanche_risk(
        temp_c=current.get("temperature_2m", 15),
        snowfall_cm=today_snowfall,
        wind_ms=current.get("wind_speed_10m", 5),
    )

    # Generate alerts
    alerts = _generate_alerts(current, hourly, daily)

    return {
        "lat": lat,
        "lon": lon,
        "elevation_m": elevation,
        "current": {
            "temperature_c": current.get("temperature_2m"),
            "feels_like_c": current.get("apparent_temperature"),
            "humidity_pct": current.get("relative_humidity_2m"),
            "wind_speed_ms": current.get("wind_speed_10m"),
            "wind_direction_deg": current.get("wind_direction_10m"),
            "wind_gusts_ms": current.get("wind_gusts_10m"),
            "pressure_hpa": current.get("surface_pressure"),
            "cloud_cover_pct": current.get("cloud_cover"),
            "weather_code": current.get("weather_code"),
            "weather_description": WMO_CODES.get(current.get("weather_code", 0), "Bilinmeyen"),
            "visibility_m": current.get("visibility"),
            "uv_index": current.get("uv_index"),
            "freezing_level_m": current.get("freezinglevel_height"),
            "is_day": current.get("is_day", 1) == 1,
        },
        "hourly": hourly_list,
        "daily": daily_list,
        "thermals": thermals,
        "avalanche_risk": avalanche,
        "alerts": alerts,
    }
