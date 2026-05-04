"use server";

import { redirect } from "next/navigation";
import { createRepoConfig } from "@/lib/db";
import SetupForm from "./SetupForm";

export default async function SetupPage() {
  async function addRepo(formData: FormData) {
    "use server";
    const stackTagsRaw = formData.get("stack_tags") as string;
    const stackTags = stackTagsRaw ? stackTagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

    await createRepoConfig({
      name: formData.get("repo_name") as string,
      github_owner: formData.get("github_owner") as string,
      base_branch: (formData.get("base_branch") as string) || "main",
      is_active: formData.get("set_active") === "on",
      repo_type: formData.get("repo_type") as string,
      stack_tags: stackTags,
      custom_prompt: (formData.get("custom_prompt") as string) || null,
      fix_model: null,
      parser_model: null,
    });
    redirect("/");
  }

  return (
    <main style={{ minHeight: "100vh", padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
      <header style={{ marginBottom: "3rem", paddingTop: "1rem" }}>
        <a href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "var(--text-muted)", textDecoration: "none", display: "inline-block", marginBottom: "1.5rem" }}>
          ← back
        </a>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "2.5rem", fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>
          Add Repository
        </h1>
      </header>

      <form action={addRepo} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <SetupForm />
      </form>
    </main>
  );
}
