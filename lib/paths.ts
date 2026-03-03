import path from "path";

const DEFAULT_PROJECTS_ROOT = "/data/projects";
const DEFAULT_BUILD_CONTEXT_ROOT = "/data/build-contexts";

export function getProjectsRoot() {
  return process.env.PROJECTS_ROOT || DEFAULT_PROJECTS_ROOT;
}

export function getProjectRoot(projectSlug: string) {
  return path.join(getProjectsRoot(), projectSlug);
}

export function getBuildContextRoot(projectId: number | string) {
  const base =
    process.env.BUILD_CONTEXT_ROOT || DEFAULT_BUILD_CONTEXT_ROOT;
  return path.join(base, String(projectId));
}

export function resolveProjectPath(projectSlug: string, relativePath: string) {
  const root = getProjectRoot(projectSlug);
  const normalized = path.normalize(relativePath).replace(/^([/\\])+/, "");
  const fullPath = path.join(root, normalized);

  if (!fullPath.startsWith(root)) {
    throw new Error("Path traversal detected");
  }

  return fullPath;
}

