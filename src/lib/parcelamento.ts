// Cálculo de datas de parcelas de um plano de pagamento (Financeiro).
//
// Regra: a parcela de índice N (0 = primeira) vence `N` meses depois da data
// da primeira parcela, mantendo o mesmo dia do mês sempre que possível. Se o
// mês de destino não tiver esse dia (ex: 1ª parcela dia 31/01 -> a parcela
// seguinte cairia em "31/02", que não existe), a data é ajustada para o
// último dia daquele mês (28 ou 29/02), nunca "estoura" pro mês seguinte.
export function dataParcela(dataPrimeiraParcela: string, indice: number): string {
  const [ano, mes, dia] = dataPrimeiraParcela.split("-").map(Number);
  if (!ano || !mes || !dia) {
    throw new Error("Data da primeira parcela inválida.");
  }

  const mesDestino = mes - 1 + indice; // 0-based, Date() normaliza ano/mês sozinho
  const ultimoDiaMesDestino = new Date(ano, mesDestino + 1, 0).getDate();
  const diaFinal = Math.min(dia, ultimoDiaMesDestino);

  const resultado = new Date(ano, mesDestino, diaFinal);
  const yyyy = resultado.getFullYear();
  const mm = String(resultado.getMonth() + 1).padStart(2, "0");
  const dd = String(resultado.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
