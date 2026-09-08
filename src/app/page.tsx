import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function RootPage() {
  const session = await getCurrentProfile();

  if (!session) {
    redirect("/login");
  }

  redirect(session.profile.role === "cliente" ? "/portal" : "/painel");
}
