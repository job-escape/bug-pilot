import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const org = req.nextUrl.searchParams.get("org");
  if (!org) return NextResponse.json({ error: "org required" }, { status: 400 });

  const token = process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const repos: string[] = [];
  let page = 1;

  while (true) {
    // Try org first, then user
    let res = await fetch(
      `https://api.github.com/orgs/${org}/repos?per_page=100&sort=updated&page=${page}`,
      { headers }
    );
    if (!res.ok) {
      res = await fetch(
        `https://api.github.com/users/${org}/repos?per_page=100&sort=updated&page=${page}`,
        { headers }
      );
      if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data: { name: string }[] = await res.json();
    if (!data.length) break;
    repos.push(...data.map((r) => r.name));
    if (data.length < 100) break;
    page++;
  }

  return NextResponse.json({ repos });
}
