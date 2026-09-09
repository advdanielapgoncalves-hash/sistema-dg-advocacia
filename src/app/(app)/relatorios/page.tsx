import { requireModule } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import RelatoriosClient, { type RelatorioRow } from "./RelatoriosClient";

export default async function RelatoriosPage() {
  // Mesma permissão de 'clientes' — é dado de relacionamento com o cliente,
  // não um módulo próprio ainda (evita mexer na tela de Configurações/
  // permissões por enquanto; dá pra separar depois se fizer sentido).
  await requireModule("clientes");

  const supabase = await createClient();

  const { data: relatorios } = await supabase
    .from("relatorios_clientes")
    .select(
      "id, cliente_id, periodo_inicio, periodo_fim, status, conteudo_gerado, conteudo_adicional, enviado_em, clientes(nome_completo, email)"
    )
    .order("periodo_inicio", { ascending: false })
    .order("created_at", { ascending: false });

  const rows: RelatorioRow[] = (relatorios ?? []).map((r) => {
    const cliente = Array.isArray(r.clientes) ? r.clientes[0] : r.clientes;
    return {
      id: r.id,
      cliente_id: r.cliente_id,
      cliente_nome: cliente?.nome_completo ?? "—",
      cliente_email: cliente?.email ?? null,
      periodo_inicio: r.periodo_inicio,
      periodo_fim: r.periodo_fim,
      status: r.status,
      conteudo_gerado: r.conteudo_gerado,
      conteudo_adicional: r.conteudo_adicional,
      enviado_em: r.enviado_em,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-foreground">Relatórios aos clientes</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Rascunhos quinzenais (dia 1 e dia 15) montados a partir das movimentações marcadas como relevantes
          (decisões e sentenças, petição inicial e contestação, réplica/manifestações, acórdãos). Revise, complete
          se quiser, e envie por e-mail — nada sai sozinho sem você aprovar.
        </p>
      </div>
      <RelatoriosClient relatorios={rows} />
    </div>
  );
}
