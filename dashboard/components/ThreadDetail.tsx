import type { Thread, Bug } from "@/lib/db";
import { StatusBadge } from "./StatusBadge";
import { BugList } from "./BugList";

export function ThreadDetail({ thread, bugs }: { thread: Thread; bugs: Bug[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-zinc-500 font-mono">{new Date(thread.parsed_at).toLocaleString()}</span>
            <StatusBadge status={thread.status} />
          </div>
          <h2 className="text-lg font-semibold text-white">{thread.feature}</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            {thread.platform} · {thread.environment}
            {thread.build ? ` · Build ${thread.build}` : ""}
          </p>
        </div>
        <div className="flex gap-3 text-center shrink-0">
          <Stat label="Bugs" value={thread.bug_count} />
          <Stat label="Fixed" value={thread.fixed_count} color="text-green-400" />
          <Stat label="Unclear" value={thread.clarification_count} color="text-yellow-400" />
        </div>
      </div>

      <div className="flex gap-3 mb-5">
        {thread.slack_permalink && (
          <a href={thread.slack_permalink} target="_blank" rel="noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 underline">
            Slack thread ↗
          </a>
        )}
        {thread.pr_url && (
          <a href={thread.pr_url} target="_blank" rel="noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 underline">
            GitHub PR ↗
          </a>
        )}
      </div>

      <BugList bugs={bugs} />
    </div>
  );
}

function Stat({ label, value, color = "text-white" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
