"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function createProcesso(formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const clienteId = String(formData.get("cliente_id") ?? "");
  const numeroProcesso = String(formData.get("numero_processo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const responsavelId = String(formData.get("responsavel_id") ?? "") || null;
  const monitoramento = formData.get("monitoramento_diario_oficial") === "on";
  const segredoJustica = formData.get("segredo_justica") === "on";
  const autor = String(formData.get("autor") ?? "").trim() || null;
  const reu = String(formData.get("reu") ?? "").trim() || null;
  const valorCausaRaw = String(formData.get("valor_causa") ?? "").replace(",", ".").trim();
  const valorCausa = valorCausaRaw ? Number(valorCausaRaw) : null;

  if (!clienteId || !numeroProcesso) {
    throw new Error("Selecione o cliente e informe o número do processo.");
  }
  if (valorCausaRaw && !Number.isFinite(valorCausa)) {
    throw new Error("Valor da causa inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("processos").insert({
    cliente_id: clienteId,
    numero_processo: numeroProcesso,
    descricao,
    responsavel_id: responsavelId,
    monitoramento_diario_oficial: monitoramento,
    segredo_justica: segredoJustica,
    tribunal_sistema: segredoJustica ? "esaj" : null,
    autor,
    reu,
    valor_causa: valorCausa,
    created_by: session.profile.id,
  });

  if (error) {
    throw new Error(`Não foi possível criar o processo: ${error.message}`);
  }

  revalidatePath("/operacional");
  revalidatePath("/clientes");
}

export async function updateProcessoStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("processos").update({ status }).eq("id", id);
  if (error) throw new Error(`Não foi possível atualizar o processo: ${error.message}`);
  revalidatePath("/operacional");
}

