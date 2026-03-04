import { promisify } from "util";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

async function runGit(
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd
  });
  return { stdout: stdout.toString(), stderr: stderr.toString() };
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    if (!fs.existsSync(path.join(cwd, ".git"))) {
      const { stdout } = await runGit(
        ["rev-parse", "--is-inside-work-tree"],
        cwd
      );
      return stdout.trim() === "true";
    }
    return true;
  } catch {
    return false;
  }
}

export type GitInfo = {
  isRepo: boolean;
  branch?: string | null;
  remoteUrl?: string | null;
  lastCommitHash?: string | null;
  lastCommitMessage?: string | null;
  lastCommitAt?: string | null;
};

export async function getGitInfo(cwd: string): Promise<GitInfo> {
  const isRepo = await isGitRepo(cwd);
  if (!isRepo) return { isRepo: false };

  let branch: string | null = null;
  let remoteUrl: string | null = null;
  let lastCommitHash: string | null = null;
  let lastCommitMessage: string | null = null;
  let lastCommitAt: string | null = null;

  try {
    const { stdout } = await runGit(
      ["rev-parse", "--abbrev-ref", "HEAD"],
      cwd
    );
    branch = stdout.trim() || null;
  } catch {
    branch = null;
  }

  try {
    const { stdout } = await runGit(
      ["remote", "get-url", "origin"],
      cwd
    );
    remoteUrl = stdout.trim() || null;
  } catch {
    remoteUrl = null;
  }

  try {
    const { stdout } = await runGit(
      ["log", "-1", "--format=%H|%ct|%s"],
      cwd
    );
    const [hash, ts, msg] = stdout.trim().split("|");
    lastCommitHash = hash || null;
    lastCommitMessage = msg || null;
    if (ts) {
      const n = Number.parseInt(ts, 10);
      if (!Number.isNaN(n)) {
        lastCommitAt = new Date(n * 1000).toISOString();
      }
    }
  } catch {
    lastCommitHash = null;
    lastCommitMessage = null;
    lastCommitAt = null;
  }

  return {
    isRepo: true,
    branch,
    remoteUrl,
    lastCommitHash,
    lastCommitMessage,
    lastCommitAt
  };
}

export async function gitPull(
  cwd: string
): Promise<{ ok: boolean; error?: string }> {
  const isRepo = await isGitRepo(cwd);
  if (!isRepo) {
    return { ok: false, error: "Not a git repository" };
  }
  try {
    await runGit(["pull", "--ff-only"], cwd);
    return { ok: true };
  } catch (e: any) {
    const msg =
      typeof e?.message === "string"
        ? e.message
        : "git pull failed";
    return { ok: false, error: msg };
  }
}

export async function gitClone(
  cwd: string,
  repoUrl: string,
  branch?: string
): Promise<{ ok: boolean; error?: string }> {
  // Very conservative URL validation to avoid obviously malformed inputs.
  const trimmed = repoUrl.trim();
  const httpsLike = /^https:\/\/[^\s]+$/i;
  const sshLike = /^git@[^:]+:[^\s]+$/;
  if (!httpsLike.test(trimmed) && !sshLike.test(trimmed)) {
    return {
      ok: false,
      error: "Repository URL must start with https:// or be an SSH git@host:path URL"
    };
  }

  const args = ["clone", "--depth", "1"];
  if (branch && branch.trim()) {
    args.push("--branch", branch.trim());
  }
  args.push(trimmed, "."); // clone into current workspace

  try {
    await runGit(args, cwd);
    return { ok: true };
  } catch (e: any) {
    const raw =
      typeof e?.message === "string"
        ? e.message
        : "git clone failed";
    let friendly = raw;
    if (raw.includes("certificate") || raw.includes("CAfile")) {
      friendly =
        "TLS/SSL certificate verification failed when contacting Git server. The panel container may be missing CA certificates (ca-certificates). Rebuild the panel image and ensure ca-certificates are installed.";
    }
    return { ok: false, error: friendly };
  }
}

