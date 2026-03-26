interface PlaygroundOutputProps {
  output: string;
  isRunning: boolean;
}

function PlaygroundOutput({ output, isRunning }: PlaygroundOutputProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-medium">Output</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{isRunning ? 'Running…' : 'Ready'}</span>
      </div>
      <pre className="p-4 min-h-[320px] whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-100 font-mono">{output}</pre>
    </div>
  );
}

export default PlaygroundOutput;
