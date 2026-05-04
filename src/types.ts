export interface RepoConfig {
  name: string;
  github_owner: string;
  base_branch: string;
  repo_type: string;       // "frontend" | "backend" | "mobile" | "data" | custom
  stack_tags: string[];
  custom_prompt?: string | null;
}

export type Platform = "iOS" | "Android" | "Web" | "unknown";
export type Environment = "stage" | "prod" | "unknown";

export interface ThreadMetadata {
  platform: Platform;
  build: string | null;
  environment: Environment;
  feature: string;
}

export type BugStatus = "pending" | "skipped" | "fixed" | "needs-clarification" | "not-found";

export interface BugImage {
  url: string;
  mimetype: string;
  isVideo?: boolean;
}

export interface PreviousAttempt {
  bugText: string;
  rationale: string;
  status: BugStatus;
  filesChanged: string[];
}

export interface Bug {
  text: string;
  images: BugImage[];
  slackPermalink: string;
  userNote?: string;
  previousAttempts?: PreviousAttempt[];
}

export interface ChangedFile {
  filePath: string;
  lineRange: string | null;
  action: "modified" | "created";
}

export interface FixResult {
  status: BugStatus;
  filePath: string | null;       // primary file (for DB storage)
  lineRange: string | null;      // primary file line range
  changedFiles: ChangedFile[];   // all files touched
  rationale: string;
}

export interface FeatureManifest {
  pr: number;
  date: string;
  build: string | null;
  title: string;
  body: string;
  filePath: string;
}
