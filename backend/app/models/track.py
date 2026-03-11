from pydantic import BaseModel, Field
from typing import Optional, Any
import uuid


class TrackCreate(BaseModel):
    name: str
    date: str
    file_type: str
    distance_m: float = 0.0
    duration_sec: Optional[float] = None
    max_alt_m: Optional[float] = None
    geojson: dict[str, Any]


class Track(TrackCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
