export type TemplatePresetId =
  | "python_basic"
  | "python_build_tools"
  | "python_ffmpeg"
  | "downloader_kit"
  | "node_basic"
  | "node_ffmpeg";

export type TemplatePreset = {
  id: TemplatePresetId;
  label: string;
  runtime: "PYTHON" | "NODE";
  aptPackages: string;
  description: string;
};

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "python_basic",
    label: "Python Basic",
    runtime: "PYTHON",
    aptPackages: "",
    description: "Minimal Python runtime using python:3.11-slim base image."
  },
  {
    id: "python_build_tools",
    label: "Python + Build Tools",
    runtime: "PYTHON",
    aptPackages:
      "build-essential gcc python3-dev libssl-dev libffi-dev",
    description:
      "Adds compiler and headers for building native Python wheels."
  },
  {
    id: "python_ffmpeg",
    label: "Python + FFmpeg",
    runtime: "PYTHON",
    aptPackages: "ffmpeg unzip zip p7zip-full jq curl wget",
    description:
      "Adds ffmpeg and common CLI utilities for media bots and tooling."
  },
  {
    id: "downloader_kit",
    label: "Downloader Kit",
    runtime: "PYTHON",
    aptPackages: "aria2 curl wget unzip zip p7zip-full jq",
    description:
      "Adds aria2, curl, wget, archive tools, and jq for downloader bots."
  },
  {
    id: "node_basic",
    label: "Node Basic",
    runtime: "NODE",
    aptPackages: "",
    description: "Minimal Node runtime using node:20-slim base image."
  },
  {
    id: "node_ffmpeg",
    label: "Node + FFmpeg",
    runtime: "NODE",
    aptPackages: "ffmpeg unzip zip p7zip-full jq curl wget",
    description:
      "Adds ffmpeg and common CLI utilities for Node-based media/webhook bots."
  }
];

export function getPresetById(id: TemplatePresetId | null | undefined) {
  if (!id) return undefined;
  return TEMPLATE_PRESETS.find((p) => p.id === id);
}

