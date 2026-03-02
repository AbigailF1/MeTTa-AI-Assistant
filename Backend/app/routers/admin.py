from fastapi import Query
@router.delete("/repo-summary")
async def delete_repo_summary(
    repo_url: str = Query(..., description="Repository URL to delete summary for"),
    branch: str = Query("main", description="Branch name (default: main)"),
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN)),
):
    collection = mongo_db.get_collection("repo_summaries")
    result = await collection.delete_one({"repo_url": repo_url, "branch": branch})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Repo summary not found")
    return {"message": "Repo summary deleted successfully"}

from fastapi import APIRouter, HTTPException, status as http_status, Depends, Body
from typing import Optional, List
from pydantic import BaseModel
from pymongo.database import Database
from bson import ObjectId
from datetime import datetime, timezone

from app.core.logging import logger
from app.dependencies import get_mongo_db, require_role, get_llm_provider_dep
from app.model.repo_summary_request import RepoSummaryRequest
from app.model.repo_summary import RepoSummary
from app.db.repo_summary_db import get_repo_summary, insert_repo_summary, ensure_repo_summaries_index
from app.services.repo_summary_service import RepoSummaryGenerator
from app.db.users import UserRole, get_users, delete_user
from app.db.db import _get_collection

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    responses={404: {"description": "Not found"}},
)

@router.post("/repo-summary", response_model=RepoSummary)
async def create_repo_summary(
    request: RepoSummaryRequest = Body(...),
    mongo_db: Database = Depends(get_mongo_db),
    llm_client = Depends(get_llm_provider_dep),
    _: None = Depends(require_role(UserRole.ADMIN)),
):
    await ensure_repo_summaries_index(mongo_db)
    # Check if summary already exists
    existing = await get_repo_summary(str(request.repo_url), request.branch, mongo_db)
    if existing and not request.force_refresh:
        return RepoSummary(**existing)

    if existing and request.force_refresh:
        collection = mongo_db.get_collection("repo_summaries")
        await collection.delete_one({"repo_url": str(request.repo_url), "branch": request.branch})

    # Generate summary using service and injected LLMClient
    summary = await RepoSummaryGenerator.generate_repo_summary(
        repo_url=str(request.repo_url),
        branch=request.branch,
        llm=llm_client,
        prompt_suffix=request.prompt_suffix
    )

    summary_doc = {
        "repo_url": str(request.repo_url),
        "branch": request.branch,
        "summary": summary,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await insert_repo_summary(summary_doc, mongo_db)
    return RepoSummary(**summary_doc)



class AdminStatsResponse(BaseModel):
    total_users: int
    total_chunks: int
    annotated_chunks: int
    failed_annotations: int
    quota_exceeded: int

class AnnotationStatsResponse(BaseModel):
    total: int
    completed: int
    pending: int
    failed: int
    completedPercentage: float
    pendingPercentage: float
    failedPercentage: float

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    createdAt: Optional[str] = None

class RepositoryResponse(BaseModel):
    id: str
    url: str
    branch: str
    chunkSize: int
    chunks: int
    status: str

@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN))
):
    """
    Get comprehensive admin statistics including users, chunks, and annotations
    """
    try:
        # Get total users count
        users_collection = _get_collection(mongo_db, "users")
        total_users = await users_collection.count_documents({})
        
        # Get chunks statistics
        chunks_collection = _get_collection(mongo_db, "chunks_temp")
        total_chunks = await chunks_collection.count_documents({})
        
        # Get annotation statistics
        annotated_chunks = await chunks_collection.count_documents({
            "status": "ANNOTATED"
        })
        
        failed_annotations = await chunks_collection.count_documents({
            "status": "FAILED_GEN"
        })
        
        quota_exceeded = await chunks_collection.count_documents({
            "status": "FAILED_QUOTA"
        })
        
        return AdminStatsResponse(
            total_users=total_users,
            total_chunks=total_chunks,
            annotated_chunks=annotated_chunks,
            failed_annotations=failed_annotations,
            quota_exceeded=quota_exceeded
        )
        
    except Exception as e:
        logger.error(f"Error getting admin stats: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving admin statistics: {str(e)}"
        )

