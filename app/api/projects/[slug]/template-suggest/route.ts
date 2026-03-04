import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";

type Params = {
  params: { slug: string };
};

type SuggestResponse = {
  runtime: "PYTHON" | "NODE" | "UNKNOWN";
  suggestedStartCommand: string | null;
  suggestedWorkdir: string | null;
  reason: string | null;
  hasDockerfile: boolean;
  wrapperFolder: string | null;
};

const PYTHON_ENTRY_CANDIDATES = ["bot.py", "main.py", "app.py", "run.py"];

function normalizeForCmd(p: string): string {
  return p.split(path.sep).join("/");
}

export async function GET(_req: Request, { params }: Params) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workspace = path.isAbsolute(project.workspacePath)
    ? project.workspacePath
    : path.resolve(process.cwd(), project.workspacePath);

  const dockerfilePath = path.join(workspace, "Dockerfile");
  const hasDockerfile = fs.existsSync(dockerfilePath);

  let projectRoot = workspace;
  let wrapperFolder: string | null = null;

  try {
    const rootEntries = (await (fs.promises as any).readdir(workspace, {
      withFileTypes: true
    })) as any[];
    const rootFiles = rootEntries
      .filter((d: any) => d.isFile())
      .map((d: any) => d.name);
    const rootDirs = rootEntries
      .filter((d: any) => d.isDirectory())
      .map((d: any) => d.name)
      .filter((name) => !name.startsWith("."));

    const mainNames = [
      ...PYTHON_ENTRY_CANDIDATES,
      "requirements.txt",
      "pyproject.toml",
      "package.json",
      "index.js"
    ];
    const hasMainFileInRoot = rootFiles.some((name) =>
      mainNames.includes(name)
    );

    if (!hasMainFileInRoot && rootDirs.length === 1) {
      projectRoot = path.join(workspace, rootDirs[0]);
      wrapperFolder = rootDirs[0];
    }
  } catch {
    // If workspace can't be read, fall back to default root.
  }

  let runtime: SuggestResponse["runtime"] = "UNKNOWN";

  const hasRequirements = fs.existsSync(
    path.join(projectRoot, "requirements.txt")
  );
  const hasPyproject = fs.existsSync(
    path.join(projectRoot, "pyproject.toml")
  );
  const hasPackageJson = fs.existsSync(
    path.join(projectRoot, "package.json")
  );

  if (hasRequirements || hasPyproject) {
    runtime = "PYTHON";
  } else if (hasPackageJson) {
    runtime = "NODE";
  } else if (project.runtimeType === "PYTHON") {
    runtime = "PYTHON";
  } else if (project.runtimeType === "NODE") {
    runtime = "NODE";
  }

  let suggestedStartCommand: string | null = null;
  let suggestedWorkdir: string | null = null;
  let reason: string | null = null;

  if (runtime === "PYTHON") {
    // Template build does WORKDIR + COPY src/ ., so workspace root is at workdir.
    // Use workdir /app and command "python <path from workspace root>".
    suggestedWorkdir = "/app";

    // 1. Root-level search in projectRoot
    for (const name of PYTHON_ENTRY_CANDIDATES) {
      const abs = path.join(projectRoot, name);
      if (fs.existsSync(abs)) {
        const relFromWorkspace = normalizeForCmd(
          path.relative(workspace, abs) || name
        );
        suggestedStartCommand = `python ${relFromWorkspace}`;
        reason = `Found ${name} in ${
          projectRoot === workspace ? "project root" : `folder ${wrapperFolder}`
        }.`;
        break;
      }
    }

    // 2. Search up to 2 levels deep if not found
    if (!suggestedStartCommand) {
      try {
        const level1 = (await (fs.promises as any).readdir(projectRoot, {
          withFileTypes: true
        })) as any[];
        const level1Dirs = level1.filter((d: any) => d.isDirectory());

        // depth 1
        outer: for (const d1 of level1Dirs) {
          const base1 = path.join(projectRoot, d1.name);
          for (const name of PYTHON_ENTRY_CANDIDATES) {
            const abs = path.join(base1, name);
            if (fs.existsSync(abs)) {
              const rel = normalizeForCmd(path.relative(workspace, abs));
              suggestedStartCommand = `python ${rel}`;
              reason = `Found ${name} at ${rel}.`;
              break outer;
            }
          }
        }

        // depth 2
        if (!suggestedStartCommand) {
          outer2: for (const d1 of level1Dirs) {
            const base1 = path.join(projectRoot, d1.name);
            let level2: any[];
            try {
              level2 = (await (fs.promises as any).readdir(base1, {
                withFileTypes: true
              })) as any[];
            } catch {
              continue;
            }
            for (const d2 of level2.filter((d: any) => d.isDirectory())) {
              const base2 = path.join(base1, d2.name);
              for (const name of PYTHON_ENTRY_CANDIDATES) {
                const abs = path.join(base2, name);
                if (fs.existsSync(abs)) {
                  const rel = normalizeForCmd(path.relative(workspace, abs));
                  suggestedStartCommand = `python ${rel}`;
                  reason = `Found ${name} at ${rel}.`;
                  break outer2;
                }
              }
            }
          }
        }
      } catch {
        // ignore traversal errors
      }
    }
  } else if (runtime === "NODE") {
    if (hasPackageJson) {
      try {
        const pkgRaw = await fs.promises.readFile(
          path.join(projectRoot, "package.json"),
          "utf8"
        );
        const pkg = JSON.parse(pkgRaw);
        if (pkg?.scripts?.start) {
          suggestedStartCommand = "npm run start";
          const relRoot = normalizeForCmd(
            path.relative(workspace, projectRoot) || "."
          );
          suggestedWorkdir =
            !relRoot || relRoot === "." ? "/app" : `/app/${relRoot}`;
          reason = "Detected package.json with a \"start\" script.";
        }
      } catch {
        // ignore parse errors
      }
    }

    if (
      !suggestedStartCommand &&
      fs.existsSync(path.join(projectRoot, "index.js"))
    ) {
      const rel = normalizeForCmd(
        path.relative(workspace, path.join(projectRoot, "index.js")) ||
          "index.js"
      );
      suggestedStartCommand = `node ${rel}`;
      suggestedWorkdir = "/app";
      reason =
        projectRoot === workspace
          ? "Found index.js in project root."
          : `Found index.js at ${rel}.`;
    }
  }

  const payload: SuggestResponse = {
    runtime,
    suggestedStartCommand,
    suggestedWorkdir,
    reason,
    hasDockerfile,
    wrapperFolder
  };

  return NextResponse.json(payload);
}

