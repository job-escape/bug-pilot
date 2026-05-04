import { Octokit } from "@octokit/rest";
import simpleGit from "simple-git";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface RepoContext {
  owner: string;
  repo: string;
  baseBranch: string;
  token: string;
}

export function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "bug-pilot-"));
}

export function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}

export async function cloneRepo(workDir: string, ctx: RepoContext): Promise<void> {
  const url = `https://${ctx.token}@github.com/${ctx.owner}/${ctx.repo}.git`;
  const git = simpleGit();
  await git.clone(url, workDir, ["--depth", "1", "--branch", ctx.baseBranch]);
}

export async function checkoutBranch(workDir: string, branchName: string): Promise<void> {
  const git = simpleGit(workDir);
  await git.checkoutLocalBranch(branchName);
}

export async function stageAndCommit(workDir: string, message: string): Promise<void> {
  const git = simpleGit(workDir);
  await git.add(".");
  await git.commit(message);
}

export async function pushBranch(workDir: string, branchName: string, _ctx: RepoContext): Promise<void> {
  const git = simpleGit(workDir);
  await git.push("origin", branchName, ["--set-upstream"]);
}

export async function openDraftPR(
  branchName: string,
  title: string,
  body: string,
  ctx: RepoContext
): Promise<string> {
  const octokit = new Octokit({ auth: ctx.token });
  const pr = await octokit.pulls.create({
    owner: ctx.owner,
    repo: ctx.repo,
    title,
    body,
    head: branchName,
    base: ctx.baseBranch,
    draft: true,
  });
  return pr.data.html_url;
}
