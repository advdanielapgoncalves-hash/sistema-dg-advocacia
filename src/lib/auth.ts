import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "funcionario" | "cliente";

export type Module =
  | "clientes"
  | "processos"
  | "prazos"
  | "tarefas"
  | "financeiro"
  | "configuracoes";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  active: boolean;
};

/**
 * Perfil do usuário logado + suas permissões por módulo, já resolvidas
 * (override individual quando existir, senão o padrão do papel). Isto é só
 * para decidir o que MOSTRAR na tela — a trava de verdade é a Row Level
 * Security do Postgres (ver supabase/migrations/0001_init.sql, função
 * has_permission), que vale mesmo que alguém tente burlar a interface.
 */
export async function getCurrentProfile(): Promise<{
  profile: Profile;
  permissions: Record<Module, boolean>;
} | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const { data: overrides } = await supabase
    .from("profile_permissions")
    .select("module, can_access")
    .eq("profile_id", user.id);

  const modules: Module[] = [
    "clientes",
    "processos",
    "prazos",
    "tarefas",
    "financeiro",
    "configuracoes",
  ];

  const defaultFor = (role: UserRole, module: Module) => {
    if (role === "admin") return true;
    if (role === "cliente") return false;
    // funcionário: acesso a tudo por padrão, exceto financeiro e configurações
    if (module === "financeiro" || module === "configuracoes") return false;
    return true;
  };

  const permissions = Object.fromEntries(
    modules.map((m) => {
      const override = overrides?.find((o) => o.module === m);
      return [m, override ? override.can_access : defaultFor(profile.role, m)];
    })
  ) as Record<Module, boolean>;

  return { profile, permissions };
}

/**
 * Usada no topo de cada página de módulo (Clientes, Financeiro, ...) para
 * mandar de volta ao Painel quem não tem permissão — mesmo que a pessoa
 * digite a URL direto. Isto é uma segunda camada de conveniência; a trava
 * que realmente não pode ser burlada é a Row Level Security do banco.
 */
export async function requireModule(module: Module) {
  const session = await getCurrentProfile();

  if (!session) {
    redirect("/login");
  }

  if (!session.permissions[module]) {
    redirect("/painel");
  }

  return session;
}
