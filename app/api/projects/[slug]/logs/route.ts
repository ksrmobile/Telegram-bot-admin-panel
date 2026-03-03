import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { streamContainerLogs } from "../../../../../lib/docker";

type Params = {
  params: { slug: string };
};

export async function GET(req: Request, { params }: Params) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const containerName =
    project.dockerContainerName || `ksr-bot-${project.slug}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stop = await streamContainerLogs(containerName, (chunk) => {
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line) continue;
            const payload = `data: ${line}\n\n`;
            controller.enqueue(encoder.encode(payload));
          }
        });

        const abort = () => {
          stop();
          controller.close();
        };

        // @ts-ignore
        req.signal?.addEventListener("abort", abort);
      } catch (e: any) {
        // If the container doesn't exist or logs can't be streamed,
        // send a single informational line instead of throwing.
        const msg =
          typeof e?.message === "string"
            ? e.message
            : "Unable to stream Docker logs.";
        const friendly = msg.includes("no such container")
          ? "Container not found yet. Start the project to see logs."
          : msg;
        const payload = `data: ${friendly}\n\n`;
        controller.enqueue(encoder.encode(payload));
        controller.close();
      }
    },
    cancel() {
      // no-op; streamContainerLogs cleanup is handled via abort
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

