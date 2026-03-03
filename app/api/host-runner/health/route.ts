import { NextResponse } from "next/server";
import { checkHostAgentHealth } from "@/lib/host-agent";

export async function GET() {
  const status = await checkHostAgentHealth();
  return NextResponse.json(status, {
    status: status.connected ? 200 : 503
  });
}