@router.get("/annotation-stats", response_model=AnnotationStatsResponse)
async def get_annotation_stats(
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN))
):
    """
    Get detailed annotation progress statistics
    """
    try:
        chunks_collection = _get_collection(mongo_db, "chunks_temp")
        
        # Only consider chunks from 'code' source for annotation stats
        annotatable_filter = {"source": "code"}
        
        total_chunks = await chunks_collection.count_documents(annotatable_filter)
        completed = await chunks_collection.count_documents({**annotatable_filter, "status": "ANNOTATED"})
        failed = await chunks_collection.count_documents({**annotatable_filter, "status": "FAILED_GEN"})
        quota_exceeded = await chunks_collection.count_documents({**annotatable_filter, "status": "FAILED_QUOTA"})
        
        # Calculate pending (unprocessed chunks from 'code' source)
        pending = total_chunks - completed - failed - quota_exceeded
        
        completed_percentage = (completed / total_chunks * 100) if total_chunks > 0 else 0
        pending_percentage = (pending / total_chunks * 100) if total_chunks > 0 else 0
        failed_percentage = (failed / total_chunks * 100) if total_chunks > 0 else 0
        
        return AnnotationStatsResponse(
            total=total_chunks,
            completed=completed,
            pending=pending,
            failed=failed,
            completedPercentage=completed_percentage,
            pendingPercentage=pending_percentage,
            failedPercentage=failed_percentage
        )
        
    except Exception as e:
        logger.error(f"Error getting annotation stats: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving annotation statistics: {str(e)}"
        )

@router.get("/users", response_model=List[UserResponse])
async def get_admin_users(
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN))
):
    """
    Get list of all users for admin management
    """
    try:
        users_list = await get_users(mongo_db)
        
        formatted_users = []
        for user in users_list:
            user_response = UserResponse(
                id=user["id"],
                email=user["email"],
                role=user["role"].capitalize(),
                createdAt=user.get("createdAt", None)
            )
            formatted_users.append(user_response)
        
        return formatted_users
        
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving users: {str(e)}"
        )

@router.delete("/users/{user_id}")
async def delete_admin_user(
    user_id: str,
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN))
):
    """
    Delete a user (admin only)
    """
    try:
        success = await delete_user(user_id, mongo_db)
        
        if not success:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="User not found or failed to delete"
            )
        
        return {"message": "User deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user: {str(e)}"
        )

@router.get("/repositories", response_model=List[RepositoryResponse])
async def get_repositories(
    mongo_db: Database = Depends(get_mongo_db),
    _: None = Depends(require_role(UserRole.ADMIN))
):
    """
    Get list of all ingested repositories with statistics
    """
    try:
        collection = _get_collection(mongo_db, "chunks_temp")
        
        pipeline = [
            {
                "$match": {
                    "project": {"$exists": True, "$ne": None},
                    "repo": {"$exists": True, "$ne": None}
                }
            },
            {
                "$group": {
                    "_id": {
                        "project": "$project",
                        "repo": "$repo",
                        "branch": {"$ifNull": ["$branch", "main"]}
                    },
                    "chunks": {"$sum": 1},
                    "chunk_size": {"$first": "$chunk_size"}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "project": "$_id.project",
                    "repo": "$_id.repo",
                    "branch": "$_id.branch",
                    "chunks": 1,
                    "chunk_size": 1
                }
            }
        ]
        cursor = await collection.aggregate(pipeline)
        ingested_repos = [doc async for doc in cursor]
        
        
        
        # Convert to RepositoryResponse format
        repositories = []
        for repo_data in ingested_repos:
            repository = RepositoryResponse(
                id=f"{repo_data['project']}_{repo_data['repo']}_{repo_data['branch']}".replace("/", "_").replace(":", "_"),
                url=repo_data["repo"],
                branch=repo_data["branch"],
                chunkSize=int(repo_data.get("chunk_size", 1000) or 1000),
                chunks=int(repo_data.get("chunks", 0)),
                status="Completed"
            )
            repositories.append(repository)
        
        logger.info(f"Found {len(repositories)} repositories")
        return repositories
        
    except Exception as e:
        logger.error(f"Error getting repositories: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving repositories: {str(e)}"
        )