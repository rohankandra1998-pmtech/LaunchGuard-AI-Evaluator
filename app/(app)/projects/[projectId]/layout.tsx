import { notFound } from "next/navigation";
import { ProjectNav } from "@/components/project-nav";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", user!.id).single();
  if (!project) notFound();

  return (
    <div>
      <ProjectNav projectId={projectId} />
      {children}
    </div>
  );
}
