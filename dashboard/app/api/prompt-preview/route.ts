import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";

export async function GET(req: NextRequest) {
  const repoType = req.nextUrl.searchParams.get("repo_type") ?? "frontend";
  const stackTags = (req.nextUrl.searchParams.get("stack_tags") ?? "").split(",").filter(Boolean);
  const customPrompt = req.nextUrl.searchParams.get("custom_prompt") ?? null;

  const prompt = buildSystemPrompt({ repo_type: repoType, stack_tags: stackTags, custom_prompt: customPrompt });
  return NextResponse.json({ prompt });
}
