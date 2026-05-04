import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import type { FeatureManifest } from "../types.js";

export function loadManifests(repoDir: string, featureArea?: string): FeatureManifest[] {
  const memoryDir = join(repoDir, ".feature-memory");
  if (!existsSync(memoryDir)) return [];

  const files = readdirSync(memoryDir).filter((f) => f.endsWith(".md"));

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

  const manifests: FeatureManifest[] = [];

  for (const file of files) {
    const filePath = join(memoryDir, file);
    const body = readFileSync(filePath, "utf8");

    const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const fileDate = new Date(dateMatch[1]!).getTime();
      if (fileDate < cutoff) continue;
    }

    const titleMatch = body.match(/^title:\s*(.+)$/m);
    const prMatch = body.match(/^pr:\s*(\d+)$/m);
    const buildMatch = body.match(/^build:\s*(.+)$/m);
    const dateTagMatch = body.match(/^date:\s*(.+)$/m);

    const title = titleMatch?.[1]?.trim() ?? file;
    const featuresMatch = body.match(/^features:\s*(.+)$/m);
    const featureTags = featuresMatch?.[1]?.split(",").map((t) => t.trim().toLowerCase()) ?? [];

    if (featureArea) {
      const featureLower = featureArea.toLowerCase();
      const matchesTags = featureTags.some((tag) => featureLower.includes(tag) || tag.includes(featureLower));
      const matchesBody = body.toLowerCase().includes(featureLower);
      const matchesTitle = title.toLowerCase().includes(featureLower);
      if (!matchesTags && !matchesBody && !matchesTitle) continue;
    }

    manifests.push({
      pr: Number(prMatch?.[1] ?? 0),
      date: dateTagMatch?.[1]?.trim() ?? "",
      build: buildMatch?.[1]?.trim() ?? null,
      title,
      body,
      filePath: file,
    });
  }

  return manifests;
}

export function formatManifests(manifests: FeatureManifest[]): string {
  if (manifests.length === 0) return "No recent feature manifests found.";
  return manifests.map((m) => `### Manifest: ${m.filePath}\n\n${m.body}`).join("\n\n---\n\n");
}
