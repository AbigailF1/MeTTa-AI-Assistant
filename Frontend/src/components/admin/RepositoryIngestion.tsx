import { useEffect, useState, useCallback } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { useAdminStore } from "../../store/useAdminStore";
import { Button } from "../ui/button";
import { ingestRepository, getBranches } from "../../services/adminService";
import { toast } from "sonner";
import Modal from "../ui/modal";
import { Input } from "../ui/input";
import Textarea from "../ui/textarea";
import {
  getRepoSummary,
  createRepoSummary,
  deleteRepoSummary,
} from "../../services/adminService";

const DEFAULT_PROMPT_SUFFIX =
  "write a concise summary (2-4 sentences) of the repository's main purpose and functionality.";

function RepositoryIngestion() {
  const { repositories, isLoadingRepositories, loadRepositories } =
    useAdminStore();
  const [repoUrl, setRepoUrl] = useState("");
  const [chunkSize, setChunkSize] = useState("1000");
  const [isIngesting, setIsIngesting] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [summary, setSummary] = useState("");
  const [promptSuffix, setPromptSuffix] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasSummary, setHasSummary] = useState(false);

  // Fetch branches when repoUrl changes
  const fetchBranches = useCallback(async (url: string) => {
    if (!url.trim()) {
      setBranches([]);
      setSelectedBranch("main");
      return;
    }

    try {
      const branchList = await getBranches(url);
      setBranches(branchList);
      if (branchList.includes("main")) setSelectedBranch("main");
      else if (branchList.length > 0) setSelectedBranch(branchList[0]);
      else setSelectedBranch("main");
    } catch (err: any) {
      console.error("Failed to fetch branches:", err);
      toast.error("Failed to fetch branches for this repo");
      setBranches([]);
      setSelectedBranch("main");
    }
  }, []);

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  const handleIngest = async () => {
    if (!repoUrl.trim()) {
      toast.error("Please enter a repository URL");
      return;
    }

    const size = parseInt(chunkSize);
    if (isNaN(size) || size < 500 || size > 1500) {
      toast.error("Chunk size must be between 500 and 1500");
      return;
    }

    try {
      setIsIngesting(true);
      await ingestRepository(repoUrl, size, selectedBranch);
      toast.success("Ingestion started successfully");
      setRepoUrl("");
      setBranches([]);
      setSelectedBranch("main");
      await loadRepositories();
      const pollForStatus = async () => {
        await loadRepositories();
        const { repositories: currentRepos } = useAdminStore.getState();
        const hasProcessing = currentRepos.some(
          (repo) => repo.status === "Processing",
        );

        if (!hasProcessing) {
          return true;
        }
        return false;
      };
      if (await pollForStatus()) return;
      const interval = setInterval(async () => {
        if (await pollForStatus()) {
          clearInterval(interval);
        }
      }, 3000);

      // Stop polling after 5 minutes to prevent infinite polling
      setTimeout(
        () => {
          clearInterval(interval);
        },
        5 * 60 * 1000,
      );
    } catch (error: any) {
      console.error("Ingestion error:", error);
      const message =
        error.response?.data?.detail || "Failed to start ingestion";
      toast.error(message);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleOpenSummaryModal = async (repo: any) => {
    setSelectedRepo(repo);
    setSummary("");
    setPromptSuffix(DEFAULT_PROMPT_SUFFIX);
    setSummaryModalOpen(true);
    setHasSummary(false);
    // Always default to main branch if available, else first branch, else repo.branch
    try {
      const branchList = await getBranches(repo.url);
      setBranches(branchList);
      let initialBranch = "main";
      if (branchList.includes("main")) initialBranch = "main";
      else if (branchList.length > 0) initialBranch = branchList[0];
      else initialBranch = repo.branch || "main";
      setSelectedBranch(initialBranch);
      // Fetch summary for initial branch
      fetchAndSetSummary(repo.url, initialBranch);
    } catch {
      setBranches([repo.branch || "main"]);
      setSelectedBranch(repo.branch || "main");
      fetchAndSetSummary(repo.url, repo.branch || "main");
    }
  };

  // Fetch summary for a given repo url and branch
  const fetchAndSetSummary = async (repoUrl: string, branch: string) => {
    try {
      const data = await getRepoSummary(repoUrl, branch);
      if (data.summary && data.summary !== "No summary available") {
        setSummary(data.summary);
        setHasSummary(true);
      } else {
        setSummary("");
        setHasSummary(false);
      }
    } catch {
      setSummary("");
      setHasSummary(false);
    }
  };

  const handleRefreshSummary = async () => {
    if (!selectedRepo) return;
    setIsRefreshing(true);
    try {
      const data = await createRepoSummary({
        repo_url: selectedRepo.url,
        branch: selectedBranch,
        force_refresh: true,
        prompt_suffix: promptSuffix,
      });
      if (data.summary && data.summary !== "No summary available") {
        setSummary(data.summary);
        setHasSummary(true);
      } else {
        setSummary("");
        setHasSummary(false);
      }
    } catch {
      setSummary("");
      setHasSummary(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteSummary = async () => {
    if (!selectedRepo) return;
    setIsDeleting(true);
    try {
      await deleteRepoSummary(selectedRepo.url, selectedBranch);
      setSummary("Summary deleted");
      setHasSummary(false);
    } catch {
      setSummary("Failed to delete summary");
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed":
        return <Check className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case "Processing":
        return (
          <Loader2 className="w-5 h-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
        );
      case "Failed":
        return <X className="w-5 h-5 text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Repository Ingestion
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Ingest and process code repositories
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          Ingest New Repository
        </h3>

        <div className="space-y-4">
          {/* Repository URL */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Repository URL
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                // Auto-fetch branches when a valid GitHub URL is entered
                if (
                  e.target.value.match(
                    /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/,
                  )
                ) {
                  fetchBranches(e.target.value);
                } else if (!e.target.value.trim()) {
                  setBranches([]);
                  setSelectedBranch("main");
                }
              }}
              placeholder="https://github.com/username/repository"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 rounded-lg text-sm"
              disabled={isIngesting}
            />
          </div>

          {/* Branch selector */}
          {branches.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Branches
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 rounded-lg text-sm"
                disabled={isIngesting}
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Chunk size */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Chunk Size
            </label>
            <input
              type="number"
              value={chunkSize}
              onChange={(e) => setChunkSize(e.target.value)}
              placeholder="1000"
              min="500"
              max="1500"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 rounded-lg text-sm"
              disabled={isIngesting}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Number of characters per chunk (500-1500)
            </p>
          </div>

          {/* Start ingestion button */}
          <Button
            onClick={handleIngest}
            className="w-full bg-black dark:bg-white text-white dark:text-black"
            disabled={isIngesting}
          >
            {isIngesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Ingestion...
              </>
            ) : (
              "Start Ingestion"
            )}
          </Button>
        </div>
      </div>

      {/* Ingested repositories list */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          Ingested Repositories ({repositories.length})
        </h3>
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          {isLoadingRepositories ? (
            <div className="px-6 py-8 text-center text-zinc-600 dark:text-zinc-400">
              Loading repositories...
            </div>
          ) : repositories.length === 0 ? (
            <div className="px-6 py-8 text-center text-zinc-600 dark:text-zinc-400">
              No repositories ingested yet
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-blue-600 dark:text-blue-400"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {repo.url}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Chunk size: {repo.chunkSize} • Chunks: {repo.chunks}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          repo.status === "Completed"
                            ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                            : repo.status === "Processing"
                              ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                              : "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {repo.status}
                      </span>
                    </div>
                    {getStatusIcon(repo.status)}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSummaryModal(repo)}
                    >
                      Summary
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Summary Modal */}
      <Modal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        title="Repository Summary"
      >
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2">Repository Summary</h2>
          <p className="mb-2 text-sm text-zinc-500">
            {selectedRepo ? `${selectedRepo.url}` : ""}
          </p>
          {branches.length > 0 && (
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">Branch</label>
              <select
                value={selectedBranch}
                onChange={async (e) => {
                  const branch = e.target.value;
                  setSelectedBranch(branch);
                  if (selectedRepo) {
                    await fetchAndSetSummary(selectedRepo.url, branch);
                  }
                }}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 rounded-lg text-sm"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Textarea className="w-full mb-2" rows={6} value={summary} readOnly />
          <label className="block text-sm font-medium mb-1">
            Custom Prompt
          </label>
          <Input
            className="w-full mb-2"
            value={promptSuffix}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPromptSuffix(e.target.value)
            }
            placeholder="e.g. focus on architecture, be brief, etc."
          />
          <div className="flex flex-col items-center mt-6">
            <div className="flex gap-4 justify-center w-full mt-2">
              {!hasSummary ? (
                <Button
                  onClick={handleRefreshSummary}
                  disabled={isRefreshing}
                  className="bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600 border border-zinc-300 dark:border-zinc-600 px-6 py-2 font-semibold shadow-sm"
                >
                  {isRefreshing ? "Generating..." : "Generate"}
                </Button>
              ) : (
                <Button
                  onClick={handleRefreshSummary}
                  disabled={isRefreshing}
                  className="bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600 border border-zinc-300 dark:border-zinc-600 px-6 py-2 font-semibold shadow-sm"
                >
                  {isRefreshing ? "Refreshing..." : "Regenerate"}
                </Button>
              )}
              {hasSummary && (
                <Button
                  onClick={handleDeleteSummary}
                  disabled={isDeleting}
                  className="bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:text-white dark:hover:bg-red-700 border-none px-6 py-2 font-semibold shadow-sm"
                >
                  {isDeleting ? "Deleting..." : "Delete Summary"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default RepositoryIngestion;
