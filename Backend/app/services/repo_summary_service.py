import httpx
from typing import Optional, List
from app.core.clients.llm_clients import LLMClient, LLMProvider
from app.core.utils.llm_utils import LLMClientFactory

class RepoSummaryGenerator:
    @staticmethod
    async def resolve_branch_to_sha(owner: str, repo: str, branch: str) -> Optional[str]:
        """Resolve a branch or ref to its commit SHA using the GitHub API."""
        api_url = f"https://api.github.com/repos/{owner}/{repo}/branches/{branch}"
        headers = {"Accept": "application/vnd.github.v3+json"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(api_url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("commit", {}).get("sha")
        return None

    @staticmethod
    async def fetch_github_tree(owner: str, repo: str, branch: str = "main") -> Optional[str]:
        sha = await RepoSummaryGenerator.resolve_branch_to_sha(owner, repo, branch)
        if not sha:
            return None
        api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{sha}?recursive=1"
        headers = {"Accept": "application/vnd.github.v3+json"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(api_url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                tree = data.get("tree", [])
                paths = [item["path"] for item in tree if item["type"] in ("tree", "blob")]

                def format_tree(paths):
                    result = []
                    for path in sorted(paths):
                        indent = "  " * (path.count("/"))
                        result.append(f"{indent}{path.split('/')[-1]}")
                    return "\n".join(result)
                return format_tree(paths)
        return None

    @staticmethod
    async def fetch_readme_from_github(repo_url: str, branch: str = "main") -> Optional[str]:
        try:
            if repo_url.endswith('/'):
                repo_url = repo_url[:-1]
            parts = repo_url.split('/')
            owner, repo = parts[-2], parts[-1]
        except Exception:
            return None
        sha = await RepoSummaryGenerator.resolve_branch_to_sha(owner, repo, branch)
        if not sha:
            return None
        readme_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{sha}/README.md"
        async with httpx.AsyncClient() as client:
            resp = await client.get(readme_url)
            if resp.status_code == 200:
                return resp.text
        return None

    @classmethod
    async def generate_repo_summary(
        cls,
        repo_url: str,
        branch: str,
        llm: Optional[LLMClient] = None,
        provider: LLMProvider = LLMProvider.OPENAI,
        model_name: Optional[str] = None,
        prompt_suffix: Optional[str] = None,
    ) -> str:
        # Parse owner/repo from URL
        try:
            url = repo_url.rstrip("/")
            parts = url.split("/")
            owner, repo = parts[-2], parts[-1]
        except Exception:
            return "Invalid repository URL."

        readme = await cls.fetch_readme_from_github(repo_url, branch)
        tree = await cls.fetch_github_tree(owner, repo, branch)
        context = ""
        if readme:
            context += f"README.md:\n{readme}\n\n"
        if tree:
            context += f"Repository Structure (folder/file tree):\n{tree}\n"
        if not context:
            return "No summary available."

        base_prompt = "You are an expert in codebase analysis. Given the following README and the repository's folder/file structure, "
        default_suffix = "write a concise summary (2-4 sentences) of the repository's main purpose and functionality."
        suffix = (prompt_suffix or "").strip() or default_suffix
        prompt = f"{base_prompt}{suffix}\n\n{context}"
        if not llm:
            llm = LLMClientFactory.create_client(provider, model_name)
        summary = await llm.generate_text(prompt, max_tokens=300)
        return summary.strip() if summary else "No summary generated."
