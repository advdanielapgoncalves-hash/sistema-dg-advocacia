"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { enviarEmail } from "@/lib/email";

function fmtDataBR(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

export async function salvarConteudoAdicional(id: string, formData: FormData) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const conteudoAdicional = String(formData.get("conteudo_adicional") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("relatorios_clientes")
    .update({ conteudo_adicional: conteudoAdicional })
    .eq("id", id);

  if (error) throw new Error(`Não foi possível salvar: ${error.message}`);

  revalidatePath("/relatorios");
}

export async function enviarRelatorio(id: string) {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");

  const supabase = await createClient();

  const { data: relatorio, error: errFetch } = await supabase
    .from("relatorios_clientes")
    .select(
      "id, status, conteudo_gerado, conteudo_adicional, periodo_inicio, periodo_fim, cliente_id, clientes(nome_completo, email)"
    )
    .eq("id", id)
    .single();

  if (errFetch || !relatorio) {
    throw new Error("Relatório não encontrado.");
  }
  if (relatorio.status === "enviado") {
    throw new Error("Este relatório já foi enviado.");
  }

  const cliente = Array.isArray(relatorio.clientes) ? relatorio.clientes[0] : relatorio.clientes;
  if (!cliente?.email) {
    throw new Error("Este cliente não tem e-mail cadastrado — cadastre um e-mail antes de enviar.");
  }

  const partes = [relatorio.conteudo_gerado];
  if (relatorio.conteudo_adicional) partes.push(relatorio.conteudo_adicional);
  const corpo = partes.join("\n\n---\n\n");

  const assunto = `Atualização do seu processo — ${fmtDataBR(relatorio.periodo_inicio)} a ${fmtDataBR(relatorio.periodo_fim)}`;

  const resultadoEnvio = await enviarEmail({ para: cliente.email, assunto, corpo });
  if (!resultadoEnvio.ok) {
    throw new Error(`Não foi possível enviar o e-mail: ${resultadoEnvio.erro}`);
  }

  const { error: errUpdate } = await supabase
    .from("relatorios_clientes")
    .update({ status: "enviado", enviado_em: new Date().toISOString(), enviado_por: session.profile.id })
    .eq("id", id);

  if (errUpdate) {
    throw new Error(
      `O e-mail foi enviado, mas não foi possível marcar como enviado no sistema: ${errUpdate.message}`
    );
  }

  revalidatePath("/relatorios");
}

// Dispara manualmente a geração dos rascunhos do período quinzenal atual —
// útil pra testar logo após o deploy, sem esperar o cron de dia 1/15.
export async function gerarRelatoriosAgora() {
  const session = await getCurrentProfile();
  if (!session) throw new Error("Sessão expirada, faça login de novo.");
  if (!session.permissions.clientes) {
    throw new Error("Você não tem permissão pra gerar relatórios.");
  }

  const { gerarRelatoriosPeriodo, periodoQuinzenalAtual } = await import("@/lib/relatorioCliente");
  const { inicio, fim } = periodoQuinzenalAtual();
  const resumo = await gerarRelatoriosPeriodo(inicio, fim);

  revalidatePath("/relatorios");
  return { periodo: { inicio, fim }, ...resumo };
}
