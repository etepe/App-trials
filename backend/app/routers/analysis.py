"""Track analysis endpoints — elevation profiles and detailed track statistics."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import math

router = APIRouter()


class Coordinate(BaseModel):
    lon: float
    lat: float
    alt: float = 0.0


class TrackProfileRequest(BaseModel):
    coordinates: List[List[float]]  # [[lon, lat, alt], ...]


class TrackStatsRequest(BaseModel):
    coordinates: List[List[float]]  # [[lon, lat, alt], ...]
    timestamps: Optional[List[float]] = None  # unix ms


class ProfilePoint(BaseModel):
    distance_m: float
    elevation_m: float
    lat: float
    lon: float


class TrackProfileResponse(BaseModel):
    points: List[ProfilePoint]


class TrackStatsResponse(BaseModel):
    total_distance_m: float
    total_ascent_m: float
    total_descent_m: float
    max_altitude_m: float
    min_altitude_m: float
    avg_speed_ms: Optional[float] = None
    max_speed_ms: float
    duration_sec: Optional[float] = None


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.post("/track-profile", response_model=TrackProfileResponse)
async def get_track_profile(req: TrackProfileRequest):
    """Generate an elevation profile along a track."""
    points: List[ProfilePoint] = []
    cum_dist = 0.0

    for i, coord in enumerate(req.coordinates):
        lon, lat = coord[0], coord[1]
        alt = coord[2] if len(coord) > 2 else 0.0

        if i > 0:
            prev = req.coordinates[i - 1]
            cum_dist += _haversine(prev[1], prev[0], lat, lon)

        points.append(ProfilePoint(
            distance_m=cum_dist,
            elevation_m=alt,
            lat=lat,
            lon=lon,
        ))

    return TrackProfileResponse(points=points)


@router.post("/track-stats", response_model=TrackStatsResponse)
async def get_track_stats(req: TrackStatsRequest):
    """Compute detailed track statistics."""
    coords = req.coordinates
    if len(coords) < 2:
        return TrackStatsResponse(
            total_distance_m=0, total_ascent_m=0, total_descent_m=0,
            max_altitude_m=0, min_altitude_m=0, avg_speed_ms=None,
            max_speed_ms=0, duration_sec=None,
        )

    total_dist = 0.0
    ascent = 0.0
    descent = 0.0
    alts = [c[2] if len(c) > 2 else 0.0 for c in coords]
    max_alt = max(alts)
    min_alt = min(alts)
    max_speed = 0.0

    for i in range(1, len(coords)):
        d = _haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0])
        total_dist += d

        dalt = alts[i] - alts[i - 1]
        if dalt > 0:
            ascent += dalt
        else:
            descent += abs(dalt)

        if req.timestamps and i < len(req.timestamps) and req.timestamps[i] and req.timestamps[i - 1]:
            dt = (req.timestamps[i] - req.timestamps[i - 1]) / 1000
            if dt > 0:
                speed = d / dt
                if speed < 200:  # filter GPS spikes
                    max_speed = max(max_speed, speed)

    duration = None
    avg_speed = None
    if req.timestamps and len(req.timestamps) >= 2:
        duration = (req.timestamps[-1] - req.timestamps[0]) / 1000
        if duration > 0:
            avg_speed = total_dist / duration

    return TrackStatsResponse(
        total_distance_m=total_dist,
        total_ascent_m=ascent,
        total_descent_m=descent,
        max_altitude_m=max_alt,
        min_altitude_m=min_alt,
        avg_speed_ms=avg_speed,
        max_speed_ms=max_speed,
        duration_sec=duration,
    )
