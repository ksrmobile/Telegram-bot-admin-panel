import fs from "fs";
import path from "path";
import { getBuildContextRoot, getProjectsRoot } from "./paths";

async function getDirSizeRecursive(root: string): Promise<number> {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    try {
      const stat = await fs.promises.stat(full);
      if (stat.isDirectory()) {
        total += await getDirSizeRecursive(full);
      } else if (stat.isFile()) {
        total += stat.size;
      }
    } catch {
      // ignore
    }
  }
  return total;
}

export async function getProjectStorage(projectId: number, workspacePath: string) {
  const workspace = path.isAbsolute(workspacePath)
    ? workspacePath
    : path.resolve(process.cwd(), workspacePath);
  const buildRoot = getBuildContextRoot(projectId);
  const buildDir = path.isAbsolute(buildRoot)
    ? buildRoot
    : path.resolve(process.cwd(), buildRoot);

  const [workspaceBytes, buildBytes] = await Promise.all([
    getDirSizeRecursive(workspace),
    getDirSizeRecursive(buildDir)
  ]);

  return {
    workspaceBytes,
    buildBytes
  };
}

export async function deleteProjectBuildContext(projectId: number) {
  const buildRoot = getBuildContextRoot(projectId);
  const buildDir = path.isAbsolute(buildRoot)
    ? buildRoot
    : path.resolve(process.cwd(), buildRoot);
  await fs.promises.rm(buildDir, { recursive: true, force: true } as any);
}

export async function cleanupTmpBackupsForProject(
  slug: string,
  keep: number = 3
) {
  const tmpDirs = ["/tmp/ksr-backup", "/tmp/ksr-restore"];
  for (const dir of tmpDirs) {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const zips = await Promise.all(
      entries
        .filter(
          (e) =>
            e.isFile() &&
            e.name.includes(slug) &&
            e.name.toLowerCase().endsWith(".zip")
        )
        .map(async (e) => {
          const full = path.join(dir, e.name);
          const stat = await fs.promises.stat(full);
          return { full, mtime: stat.mtimeMs };
        })
    );
    zips.sort((a, b) => b.mtime - a.mtime);
    const toDelete = zips.slice(keep);
    for (const z of toDelete) {
      try {
        await fs.promises.unlink(z.full);
      } catch {
        // ignore
      }
    }
  }
}

export async function getSystemStorageSummary() {
  const projectsRoot = getProjectsRoot();
  const buildRootBase =
    process.env.BUILD_CONTEXT_ROOT || "/data/build-contexts";

  const [projectsBytes, buildBytes] = await Promise.all([
    getDirSizeRecursive(
      path.isAbsolute(projectsRoot)
        ? projectsRoot
        : path.resolve(process.cwd(), projectsRoot)
    ),
    getDirSizeRecursive(
      path.isAbsolute(buildRootBase)
        ? buildRootBase
        : path.resolve(process.cwd(), buildRootBase)
    )
  ]);

  return {
    projectsBytes,
    buildBytes
  };
}