export async function createPrazo(formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const processoId = String(formData.get("processo_id") ?? "") || null;
  const tipo = String(formData.get("tipo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const dataVencimento = String(formData.get("data_vencimento") ?? "");
  const responsavelId = String(formData.get("responsavel_id") ?? "") || null;

  if (!tipo || !dataVencimento) {
    throw new Error("Informe o tipo de prazo e a data de vencimento.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("prazos").insert({
    processo_id: processoId,
    tipo,
    descricao,
    data_vencimento: dataVencimento,
    responsavel_id: responsavelId,
    created_by: session.profile.id,
  });

  if (error) {
    throw new Error(`Não foi possível criar o prazo: ${error.message}`);
  }

  revalidatePath("/operacional");
}

export async function updatePrazo(id: string, formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const tipo = String(formData.get("tipo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const dataVencimento = String(formData.get("data_vencimento") ?? "");
  const responsavelId = String(formData.get("responsavel_id") ?? "") || null;

  if (!tipo || !dataVencimento) {
    throw new Error("Informe o tipo de prazo e a data de vencimento.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("prazos")
    .update({ tipo, descricao, data_vencimento: dataVencimento, responsavel_id: responsavelId })
    .eq("id", id);

  if (error) {
    throw new Error(`Não foi possível atualizar o prazo: ${error.message}`);
  }

  revalidatePath("/operacional");
}

// Concluir um prazo com registro do que foi feito (pedido da Daniela: ao
// finalizar, ela quer escrever uma observação — ex: "protocolo na pasta,
// pendente informar o cliente" — e já ter a opção de lançar o tempo gasto
// nessa mesma ação, sem precisar ir até a aba Timesheet depois). O tempo,
// se informado, entra como um apontamento vinculado a este prazo.
export async function concluirPrazo(id: string, formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const observacao = String(formData.get("observacao") ?? "").trim();
  const minutosRaw = String(formData.get("minutos") ?? "").replace(",", ".").trim();
  const minutos = minutosRaw ? Math.round(Number(minutosRaw)) : null;

  if (!observacao) {
    throw new Error("Descreva o que foi feito para concluir este prazo.");
  }
  if (minutosRaw && (!Number.isFinite(minutos) || (minutos as number) <= 0)) {
    throw new Error("O tempo gasto, se informado, precisa ser maior que zero (em minutos).");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("prazos")
    .update({
      status: "concluido",
      observacao_conclusao: observacao,
      concluido_em: new Date().toISOString(),
      concluido_por: session.profile.id,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Não foi possível concluir o prazo: ${error.message}`);
  }

  if (minutos) {
    const { error: apontamentoError } = await supabase.from("apontamentos_tempo").insert({
      descricao: observacao,
      minutos,
      data: new Date().toISOString().slice(0, 10),
      prazo_id: id,
      profile_id: session.profile.id,
    });
    if (apontamentoError) {
      throw new Error(
        `O prazo foi concluído, mas não foi possível lançar o timesheet: ${apontamentoError.message}`
      );
    }
  }

  revalidatePath("/operacional");
  revalidatePath("/painel");
}

export async function updatePrazoStatus(id: string, status: "pendente" | "concluido") {
  const supabase = await createClient();
  const { error } = await supabase.from("prazos").update({ status }).eq("id", id);
  if (error) throw new Error(`Não foi possível atualizar o prazo: ${error.message}`);
  revalidatePath("/operacional");
}

export async function createTarefa(formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const responsavelId = String(formData.get("responsavel_id") ?? "");
  const dataLimite = String(formData.get("data_limite") ?? "") || null;

  if (!titulo || !responsavelId) {
    throw new Error("Informe o título da tarefa e o responsável.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tarefas").insert({
    titulo,
    descricao,
    responsavel_id: responsavelId,
    data_limite: dataLimite,
    atribuido_por: session.profile.id,
  });

  if (error) {
    throw new Error(`Não foi possível delegar a tarefa: ${error.message}`);
  }

  revalidatePath("/operacional");
}

export async function updateTarefaStatus(
  id: string,
  status: "pendente" | "em_andamento" | "concluida"
) {
  const supabase = await createClient();
  const { error } = await supabase.from("tarefas").update({ status }).eq("id", id);
  if (error) throw new Error(`Não foi possível atualizar a tarefa: ${error.message}`);
  revalidatePath("/operacional");
}

export async function createApontamento(formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const descricao = String(formData.get("descricao") ?? "").trim();
  const minutosRaw = String(formData.get("minutos") ?? "").replace(",", ".");
  const minutos = Math.round(Number(minutosRaw));
  const data = String(formData.get("data") ?? "") || new Date().toISOString().slice(0, 10);
  const tarefaId = String(formData.get("tarefa_id") ?? "") || null;
  const prazoId = String(formData.get("prazo_id") ?? "") || null;

  if (!descricao || !Number.isFinite(minutos) || minutos <= 0) {
    throw new Error("Descreva a atividade e informe um tempo maior que zero (em minutos, ex: 90).");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("apontamentos_tempo").insert({
    descricao,
    minutos,
    data,
    tarefa_id: tarefaId,
    prazo_id: prazoId,
    profile_id: session.profile.id,
  });

  if (error) {
    throw new Error(`Não foi possível salvar o apontamento: ${error.message}`);
  }

  revalidatePath("/operacional");
}

export async function deleteApontamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("apontamentos_tempo").delete().eq("id", id);
  if (error) throw new Error(`Não foi possível excluir o apontamento: ${error.message}`);
  revalidatePath("/operacional");
}

export async function marcarIntimacaoRevisada(id: string) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("andamentos_processuais")
    .update({ revisado_por: session.profile.id, revisado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Não foi possível marcar como revisada: ${error.message}`);
  revalidatePath("/operacional");
}

export async function createAndamentoManual(formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const processoId = String(formData.get("processo_id") ?? "");
  const dataAndamento = String(formData.get("data_andamento") ?? "");
  const descricao = String(formData.get("descricao") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "andamento");

  if (!processoId || !dataAndamento || !descricao) {
    throw new Error("Selecione o processo e informe a data e a descrição do andamento/intimação.");
  }
  if (tipo !== "andamento" && tipo !== "intimacao") {
    throw new Error("Tipo inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("andamentos_processuais").insert({
    processo_id: processoId,
    data_andamento: dataAndamento,
    descricao,
    origem: "manual",
    tipo,
    data_push: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Não foi possível registrar o andamento: ${error.message}`);
  }

  revalidatePath("/operacional");
  revalidatePath("/painel");
}

export async function sincronizarDataJudManual() {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");
  if (!session.permissions.processos) {
    throw new Error("Você não tem permissão pra sincronizar processos.");
  }

  // Import feito aqui dentro (não no topo do arquivo) porque este módulo usa
  // o cliente service_role (ignora RLS) — só deve rodar quando esta ação é
  // de fato chamada, nunca ser carregado por engano em código de cliente.
  const { runDataJudSync } = await import("@/lib/datajudSync");
  const resumo = await runDataJudSync();
  revalidatePath("/operacional");
  revalidatePath("/painel");
  return resumo;
}
