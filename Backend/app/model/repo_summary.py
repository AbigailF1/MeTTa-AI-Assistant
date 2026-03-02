from pydantic import BaseModel, HttpUrl, Field
from typing import Optional
from datetime import datetime

class RepoSummary(BaseModel):
    repo_url: HttpUrl = Field(..., description="Repository URL")
    branch: str = Field(..., description="Branch name")
    summary: str = Field(..., description="Summary of the repository")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
