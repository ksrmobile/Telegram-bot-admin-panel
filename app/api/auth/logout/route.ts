import { NextResponse } from "next/server";
import { logout } from "../../../../lib/auth";

export async function POST() {
  try {
    await logout();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Logout error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

