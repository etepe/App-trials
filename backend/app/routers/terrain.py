from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal, Optional, List

from app.services.terrain_service import analyze_dem

router = APIRouter()


class BBox(BaseModel):
    minLon: float
    minLat: float
    maxLon: float
    maxLat: float


class TerrainAnalysisRequest(BaseModel):
    bbox: BBox
    analysis_type: Literal["slope", "aspect", "profile"]


class ElevationPoint(BaseModel):
    distance_m: float
    elevation_m: float
    lat: float
    lon: float


class TerrainStats(BaseModel):
    min_slope_deg: Optional[float] = None
    max_slope_deg: Optional[float] = None
    mean_slope_deg: Optional[float] = None
    dominant_aspect: Optional[str] = None


class TerrainAnalysisResult(BaseModel):
    analysis_type: str
    tiles_url: Optional[str] = None
    profile: Optional[List[ElevationPoint]] = None
    stats: Optional[TerrainStats] = None


@router.post("/analyze", response_model=TerrainAnalysisResult)
async def analyze_terrain(request: TerrainAnalysisRequest):
    """
    Analyze terrain within a bounding box.
    - slope: Returns color-coded slope angle map as XYZ tile URL
    - aspect: Returns aspect (facing direction) map as XYZ tile URL
    - profile: Returns elevation profile along the bbox diagonal
    """
    bbox = (request.bbox.minLon, request.bbox.minLat, request.bbox.maxLon, request.bbox.maxLat)
    area_deg2 = (request.bbox.maxLon - request.bbox.minLon) * (request.bbox.maxLat - request.bbox.minLat)
    if area_deg2 > 1.0:  # ~111km x 111km max
        raise HTTPException(status_code=400, detail="Bounding box too large (max ~1 degree²)")

    try:
        result = await analyze_dem(bbox, request.analysis_type)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Terrain analysis failed: {e}")
