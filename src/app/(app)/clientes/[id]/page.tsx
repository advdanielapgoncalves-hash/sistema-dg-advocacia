import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AtendimentoForm from "./AtendimentoForm";

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("clientes");
  const { id } = await params;

  const supabase = await createClient();

  const [{ data: cliente }, { data: processos }, { data: atendimentos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase
      .from("processos")
      .select("id, numero_processo, descricao, status")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("atendimentos_cliente")
      .select("id, data, tipo, descricao, registrado_por:profiles(full_name)")
      .eq("cliente_id", id)
      .order("data", { ascending: false }),
  ]);

  if (!cliente) {
    notFound();
  }

  return (
    <div>
      <Link href="/clientes" className="text-[13px] font-semibold text-brand-navy hover:underline">
        ← Clientes
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-foreground">{cliente.nome_completo}</h1>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 rounded-xl border border-border bg-white p-5 text-sm">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">CPF/CNPJ</div>
          <div className="mt-1 text-foreground">{cliente.cpf_cnpj || "—"}</div>
        </div>
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Telefone</div>
          <div className="mt-1 text-foreground">{cliente.telefone || "—"}</div>
        </div>
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">E-mail</div>
          <div className="mt-1 text-foreground">{cliente.email || "—"}</div>
        </div>
        <div className="col-span-3">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Endereço</div>
          <div className="mt-1 text-foreground">{cliente.endereco || "—"}</div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold text-foreground">Processos vinculados</span>
          <Link href="/operacional?tab=processos" className="text-[13px] font-semibold text-brand-navy hover:underline">
            + Novo processo →
          </Link>
        </div>
        {processos && processos.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border/60">
            {processos.map((p) => (
              <li key={p.id} className="py-2 text-sm">
                <span className="font-semibold text-foreground">{p.numero_processo}</span>
                {p.descricao && <span className="text-text-secondary"> — {p.descricao}</span>}
                <span className="ml-2 text-[12px] text-text-muted">({p.status})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Nenhum processo vinculado ainda.</p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-white p-5">
        <div className="mb-1">
          <span className="text-[15px] font-bold text-foreground">Histórico de atendimento</span>
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            Registre aqui cada contato com o cliente — qualquer pessoa da equipe consegue ver o histórico e
            assumir o caso se precisar. Não aparece no portal do cliente.
          </p>
        </div>

        <div className="mt-3">
          <AtendimentoForm clienteId={id} />
        </div>

        <ul className="mt-4 flex flex-col divide-y divide-border/60">
          {(atendimentos ?? []).length === 0 && (
            <li className="py-3 text-sm text-text-muted">Nenhum atendimento registrado ainda.</li>
          )}
          {(atendimentos ?? []).map((a) => {
            const registradoPor = Array.isArray(a.registrado_por) ? a.registrado_por[0] : a.registrado_por;
            return (
              <li key={a.id} className="py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{a.tipo || "Atendimento"}</span>
                  <span className="text-[12px] text-text-muted">
                    {new Date(a.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {registradoPor?.full_name ? ` · ${registradoPor.full_name}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-text-secondary">{a.descricao}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
