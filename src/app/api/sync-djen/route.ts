import { NextRequest } from "next/server";
import { runDjenSync } from "@/lib/djenSync";

/**
 * Rota chamada pelo Cron Job da Vercel (configurado em vercel.json) pra
 * sincronizar comunicações do DJEN — mesmo mecanismo de proteção já usado
 * em /api/sync-datajud (CRON_SECRET, ver comentário lá).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resumo = await runDjenSync();
  return Response.json(resumo);
}
