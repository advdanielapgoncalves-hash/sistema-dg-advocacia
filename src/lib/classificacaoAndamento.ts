/**
 * Classificação por palavra-chave do tipo de andamento/comunicação
 * processual, usada só pra decidir o que entra no relatório quinzenal do
 * cliente (ver src/lib/relatorioCliente.ts).
 *
 * NÃO é uma classificação oficial do CNJ — é uma aproximação por palavra-
 * chave no nome/teor do movimento, com os riscos de qualquer heurística:
 * pode deixar passar algo relevante (falso negativo) ou marcar como
 * relevante algo que não é (falso positivo). Por isso a Daniela pediu pra
 * revisar cada relatório antes de enviar, em vez de mandar automático — é
 * essa revisão que cobre o risco até o filtro ser calibrado com casos reais
 * (mesma lógica já usada pra classificarMovimentoDataJud, ver datajud.ts).
 *
 * Categorias pedidas por ela em 09/09: decisões (interlocutórias e
 * sentenças), petição inicial e contestação, réplica e outras
 * manifestações das partes, acórdãos. Tudo que não bater em nenhuma dessas
 * cai em "outro" e fica de fora do relatório por padrão.
 */
export type CategoriaAndamento =
  | "peticao_inicial"
  | "contestacao"
  | "replica_manifestacao"
  | "decisao"
  | "sentenca"
  | "acordao"
  | "outro";

export const CATEGORIA_LABEL: Record<CategoriaAndamento, string> = {
  peticao_inicial: "Petição inicial",
  contestacao: "Contestação",
  replica_manifestacao: "Réplica/manifestação",
  decisao: "Decisão interlocutória",
  sentenca: "Sentença",
  acordao: "Acórdão",
  outro: "Outro",
};

// Ordem importa: categorias mais específicas primeiro, pra "sentença" ou
// "acórdão" não caírem na regra genérica de "decisão".
const REGRAS: { categoria: CategoriaAndamento; padrao: RegExp }[] = [
  { categoria: "sentenca", padrao: /senten[çc]a/i },
  { categoria: "acordao", padrao: /ac[óo]rd[ãa]o/i },
  { categoria: "peticao_inicial", padrao: /peti[çc][ãa]o inicial|distribui[çc][ãa]o (d[ea] )?(peti[çc][ãa]o|feito)/i },
  { categoria: "contestacao", padrao: /contesta[çc][ãa]o/i },
  {
    categoria: "replica_manifestacao",
    padrao: /r[ée]plica|impugna[çc][ãa]o( à| a)? contesta[çc][ãa]o|manifesta[çc][ãa]o da parte/i,
  },
  { categoria: "decisao", padrao: /decis[ãa]o interlocut[óo]ria|despacho decis[óo]rio|\bdecis[ãa]o\b/i },
];

export function classificarAndamento(texto: string | null | undefined): CategoriaAndamento {
  if (!texto) return "outro";
  for (const regra of REGRAS) {
    if (regra.padrao.test(texto)) return regra.categoria;
  }
  return "outro";
}

// Categorias que a Daniela marcou como relevantes pro relatório quinzenal
// (09/09) — hoje é "tudo, exceto outro", mas fica explícito numa lista (em
// vez de um simples "!== 'outro'") pra ser fácil tirar uma categoria de
// cena depois, sem mexer na lógica de classificação em si.
const CATEGORIAS_RELEVANTES: CategoriaAndamento[] = [
  "peticao_inicial",
  "contestacao",
  "replica_manifestacao",
  "decisao",
  "sentenca",
  "acordao",
];

export function isRelevantePararRelatorio(categoria: CategoriaAndamento): boolean {
  return CATEGORIAS_RELEVANTES.includes(categoria);
}
