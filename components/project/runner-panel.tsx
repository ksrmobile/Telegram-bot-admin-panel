"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useToast } from "../ui/toast";
import { Play, Square, RotateCcw, Clock, Cpu, MemoryStick } from "lucide-react";
import { TEMPLATE_PRESETS, TemplatePreset, TemplatePresetId } from "../../lib/template-presets";

type RunnerStatus = {
  status: {
    running: boolean;
    status?: string;
    exitCode?: number;
    startedAt?: string;
    finishedAt?: string;
  } | null;
  project: {
    cpuLimit: number | null;
    memoryLimitMb: number | null;
    runnerMode?: string | null;
    runtimeType?: string;
    startCommand?: string;
    templateRuntime?: string | null;
    templateAptPackages?: string | null;
    templateWorkdir?: string | null;
    templateExposePort?: number | null;
  };
};

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )ksr_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function RunnerPanel({
  slug,
  projectId
}: {
  slug: string;
  projectId: number;
}) {
  const { push } = useToast();
  const [data, setData] = useState<RunnerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [cpuLimit, setCpuLimit] = useState<string>("");
  const [memLimit, setMemLimit] = useState<string>("");
  const [runnerMode, setRunnerMode] = useState<"DOCKERFILE" | "TEMPLATE">(
    "DOCKERFILE"
  );
  const [templateRuntime, setTemplateRuntime] = useState<
    "NODE" | "PYTHON" | "CUSTOM"
  >("NODE");
  const [aptPackages, setAptPackages] = useState("");
  const [exposePort, setExposePort] = useState<string>("");
  const [startCommand, setStartCommand] = useState<string>("");
  const [templateWorkdir, setTemplateWorkdir] = useState<string>("/app");
  const [presetId, setPresetId] = useState<TemplatePresetId | "">("");
  const [suggestedCmd, setSuggestedCmd] = useState<string | null>(null);
  const [suggestReason, setSuggestReason] = useState<string | null>(null);
  const [hasDockerfile, setHasDockerfile] = useState(false);
  const [wrapperFolder, setWrapperFolder] = useState<string | null>(null);
  const [suggestedWorkdir, setSuggestedWorkdir] = useState<string | null>(null);
  const [buildJobs, setBuildJobs] = useState<any[]>([]);
  const [diagnose, setDiagnose] = useState<{
    lastLogs: string[];
    diagnostics: any[];
    hasEnvFile: boolean;
  } | null>(null);

  async function fetchStatus() {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/runner`
      );
      if (!res.ok) throw new Error("Unable to fetch status");
      const json: RunnerStatus = await res.json();
      setData(json);
      if (json.project.cpuLimit != null) {
        setCpuLimit(String(json.project.cpuLimit));
      }
      if (json.project.memoryLimitMb != null) {
        setMemLimit(String(json.project.memoryLimitMb));
      }
      if (json.project.runnerMode) {
        const mode =
          json.project.runnerMode === "TEMPLATE"
            ? "TEMPLATE"
            : "DOCKERFILE";
        setRunnerMode(mode);
      }
      if (json.project.templateRuntime) {
        const rt = json.project.templateRuntime as
          | "NODE"
          | "PYTHON"
          | "CUSTOM";
        setTemplateRuntime(rt);
      } else if (json.project.runtimeType) {
        const rt = json.project.runtimeType as
          | "NODE"
          | "PYTHON"
          | "DOCKERFILE";
        setTemplateRuntime(rt === "PYTHON" ? "PYTHON" : "NODE");
      }
      if (json.project.templateAptPackages) {
        setAptPackages(json.project.templateAptPackages);
      }
      if (json.project.templateExposePort != null) {
        setExposePort(String(json.project.templateExposePort));
      }
      if (json.project.startCommand) {
        setStartCommand(json.project.startCommand);
      }
      if (json.project.templateWorkdir) {
        setTemplateWorkdir(json.project.templateWorkdir);
      }
    } catch (err) {
      // ignore transient
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, projectId]);

  useEffect(() => {
    if (runnerMode !== "TEMPLATE") return;
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(slug)}/template-suggest`
        );
        if (!res.ok) return;
        const json = await res.json();
        setSuggestedCmd(json.suggestedStartCommand || null);
        setSuggestReason(json.reason || null);
        setHasDockerfile(Boolean(json.hasDockerfile));
        setWrapperFolder(json.wrapperFolder || null);
        setSuggestedWorkdir(json.suggestedWorkdir || null);
      } catch {
        // ignore
      }
    })();
  }, [runnerMode, slug]);

  useEffect(() => {
    let timer: number | undefined;
    const loadJobs = async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(slug)}/template-build-jobs`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json.jobs)) {
          setBuildJobs(json.jobs);
        }
      } catch {
        // ignore
      }
    };
    loadJobs();
    timer = window.setInterval(loadJobs, 8000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [slug]);

  async function action(action: "start" | "stop" | "restart") {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(
          slug
        )}/runner?action=${action}`,
        {
          method: "POST",
          headers: {
            "x-csrf-token": getCsrfToken()
          }
        }
      );
      if (!res.ok) throw new Error("Unable to perform action");
      push({
        title: `Container ${action}ed`,
        description: `Docker container action '${action}' queued.`
      });
      await fetchStatus();
    } catch (err: any) {
      push({
        title: "Runner error",
        description: err.message || "Unable to control container",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveLimits() {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken()
          },
          body: JSON.stringify({
            cpuLimit: cpuLimit ? Number(cpuLimit) : null,
            memoryLimitMb: memLimit ? Number(memLimit) : null
          })
        }
      );
      if (!res.ok) throw new Error("Unable to save limits");
      push({
        title: "Limits updated",
        description: "New CPU and memory limits will apply on next start."
      });
      await fetchStatus();
    } catch (err: any) {
      push({
        title: "Save failed",
        description: err.message || "Unable to update limits",
        variant: "destructive"
      });
    }
  }

  async function setModeAndPersist(mode: "DOCKERFILE" | "TEMPLATE") {
    const prev = runnerMode;
    setRunnerMode(mode);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/template-config`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken()
          },
          body: JSON.stringify({ runnerMode: mode })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Unable to save runner mode");
      }
      push({
        title: "Runner mode updated",
        description:
          mode === "DOCKERFILE"
            ? "Using Dockerfile for builds."
            : "Using template for builds."
      });
    } catch (err: any) {
      setRunnerMode(prev);
      push({
        title: "Mode switch failed",
        description: err.message || "Could not save runner mode",
        variant: "destructive"
      });
    }
  }

  async function setRuntimeAndPersist(
    runtime: "NODE" | "PYTHON" | "CUSTOM"
  ) {
    const prev = templateRuntime;
    setTemplateRuntime(runtime);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/template-config`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken()
          },
          body: JSON.stringify({ templateRuntime: runtime })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Unable to save runtime");
      }
      push({
        title: "Runtime updated",
        description:
          runtime === "PYTHON"
            ? "Using Python template runtime."
            : runtime === "NODE"
            ? "Using Node template runtime."
            : "Using custom template runtime."
      });
    } catch (err: any) {
      setTemplateRuntime(prev);
      push({
        title: "Runtime switch failed",
        description: err.message || "Could not save runtime",
        variant: "destructive"
      });
    }
  }

  async function saveTemplateConfig() {
    if (!startCommand.trim()) {
      push({
        title: "Validation error",
        description: "Start command cannot be empty.",
        variant: "destructive"
      });
      return;
    }
    const workdir = templateWorkdir || "/app";
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/template-config`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken()
          },
          body: JSON.stringify({
            runnerMode,
            templateRuntime,
            templateWorkdir: workdir,
            templateAptPackages: aptPackages,
            startCommand,
            templateExposePort: exposePort
              ? Number.parseInt(exposePort, 10)
              : null
          })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Unable to save template config");
      }
      push({
        title: "Template config saved",
        description: "Template runner settings updated."
      });
      await fetchStatus();
    } catch (err: any) {
      push({
        title: "Save failed",
        description: err.message || "Unable to update template config",
        variant: "destructive"
      });
    }
  }

  async function buildTemplate(noCache: boolean) {
    setLoading(true);
    try {
      const url = `/api/projects/${encodeURIComponent(
        slug
      )}/template-build${noCache ? "?rebuild=1" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-csrf-token": getCsrfToken()
        }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Template build failed");
      }
      push({
        title: "Build started",
        description: "Template image build queued. You can watch status below."
      });
      await fetchStatus();
    } catch (err: any) {
      push({
        title: "Build failed",
        description: err.message || "Unable to build image",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  const running = data?.status?.running;

  function applyPreset(p: TemplatePreset) {
    setPresetId(p.id);
    setTemplateRuntime(p.runtime);
    setAptPackages(p.aptPackages);
  }

  async function applyPresetAndSave(p: TemplatePreset) {
    applyPreset(p);
    await saveTemplateConfig();
  }

  async function useSuggestedCommand() {
    if (!suggestedCmd) return;
    const workdir =
      suggestedWorkdir && typeof suggestedWorkdir === "string"
        ? suggestedWorkdir
        : templateWorkdir || "/app";
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/template-config`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken()
          },
          body: JSON.stringify({
            startCommand: suggestedCmd,
            templateWorkdir: workdir
          })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Unable to apply suggested command");
      }
      setStartCommand(suggestedCmd);
      setTemplateWorkdir(workdir);
      push({
        title: "Start command updated",
        description: `Using suggested command: ${suggestedCmd} (workdir ${workdir})`
      });
      await fetchStatus();
    } catch (err: any) {
      push({
        title: "Update failed",
        description: err.message || "Unable to update start command",
        variant: "destructive"
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">
            Container status
          </CardTitle>
          <Badge
            variant={
              running
                ? "success"
                : data?.status?.status === "exited"
                ? "outline"
                : "outline"
            }
          >
            {running ? "RUNNING" : data?.status?.status?.toUpperCase() || "STOPPED"}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Started:{" "}
                {data?.status?.startedAt
                  ? new Date(data.status.startedAt).toLocaleString()
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Last exit code:{" "}
                {data?.status?.exitCode != null
                  ? data.status.exitCode
                  : "—"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => action("start")}
              disabled={loading || running}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => action("stop")}
              disabled={loading || !running}
              className="gap-1.5"
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => action("restart")}
              disabled={loading}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Diagnose issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              Run a quick health check to see recent logs and common problems.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch(
                    `/api/projects/${encodeURIComponent(slug)}/diagnose`
                  );
                  if (!res.ok) throw new Error("Unable to run diagnostics");
                  const json = await res.json();
                  setDiagnose(json);
                } catch (err: any) {
                  push({
                    title: "Diagnose failed",
                    description:
                      err?.message || "Unable to run diagnostics",
                    variant: "destructive"
                  });
                }
              }}
            >
              Run diagnose
            </Button>
          </div>
          {diagnose && (
            <div className="space-y-2">
              {Array.isArray(diagnose.diagnostics) &&
              diagnose.diagnostics.length > 0 ? (
                <div className="space-y-2">
                  {diagnose.diagnostics.map((d: any) => {
                    const preset =
                      TEMPLATE_PRESETS.find(
                        (p) => p.id === d.presetSuggestion
                      ) || null;
                    return (
                      <div
                        key={d.id}
                        className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2"
                      >
                        <div className="text-[11px] font-semibold text-amber-200">
                          {d.title}
                        </div>
                        <div className="text-[11px] text-amber-100">
                          {d.description}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {preset && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyPresetAndSave(preset)}
                              >
                                Apply {preset.label}
                              </Button>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  await applyPresetAndSave(preset);
                                  await buildTemplate(true);
                                }}
                              >
                                Apply &amp; rebuild (no cache)
                              </Button>
                            </>
                          )}
                          {d.actionHint === "open_config" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (typeof window !== "undefined") {
                                  const url = new URL(
                                    window.location.href
                                  );
                                  url.searchParams.set("tab", "config");
                                  window.location.href = url.toString();
                                }
                              }}
                            >
                              Open Config
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  No obvious issues detected in the last few log lines.
                </p>
              )}
              {diagnose.lastLogs && diagnose.lastLogs.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground">
                    View last 50 log lines
                  </summary>
                  <pre className="mt-1 max-h-56 overflow-y-auto rounded bg-black/80 p-2 font-mono text-[10px] text-emerald-100">
{(diagnose.lastLogs || []).join("\n")}
                  </pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Runner mode & template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Mode</span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={runnerMode === "DOCKERFILE" ? "default" : "outline"}
                onClick={() => setModeAndPersist("DOCKERFILE")}
              >
                Dockerfile mode
              </Button>
              <Button
                type="button"
                size="sm"
                variant={runnerMode === "TEMPLATE" ? "default" : "outline"}
                onClick={() => setModeAndPersist("TEMPLATE")}
              >
                Template mode
              </Button>
            </div>
          </div>

          {runnerMode === "TEMPLATE" && (
            <div className="space-y-3">
              {wrapperFolder && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px]">
                  <div className="font-semibold text-amber-200">
                    Fix project root
                  </div>
                  <div className="text-amber-100">
                    This workspace looks like it has an extra top-level folder{" "}
                    <code>{wrapperFolder}</code>. The suggested start command
                    below already uses this path. For a cleaner layout, you can
                    move the files inside <code>{wrapperFolder}</code> up one
                    level in the Files tab and rebuild.
                  </div>
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-3">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px]">
                    Runtime
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        templateRuntime === "PYTHON" ? "default" : "outline"
                      }
                      onClick={() => setRuntimeAndPersist("PYTHON")}
                    >
                      Python
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        templateRuntime === "NODE" ? "default" : "outline"
                      }
                      onClick={() => setRuntimeAndPersist("NODE")}
                    >
                      Node
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        templateRuntime === "CUSTOM" ? "default" : "outline"
                      }
                      onClick={() => setRuntimeAndPersist("CUSTOM")}
                    >
                      Custom
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px]">
                    Toolkit preset
                  </span>
                  <div className="flex flex-col gap-1">
                    <select
                      className="h-8 rounded-md border border-border bg-background px-2 text-[11px]"
                      value={presetId}
                      onChange={(e) => {
                        const id = e.target.value as TemplatePresetId | "";
                        setPresetId(id);
                        const preset = TEMPLATE_PRESETS.find((p) => p.id === id);
                        if (preset) {
                          applyPreset(preset);
                        }
                      }}
                    >
                      <option value="">Custom</option>
                      {TEMPLATE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {presetId && (
                      <p className="text-[11px] text-muted-foreground">
                        {
                          TEMPLATE_PRESETS.find((p) => p.id === presetId)
                            ?.description
                        }
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px]">
                    Apt packages (space separated)
                  </span>
                  <Input
                    value={aptPackages}
                    onChange={(e) => setAptPackages(e.target.value)}
                    placeholder="ffmpeg unzip zip ..."
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px]">
                    Expose port (optional)
                  </span>
                  <Input
                    value={exposePort}
                    onChange={(e) => setExposePort(e.target.value)}
                    placeholder="e.g. 8080"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px]">
                    Start command
                  </span>
                  <Input
                    value={startCommand}
                    onChange={(e) => setStartCommand(e.target.value)}
                    placeholder={
                      templateRuntime === "PYTHON"
                        ? "python main.py"
                        : templateRuntime === "NODE"
                        ? "npm run start"
                        : "command to run your bot"
                    }
                    className="h-8 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This command runs inside the container in the workdir below.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px]">
                    Workdir inside container
                  </span>
                  <Input
                    value={templateWorkdir}
                    onChange={(e) => setTemplateWorkdir(e.target.value)}
                    placeholder="/app"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  {suggestedCmd && !hasDockerfile && (
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      <div>
                        Suggested:{" "}
                        <code className="bg-secondary px-1.5 py-0.5">
                          {suggestedCmd}
                        </code>
                        {suggestedWorkdir && (
                          <>
                            {" "}
                            in{" "}
                            <code className="bg-secondary px-1.5 py-0.5">
                              {suggestedWorkdir}
                            </code>
                          </>
                        )}
                      </div>
                      {suggestReason && <div>({suggestReason})</div>}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={useSuggestedCommand}
                      >
                        Apply suggestion
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveTemplateConfig}
                  disabled={loading}
                >
                  Save template config
                </Button>
                <Button
                  size="sm"
                  onClick={() => buildTemplate(false)}
                  disabled={loading}
                  className="gap-1.5"
                >
                  Build
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => buildTemplate(true)}
                  disabled={loading}
                  className="gap-1.5"
                >
                  Rebuild (no cache)
                </Button>
              </div>

              {buildJobs.length > 0 && (
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/40 p-2">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>Recent template builds</span>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `/api/projects/${encodeURIComponent(
                              slug
                            )}/template-build-jobs`
                          );
                          if (!res.ok) return;
                          const json = await res.json();
                          if (Array.isArray(json.jobs)) {
                            setBuildJobs(json.jobs);
                          }
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      Refresh
                    </button>
                  </div>
                  {buildJobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded border border-border/60 bg-background/60 p-2 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span>
                          Job #{job.id} • {job.status}
                        </span>
                        {job.error && (
                          <span className="text-rose-300">
                            {job.error}
                          </span>
                        )}
                      </div>
                      {job.lastLogTail && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] text-muted-foreground">
                            View last 150 log lines
                          </summary>
                          <pre className="mt-1 max-h-40 overflow-y-auto rounded bg-black/80 p-2 font-mono text-[10px] text-emerald-100">
{job.lastLogTail}
                          </pre>
                        </details>
                      )}
                      {Array.isArray(job.diagnostics) &&
                        job.diagnostics.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {job.diagnostics.map((d: any) => {
                              const preset =
                                TEMPLATE_PRESETS.find(
                                  (p) => p.id === d.presetSuggestion
                                ) || null;
                              return (
                                <div
                                  key={d.id}
                                  className="rounded border border-amber-500/40 bg-amber-500/5 p-2"
                                >
                                  <div className="text-[11px] font-semibold text-amber-200">
                                    {d.title}
                                  </div>
                                  <div className="text-[11px] text-amber-100">
                                    {d.description}
                                  </div>
                                  {preset && (
                                    <div className="mt-1 flex flex-wrap gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          applyPresetAndSave(preset)
                                        }
                                      >
                                        Apply {preset.label}
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={async () => {
                                          await applyPresetAndSave(preset);
                                          await buildTemplate(true);
                                        }}
                                      >
                                        Apply &amp; rebuild (no cache)
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Resource limits
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" />
              CPU cores
            </label>
            <Input
              value={cpuLimit}
              onChange={(e) => setCpuLimit(e.target.value)}
              placeholder="e.g. 0.5"
              className="h-8 text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave blank for no explicit CPU limit. Uses Docker <code>NanoCPUs</code>.
            </p>
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <MemoryStick className="h-3.5 w-3.5" />
              Memory (MB)
            </label>
            <Input
              value={memLimit}
              onChange={(e) => setMemLimit(e.target.value)}
              placeholder="e.g. 512"
              className="h-8 text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave blank for no explicit memory limit.
            </p>
          </div>
          <div className="md:col-span-2 flex justify-end pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={saveLimits}
            >
              Save limits
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

