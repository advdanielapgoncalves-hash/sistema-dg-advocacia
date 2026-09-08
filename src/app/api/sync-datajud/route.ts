import { NextRequest } from "next/server";
import { runDataJudSync } from "@/lib/datajudSync";

/**
 * Rota chamada pelo Cron Job da Vercel (configurado em vercel.json, 1x por
 * dia — é o limite do plano Hobby, e também é a frequência real possível já
 * que o DataJud não avisa sozinho quando um processo muda, ver README).
 *
 * Protegida por CRON_SECRET: a Vercel manda automaticamente o header
 * "Authorization: Bearer <CRON_SECRET>" quando essa variável de ambiente
 * está configurada no projeto — é o mecanismo oficial deles pra evitar que
 * qualquer pessoa na internet dispare essa rota manualmente.
 * Fonte: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resumo = await runDataJudSync();
  return Response.json(resumo);
}
