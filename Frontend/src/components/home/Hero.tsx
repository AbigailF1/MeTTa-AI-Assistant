import { ArrowRight, BrainCircuit, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 pb-14 pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:pt-28">
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <BrainCircuit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">MeTTa AI Assistant</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Symbolic reasoning and AI-native exploration
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300">
          <Sparkles className="h-3.5 w-3.5" />
          Built for structured knowledge, pattern matching, and interactive learning
        </div>

        <div className="space-y-5">
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Explore <span className="text-blue-600 dark:text-blue-400">MeTTa</span>, symbolic intelligence, and AI workflows in one place.
          </h1>

          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400 sm:text-lg">
            MeTTa AI Assistant is designed as a modern front door for learning concepts, experimenting with symbolic reasoning, and moving into practical assistant-driven workflows.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            Login
            <ArrowRight className="h-4 w-4" />
          </Link>

          <a
            href="#about-metta"
            className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Learn about MeTTa
          </a>
        </div>
      </div>

      <div className="flex items-center">
        <div className="w-full rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/30">
          <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div>
              <p className="text-sm font-semibold">Quick demo</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">A sample MeTTa interaction</p>
            </div>
            <div className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              Playground-ready
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="ml-3 text-xs text-zinc-400">hello.metta</span>
            </div>
            <pre className="overflow-x-auto px-4 py-5 text-sm leading-7 text-zinc-200">
                {`; facts
                (Parent "Tom" "Bob")
                (Parent "Tom" "Alice")

                ; query
                !(match &self (Parent "Tom" $x) $x)

                ; result
                ["Bob", "Alice"]`}
            </pre>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">What you can do</p>
              <p className="mt-2 text-sm font-medium">Learn, query, reason, and prototype symbolic ideas</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Designed for</p>
              <p className="mt-2 text-sm font-medium">Students, researchers, and teams building AI-native tools</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero