from pydantic import BaseModel, HttpUrl, Field
from typing import Optional
from datetime import datetime

class RepoSummaryDBModel(BaseModel):
    repo_url: HttpUrl = Field(..., description="Repository URL")
    branch: str = Field(..., description="Branch name")
    summary: str = Field(..., description="Summary of the repository")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


# Collection name for repo summaries
REPO_SUMMARIES_COLLECTION = "repo_summaries"

from pymongo.database import Database
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError
from app.core.logging import logger

def get_repo_summaries_collection(mongo_db: Database) -> Collection:
    if mongo_db is None:
        raise RuntimeError("Database connection not initialized — pass a valid mongo_db")
    return mongo_db.get_collection(REPO_SUMMARIES_COLLECTION)

async def ensure_repo_summaries_index(mongo_db: Database):
    # unique index on (repo_url, branch) for idempotency
    collection = get_repo_summaries_collection(mongo_db)
    await collection.create_index([
        ("repo_url", 1),
        ("branch", 1)
    ], unique=True)

async def get_repo_summary(repo_url: str, branch: str, mongo_db: Database) -> dict | None:
    collection = get_repo_summaries_collection(mongo_db)
    return await collection.find_one({"repo_url": repo_url, "branch": branch}, {"_id": 0})

async def insert_repo_summary(summary_data: dict, mongo_db: Database) -> bool:
    collection = get_repo_summaries_collection(mongo_db)
    try:
        await collection.insert_one(summary_data)
        return True
    except DuplicateKeyError:
        logger.info(f"Repo summary already exists for {summary_data.get('repo_url')}:{summary_data.get('branch')}")
        return False
