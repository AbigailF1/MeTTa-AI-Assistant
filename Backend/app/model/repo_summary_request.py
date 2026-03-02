from pydantic import BaseModel, HttpUrl, Field
from typing import Optional

class RepoSummaryRequest(BaseModel):
    repo_url: HttpUrl = Field(..., description="Repository URL to summarize")
    branch: Optional[str] = Field("main", description="Branch name (default: main)")
    force_refresh: Optional[bool] = Field(False, description="Force refresh the summary even if one exists")
    prompt_suffix: Optional[str] = Field("", description="Custom prompt ending for summary generation (after 'Given the following ...')")
