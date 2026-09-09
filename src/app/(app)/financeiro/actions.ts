"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { dataParcela } from "@/lib/parcelamento";

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

// Cria um "plano de pagamento" completo pra um cliente numa única ação:
// uma entrada opcional (lançamento já recebido, cai direto no fluxo de
// caixa) e/ou N parcelas futuras (recebimentos esperados, com baixa manual
// depois). Pensado pro caso que a Daniela descreveu: "recebo 700 de entrada
// e mais 5 parcelas de 400, todo dia 10" — tudo isso numa vez só, com as
// datas das parcelas calculadas automaticamente (ver src/lib/parcelamento.ts).
export async function createPlanoRecebimento(formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const clienteId = String(formData.get("cliente_id") ?? "");
  const processoId = String(formData.get("processo_id") ?? "") || null;
  const descricao = String(formData.get("descricao") ?? "").trim();
  const formaRecebimento = String(formData.get("forma_recebimento") ?? "").trim() || null;

  const entradaValorRaw = String(formData.get("entrada_valor") ?? "").replace(",", ".").trim();
  const entradaValor = entradaValorRaw ? Number(entradaValorRaw) : null;
  const entradaData = String(formData.get("entrada_data") ?? "").trim() || null;

  const numeroParcelas = Math.round(Number(formData.get("numero_parcelas") ?? "0")) || 0;
  const valorParcelaRaw = String(formData.get("valor_parcela") ?? "").replace(",", ".").trim();
  const valorParcela = valorParcelaRaw ? Number(valorParcelaRaw) : null;
  const dataPrimeiraParcela = String(formData.get("data_primeira_parcela") ?? "").trim() || null;

  if (!clienteId || !descricao) {
    throw new Error("Selecione o cliente e informe uma descrição para o plano de pagamento.");
  }

  const temEntrada = entradaValor !== null && entradaValorRaw !== "";
  const temParcelas = numeroParcelas > 0;

  if (!temEntrada && !temParcelas) {
    throw new Error("Informe o valor de entrada e/ou as parcelas do plano de pagamento.");
  }
  if (temEntrada && (!Number.isFinite(entradaValor) || (entradaValor as number) <= 0 || !entradaData)) {
    throw new Error("Para a entrada, informe um valor maior que zero e a data em que foi (ou será) recebida.");
  }
  if (temParcelas && (!Number.isFinite(valorParcela) || (valorParcela as number) <= 0 || !dataPrimeiraParcela)) {
    throw new Error("Para as parcelas, informe o valor de cada uma e a data de vencimento da primeira.");
  }

  const supabase = await createClient();

  if (temEntrada && entradaValor !== null && entradaData) {
    const { error } = await supabase.from("financeiro_lancamentos").insert({
      tipo: "entrada",
      descricao: `${descricao} — entrada`,
      categoria: "Honorários",
      valor: entradaValor,
      data: entradaData,
      cliente_id: clienteId,
      criado_por: session.profile.id,
    });
    if (error) {
      throw new Error(`Não foi possível salvar a entrada: ${error.message}`);
    }
  }

  if (temParcelas && valorParcela !== null && dataPrimeiraParcela) {
    const parcelasParaInserir = Array.from({ length: numeroParcelas }, (_, i) => ({
      cliente_id: clienteId,
      processo_id: processoId,
      descricao: `${descricao} — parcela ${i + 1}/${numeroParcelas}`,
      numero_parcela: i + 1,
      total_parcelas: numeroParcelas,
      valor: valorParcela,
      forma_recebimento: formaRecebimento,
      data_vencimento: dataParcela(dataPrimeiraParcela, i),
      status: "a_vencer" as const,
    }));

    const { error } = await supabase.from("financeiro_parcelas").insert(parcelasParaInserir);
    if (error) {
      throw new Error(`Não foi possível salvar as parcelas: ${error.message}`);
    }
  }

  revalidatePath("/financeiro");
  revalidatePath("/painel");
  revalidatePath(`/clientes/${clienteId}`);
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
