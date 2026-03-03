import Docker from "dockerode";
import { cleanLogText } from "./log-sanitize";

function createDockerClient() {
  const socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
  const dockerHost = process.env.DOCKER_HOST;

  // Prefer DOCKER_HOST if provided
  if (dockerHost) {
    try {
      // unix:// or tcp:// style
      if (dockerHost.startsWith("unix://")) {
        return new Docker({
          socketPath: dockerHost.replace("unix://", ""),
          timeout: 30_000
        });
      }
      const url = new URL(dockerHost);
      const protocol = (url.protocol.replace(":", "") ||
        "http") as "http" | "https";
      const port = url.port ? Number(url.port) : 2375;
      return new Docker({
        protocol,
        host: url.hostname,
        port,
        timeout: 30_000
      } as any);
    } catch {
      // Fallback to socket path if DOCKER_HOST is malformed
    }
  }

  // Default: local Unix socket
  return new Docker({
    socketPath,
    timeout: 30_000
  });
}

const docker = createDockerClient();

export type RunOptions = {
  image: string;
  name: string;
  projectSlug: string;
  env?: Record<string, string>;
  cpuLimit?: number; // in cores
  memoryLimitMb?: number;
  readOnly?: boolean;
  workdir?: string;
  bindPath: string;
  restartPolicy?: "no" | "unless-stopped" | "always" | "on-failure";
  ports?: { containerPort: number; hostPort?: number }[];
};

export async function getDockerInfo() {
  try {
    await docker.ping();
    const version = await docker.version();
    return {
      connected: true,
      version: version?.Version ?? null,
      apiVersion: version?.ApiVersion ?? null,
      error: null
    };
  } catch (e: any) {
    const msg = e?.message || "Docker unavailable";
    let friendly = msg;
    if (msg.includes("ENOENT")) {
      friendly =
        "Docker socket not found. If running in Docker, mount /var/run/docker.sock or set DOCKER_HOST.";
    } else if (msg.includes("ECONNREFUSED")) {
      friendly =
        "Cannot reach Docker at configured host. Check DOCKER_HOST and that the daemon is listening.";
    }
    return {
      connected: false,
      version: null,
      apiVersion: null,
      error: friendly
    };
  }
}

export async function buildImage(
  contextPath: string,
  dockerfile: string,
  tag: string,
  noCache: boolean = false
) {
  const stream = await docker.buildImage(
    {
      context: contextPath,
      src: ["."],
      dockerfile
    } as any,
    { t: tag, nocache: noCache }
  );

  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err: any) => (err ? reject(err) : resolve())
    );
  });
}

export async function buildImageWithLogs(
  contextPath: string,
  dockerfile: string,
  tag: string,
  noCache: boolean = false
): Promise<string> {
  const stream = await docker.buildImage(
    {
      context: contextPath,
      src: ["."],
      dockerfile
    } as any,
    { t: tag, nocache: noCache }
  );

  const chunks: string[] = [];

  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      },
      (event: any) => {
        const text: string | undefined =
          (event && (event.stream as string)) ||
          (event && (event.status as string)) ||
          (event && (event.error as string));
        if (text) {
          chunks.push(text);
        }
      }
    );
  });

  const joined = chunks.join("");
  const maxChars = 20_000;
  if (joined.length > maxChars) {
    return joined.slice(joined.length - maxChars);
  }
  return joined;
}

export async function runContainer(options: RunOptions) {
  const existing = docker.getContainer(options.name);
  try {
    await existing.inspect();
    await existing.remove({ force: true });
  } catch {
    // ignore if not exists
  }

  const memBytes =
    options.memoryLimitMb && options.memoryLimitMb > 0
      ? options.memoryLimitMb * 1024 * 1024
      : undefined;

  const hostConfig: Docker.ContainerCreateOptions["HostConfig"] = {
    Binds: [
      `${options.bindPath}:${options.workdir || "/app"}:${
        options.readOnly ? "ro" : "rw"
      }`
    ],
    RestartPolicy: {
      Name: options.restartPolicy || "unless-stopped"
    }
  };

  if (options.ports && options.ports.length > 0) {
    hostConfig.PortBindings = {};
    for (const p of options.ports) {
      const key = `${p.containerPort}/tcp`;
      hostConfig.PortBindings[key] = [
        {
          HostPort: String(p.hostPort ?? p.containerPort)
        }
      ];
    }
  }

  if (options.cpuLimit && options.cpuLimit > 0) {
    hostConfig.NanoCpus = Math.floor(options.cpuLimit * 1e9);
  }
  if (memBytes) {
    hostConfig.Memory = memBytes;
  }

  const container = await docker.createContainer({
    Image: options.image,
    name: options.name,
    WorkingDir: options.workdir || "/app",
    Env: Object.entries(options.env || {}).map(([k, v]) => `${k}=${v}`),
    HostConfig: hostConfig,
    Labels: {
      "ksr.project": options.projectSlug
    }
  });

  await container.start();
}

export async function removeImage(name: string) {
  try {
    const image = docker.getImage(name);
    // Force removal to avoid dangling containers/layers blocking delete.
    await image.remove({ force: true } as any);
  } catch {
    // ignore if image does not exist or cannot be removed
  }
}

export async function stopAndRemoveContainer(name: string) {
  const container = docker.getContainer(name);
  try {
    await container.stop({ t: 10 });
  } catch {
    // ignore
  }
  try {
    await container.remove({ force: true });
  } catch {
    // ignore
  }
}

export async function restartContainer(name: string) {
  const container = docker.getContainer(name);
  await container.restart();
}

export async function getContainerStatus(name: string) {
  const container = docker.getContainer(name);
  try {
    const info = await container.inspect();
    return {
      running: info.State?.Running ?? false,
      status: info.State?.Status,
      exitCode: info.State?.ExitCode,
      startedAt: info.State?.StartedAt,
      finishedAt: info.State?.FinishedAt
    };
  } catch {
    return null;
  }
}

export async function streamContainerLogs(
  name: string,
  onData: (chunk: string) => void
) {
  const container = docker.getContainer(name);
  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail: 200
  });

  stream.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    const cleaned = cleanLogText(text, { stripAnsi: false });
    onData(cleaned);
  });

  return () => {
    try {
      stream.destroy();
    } catch {
      // ignore
    }
  };
}

export async function getRecentLogs(
  name: string,
  tail: number = 50,
  options?: { stripAnsi?: boolean }
): Promise<string[]> {
  const container = docker.getContainer(name);
  try {
    const stream = await container.logs({
      follow: false,
      stdout: true,
      stderr: true,
      tail
    });

    const chunks: Buffer[] = [];

    return await new Promise<string[]>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      stream.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const text = cleanLogText(raw, {
          stripAnsi: options?.stripAnsi ?? false
        });
        const lines = text.split("\n").map((l) => l.trimEnd());
        resolve(lines.filter((l) => l.length > 0));
      });
      stream.on("error", (err: any) => {
        reject(err);
      });
    });
  } catch {
    return [];
  }
}

export async function pruneDanglingImages() {
  try {
    const result = await docker.pruneImages({
      filters: {
        dangling: {
          true: true
        }
      } as any
    } as any);
    return {
      pruned: (result?.ImagesDeleted || []).length ?? 0,
      reclaimedBytes: result?.SpaceReclaimed ?? 0
    };
  } catch (e: any) {
    const msg = e?.message || "Unable to prune images";
    return { pruned: 0, reclaimedBytes: 0, error: msg };
  }
}


