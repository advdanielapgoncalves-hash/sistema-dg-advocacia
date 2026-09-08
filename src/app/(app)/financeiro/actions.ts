"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function createLancamento(formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const tipo = String(formData.get("tipo") ?? "");
  const descricao = String(formData.get("descricao") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const valorRaw = String(formData.get("valor") ?? "").replace(",", ".");
  const valor = Number(valorRaw);
  const data = String(formData.get("data") ?? "");
  const clienteId = String(formData.get("cliente_id") ?? "") || null;

  if ((tipo !== "entrada" && tipo !== "saida") || !descricao || !data || !Number.isFinite(valor) || valor <= 0) {
    throw new Error("Preencha tipo, descrição, valor (maior que zero) e data.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("financeiro_lancamentos").insert({
    tipo,
    descricao,
    categoria,
    valor,
    data,
    cliente_id: clienteId,
    criado_por: session.profile.id,
  });

  if (error) {
    throw new Error(`Não foi possível salvar o lançamento: ${error.message}`);
  }

  revalidatePath("/financeiro");
}

export async function createParcela(formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const clienteId = String(formData.get("cliente_id") ?? "");
  const processoId = String(formData.get("processo_id") ?? "") || null;
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor") ?? "").replace(",", ".");
  const valor = Number(valorRaw);
  const dataVencimento = String(formData.get("data_vencimento") ?? "");
  const formaRecebimento = String(formData.get("forma_recebimento") ?? "").trim() || null;
  const numeroParcela = Number(formData.get("numero_parcela") ?? "1") || 1;
  const totalParcelas = Number(formData.get("total_parcelas") ?? "1") || 1;

  if (!clienteId || !descricao || !dataVencimento || !Number.isFinite(valor) || valor <= 0) {
    throw new Error("Preencha cliente, descrição, valor (maior que zero) e data de vencimento.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("financeiro_parcelas").insert({
    cliente_id: clienteId,
    processo_id: processoId,
    descricao,
    numero_parcela: numeroParcela,
    total_parcelas: totalParcelas,
    valor,
    forma_recebimento: formaRecebimento,
    data_vencimento: dataVencimento,
    status: "a_vencer",
  });

  if (error) {
    throw new Error(`Não foi possível salvar o recebimento: ${error.message}`);
  }

  revalidatePath("/financeiro");
  revalidatePath("/painel");
}

export async function darBaixaParcela(id: string) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("financeiro_parcelas")
    .update({ status: "pago", data_pagamento: hoje })
    .eq("id", id);

  if (error) {
    throw new Error(`Não foi possível dar baixa neste recebimento: ${error.message}`);
  }

  revalidatePath("/financeiro");
  revalidatePath("/painel");
}

export async function desfazerBaixaParcela(id: string) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("financeiro_parcelas")
    .update({ status: "a_vencer", data_pagamento: null })
    .eq("id", id);

  if (error) {
    throw new Error(`Não foi possível desfazer a baixa: ${error.message}`);
  }

  revalidatePath("/financeiro");
  revalidatePath("/painel");
}
