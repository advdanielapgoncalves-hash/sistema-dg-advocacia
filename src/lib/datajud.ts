/**
 * Cliente para a API Pública do DataJud (CNJ) — consulta de andamentos por
 * número de processo.
 *
 * Detalhes técnicos abaixo foram levantados por pesquisa (não testados contra
 * a API real de dentro do ambiente onde este código foi escrito, porque a
 * rede desse ambiente bloqueia acesso automatizado a *.cnj.jus.br — o mesmo
 * bloqueio já registrado no README pra cnj.jus.br e esaj.tjsp.jus.br).
 * A Vercel (onde isso roda de verdade) tem acesso normal à internet, então
 * o primeiro disparo em produção é o teste real — acompanhe os logs da
 * função (Vercel → Logs) na primeira execução.
 *
 * Fontes:
 * - Endpoint e autenticação: página oficial de transparência do TJDFT
 *   (reproduz a documentação do CNJ) —
 *   https://www.tjdft.jus.br/transparencia/tecnologia-da-informacao-e-comunicacao/dados-abertos/datajud-tjdft
 * - Chave pública (a mesma pra todo mundo, publicada pelo próprio CNJ) e
 *   formato do corpo da requisição — exemplo de código citando a
 *   documentação do CNJ: https://www.tabnews.com.br/leonardomv/projeto-php-para-utilizacao-da-api-do-cnj
 * - Alias do TJSP e observação sobre rate limit (a API responde 429/500 em
 *   volume alto) — https://chatjuridico.com.br/como-consultar-datajud-cnj/
 * - Nomes dos campos dentro de cada "movimento" (codigo, nome, dataHora,
 *   complementosTabelados) — tutorial oficial do CNJ (PDF), Anexo I
 *   (Glossário de Dados): https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf
 * - Confirmação de que não existe webhook/push (é só consulta sob demanda):
 *   já registrado antes neste projeto, ver seção "Sobre o Diário Oficial" no
 *   README.
 *
 * Limitação atual conhecida: só cobre o TJSP (alias "api_publica_tjsp"). Se
 * a Daniela tiver processos em outro tribunal (federal, trabalhista, TJ de
 * outro estado), o alias abaixo precisa ser trocado ou o processo precisa
 * indicar o tribunal certo — hoje o sistema não faz essa distinção, porque
 * até aqui todos os processos cadastrados são do TJSP.
 */

const DATAJUD_ENDPOINT = "https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search";

export type DataJudMovimento = {
  codigo?: number;
  nome?: string;
  dataHora?: string;
  complementosTabelados?: unknown;
};

type DataJudResultado =
  | { ok: true; movimentos: DataJudMovimento[] }
  | { ok: false; erro: string };

export async function consultarProcessoDataJud(numeroProcesso: string): Promise<DataJudResultado> {
  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey) {
    return { ok: false, erro: "DATAJUD_API_KEY não configurada." };
  }

  const numeroLimpo = numeroProcesso.replace(/\D/g, "");
  if (!numeroLimpo) {
    return { ok: false, erro: "Número de processo vazio/inválido." };
  }

  let response: Response;
  try {
    response = await fetch(DATAJUD_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `APIKey ${apiKey}`,
      },
      body: JSON.stringify({ query: { match: { numeroProcesso: numeroLimpo } } }),
      // A API pode demorar; não vale a pena travar o cron inteiro por um
      // processo lento — 20s de limite por consulta individual.
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return { ok: false, erro: `Falha de rede ao consultar DataJud: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!response.ok) {
    return { ok: false, erro: `DataJud respondeu HTTP ${response.status}.` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, erro: "Resposta do DataJud não é um JSON válido." };
  }

  // Formato padrão de resposta do Elasticsearch (tecnologia por trás da API,
  // não específico do DataJud): { hits: { hits: [ { _source: {...} } ] } }.
  const hits = (body as { hits?: { hits?: { _source?: { movimentos?: unknown } }[] } })?.hits?.hits;
  if (!Array.isArray(hits) || hits.length === 0) {
    return { ok: true, movimentos: [] };
  }

  const movimentos = hits[0]?._source?.movimentos;
  if (!Array.isArray(movimentos)) {
    return { ok: true, movimentos: [] };
  }

  return { ok: true, movimentos: movimentos as DataJudMovimento[] };
}

/** Heurística simples pra separar "intimação" (exige ação) de andamento
 * meramente informativo: olha se a palavra aparece no nome do movimento.
 * Isso NÃO é uma classificação oficial do CNJ — é só uma aproximação
 * razoável até termos um motivo pra refinar com a Daniela olhando casos
 * reais depois do primeiro sincronismo. */
export function classificarMovimentoDataJud(nomeMovimento: string | undefined): "andamento" | "intimacao" {
  if (!nomeMovimento) return "andamento";
  return /intima/i.test(nomeMovimento) ? "intimacao" : "andamento";
}
