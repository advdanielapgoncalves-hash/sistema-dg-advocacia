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
  const cpfCnpj = String(formData.get("cpf_cnpj") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const endereco = String(formData.get("endereco") ?? "").trim() || null;

  if (!nomeCompleto) {
    throw new Error("Nome completo é obrigatório.");
  }
  if (!cpfCnpj) {
    throw new Error("CPF ou CNPJ é obrigatório.");
  }
  if (!telefone) {
    throw new Error("Telefone é obrigatório.");
  }

  // Valida só a quantidade de dígitos (11 = CPF, 14 = CNPJ) — não confere os
  // dígitos verificadores (checksum oficial), só o comprimento, que foi o
  // que a Daniela pediu.
  const digitos = cpfCnpj.replace(/\D/g, "");
  if (digitos.length !== 11 && digitos.length !== 14) {
    throw new Error(
      "CPF precisa ter 11 dígitos ou CNPJ 14 dígitos — confira a quantidade de números digitados."
    );
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

export async function updateAtendimento(id: string, clienteId: string, formData: FormData) {
  await requireClientesAccess();

  const descricao = String(formData.get("descricao") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim() || null;
  const dataRaw = String(formData.get("data") ?? "").trim(); // vem de <input type="datetime-local">

  if (!descricao) {
    throw new Error("Descreva o atendimento antes de salvar.");
  }
  if (!dataRaw) {
    throw new Error("Informe a data do atendimento.");
  }

  const dataConvertida = new Date(dataRaw);
  if (Number.isNaN(dataConvertida.getTime())) {
    throw new Error("Data do atendimento inválida.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("atendimentos_cliente")
    .update({ descricao, tipo, data: dataConvertida.toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Não foi possível atualizar o atendimento: ${error.message}`);
  }

  revalidatePath(`/clientes/${clienteId}`);
}
