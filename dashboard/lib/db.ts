import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
  connect_timeout: 30,
  idle_timeout: 20,
  max_lifetime: 60 * 10,
});

export default sql;

export interface Thread {
  id: number;
  slack_ts: string;
  slack_permalink: string;
  platform: string;
  build: string | null;
  environment: string;
  feature: string;
  parsed_at: string;
  pr_url: string | null;
  status: string;
  repo: string;
  user_context: string | null;
  bug_count: number;
  fixed_count: number;
  clarification_count: number;
  not_found_count: number;
}

export interface Bug {
  id: number;
  thread_id: number;
  text: string;
  image_url: string | null;
  image_urls: string[] | null;
  file_path: string | null;
  line_range: string | null;
  rationale: string | null;
  status: string;
  slack_permalink: string | null;
}

export interface RepoSummary {
  repo: string;
  thread_count: number;
  bug_count: number;
  fixed_count: number;
  clarification_count: number;
  not_found_count: number;
  last_seen: string;
  last_pr_url: string | null;
}

const THREAD_COUNTS = `
  COUNT(b.id)::int AS bug_count,
  COUNT(b.id) FILTER (WHERE b.status = 'fixed')::int AS fixed_count,
  COUNT(b.id) FILTER (WHERE b.status = 'needs-clarification')::int AS clarification_count,
  COUNT(b.id) FILTER (WHERE b.status = 'not-found')::int AS not_found_count
`;

export async function getRepos(): Promise<RepoSummary[]> {
  return sql<RepoSummary[]>`
    SELECT
      r.name AS repo,
      COUNT(DISTINCT t.id)::int AS thread_count,
      COUNT(b.id)::int AS bug_count,
      COUNT(b.id) FILTER (WHERE b.status = 'fixed')::int AS fixed_count,
      COUNT(b.id) FILTER (WHERE b.status = 'needs-clarification')::int AS clarification_count,
      COUNT(b.id) FILTER (WHERE b.status = 'not-found')::int AS not_found_count,
      MAX(t.parsed_at)::text AS last_seen,
      (SELECT pr_url FROM threads WHERE repo = r.name AND pr_url IS NOT NULL ORDER BY parsed_at DESC LIMIT 1) AS last_pr_url
    FROM repos r
    LEFT JOIN threads t ON t.repo = r.name
    LEFT JOIN bugs b ON b.thread_id = t.id
    GROUP BY r.name, r.created_at
    ORDER BY r.created_at DESC
  `;
}

export async function getThreadsByRepo(repo: string): Promise<Thread[]> {
  return sql<Thread[]>`
    SELECT
      t.*,
      ${sql.unsafe(THREAD_COUNTS)}
    FROM threads t
    LEFT JOIN bugs b ON b.thread_id = t.id
    WHERE t.repo = ${repo}
    GROUP BY t.id
    ORDER BY t.parsed_at DESC
  `;
}

export async function getThreads(): Promise<Thread[]> {
  return sql<Thread[]>`
    SELECT
      t.*,
      ${sql.unsafe(THREAD_COUNTS)}
    FROM threads t
    LEFT JOIN bugs b ON b.thread_id = t.id
    GROUP BY t.id
    ORDER BY t.parsed_at DESC
  `;
}

export async function getThread(id: number): Promise<Thread | null> {
  const rows = await sql<Thread[]>`
    SELECT
      t.*,
      ${sql.unsafe(THREAD_COUNTS)}
    FROM threads t
    LEFT JOIN bugs b ON b.thread_id = t.id
    WHERE t.id = ${id}
    GROUP BY t.id
  `;
  return rows[0] ?? null;
}

export async function getThreadBugs(threadId: number): Promise<Bug[]> {
  return sql<Bug[]>`
    SELECT * FROM bugs WHERE thread_id = ${threadId} ORDER BY id
  `;
}

export interface RepoConfig {
  id: number;
  name: string;
  github_owner: string;
  base_branch: string;
  is_active: boolean;
  repo_type: string;
  stack_tags: string[];
  custom_prompt: string | null;
  fix_model: string | null;
  parser_model: string | null;
  created_at: string;
}

export async function getRepoConfigs(): Promise<RepoConfig[]> {
  return sql<RepoConfig[]>`
    SELECT * FROM repos ORDER BY is_active DESC, created_at DESC
  `;
}

export async function createRepoConfig(config: Omit<RepoConfig, "id" | "created_at">): Promise<void> {
  await sql`
    INSERT INTO repos (name, github_owner, base_branch, is_active, repo_type, stack_tags, custom_prompt)
    VALUES (${config.name}, ${config.github_owner}, ${config.base_branch}, ${config.is_active}, ${config.repo_type}, ${JSON.stringify(config.stack_tags)}, ${config.custom_prompt ?? null})
  `;
}

export async function updateRepoConfig(name: string, config: Partial<Omit<RepoConfig, "id" | "created_at" | "name">>): Promise<void> {
  if (config.github_owner !== undefined) await sql`UPDATE repos SET github_owner = ${config.github_owner} WHERE name = ${name}`;
  if (config.base_branch !== undefined) await sql`UPDATE repos SET base_branch = ${config.base_branch} WHERE name = ${name}`;
  if (config.repo_type !== undefined) await sql`UPDATE repos SET repo_type = ${config.repo_type} WHERE name = ${name}`;
  if (config.stack_tags !== undefined) await sql`UPDATE repos SET stack_tags = ${JSON.stringify(config.stack_tags)} WHERE name = ${name}`;
  if (config.custom_prompt !== undefined) await sql`UPDATE repos SET custom_prompt = ${config.custom_prompt ?? null} WHERE name = ${name}`;
  if (config.fix_model !== undefined) await sql`UPDATE repos SET fix_model = ${config.fix_model ?? null} WHERE name = ${name}`;
  if (config.parser_model !== undefined) await sql`UPDATE repos SET parser_model = ${config.parser_model ?? null} WHERE name = ${name}`;
}

export async function setActiveRepo(name: string): Promise<void> {
  await sql`UPDATE repos SET is_active = false`;
  await sql`UPDATE repos SET is_active = true WHERE name = ${name}`;
}

export async function deactivateAllRepos(): Promise<void> {
  await sql`UPDATE repos SET is_active = false`;
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await sql<{ key: string; value: string }[]>`SELECT key, value FROM settings`;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function skipBug(id: number): Promise<void> {
  await sql`UPDATE bugs SET status = 'skipped' WHERE id = ${id}`;
}

export async function unskipBug(id: number): Promise<void> {
  await sql`UPDATE bugs SET status = 'pending' WHERE id = ${id}`;
}

export async function saveThreadContext(threadId: number, context: string): Promise<void> {
  await sql`UPDATE threads SET user_context = ${context} WHERE id = ${threadId}`;
}

export async function saveSettings(settings: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = ${value}
    `;
  }
}
