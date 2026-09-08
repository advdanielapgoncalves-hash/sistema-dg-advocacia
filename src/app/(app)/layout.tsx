import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentProfile();

  if (!session) {
    redirect("/login");
  }

  if (session.profile.role === "cliente") {
    // Cliente usa o portal enxuto (Fase 6), não este shell interno.
    redirect("/portal");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={session.profile} permissions={session.permissions} />
      <main className="min-w-0 flex-1 px-12 py-10">{children}</main>
    </div>
  );
}
