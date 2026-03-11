"""
Overpass API service — fetch mountain peaks from OpenStreetMap.
Uses the public Overpass API (rate-limited; cache results on the client).
"""
import re
import httpx
from typing import Optional, List
from app.models.mountain import Mountain

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
TIMEOUT = 20.0

# Only allow alphanumeric, spaces, hyphens, dots, and common diacritics
_SAFE_NAME_RE = re.compile(r'^[\w\s\-.\u00C0-\u024F\u0400-\u04FF]+$', re.UNICODE)


def _sanitize_name(name: str) -> str:
    """Sanitize user input to prevent Overpass QL injection."""
    name = name.strip()[:100]  # limit length
    # Remove characters that could break Overpass QL syntax
    name = name.replace('"', '').replace("'", '').replace('\\', '').replace(']', '').replace('[', '')
    if not name or not _SAFE_NAME_RE.match(name):
        return ""
    return name


def _build_query(lat: float, lon: float, radius_m: int, name_filter: Optional[str]) -> str:
    if name_filter:
        safe_name = _sanitize_name(name_filter)
        name_clause = f'["name"~"{safe_name}",i]' if safe_name else '["name"]'
    else:
        name_clause = '["name"]'
    return f"""
[out:json][timeout:15];
(
  node["natural"="peak"]{name_clause}(around:{radius_m},{lat},{lon});
  node["natural"="summit"]{name_clause}(around:{radius_m},{lat},{lon});
  node["natural"="mountain_pass"]{name_clause}(around:{radius_m},{lat},{lon});
);
out body;
"""


def _parse_element(el: dict) -> Mountain:
    tags = el.get("tags", {})
    elevation_str = tags.get("ele")
    elevation: Optional[float] = None
    if elevation_str:
        try:
            elevation = float(elevation_str)
        except ValueError:
            pass
    return Mountain(
        osm_id=str(el["id"]),
        name=tags.get("name", "Unknown Peak"),
        lat=el["lat"],
        lon=el["lon"],
        elevation=elevation,
        type=tags.get("natural", "peak"),
        tags={k: v for k, v in tags.items() if k not in ("name", "ele", "natural")},
    )


async def search_peaks(
    lat: float, lon: float, radius_km: float, name_filter: Optional[str] = None
) -> List[Mountain]:
    radius_m = int(radius_km * 1000)
    query = _build_query(lat, lon, radius_m, name_filter)

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()
        data = resp.json()

    elements = data.get("elements", [])
    mountains = [_parse_element(el) for el in elements if el.get("type") == "node"]

    # Sort by distance from center
    def dist2(m: Mountain) -> float:
        return (m.lat - lat) ** 2 + (m.lon - lon) ** 2

    mountains.sort(key=dist2)
    return mountains[:50]  # cap at 50 results


async def search_peaks_by_name(name: str, limit: int = 30) -> List[Mountain]:
    """Search peaks globally by name only, without coordinates."""
    safe_name = _sanitize_name(name)
    if not safe_name:
        return []

    query = f"""
[out:json][timeout:15];
(
  node["natural"="peak"]["name"~"{safe_name}",i];
  node["natural"="summit"]["name"~"{safe_name}",i];
);
out body qt {limit};
"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()
        data = resp.json()

    elements = data.get("elements", [])
    mountains = [_parse_element(el) for el in elements if el.get("type") == "node"]
    return mountains[:limit]


async def get_peak(osm_id: str) -> Optional[Mountain]:
    query = f"""
[out:json][timeout:10];
node(id:{osm_id});
out body;
"""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()
        data = resp.json()

    elements = data.get("elements", [])
    if not elements:
        return None
    return _parse_element(elements[0])
