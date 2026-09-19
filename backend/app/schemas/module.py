from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ModuleBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class ModuleCreate(ModuleBase):
    pass


class ModuleUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class ModuleResponse(ModuleBase):
    id: str
    user_id: str
    created_at: datetime
    lectures_count: Optional[int] = 0

    model_config = {"from_attributes": True}
