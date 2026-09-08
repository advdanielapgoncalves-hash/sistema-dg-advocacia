import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TribunalClient, { type CredencialRow } from "./TribunalClient";

export default async function TribunalPage() {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  if (session.profile.role === "cliente") redirect("/portal");

  const supabase = await createClient();
  const { data } = await supabase
    .from("credenciais_tribunal")
    .select("tribunal_sistema, identificador, updated_at")
    .eq("profile_id", session.profile.id);

  const credenciais: CredencialRow[] = data ?? [];

  return (
    <div>
      <h1 className="text-[22px] font-bold text-foreground">Credenciais de tribunal</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Pra consultar processos em segredo de justiça automaticamente é preciso logar com o SEU acesso no
        portal do tribunal — só quem é advogado(a) habilitado(a) no processo enxerga o sigiloso.
      </p>
      <div className="mt-6">
        <TribunalClient credenciais={credenciais} />
      </div>
    </div>
  );
}
