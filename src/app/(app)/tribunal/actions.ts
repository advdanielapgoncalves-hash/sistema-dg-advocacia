"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";

const TRIBUNAIS = ["esaj", "pje", "eproc", "projudi"] as const;

export async function saveCredencial(formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const tribunal = String(formData.get("tribunal_sistema") ?? "");
  const identificador = String(formData.get("identificador") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!TRIBUNAIS.includes(tribunal as (typeof TRIBUNAIS)[number])) {
    throw new Error("Tribunal inválido.");
  }
  if (!identificador || !senha) {
    throw new Error("Informe o login/CPF-CNPJ e a senha.");
  }

  const segredoCifrado = encryptSecret(senha);

  const supabase = await createClient();
  const { error } = await supabase.from("credenciais_tribunal").upsert(
    {
      profile_id: session.profile.id,
      tribunal_sistema: tribunal,
      identificador,
      segredo_cifrado: segredoCifrado,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,tribunal_sistema" }
  );

  if (error) {
    throw new Error(`Não foi possível salvar a credencial: ${error.message}`);
  }

  revalidatePath("/tribunal");
}

export async function deleteCredencial(tribunal: string) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("credenciais_tribunal")
    .delete()
    .eq("profile_id", session.profile.id)
    .eq("tribunal_sistema", tribunal);

  if (error) throw new Error(`Não foi possível remover: ${error.message}`);
  revalidatePath("/tribunal");
}
