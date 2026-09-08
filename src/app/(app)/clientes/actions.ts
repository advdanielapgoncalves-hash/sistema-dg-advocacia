"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

async function requireClientesAccess() {
  const session = await getCurrentProfile();
  if (!session || !session.permissions.clientes) {
    throw new Error("Você não tem acesso ao módulo Clientes.");
  }
  return session;
}

export async function createCliente(formData: FormData) {
  await requireClientesAccess();

  const nomeCompleto = String(formData.get("nome_completo") ?? "").trim();
  const cpfCnpj = String(formData.get("cpf_cnpj") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const endereco = String(formData.get("endereco") ?? "").trim() || null;

  if (!nomeCompleto) {
    throw new Error("Nome completo é obrigatório.");
  }

  const session = await getCurrentProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nome_completo: nomeCompleto,
      cpf_cnpj: cpfCnpj,
      telefone,
      email,
      endereco,
      created_by: session?.profile.id,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Não foi possível cadastrar o cliente: ${error.message}`);
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function addAtendimento(clienteId: string, formData: FormData) {
  await requireClientesAccess();

  const descricao = String(formData.get("descricao") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim() || null;

  if (!descricao) {
    throw new Error("Descreva o atendimento antes de salvar.");
  }

  const session = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("atendimentos_cliente").insert({
    cliente_id: clienteId,
    descricao,
    tipo,
    registrado_por: session?.profile.id,
  });

  if (error) {
    throw new Error(`Não foi possível salvar o atendimento: ${error.message}`);
  }

  revalidatePath(`/clientes/${clienteId}`);
}
