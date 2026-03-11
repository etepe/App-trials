"""
Terrain analysis service.
Downloads DEM (Digital Elevation Model) from OpenTopography SRTM,
then computes slope / aspect maps or elevation profiles using rasterio + numpy.
Generates PNG overlay images for visualization on the 3D globe.
"""
import os
import io
import math
import uuid
import base64
import hashlib
import tempfile
import logging
from typing import Literal, Tuple

import httpx
import numpy as np

logger = logging.getLogger("mountain_explorer.terrain")

OPENTOPO_URL = "https://portal.opentopography.org/API/globaldem"
OPENTOPO_KEY = os.environ.get("OPENTOPO_API_KEY", "")
TIMEOUT = 60.0

BBox = Tuple[float, float, float, float]  # (minLon, minLat, maxLon, maxLat)

# Compass direction from aspect degrees
ASPECT_NAMES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"]

# Directory for generated overlay images
_OVERLAY_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "static", "overlays",
)
os.makedirs(_OVERLAY_DIR, exist_ok=True)


def _deg2compass(deg: float) -> str:
    return ASPECT_NAMES[round(deg / 45) % 8]


# ─── Slope color ramp (0°→green, 30°→yellow, 45°→red, 60°+→purple) ─────────

def _slope_colormap(slope_deg: np.ndarray) -> np.ndarray:
    """Map slope degrees to RGBA (H x W x 4) uint8 array."""
    h, w = slope_deg.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)

    s = np.clip(slope_deg, 0, 70)

    # Green zone: 0-20°
    mask1 = s < 20
    t = s[mask1] / 20.0
    rgba[mask1, 0] = (34 + t * (241 - 34)).astype(np.uint8)   # R
    rgba[mask1, 1] = (197 + t * (196 - 197)).astype(np.uint8)  # G
    rgba[mask1, 2] = (94 + t * (15 - 94)).astype(np.uint8)     # B

    # Yellow zone: 20-35°
    mask2 = (s >= 20) & (s < 35)
    t = (s[mask2] - 20) / 15.0
    rgba[mask2, 0] = (241 + t * (231 - 241)).astype(np.uint8)
    rgba[mask2, 1] = (196 + t * (76 - 196)).astype(np.uint8)
    rgba[mask2, 2] = (15 + t * (60 - 15)).astype(np.uint8)

    # Red zone: 35-50°
    mask3 = (s >= 35) & (s < 50)
    t = (s[mask3] - 35) / 15.0
    rgba[mask3, 0] = (231 - t * (231 - 142)).astype(np.uint8)
    rgba[mask3, 1] = (76 - t * 76).astype(np.uint8)
    rgba[mask3, 2] = (60 + t * (68 - 60)).astype(np.uint8)

    # Purple zone: 50°+
    mask4 = s >= 50
    rgba[mask4, 0] = 142
    rgba[mask4, 1] = 0
    rgba[mask4, 2] = 68

    # Alpha: semi-transparent
    valid = ~np.isnan(slope_deg)
    rgba[valid, 3] = 180
    rgba[~valid, 3] = 0

    return rgba


# ─── Aspect color wheel (N=blue, E=green, S=red, W=yellow) ──────────────────

def _aspect_colormap(aspect_deg: np.ndarray, slope_deg: np.ndarray) -> np.ndarray:
    """Map aspect degrees to RGBA using HSV-like color wheel."""
    h, w = aspect_deg.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)

    a = np.radians(aspect_deg)
    # Map aspect to hue (0-360) using color wheel
    # N=blue(240°), E=green(120°), S=red(0°), W=yellow(60°)
    hue = (aspect_deg + 180) % 360

    # Convert hue to RGB using simple sector-based conversion
    h_sector = hue / 60.0
    c = 200  # chroma
    x = c * (1 - np.abs(h_sector % 2 - 1))

    for sector in range(6):
        mask = (h_sector >= sector) & (h_sector < sector + 1)
        if sector == 0:
            rgba[mask, 0], rgba[mask, 1], rgba[mask, 2] = c, x[mask].astype(np.uint8), 40
        elif sector == 1:
            rgba[mask, 0], rgba[mask, 1], rgba[mask, 2] = x[mask].astype(np.uint8), c, 40
        elif sector == 2:
            rgba[mask, 0], rgba[mask, 1], rgba[mask, 2] = 40, c, x[mask].astype(np.uint8)
        elif sector == 3:
            rgba[mask, 0], rgba[mask, 1], rgba[mask, 2] = 40, x[mask].astype(np.uint8), c
        elif sector == 4:
            rgba[mask, 0], rgba[mask, 1], rgba[mask, 2] = x[mask].astype(np.uint8), 40, c
        else:
            rgba[mask, 0], rgba[mask, 1], rgba[mask, 2] = c, 40, x[mask].astype(np.uint8)

    # Reduce alpha on flat areas (slope < 5°)
    valid = ~np.isnan(aspect_deg)
    flat = slope_deg < 5
    rgba[valid & ~flat, 3] = 170
    rgba[valid & flat, 3] = 40
    rgba[~valid, 3] = 0

    return rgba


