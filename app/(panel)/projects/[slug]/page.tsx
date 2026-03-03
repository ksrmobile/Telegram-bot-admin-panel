import { prisma } from "../../../../lib/prisma";
import { notFound } from "next/navigation";
import { ProjectDetailClient } from "../../../../components/project/project-detail-client";

type Params = { params: { slug: string } };

export default async function ProjectDetailPage({ params }: Params) {
  const { slug } = params;
  const project = await prisma.project.findUnique({
    where: { slug }
  });

  if (!project) {
    notFound();
  }

  return (
    <ProjectDetailClient
      project={{
        id: project.id,
        name: project.name,
        slug: project.slug,
        runtimeType: project.runtimeType,
        startCommand: project.startCommand,
        workspacePath: project.workspacePath,
        dockerImageName: project.dockerImageName,
        dockerContainerName: project.dockerContainerName,
        status: project.status,
        runnerMode: (project as any).runnerMode,
        templateRuntime: (project as any).templateRuntime,
        templateAptPackages: (project as any).templateAptPackages,
        templateExposePort: (project as any).templateExposePort
      }}
    />
  );
}
