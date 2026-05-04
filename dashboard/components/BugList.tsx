import type { Bug } from "@/lib/db";
import { StatusBadge } from "./StatusBadge";

export function BugList({ bugs }: { bugs: Bug[] }) {
  if (bugs.length === 0) return <p className="text-zinc-500 text-sm">No bugs found.</p>;

  return (
    <div className="space-y-3">
      {bugs.map((bug) => (
        <div key={bug.id} className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-sm text-zinc-200 leading-snug flex-1">{bug.text || "(no text)"}</p>
            <StatusBadge status={bug.status} />
          </div>

          {bug.rationale && (
            <p className="text-xs text-zinc-400 mt-1">
              <span className="text-zinc-500">Rationale: </span>{bug.rationale}
            </p>
          )}

          {bug.file_path && (
            <p className="text-xs text-zinc-500 mt-1 font-mono">
              {bug.file_path}{bug.line_range ? `:${bug.line_range}` : ""}
            </p>
          )}

          {bug.image_url && (
            <img
              src={bug.image_url}
              alt="Bug screenshot"
              className="mt-3 max-h-48 rounded border border-zinc-700 object-contain"
            />
          )}
        </div>
      ))}
    </div>
  );
}