# ─── Contour line generation ────────────────────────────────────────────────

def _contour_overlay(dem: np.ndarray, interval_m: float = 100.0) -> np.ndarray:
    """Generate contour line overlay as RGBA image."""
    h, w = dem.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)

    valid = ~np.isnan(dem)
    if not valid.any():
        return rgba

    # Find contour crossings using modulo
    dem_mod = np.where(valid, dem % interval_m, np.nan)

    # Check horizontal crossings
    h_cross = np.zeros((h, w), dtype=bool)
    h_cross[:, 1:] |= valid[:, 1:] & valid[:, :-1] & (
        np.floor(dem[:, 1:] / interval_m) != np.floor(dem[:, :-1] / interval_m)
    )
    # Check vertical crossings
    v_cross = np.zeros((h, w), dtype=bool)
    v_cross[1:, :] |= valid[1:, :] & valid[:-1, :] & (
        np.floor(dem[1:, :] / interval_m) != np.floor(dem[:-1, :] / interval_m)
    )

    contour = h_cross | v_cross

    # Major contours (every 500m) are thicker/brighter
    major_h = np.zeros((h, w), dtype=bool)
    major_h[:, 1:] |= valid[:, 1:] & valid[:, :-1] & (
        np.floor(dem[:, 1:] / (interval_m * 5)) != np.floor(dem[:, :-1] / (interval_m * 5))
    )
    major_v = np.zeros((h, w), dtype=bool)
    major_v[1:, :] |= valid[1:, :] & valid[:-1, :] & (
        np.floor(dem[1:, :] / (interval_m * 5)) != np.floor(dem[:-1, :] / (interval_m * 5))
    )
    major = major_h | major_v

    # Minor contours: brown, semi-transparent
    rgba[contour & ~major] = [139, 90, 43, 140]
    # Major contours: darker brown, more opaque
    rgba[major] = [101, 67, 33, 220]

    return rgba


def _render_png(rgba: np.ndarray) -> bytes:
    """Encode RGBA numpy array as PNG bytes."""
    from PIL import Image
    img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _save_overlay(png_bytes: bytes, prefix: str) -> str:
    """Save overlay PNG and return the filename."""
    name = f"{prefix}_{uuid.uuid4().hex[:8]}.png"
    path = os.path.join(_OVERLAY_DIR, name)
    with open(path, "wb") as f:
        f.write(png_bytes)
    return name


async def _download_dem(bbox: BBox) -> Tuple[np.ndarray, object]:
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
            step_m = math.sqrt(30**2 + 30**2)
            total_dist += step_m

        profile.append({
            "distance_m": round(total_dist, 1),
            "elevation_m": round(elev, 1),
            "lat": 0.0,
            "lon": 0.0,
        })
        prev_elev = elev

    return profile


async def analyze_dem(bbox: BBox, analysis_type: Literal["slope", "aspect", "profile", "contour"]) -> dict:
    """
    Main entry point.
    Returns a dict matching TerrainAnalysisResult schema.
    For slope/aspect/contour: generates a PNG overlay image served as a static file.
    """
    dem, transform = await _download_dem(bbox)

    if analysis_type == "profile":
        profile = _elevation_profile(dem)
        minLon, minLat, maxLon, maxLat = bbox
        n = len(profile)
        for i, pt in enumerate(profile):
            pt["lat"] = minLat + (maxLat - minLat) * i / (n - 1)
            pt["lon"] = minLon + (maxLon - minLon) * i / (n - 1)

        return {
            "analysis_type": "profile",
            "profile": profile,
            "stats": None,
            "overlay_image": None,
            "bbox": list(bbox),
        }

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
        sin_mean = np.nanmean(np.sin(np.radians(valid_aspect)))
        cos_mean = np.nanmean(np.cos(np.radians(valid_aspect)))
        mean_aspect = (math.degrees(math.atan2(sin_mean, cos_mean)) + 360) % 360
        stats["dominant_aspect"] = _deg2compass(mean_aspect)

    # Generate overlay PNG
    if analysis_type == "slope":
        rgba = _slope_colormap(slope_deg)
    elif analysis_type == "aspect":
        rgba = _aspect_colormap(aspect_deg, slope_deg)
    elif analysis_type == "contour":
        rgba = _contour_overlay(dem)
    else:
        rgba = _slope_colormap(slope_deg)

    png_bytes = _render_png(rgba)
    overlay_name = _save_overlay(png_bytes, analysis_type)
    logger.info("Generated %s overlay: %s (%d bytes)", analysis_type, overlay_name, len(png_bytes))

    return {
        "analysis_type": analysis_type,
        "overlay_image": f"/static/overlays/{overlay_name}",
        "bbox": list(bbox),
        "profile": None,
        "stats": stats,
    }
