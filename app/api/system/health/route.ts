import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectsRoot } from "@/lib/paths";
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

async function getHostPathStatus() {
  const projectsRoot = getProjectsRoot();
  const dataRoot = path.dirname(projectsRoot); // usually /data

  let projectsRootExists = false;
  try {
    const st = await fs.promises.stat(projectsRoot);
    projectsRootExists = st.isDirectory();
  } catch {
    projectsRootExists = false;
  }

  let dataMountOk = false;
  let dataMountSource: string | null = null;

  try {
    const mountInfo = await fs.promises.readFile(
      "/proc/self/mountinfo",
      "utf8"
    );
    const lines = mountInfo.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(" ");
      if (parts.length < 10) continue;
      const mountPoint = parts[4];
      if (mountPoint !== dataRoot) continue;
      const dashIdx = parts.indexOf("-");
      if (dashIdx === -1 || dashIdx + 2 >= parts.length) continue;
      const fsType = parts[dashIdx + 1];
      const mountSource = parts[dashIdx + 2];
      dataMountSource = `${fsType}:${mountSource}`;
      // Treat anything that is not the root overlay as "ok enough" bind.
      dataMountOk = mountSource !== "overlay";
      break;
    }
  } catch {
    // If we cannot read mountinfo (non-Linux, restricted), leave defaults.
  }

  return {
    projectsRoot,
    dataRoot,
    projectsRootExists,
    dataMountOk,
    dataMountSource
  };
}

export async function GET() {
  const [docker, disk, hostPaths] = await Promise.all([
    getDockerInfo(),
    getDiskStatus(),
    getHostPathStatus()
  ]);
  const socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
  const inContainer = fs.existsSync("/.dockerenv");
  const socketPathExists = fs.existsSync(socketPath);
  const dockerHost = process.env.DOCKER_HOST || null;

  return NextResponse.json({
    docker: {
      ...docker,
      dockerPingOk: docker.connected,
      dockerSocketExists: socketPathExists
    },
    disk,
    host: hostPaths,
    https: process.env.VERCEL ?? process.env.NODE_ENV === "production" ? "unknown" : "dev",
    inContainer,
    socketPath,
    socketPathExists,
    dockerHost
  });
}
