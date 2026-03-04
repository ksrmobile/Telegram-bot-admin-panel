import { NextResponse } from "next/server";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);

export async function GET() {
  try {
    const { stdout } = await execFileAsync("git", [
      "ls-remote",
      "--heads",
      "https://github.com/github/gitignore.git"
    ]);
    return NextResponse.json({
      ok: true,
      stdout: stdout.toString()
    });
  } catch (e: any) {
    const msg: string =
      typeof e?.message === "string" ? e.message : "git ls-remote failed";
    const caError =
      msg.includes("certificate") || msg.includes("CAfile") || msg.includes("SSL");
    return NextResponse.json({
      ok: false,
      caError,
      error: msg
    });
  }
}

