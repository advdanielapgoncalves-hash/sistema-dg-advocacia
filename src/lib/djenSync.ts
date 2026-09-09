import { createAdminClient } from "@/lib/supabase/admin";
import { consultarComunicacoesDjen } from "@/lib/djen";
import { classificarAndamento, isRelevantePararRelatorio } from "@/lib/classificacaoAndamento";

export type ResumoSincronizacaoDjen = {
  processosVerificados: number;
  novasComunicacoes: number;
  erros: { numero_processo: string; erro: string }[];
};

/**
 * Sincronização com o DJEN pra todos os processos elegíveis — mesmo
 * critério já usado pro DataJud (segredo_justica = false, monitoramento
 * ligado, processo ativo). Roda com o cliente service_role porque é
 * chamada pelo Cron Job da Vercel, sem sessão de usuário.
 *
 * Diferente do DataJud (que hoje só cobre o TJSP, ver datajud.ts), a API do
 * DJEN parece ser nacional — consulta por número de processo sem exigir o
 * tribunal — então isso pode cobrir processos fora do TJSP também. Isso não
 * foi testado ainda (ver aviso em djen.ts).
 *
 * Janela de busca: últimos 30 dias a partir de hoje, toda vez que roda —
 * folga de sobra pra nunca perder uma comunicação entre duas execuções
 * diárias, já que a deduplicação por djen_id garante que reprocessar o
 * mesmo período não duplica nada.
 */
export async function runDjenSync(): Promise<ResumoSincronizacaoDjen> {
  const supabase = createAdminClient();
  const resumo: ResumoSincronizacaoDjen = { processosVerificados: 0, novasComunicacoes: 0, erros: [] };

  const { data: processos, error: errProcessos } = await supabase
    .from("processos")
    .select("id, numero_processo")
    .eq("segredo_justica", false)
    .eq("monitoramento_diario_oficial", true)
    .eq("status", "ativo");

  if (errProcessos) {
    resumo.erros.push({ numero_processo: "(consulta de processos)", erro: errProcessos.message });
    return resumo;
  }

  const hoje = new Date();
  const dataFim = hoje.toISOString().slice(0, 10);
  const trintaDiasAtras = new Date(hoje);
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
  const dataInicio = trintaDiasAtras.toISOString().slice(0, 10);

  for (const processo of processos ?? []) {
    resumo.processosVerificados += 1;

    const resultado = await consultarComunicacoesDjen(processo.numero_processo, dataInicio, dataFim);
    if (!resultado.ok) {
      resumo.erros.push({ numero_processo: processo.numero_processo, erro: resultado.erro });
      continue;
    }

    if (resultado.comunicacoes.length === 0) continue;

    const { data: existentes } = await supabase
      .from("andamentos_processuais")
      .select("djen_id")
      .eq("processo_id", processo.id)
      .eq("origem", "djen");

    const jaExiste = new Set((existentes ?? []).map((e) => e.djen_id).filter((id): id is string => Boolean(id)));

    for (const com of resultado.comunicacoes) {
      const djenId = com.id != null ? String(com.id) : null;
      const texto = com.texto?.trim();
      const dataDisp = com.dataDisponibilizacao;
      if (!djenId || !texto || !dataDisp || jaExiste.has(djenId)) continue;

      const categoria = classificarAndamento(texto);

      const { error: errInsert } = await supabase.from("andamentos_processuais").insert({
        processo_id: processo.id,
        data_andamento: dataDisp.slice(0, 10),
        descricao: texto,
        origem: "djen",
        tipo: "intimacao",
        djen_id: djenId,
        categoria_relatorio: categoria,
        relevante_relatorio: isRelevantePararRelatorio(categoria),
        data_push: new Date().toISOString(),
      });

      if (errInsert) {
        resumo.erros.push({ numero_processo: processo.numero_processo, erro: errInsert.message });
        continue;
      }

      jaExiste.add(djenId);
      resumo.novasComunicacoes += 1;
    }
  }

  return resumo;
}
