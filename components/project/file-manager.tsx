"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useToast } from "../ui/toast";
import {
  Folder,
  FileText,
  UploadCloud,
  Download,
  FilePlus,
  FolderPlus,
  Trash2,
  RefreshCcw,
  Pencil
} from "lucide-react";

type FileItem = {
  name: string;
  isDir: boolean;
  size: number;
};

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )ksr_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function FileManager({ slug }: { slug: string }) {
  const { push } = useToast();
  const [path, setPath] = useState(".");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ path: string; name: string } | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadDirectory(p: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/files?path=${encodeURIComponent(
          p
        )}`
      );
      if (!res.ok) throw new Error("Failed to load directory");
      const data = await res.json();
      setItems(data.items);
      setPath(data.path);
    } catch (err: any) {
      push({
        title: "File browser error",
        description: err.message || "Unable to read directory",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  async function openFile(name: string) {
    const rel = path === "." ? name : `${path}/${name}`;
    setSelectedFile(rel);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(
          slug
        )}/file?path=${encodeURIComponent(rel)}`
      );
      if (!res.ok) throw new Error("Unable to open file");
      const data = await res.json();
      setFileContent(data.content ?? "");
    } catch (err: any) {
      push({
        title: "Open file failed",
        description: err.message || "Unable to open file",
        variant: "destructive"
      });
    }
  }

  async function saveFile() {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/file`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken()
          },
          body: JSON.stringify({
            path: selectedFile,
            content: fileContent
          })
        }
      );
      if (!res.ok) throw new Error("Unable to save file");
      push({
        title: "Saved",
        description: selectedFile
      });
      await loadDirectory(path);
    } catch (err: any) {
      push({
        title: "Save failed",
        description: err.message || "Unable to save file",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  }

  async function createEntry(type: "file" | "dir") {
    const name = prompt(
      `New ${type === "file" ? "file" : "folder"} name (relative to ${path})`
    );
    if (!name) return;
    const rel = path === "." ? name : `${path}/${name}`;
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/file`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken()
          },
          body: JSON.stringify({
            path: type === "file" ? rel : `${rel}/.keep`,
            content: type === "file" ? "" : ""
          })
        }
      );
      if (!res.ok) throw new Error("Unable to create");
      await loadDirectory(path);
    } catch (err: any) {
      push({
        title: "Creation failed",
        description: err.message || "Unable to create entry",
        variant: "destructive"
      });
    }
  }

  function confirmDelete(name: string) {
    const rel = path === "." ? name : `${path}/${name}`;
    setDeleteConfirm({ path: rel, name });
  }

  async function doDelete() {
    if (!deleteConfirm) return;
    const rel = deleteConfirm.path;
    setDeleteConfirm(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/file?path=${encodeURIComponent(rel)}`,
        {
          method: "DELETE",
          headers: { "x-csrf-token": getCsrfToken() }
        }
      );
      if (!res.ok) throw new Error("Unable to delete");
      if (selectedFile === rel) {
        setSelectedFile(null);
        setFileContent("");
      }
      await loadDirectory(path);
      push({ title: "Deleted", description: rel });
    } catch (err: any) {
      push({
        title: "Delete failed",
        description: err.message || "Unable to delete entry",
        variant: "destructive"
      });
    }
  }

  async function renameEntry(name: string) {
    const rel = path === "." ? name : `${path}/${name}`;
    const newRel = path === "." ? newName.trim() : `${path}/${newName.trim()}`;
    if (!newName.trim() || newRel === rel) {
      setRenaming(null);
      setNewName("");
      return;
    }
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(slug)}/file`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken()
        },
        body: JSON.stringify({ path: rel, newPath: newRel })
      });
      if (!res.ok) throw new Error("Unable to rename");
      if (selectedFile === rel) setSelectedFile(newRel);
      setRenaming(null);
      setNewName("");
      await loadDirectory(path);
      push({ title: "Renamed", description: `${name} → ${newName.trim()}` });
    } catch (err: any) {
      push({
        title: "Rename failed",
        description: (err as Error).message || "Unable to rename",
        variant: "destructive"
      });
    }
  }

  async function deleteAllInCurrentPath() {
    setDeleteAllConfirm(false);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(
          slug
        )}/files?path=${encodeURIComponent(path)}`,
        {
          method: "DELETE",
          headers: { "x-csrf-token": getCsrfToken() }
        }
      );
      if (!res.ok) throw new Error("Unable to delete all files");
      setSelectedFile(null);
      setFileContent("");
      await loadDirectory(path);
      push({
        title: "Workspace cleared",
        description:
          path === "."
            ? "All files in project root removed."
            : `All files in ${path} removed.`
      });
    } catch (err: any) {
      push({
        title: "Delete all failed",
        description: err.message || "Unable to delete directory contents",
        variant: "destructive"
      });
    }
  }

  async function downloadFile(name: string) {
    const rel = path === "." ? name : `${path}/${name}`;
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(slug)}/file?path=${encodeURIComponent(rel)}`
      );
      if (!res.ok) throw new Error("Unable to download");
      const data = await res.json();
      const blob = new Blob([data.content ?? ""], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      push({ title: "Downloaded", description: name });
    } catch (err: any) {
      push({
        title: "Download failed",
        description: (err as Error).message || "Unable to download",
        variant: "destructive"
      });
    }
  }

  async function uploadZip(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(
          slug
        )}/upload-zip?path=${encodeURIComponent(path)}`,
        {
          method: "POST",
          headers: {
            "x-csrf-token": getCsrfToken()
          },
          body: form
        }
      );
      if (!res.ok) throw new Error("Unable to upload zip");
      push({
        title: "ZIP extracted",
        description: "Archive extracted safely into workspace."
      });
      await loadDirectory(path);
    } catch (err: any) {
      push({
        title: "Upload failed",
        description: err.message || "Unable to upload zip",
        variant: "destructive"
      });
    }
  }

  async function uploadFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(
          slug
        )}/upload-file?path=${encodeURIComponent(path)}`,
        {
          method: "POST",
          headers: {
            "x-csrf-token": getCsrfToken()
          },
          body: form
        }
      );
      if (!res.ok) throw new Error("Unable to upload file");
      await loadDirectory(path);
    } catch (err: any) {
      push({
        title: "Upload failed",
        description: err.message || "Unable to upload file",
        variant: "destructive"
      });
    }
  }

  async function downloadZip() {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(
          slug
        )}/download-zip?path=${encodeURIComponent(path)}`
      );
      if (!res.ok) throw new Error("Unable to create zip");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-${path === "." ? "root" : path}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      push({
        title: "Download failed",
        description: err.message || "Unable to download zip",
        variant: "destructive"
      });
    }
  }

  useEffect(() => {
    loadDirectory(".");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const segments =
    path === "." ? [] : path.split("/").filter((s) => s.length > 0);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Workspace</span>
            <span>/</span>
            {segments.length === 0 ? (
              <Badge variant="outline">root</Badge>
            ) : (
              segments.map((seg, idx) => (
                <button
                  key={idx}
                  className="rounded bg-secondary/50 px-1.5 py-0.5 hover:bg-secondary/80"
                  onClick={() =>
                    loadDirectory(
                      idx === segments.length - 1
                        ? path
                        : segments.slice(0, idx + 1).join("/") || "."
                    )
                  }
                >
                  {seg}
                </button>
              ))
            )}
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => loadDirectory(path)}
              title="Refresh"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => zipInputRef.current?.click()}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload ZIP
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <FilePlus className="h-3.5 w-3.5" />
            Upload file
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => createEntry("file")}
          >
            <FilePlus className="h-3.5 w-3.5" />
            New file
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => createEntry("dir")}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New folder
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={downloadZip}
          >
            <Download className="h-3.5 w-3.5" />
            Download as ZIP
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5"
            disabled={items.length === 0}
            onClick={() => setDeleteAllConfirm(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete all here
          </Button>
        </div>

        <input
          ref={zipInputRef}
          type="file"
          className="hidden"
          accept=".zip"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadZip(file);
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />

        <div className="rounded-lg border border-border/60 bg-card/80">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <span>{items.length} items</span>
            {loading && <span>Loading…</span>}
          </div>
          <div className="max-h-80 overflow-y-auto text-sm">
            {items.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-secondary/40"
              >
                <button
                  className="flex flex-1 items-center gap-2 text-left"
                  onClick={() =>
                    item.isDir
                      ? loadDirectory(
                          path === "." ? item.name : `${path}/${item.name}`
                        )
                      : openFile(item.name)
                  }
                >
                  {item.isDir ? (
                    <Folder className="h-4 w-4 text-amber-300" />
                  ) : (
                    <FileText className="h-4 w-4 text-sky-300" />
                  )}
                  <span className="truncate">{item.name}</span>
                </button>
                <div className="flex items-center gap-1">
                  {!item.isDir && (
                    <span className="text-[11px] text-muted-foreground">
                      {(item.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                  {renaming === item.name ? (
                    <div className="flex items-center gap-1">
                      <Input
                        className="h-7 w-32 text-xs"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameEntry(item.name);
                          if (e.key === "Escape") { setRenaming(null); setNewName(""); }
                        }}
                        autoFocus
                      />
                      <Button size="sm" className="h-7" onClick={() => renameEntry(item.name)}>OK</Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => { setRenaming(null); setNewName(""); }}>Cancel</Button>
                    </div>
                  ) : (
                    <>
                      {!item.isDir && (
                        <button
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={() => downloadFile(item.name)}
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => { setRenaming(item.name); setNewName(item.name); }}
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => confirmDelete(item.name)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Empty directory. Upload a bot ZIP or create files to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl">
            <h2 id="delete-title" className="text-sm font-semibold">Delete?</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Delete <code className="rounded bg-secondary px-1">{deleteConfirm.path}</code>? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {deleteAllConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-all-title"
        >
          <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl">
            <h2
              id="delete-all-title"
              className="text-sm font-semibold"
            >
              Delete all files here?
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              This will remove{" "}
              <span className="font-semibold">
                all files and folders in{" "}
                {path === "." ? "the project root" : path}
              </span>
              . This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteAllConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteAllInCurrentPath}
              >
                Delete all
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">
              Editor
            </span>
            <span className="text-xs text-muted-foreground">
              Supports quick edits for .env, JSON, YAML, TypeScript, Python, and more.
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              readOnly
              value={selectedFile || "No file selected"}
              className="h-8 w-52 truncate text-xs"
            />
            <Button
              size="sm"
              disabled={!selectedFile || saving}
              onClick={saveFile}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <div className="h-[360px] overflow-hidden rounded-lg border border-border/60 bg-card/80">
          {selectedFile ? (
            <textarea
              className="h-full w-full resize-none bg-transparent p-3 font-mono text-xs text-foreground outline-none"
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Select a file from the left to view and edit its contents.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

