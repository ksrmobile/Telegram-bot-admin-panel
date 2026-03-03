import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";
import { gitClone, isGitRepo } from "@/lib/git";
import { verifyCsrfToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type Params = {
  params: { slug: string };
};

export async function POST(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
  const branch =
    typeof body?.branch === "string" ? body.branch.trim() : undefined;

  if (!repoUrl) {
    return NextResponse.json(
      { error: "Repository URL is required" },
      { status: 400 }
    );
  }

  const workspace = path.isAbsolute(project.workspacePath)
    ? project.workspacePath
    : path.resolve(process.cwd(), project.workspacePath);

  // Ensure workspace exists and is essentially empty before cloning.
  try {
    await fs.promises.mkdir(workspace, { recursive: true });
    const entries = await fs.promises.readdir(workspace);
    const filtered = entries.filter((name) => ![".", ".."].includes(name));
    if (filtered.length > 0) {
      const alreadyGit = await isGitRepo(workspace);
      if (alreadyGit) {
        return NextResponse.json(
          { error: "Workspace already contains a git repository" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Workspace is not empty; cannot clone into it" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Unable to prepare workspace directory" },
      { status: 500 }
    );
  }

  const result = await gitClone(workspace, repoUrl, branch);
  if (!result.ok) {
    await logAudit("git_clone_failed", project.id);
    return NextResponse.json(
      { error: result.error || "git clone failed" },
      { status: 500 }
    );
  }

  await logAudit("git_cloned", project.id);

  return NextResponse.json({ ok: true });
}

