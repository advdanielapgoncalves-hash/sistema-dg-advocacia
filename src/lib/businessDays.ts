// Cálculo de dias úteis para os alertas de prazo (Painel e Operacional).
//
// IMPORTANTE — limitação conhecida: este cálculo conta só segunda a sexta.
// Ele ainda NÃO desconta feriados nacionais/forenses, porque eu não tenho uma
// fonte de feriados verificada pra cravar no código sem risco de errar uma
// data (e um prazo errado por causa de feriado é exatamente o tipo de erro
// que não podemos correr o risco de cometer). Isso está registrado como
// pendência no plano — antes de confiar 100% no alerta de "prazo fatal" pra
// decisões reais, o calendário de feriados precisa ser adicionado e
// conferido com a Daniela.

const WEEKEND_DAYS = [0, 6]; // domingo = 0, sábado = 6

function toLocalMidnight(date: string | Date): Date {
  if (typeof date === "string") {
    // "YYYY-MM-DD" — monta em horário local pra não perder o dia por causa de fuso
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Diferença em dias úteis entre hoje (ou `from`) e `dueDate`.
 * Positivo = dias úteis restantes até o vencimento.
 * Negativo = dias úteis já vencidos (prazo perdido).
 */
export function businessDaysUntil(dueDate: string | Date, from: Date = new Date()): number {
  const start = toLocalMidnight(from);
  const end = toLocalMidnight(dueDate);

  const direction = end >= start ? 1 : -1;
  let count = 0;
  const cursor = new Date(start);

  while (cursor.getTime() !== end.getTime()) {
    cursor.setDate(cursor.getDate() + direction);
    if (!WEEKEND_DAYS.includes(cursor.getDay())) {
      count += direction;
    }
  }

  return count;
}

/**
 * Data de segurança interna (D-1): um dia de calendário antes do vencimento
 * real, pedida pela Daniela como margem de segurança pessoal — ex: se o
 * prazo fatal é 11/09, o sistema mostra "D-1: 10/09" ao lado, pra ela agir
 * um dia antes do vencimento oficial. NÃO altera o vencimento real gravado
 * no banco (esse continua sendo a data oficial do processo) — é só uma
 * exibição adicional.
 */
export function diaSegurancaD1(dataVencimento: string): string {
  const d = toLocalMidnight(dataVencimento);
  d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type PrazoUrgencia = "vencido" | "fatal" | "proximo" | "em_dia";

/**
 * Classifica a urgência a partir de dias úteis restantes.
 * "fatal" a 4 dias úteis é o valor que a Daniela pediu explicitamente.
 * O corte de "próximo" (5–10 dias úteis) é um padrão razoável que escolhi
 * pra dar um estágio intermediário no alerta — não veio de uma instrução
 * dela, então é ajustável se ela quiser outro número.
 */
export function classificarPrazo(diasUteis: number): PrazoUrgencia {
  if (diasUteis < 0) return "vencido";
  if (diasUteis <= 4) return "fatal";
  if (diasUteis <= 10) return "proximo";
  return "em_dia";
}

export const URGENCIA_LABEL: Record<PrazoUrgencia, string> = {
  vencido: "Vencido",
  fatal: "Prazo fatal",
  proximo: "Próximo",
  em_dia: "Em dia",
};

export const URGENCIA_CLASSES: Record<PrazoUrgencia, { text: string; bg: string }> = {
  vencido: { text: "text-status-critical", bg: "bg-status-critical-bg" },
  fatal: { text: "text-status-critical", bg: "bg-status-critical-bg" },
  proximo: { text: "text-status-warning", bg: "bg-status-warning-bg" },
  em_dia: { text: "text-status-good", bg: "bg-status-good-bg" },
};
