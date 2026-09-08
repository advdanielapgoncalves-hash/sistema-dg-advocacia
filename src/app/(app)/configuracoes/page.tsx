import { redirect } from "next/navigation";
import { getCurrentProfile, type Module } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ConfiguracoesClient, { type StaffMember } from "./ConfiguracoesClient";

const TOGGLE_MODULES: Module[] = ["clientes", "processos", "prazos", "tarefas", "financeiro"];

export default async function ConfiguracoesPage() {
  const session = await getCurrentProfile();

  if (!session || session.profile.role !== "admin") {
    redirect("/painel");
  }

  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active")
    .order("created_at", { ascending: true });

  const { data: overrides } = await supabase
    .from("profile_permissions")
    .select("profile_id, module, can_access");

  const staff: StaffMember[] = (profiles ?? [])
    .filter((p) => p.role !== "cliente")
    .map((p) => ({
      ...p,
      permissions: Object.fromEntries(
        TOGGLE_MODULES.map((m) => {
          const override = overrides?.find((o) => o.profile_id === p.id && o.module === m);
          const roleDefault =
            p.role === "admin" ? true : m !== "financeiro";
          return [m, override ? override.can_access : roleDefault];
        })
      ) as Record<Module, boolean>,
    }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-foreground">Configurações</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Cadastre a equipe e escolha o que cada pessoa pode acessar no sistema.
        </p>
      </div>

      <ConfiguracoesClient staff={staff} modules={TOGGLE_MODULES} />
    </div>
  );
}
