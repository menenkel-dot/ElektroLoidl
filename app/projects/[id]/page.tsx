import { Shell } from '@/components/layout/shell';
import { ProjectDetailView } from '@/components/projects/project-detail-view';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Shell>
      <ProjectDetailView projectId={id} />
    </Shell>
  );
}
