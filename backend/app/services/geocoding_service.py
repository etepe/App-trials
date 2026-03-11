"""
Geocoding service — resolve place names to coordinates using OpenStreetMap Nominatim.
"""
import httpx
from typing import Optional, List
from pydantic import BaseModel

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
TIMEOUT = 10.0
USER_AGENT = "MountainExplorer/1.0"


class GeocodingResult(BaseModel):
    name: str
    display_name: str
    lat: float
    lon: float
    type: str
    importance: float
    bbox: Optional[List[float]] = None  # [south, north, west, east]


async def geocode_search(
    query: str,
    limit: int = 10,
    language: str = "tr",
) -> List[GeocodingResult]:
    """Search for a place by name using Nominatim."""
    query = query.strip()[:200]
    if not query:
        return []

    params = {
        "q": query,
        "format": "json",
        "limit": min(limit, 20),
        "addressdetails": 1,
        "accept-language": language,
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            NOMINATIM_URL,
            params=params,
            headers={"User-Agent": USER_AGENT},
        )
        resp.raise_for_status()
        data = resp.json()

    results: List[GeocodingResult] = []
    for item in data:
        try:
            bbox = None
            if "boundingbox" in item:
                bb = item["boundingbox"]
                bbox = [float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])]

            results.append(GeocodingResult(
                name=item.get("name") or item.get("display_name", "").split(",")[0],
                display_name=item.get("display_name", ""),
                lat=float(item["lat"]),
                lon=float(item["lon"]),
                type=item.get("type", "unknown"),
                importance=float(item.get("importance", 0)),
                bbox=bbox,
            ))
        except (ValueError, KeyError):
            continue

    return results


async def reverse_geocode(lat: float, lon: float, language: str = "tr") -> Optional[GeocodingResult]:
    """Reverse geocode: get place name from coordinates."""
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "accept-language": language,
        "zoom": 10,
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/reverse",
            params=params,
            headers={"User-Agent": USER_AGENT},
        )
        resp.raise_for_status()
        data = resp.json()

    if "error" in data:
        return None

    return GeocodingResult(
        name=data.get("name") or data.get("display_name", "").split(",")[0],
        display_name=data.get("display_name", ""),
        lat=float(data["lat"]),
        lon=float(data["lon"]),
        type=data.get("type", "unknown"),
        importance=0,
    )
