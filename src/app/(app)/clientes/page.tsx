import { requireModule } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ClientesClient, { type ClienteRow } from "./ClientesClient";

export default async function ClientesPage() {
  await requireModule("clientes");

  const supabase = await createClient();

  const [{ data: clientes }, { data: processos }] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome_completo, telefone, email")
      .order("nome_completo", { ascending: true }),
    supabase.from("processos").select("cliente_id"),
  ]);

  const countByCliente = new Map<string, number>();
  for (const p of processos ?? []) {
    countByCliente.set(p.cliente_id, (countByCliente.get(p.cliente_id) ?? 0) + 1);
  }

  const rows: ClienteRow[] = (clientes ?? []).map((c) => ({
    id: c.id,
    nome_completo: c.nome_completo,
    telefone: c.telefone,
    email: c.email,
    processos_count: countByCliente.get(c.id) ?? 0,
  }));

  return (
    <div>
      <h1 className="text-[22px] font-bold text-foreground">Clientes</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Cadastro de clientes. Abra a ficha de cada um para ver processos vinculados e o histórico de atendimento.
      </p>
      <div className="mt-6">
        <ClientesClient clientes={rows} />
      </div>
    </div>
  );
}
