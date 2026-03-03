"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { useToast } from "../../../../components/ui/toast";
import { TEMPLATE_PRESETS, TemplatePresetId } from "../../../../lib/template-presets";
import {
  FolderOpen,
  UploadCloud,
  FileCode,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2
} from "lucide-react";

type StartMethod = "empty" | "upload" | "template";
type TemplateKind = "node" | "python";

const RUNTIME_DEFAULTS: Record<string, { runtimeType: "NODE" | "PYTHON" | "DOCKERFILE"; startCommand: string }> = {
  node: { runtimeType: "NODE", startCommand: "npm start" },
  python: { runtimeType: "PYTHON", startCommand: "python bot.py" },
  dockerfile: { runtimeType: "DOCKERFILE", startCommand: "" }
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

export default function NewProjectPage() {
  const router = useRouter();
  const { push } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [startMethod, setStartMethod] = useState<StartMethod>("empty");
  const [template, setTemplate] = useState<TemplateKind>("node");
  const [startCommand, setStartCommand] = useState("npm start");
  const [runtimeType, setRuntimeType] = useState<"NODE" | "PYTHON" | "DOCKERFILE">("NODE");
  const [loading, setLoading] = useState(false);
  const [presetId, setPresetId] = useState<TemplatePresetId | "">("");

  const syncSlug = (newName: string) => {
    setName(newName);
    setSlug(slugify(newName));
  };

  const canNextStep1 = name.trim().length > 0 && slug.length > 0;
  const handleNext = () => {
    if (step === 1 && canNextStep1) {
      if (startMethod === "template") {
        const def = RUNTIME_DEFAULTS[template];
        setRuntimeType(def.runtimeType);
        setStartCommand(def.startCommand);
      } else if (startMethod === "empty") {
        setRuntimeType("NODE");
        setStartCommand("npm start");
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const createPayload = () => {
    const baseRuntime =
      startMethod === "template"
        ? RUNTIME_DEFAULTS[template].runtimeType
        : runtimeType;
    const isDockerfile = baseRuntime === "DOCKERFILE";

    const finalStartCommand =
      startCommand?.trim() ||
      (startMethod === "template"
        ? RUNTIME_DEFAULTS[template].startCommand
        : "npm start");

    const runnerMode = isDockerfile ? "DOCKERFILE" : "TEMPLATE";
    const templateRuntime = isDockerfile
      ? undefined
      : baseRuntime === "PYTHON"
      ? "PYTHON"
      : "NODE";

    const preset =
      !isDockerfile && presetId
        ? TEMPLATE_PRESETS.find((p) => p.id === presetId)
        : undefined;

    return {
      name: name.trim(),
      slug: slugify(slug.trim() || name.trim()),
      runtimeType: baseRuntime,
      startCommand: finalStartCommand,
      runnerMode,
      templateRuntime,
      templateAptPackages: preset?.aptPackages
    };
  };

  const doCreate = async () => {
    setLoading(true);
    try {
      const body = createPayload();
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create project");
      }
      const project = await res.json();
      push({ title: "Project created", description: "Workspace ready." });
      if (startMethod === "upload") router.push(`/projects/${project.slug}?upload=zip`);
      else router.push(`/projects/${project.slug}`);
    } catch (err: any) {
      push({ title: "Error", description: (err as Error).message || "Unable to create project", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">Projects</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">New project</span>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create project</h1>
        <p className="text-sm text-muted-foreground">
          Set up a new Telegram bot workspace. Choose how to start, then we&apos;ll create the project.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
            ))}
            {step < 3 && <div className="h-px flex-1 bg-border" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  placeholder="My Telegram Bot"
                  value={name}
                  onChange={(e) => syncSlug(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL-safe name)</Label>
                <Input
                  id="slug"
                  placeholder="my-telegram-bot"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Used in project path and URLs.</p>
              </div>
              <div className="space-y-2">
                <Label>How do you want to start?</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setStartMethod("empty")}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-left transition-colors ${
                      startMethod === "empty" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <FolderOpen className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">Empty workspace</span>
                    <span className="text-xs text-muted-foreground">Add files or paste code later</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartMethod("upload")}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-left transition-colors ${
                      startMethod === "upload" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">Upload ZIP</span>
                    <span className="text-xs text-muted-foreground">Create then upload your bot ZIP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartMethod("template")}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-left transition-colors ${
                      startMethod === "template" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <FileCode className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">Use template</span>
                    <span className="text-xs text-muted-foreground">Node or Python starter</span>
                  </button>
                </div>
              </div>
              {startMethod === "template" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={template === "node" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTemplate("node")}
                    >
                      Node (Telegraf)
                    </Button>
                    <Button
                      type="button"
                      variant={template === "python" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTemplate("python")}
                    >
                      Python (python-telegram-bot)
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label>Template toolkit</Label>
                    <select
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                      value={presetId}
                      onChange={(e) =>
                        setPresetId(e.target.value as TemplatePresetId | "")
                      }
                    >
                      <option value="">No preset (custom)</option>
                      {TEMPLATE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {presetId && (
                      <p className="text-xs text-muted-foreground">
                        {
                          TEMPLATE_PRESETS.find((p) => p.id === presetId)
                            ?.description
                        }
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-medium mb-2">Summary</h3>
                <dl className="grid gap-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Name:</dt>
                    <dd>{name || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Slug:</dt>
                    <dd className="font-mono text-xs">{slug || slugify(name) || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Start:</dt>
                    <dd>{startMethod === "empty" ? "Empty workspace" : startMethod === "upload" ? "Upload ZIP after create" : `Template (${template})`}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Runtime:</dt>
                    <dd>
                      {startMethod === "template"
                        ? RUNTIME_DEFAULTS[template].runtimeType
                        : runtimeType}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Start command:</dt>
                    <dd className="font-mono text-xs">
                      {startCommand || (startMethod === "template"
                        ? RUNTIME_DEFAULTS[template].startCommand
                        : "npm start")}
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="text-xs text-muted-foreground">
                This start command will be used inside Docker when running your bot (Template mode).
              </p>
              <div className="space-y-2 pt-2">
                <Label htmlFor="startCommand">Start command</Label>
                <Input
                  id="startCommand"
                  placeholder={
                    startMethod === "template"
                      ? RUNTIME_DEFAULTS[template].startCommand
                      : "npm start"
                  }
                  value={startCommand}
                  onChange={(e) => setStartCommand(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Example: <code>python bot.py</code>,{" "}
                  <code>npm start</code>, or{" "}
                  <code>node index.js</code>.
                </p>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Click Create to initialize the workspace. {startMethod === "upload" && "You'll be taken to the project to upload your ZIP."}
              </p>
              <div className="flex gap-2">
                <Button onClick={doCreate} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Creating..." : "Create project"}
                </Button>
                <Button variant="outline" onClick={handleBack} disabled={loading}>
                  Back
                </Button>
              </div>
            </div>
          )}

          {step < 3 && (
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={handleBack} disabled={step === 1}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={step === 1 && !canNextStep1}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
