"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, type Module, type UserRole } from "@/lib/auth";

async function requireAdmin() {
  const session = await getCurrentProfile();
  if (!session || session.profile.role !== "admin") {
    throw new Error("Apenas a administradora pode gerenciar usuários.");
  }
  return session;
}

export async function createStaffUser(formData: FormData) {
  await requireAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "funcionario") as UserRole;
  const tempPassword = String(formData.get("temp_password") ?? "");

  if (!fullName || !email || tempPassword.length < 6) {
    throw new Error("Preencha nome, e-mail e uma senha temporária com pelo menos 6 caracteres.");
  }

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error) {
    throw new Error(`Não foi possível criar o usuário: ${error.message}`);
  }

  revalidatePath("/configuracoes");
}

export async function setPermission(profileId: string, module: Module, canAccess: boolean) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("profile_permissions")
    .upsert(
      { profile_id: profileId, module, can_access: canAccess },
      { onConflict: "profile_id,module" }
    );

  if (error) {
    throw new Error(`Não foi possível atualizar a permissão: ${error.message}`);
  }

  revalidatePath("/configuracoes");
}

export async function setActive(profileId: string, active: boolean) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", profileId);

  if (error) {
    throw new Error(`Não foi possível atualizar o usuário: ${error.message}`);
  }

  revalidatePath("/configuracoes");
}
