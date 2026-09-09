/**
 * Cliente para a API pública de Comunicações Processuais do CNJ — o DJEN
 * (Diário de Justiça Eletrônico Nacional).
 *
 * ATENÇÃO — pesquisado, NÃO testado a partir deste ambiente: assim como o
 * DataJud (ver src/lib/datajud.ts), o domínio oficial (comunicaapi.pje.jus.br)
 * bloqueia acesso de fora do Brasil — confirmei isso tentando acessar direto
 * daqui e recebendo HTTP 403, o mesmo bloqueio já documentado neste projeto
 * pra cnj.jus.br e esaj.tjsp.jus.br. A implementação abaixo é baseada em
 * fontes de terceiros que descrevem a API oficial (não consegui confirmar
 * direto na documentação primária do CNJ/PJe por causa desse bloqueio) — o
 * primeiro teste real só vai acontecer em produção (Vercel), do mesmo jeito
 * que aconteceu com o DataJud. Acompanhe os logs da função na primeira
 * execução, e trate os nomes de campo abaixo como a melhor aproximação
 * disponível, não como certeza.
 *
 * Fontes (terceiros — a documentação oficial ficou bloqueada daqui):
 * - Endpoint (comunicaapi.pje.jus.br/api/v1/comunicacao), parâmetros de
 *   consulta (numeroProcesso, dataDisponibilizacaoInicio/Fim, paginação) e
 *   confirmação de que é gratuita/pública, sem autenticação:
 *   https://chatjuridico.com.br/api-do-djen-consulta-oficial-cnj/
 * - Confirmação de que não há filtro nativo por "tipo de decisão relevante"
 *   (a API devolve tudo do período, o filtro é feito localmente) — mesma
 *   fonte acima.
 * - Existência de um portal de consulta oficial (comunica.pje.jus.br) e de
 *   um Swagger da API (comunicaapi.pje.jus.br) — achados via busca, mas
 *   também bloqueados por geo-restrição ao tentar acessar daqui.
 *
 * Limitação conhecida e IMPORTANTE pro relatório ao cliente: as fontes
 * descrevem o DJEN como cobrindo o que o TRIBUNAL comunica às partes
 * (despachos, decisões interlocutórias, sentenças, acórdãos) — não achei
 * confirmação de que a petição inicial ou a contestação (peças que as
 * PARTES protocolam, não o tribunal) apareçam como "comunicação" do DJEN.
 * Por isso o relatório quinzenal (ver src/lib/relatorioCliente.ts) combina
 * este módulo com os MOVIMENTOS já sincronizados via DataJud, que cobrem
 * oficialmente esse tipo de juntada pela Tabela Processual Unificada do CNJ.
 */

const DJEN_ENDPOINT = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

export type DjenComunicacao = {
  id?: string | number;
  texto?: string;
  tipoComunicacao?: string;
  tipoDocumento?: string;
  dataDisponibilizacao?: string;
  siglaTribunal?: string;
  nomeOrgao?: string;
};

type DjenResultado =
  | { ok: true; comunicacoes: DjenComunicacao[] }
  | { ok: false; erro: string };

export async function consultarComunicacoesDjen(
  numeroProcesso: string,
  dataInicio: string,
  dataFim: string
): Promise<DjenResultado> {
  const numeroLimpo = numeroProcesso.replace(/\D/g, "");
  if (!numeroLimpo) {
    return { ok: false, erro: "Número de processo vazio/inválido." };
  }

  const params = new URLSearchParams({
    numeroProcesso: numeroLimpo,
    dataDisponibilizacaoInicio: dataInicio,
    dataDisponibilizacaoFim: dataFim,
    itensPorPagina: "50",
    pagina: "1",
  });

  let response: Response;
  try {
    response = await fetch(`${DJEN_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      // Sem SLA publicado — 20s de limite por consulta individual, mesmo
      // critério já usado no DataJud, pra não travar o cron inteiro por um
      // processo lento.
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return {
      ok: false,
      erro: `Falha de rede ao consultar o DJEN: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!response.ok) {
    return { ok: false, erro: `DJEN respondeu HTTP ${response.status}.` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, erro: "Resposta do DJEN não é um JSON válido." };
  }

  // Formato exato da resposta não confirmado na fonte primária (ver
  // comentário no topo do arquivo) — tenta os formatos mais prováveis
  // descritos por terceiros: um array direto, ou um objeto com uma das
  // chaves abaixo contendo o array de comunicações.
  const possivelArray = Array.isArray(body)
    ? body
    : (body as { items?: unknown[] })?.items ??
      (body as { comunicacoes?: unknown[] })?.comunicacoes ??
      (body as { content?: unknown[] })?.content;

  if (!Array.isArray(possivelArray)) {
    return { ok: true, comunicacoes: [] };
  }

  return { ok: true, comunicacoes: possivelArray as DjenComunicacao[] };
}
