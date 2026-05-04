import Anthropic from "@anthropic-ai/sdk";
import type { ThreadMetadata } from "../types.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You extract structured metadata from Slack QA bug reports.
Return ONLY valid JSON with these fields:
- platform: "iOS" | "Android" | "Web" | "unknown"
- build: string or null
- environment: "stage" | "prod" | "unknown"
- feature: string (free text, e.g. "Pathway", "Apps", "Onboarding")`;

export async function parseThreadMetadata(
  topMessage: string,
  firstReplies: string[],
  model = process.env.PARSER_MODEL ?? "claude-haiku-4-5-20251001"
): Promise<ThreadMetadata> {
  const content = [topMessage, ...firstReplies.slice(0, 3)].join("\n---\n");

  const response = await anthropic.messages.create({
    model,
    max_tokens: 256,
    system: SYSTEM,
    messages: [{ role: "user", content: `Extract metadata from this QA report:\n\n${content}` }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";

  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    return {
      platform: parsed.platform ?? "unknown",
      build: parsed.build ?? null,
      environment: parsed.environment ?? "unknown",
      feature: parsed.feature ?? "unknown",
    };
  } catch {
    return { platform: "unknown", build: null, environment: "unknown", feature: "unknown" };
  }
}
