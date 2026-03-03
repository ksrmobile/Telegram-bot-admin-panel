import { NextResponse } from "next/server";
import { getProjectsRoot } from "@/lib/paths";
import fs from "fs";
import { getDockerInfo } from "@/lib/docker";

async function getDiskStatus() {
  const root = getProjectsRoot();
  if (process.platform === "win32") {
    try {
      const stat = fs.statSync(root);
      return { path: root, exists: stat.isDirectory(), freeMb: null, totalMb: null };
    } catch {
      return { path: root, exists: false, freeMb: null, totalMb: null };
    }
  }
  try {
    const { execSync } = await import("child_process");
    const out = execSync(`df -k "${root}" 2>/dev/null || df -k .`, { encoding: "utf8" });
    const lines = out.trim().split("\n");
    if (lines.length < 2) return { path: root, freeMb: null, totalMb: null };
    const parts = lines[1].split(/\s+/).filter(Boolean);
    if (parts.length < 4) return { path: root, freeMb: null, totalMb: null };
    const totalK = parseInt(parts[1], 10);
    const usedK = parseInt(parts[2], 10);
    const availK = parseInt(parts[3], 10);
    return {
      path: root,
      totalMb: Math.round(totalK / 1024),
      usedMb: Math.round(usedK / 1024),
      freeMb: Math.round(availK / 1024)
    };
  } catch {
    return { path: root, freeMb: null, totalMb: null };
  }
}

export async function GET() {
  const [docker, disk] = await Promise.all([getDockerInfo(), getDiskStatus()]);
  const socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
  const inContainer = fs.existsSync("/.dockerenv");
  const socketPathExists = fs.existsSync(socketPath);
  const dockerHost = process.env.DOCKER_HOST || null;

  return NextResponse.json({
    docker,
    disk,
    https: process.env.VERCEL ?? process.env.NODE_ENV === "production" ? "unknown" : "dev",
    inContainer,
    socketPath,
    socketPathExists,
    dockerHost
  });
}
