import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORIA_LABEL, type CategoriaAndamento } from "@/lib/classificacaoAndamento";

export type ResumoGeracaoRelatorios = {
  clientesVerificados: number;
  relatoriosCriados: number;
  relatoriosSemNovidade: number;
  erros: { cliente: string; erro: string }[];
};

function fmtDataBR(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Calcula o período do relatório quinzenal com base na data de hoje —
 * pedido da Daniela: datas fixas, dia 1 e dia 15 de cada mês (09/09).
 * Rodando no dia 15, cobre 1 a 14 do mês corrente; rodando no dia 1, cobre
 * 15 até o último dia do mês anterior.
 */
export function periodoQuinzenalAtual(hoje: Date = new Date()): { inicio: string; fim: string } {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const dia = hoje.getDate();

  if (dia <= 15) {
    return { inicio: toISODate(new Date(ano, mes, 1)), fim: toISODate(new Date(ano, mes, 14)) };
  }
  return {
    inicio: toISODate(new Date(ano, mes - 1, 15)),
    fim: toISODate(new Date(ano, mes, 0)), // dia 0 do mês corrente = último dia do mês anterior
  };
}

/**
 * Gera (ou atualiza) o rascunho de relatório de cada cliente pro período
 * informado, a partir dos andamentos marcados como relevante_relatorio=true
 * (ver src/lib/classificacaoAndamento.ts) nos processos desse cliente.
 *
 * Importante: o conteúdo gerado é sempre a descrição/teor tal como
 * capturado do DJEN/DataJud/lançamento manual — nunca uma reescrita ou
 * resumo interpretativo, pra não correr o risco de alterar o sentido de
 * uma decisão. Um relatório já 'enviado' nunca é sobrescrito por uma nova
 * geração (protege o histórico do que já foi mandado ao cliente).
 */
export async function gerarRelatoriosPeriodo(
  periodoInicio: string,
  periodoFim: string
): Promise<ResumoGeracaoRelatorios> {
  const supabase = createAdminClient();
  const resumo: ResumoGeracaoRelatorios = {
    clientesVerificados: 0,
    relatoriosCriados: 0,
    relatoriosSemNovidade: 0,
    erros: [],
  };

  const { data: clientes, error: errClientes } = await supabase.from("clientes").select("id, nome_completo");
  if (errClientes) {
    resumo.erros.push({ cliente: "(consulta de clientes)", erro: errClientes.message });
    return resumo;
  }

  for (const cliente of clientes ?? []) {
    const { data: processos } = await supabase
      .from("processos")
      .select("id, numero_processo")
      .eq("cliente_id", cliente.id);

    if (!processos || processos.length === 0) continue; // sem processo, nada pra relatar

    const { data: relatorioExistente } = await supabase
      .from("relatorios_clientes")
      .select("id, status")
      .eq("cliente_id", cliente.id)
      .eq("periodo_inicio", periodoInicio)
      .eq("periodo_fim", periodoFim)
      .maybeSingle();

    if (relatorioExistente?.status === "enviado") continue; // já foi enviado, não sobrescreve

    resumo.clientesVerificados += 1;

    const processoIds = processos.map((p) => p.id);
    const processoNumeroPorId = new Map(processos.map((p) => [p.id, p.numero_processo]));

    const { data: andamentos, error: errAndamentos } = await supabase
      .from("andamentos_processuais")
      .select("processo_id, data_andamento, descricao, categoria_relatorio")
      .in("processo_id", processoIds)
      .eq("relevante_relatorio", true)
      .gte("data_andamento", periodoInicio)
      .lte("data_andamento", periodoFim)
      .order("data_andamento", { ascending: true });

    if (errAndamentos) {
      resumo.erros.push({ cliente: cliente.nome_completo, erro: errAndamentos.message });
      continue;
    }

    let conteudo: string;
    if (!andamentos || andamentos.length === 0) {
      conteudo = "Nenhuma movimentação relevante identificada neste período.";
      resumo.relatoriosSemNovidade += 1;
    } else {
      conteudo = andamentos
        .map((a) => {
          const numero = processoNumeroPorId.get(a.processo_id) ?? "processo";
          const categoria = CATEGORIA_LABEL[(a.categoria_relatorio ?? "outro") as CategoriaAndamento] ?? "Movimentação";
          return `[Processo ${numero}] ${fmtDataBR(a.data_andamento)} — ${categoria}:\n${a.descricao}`;
        })
        .join("\n\n");
    }

    const { error: errUpsert } = await supabase.from("relatorios_clientes").upsert(
      {
        cliente_id: cliente.id,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        conteudo_gerado: conteudo,
        status: "rascunho",
      },
      { onConflict: "cliente_id,periodo_inicio,periodo_fim" }
    );

    if (errUpsert) {
      resumo.erros.push({ cliente: cliente.nome_completo, erro: errUpsert.message });
      continue;
    }

    resumo.relatoriosCriados += 1;
  }

  return resumo;
}
