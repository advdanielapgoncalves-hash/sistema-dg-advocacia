import { NextRequest } from "next/server";
import { gerarRelatoriosPeriodo, periodoQuinzenalAtual } from "@/lib/relatorioCliente";

/**
 * Rota chamada pelo Cron Job da Vercel, todo dia 1 e dia 15 (ver
 * vercel.json), pra gerar os rascunhos de relatório quinzenal de cada
 * cliente. Não envia nada sozinha — só cria/atualiza os rascunhos, que a
 * Daniela revisa e envia manualmente em /relatorios (pedido dela: revisar
 * antes de enviar, não automático).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { inicio, fim } = periodoQuinzenalAtual();
  const resumo = await gerarRelatoriosPeriodo(inicio, fim);
  return Response.json({ periodo: { inicio, fim }, ...resumo });
}
