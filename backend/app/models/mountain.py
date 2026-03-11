from pydantic import BaseModel
from typing import Optional


class Mountain(BaseModel):
    osm_id: str
    name: str
    lat: float
    lon: float
    elevation: Optional[float] = None
    type: str
    tags: Optional[dict[str, str]] = None
