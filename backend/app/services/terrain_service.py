"""
Terrain analysis service.
Downloads DEM (Digital Elevation Model) from OpenTopography SRTM,
then computes slope / aspect maps or elevation profiles using rasterio + numpy.
"""
import os
import math
import tempfile
from typing import Literal, Tuple

import httpx
import numpy as np

OPENTOPO_URL = "https://portal.opentopography.org/API/globaldem"
OPENTOPO_KEY = os.environ.get("OPENTOPO_API_KEY", "")
TIMEOUT = 60.0

BBox = Tuple[float, float, float, float]  # (minLon, minLat, maxLon, maxLat)

# Compass direction from aspect degrees
ASPECT_NAMES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"]


def _deg2compass(deg: float) -> str:
    return ASPECT_NAMES[round(deg / 45) % 8]


async def _download_dem(bbox: BBox) -> np.ndarray:
    """Download SRTM 30m DEM from OpenTopography and return as numpy array."""
    minLon, minLat, maxLon, maxLat = bbox
    params = {
        "demtype": "SRTMGL1",
        "south": minLat,
        "north": maxLat,
        "west": minLon,
        "east": maxLon,
        "outputFormat": "GTiff",
        "API_Key": OPENTOPO_KEY,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(OPENTOPO_URL, params=params)
        resp.raise_for_status()

    # Write to temp file and read with rasterio
    import rasterio
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(resp.content)
        tmp_path = f.name

    try:
        with rasterio.open(tmp_path) as ds:
            data = ds.read(1).astype(np.float32)
            transform = ds.transform
            nodata = ds.nodata
    finally:
        os.unlink(tmp_path)

    if nodata is not None:
        data[data == nodata] = np.nan

    return data, transform


def _compute_slope_aspect(
    dem: np.ndarray, cell_size_m: float = 30.0
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute slope (degrees) and aspect (degrees) from DEM."""
    # Pad edges with reflection
    padded = np.pad(dem, 1, mode="edge")
    dz_dx = (padded[1:-1, 2:] - padded[1:-1, :-2]) / (2 * cell_size_m)
    dz_dy = (padded[2:, 1:-1] - padded[:-2, 1:-1]) / (2 * cell_size_m)

    slope_rad = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
    slope_deg = np.degrees(slope_rad)

    aspect_rad = np.arctan2(-dz_dy, dz_dx)
    aspect_deg = (np.degrees(aspect_rad) + 360) % 360

    return slope_deg, aspect_deg


def _elevation_profile(dem: np.ndarray, n_points: int = 100) -> list[dict]:
    """Sample the DEM diagonal as an elevation profile."""
    rows, cols = dem.shape
    profile = []
    total_dist = 0.0
    prev_elev = None

    for i in range(n_points):
        r = int(i * (rows - 1) / (n_points - 1))
        c = int(i * (cols - 1) / (n_points - 1))
        elev = float(dem[r, c])
        if np.isnan(elev):
            elev = 0.0

        if prev_elev is not None:
            # Approximate horizontal distance per step
            step_m = math.sqrt(30**2 + 30**2)  # diagonal pixel
            total_dist += step_m

        profile.append({
            "distance_m": round(total_dist, 1),
            "elevation_m": round(elev, 1),
            "lat": 0.0,  # populated by caller with actual coords
            "lon": 0.0,
        })
        prev_elev = elev

    return profile


async def analyze_dem(bbox: BBox, analysis_type: Literal["slope", "aspect", "profile"]) -> dict:
    """
    Main entry point.
    Returns a dict matching TerrainAnalysisResult schema.
    """
    dem, transform = await _download_dem(bbox)

    if analysis_type == "profile":
        profile = _elevation_profile(dem)
        # Fill lat/lon by interpolating bbox
        minLon, minLat, maxLon, maxLat = bbox
        n = len(profile)
        for i, pt in enumerate(profile):
            pt["lat"] = minLat + (maxLat - minLat) * i / (n - 1)
            pt["lon"] = minLon + (maxLon - minLon) * i / (n - 1)

        return {
            "analysis_type": "profile",
            "profile": profile,
            "stats": None,
            "tiles_url": None,
        }

    # For slope/aspect: compute raster and return stats
    # (In production, render tiles and host them; here we return summary stats only)
    slope_deg, aspect_deg = _compute_slope_aspect(dem)

    valid_mask = ~np.isnan(dem)
    valid_slope = slope_deg[valid_mask]
    valid_aspect = aspect_deg[valid_mask]

    stats: dict = {}
    if valid_slope.size > 0:
        stats["min_slope_deg"] = round(float(np.nanmin(valid_slope)), 1)
        stats["max_slope_deg"] = round(float(np.nanmax(valid_slope)), 1)
        stats["mean_slope_deg"] = round(float(np.nanmean(valid_slope)), 1)

    if valid_aspect.size > 0:
        # Circular mean of aspect
        sin_mean = np.nanmean(np.sin(np.radians(valid_aspect)))
        cos_mean = np.nanmean(np.cos(np.radians(valid_aspect)))
        mean_aspect = (math.degrees(math.atan2(sin_mean, cos_mean)) + 360) % 360
        stats["dominant_aspect"] = _deg2compass(mean_aspect)

    return {
        "analysis_type": analysis_type,
        "tiles_url": None,  # TODO: render tiles and return URL
        "profile": None,
        "stats": stats,
    }
