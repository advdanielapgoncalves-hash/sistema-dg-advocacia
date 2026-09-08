import { createAdminClient } from "@/lib/supabase/admin";
import { consultarProcessoDataJud, classificarMovimentoDataJud } from "@/lib/datajud";

export type ResumoSincronizacao = {
  processosVerificados: number;
  novosAndamentos: number;
  erros: { numero_processo: string; erro: string }[];
};

/**
 * Roda a sincronização com o DataJud pra todos os processos elegíveis:
 * - segredo_justica = false (sigiloso nunca aparece no DataJud, ver README)
 * - monitoramento_diario_oficial = true (a pessoa marcou que quer monitorar)
 *
 * Usa o cliente service_role porque isso roda sem sessão de usuário (cron
 * job da Vercel) — precisa ignorar RLS pra ver processos de todo mundo.
 *
 * Idempotência: como a API do DataJud não garante nenhum ID estável de
 * movimento (ver datajud.ts), a deduplicação é feita comparando
 * processo_id + data (dia) + descrição contra o que já existe em
 * andamentos_processuais antes de inserir. Rodar esta função mais de uma
 * vez pro mesmo dia não deve duplicar registros.
 */
export async function runDataJudSync(): Promise<ResumoSincronizacao> {
  const supabase = createAdminClient();
  const resumo: ResumoSincronizacao = { processosVerificados: 0, novosAndamentos: 0, erros: [] };

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

  for (const processo of processos ?? []) {
    resumo.processosVerificados += 1;

    const resultado = await consultarProcessoDataJud(processo.numero_processo);
    if (!resultado.ok) {
      resumo.erros.push({ numero_processo: processo.numero_processo, erro: resultado.erro });
      continue;
    }

    if (resultado.movimentos.length === 0) continue;

    // Já existentes deste processo, pra deduplicar antes de inserir.
    const { data: existentes } = await supabase
      .from("andamentos_processuais")
      .select("data_andamento, descricao")
      .eq("processo_id", processo.id)
      .eq("origem", "datajud");

    const jaExiste = new Set((existentes ?? []).map((e) => `${e.data_andamento}|${e.descricao}`));

    for (const mov of resultado.movimentos) {
      const nome = mov.nome?.trim();
      if (!nome || !mov.dataHora) continue;

      const dataAndamento = mov.dataHora.slice(0, 10); // "AAAA-MM-DD" a partir do dataHora ISO
      const chave = `${dataAndamento}|${nome}`;
      if (jaExiste.has(chave)) continue;

      const { error: errInsert } = await supabase.from("andamentos_processuais").insert({
        processo_id: processo.id,
        data_andamento: dataAndamento,
        descricao: nome,
        origem: "datajud",
        tipo: classificarMovimentoDataJud(nome),
        data_push: new Date().toISOString(),
      });

      if (errInsert) {
        resumo.erros.push({ numero_processo: processo.numero_processo, erro: errInsert.message });
        continue;
      }

      jaExiste.add(chave);
      resumo.novosAndamentos += 1;
    }
  }

  return resumo;
}
