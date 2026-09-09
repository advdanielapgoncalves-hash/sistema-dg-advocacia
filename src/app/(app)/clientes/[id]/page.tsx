import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AtendimentoForm, { type AtendimentoRow } from "./AtendimentoForm";
import FinanceiroClienteSection, {
  type FinLancamentoRow,
  type FinParcelaRow,
} from "./FinanceiroClienteSection";

function formatMinutos(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireModule("clientes");
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

  const atendimentoRows: AtendimentoRow[] = (atendimentos ?? []).map((a) => {
    const registradoPor = Array.isArray(a.registrado_por) ? a.registrado_por[0] : a.registrado_por;
    return {
      id: a.id,
      data: a.data,
      tipo: a.tipo,
      descricao: a.descricao,
      registrado_por_nome: registradoPor?.full_name ?? null,
    };
  });

  // Horas trabalhadas dedicadas a este cliente: soma os apontamentos de tempo
  // (timesheet) vinculados a este cliente por qualquer um dos três caminhos
  // que existem hoje: (1) direto num prazo deste cliente; (2) numa tarefa
  // vinculada a um prazo deste cliente; (3) numa tarefa vinculada diretamente
  // a este cliente (ex: tarefa pré-processual, concluída com "Baixar tarefa",
  // que exige vincular um cliente mesmo sem processo/prazo).
  //
  // Limitação conhecida: um apontamento lançado totalmente avulso (sem prazo
  // e sem tarefa) não entra nessa soma — não tem como saber de qual cliente é.
  const { data: prazosCliente } = await supabase.from("prazos").select("id").eq("cliente_id", id);
  const prazoIds = (prazosCliente ?? []).map((p) => p.id);

  const { data: tarefasDoCliente } = await supabase.from("tarefas").select("id").eq("cliente_id", id);
  const tarefaIdsDiretas = (tarefasDoCliente ?? []).map((t) => t.id);

  let tarefaIdsViaPrazo: string[] = [];
  if (prazoIds.length > 0) {
    const { data: tarefasVinculadas } = await supabase.from("tarefas").select("id").in("prazo_id", prazoIds);
    tarefaIdsViaPrazo = (tarefasVinculadas ?? []).map((t) => t.id);
  }
  const tarefaIds = Array.from(new Set([...tarefaIdsDiretas, ...tarefaIdsViaPrazo]));

  let totalMinutosCliente = 0;
  if (prazoIds.length > 0) {
    const { data: apontPrazo } = await supabase
      .from("apontamentos_tempo")
      .select("minutos")
      .in("prazo_id", prazoIds);
    totalMinutosCliente += (apontPrazo ?? []).reduce((soma, a) => soma + a.minutos, 0);
  }
  if (tarefaIds.length > 0) {
    const { data: apontTarefa } = await supabase
      .from("apontamentos_tempo")
      .select("minutos")
      .in("tarefa_id", tarefaIds);
    totalMinutosCliente += (apontTarefa ?? []).reduce((soma, a) => soma + a.minutos, 0);
  }

  // "Toda a vida financeira" do cliente no escritório: só busca e só mostra
  // pra quem tem permissão de Financeiro (mesma trava do módulo Financeiro
  // em si — funcionário sem acesso não vê nem o resumo aqui na ficha do
  // cliente).
  const podeVerFinanceiro = session.permissions.financeiro;
  let lancamentosCliente: FinLancamentoRow[] = [];
  let parcelasCliente: FinParcelaRow[] = [];

  if (podeVerFinanceiro) {
    const [{ data: lancamentos }, { data: parcelas }] = await Promise.all([
      supabase
        .from("financeiro_lancamentos")
        .select("id, tipo, descricao, valor, data")
        .eq("cliente_id", id)
        .order("data", { ascending: false }),
      supabase
        .from("financeiro_parcelas")
        .select("id, descricao, numero_parcela, total_parcelas, valor, forma_recebimento, data_vencimento, status, data_pagamento")
        .eq("cliente_id", id)
        .order("data_vencimento", { ascending: true }),
    ]);

    const todayISO = new Date().toISOString().slice(0, 10);
    lancamentosCliente = (lancamentos ?? []).map((l) => ({
      id: l.id,
      tipo: l.tipo,
      descricao: l.descricao,
      valor: Number(l.valor),
      data: l.data,
    }));
    parcelasCliente = (parcelas ?? []).map((p) => ({
      id: p.id,
      descricao: p.descricao,
      numero_parcela: p.numero_parcela,
      total_parcelas: p.total_parcelas,
      valor: Number(p.valor),
      forma_recebimento: p.forma_recebimento,
      data_vencimento: p.data_vencimento,
      status: p.status === "pago" ? "pago" : p.data_vencimento < todayISO ? "atrasado" : "a_vencer",
      data_pagamento: p.data_pagamento,
    }));
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
        <div className="mb-1">
          <span className="text-[15px] font-bold text-foreground">Horas trabalhadas (timesheet)</span>
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            Soma dos apontamentos de tempo vinculados a prazos ou tarefas deste cliente (incluindo tarefas
            pré-processuais, sem processo). Tempo lançado totalmente avulso não entra nessa conta.
          </p>
        </div>
        <div className="mt-2 text-[26px] font-bold text-foreground">{formatMinutos(totalMinutosCliente)}</div>
      </div>

      {podeVerFinanceiro && (
        <div className="mt-6 rounded-xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-[15px] font-bold text-foreground">Financeiro deste cliente</span>
              <p className="mt-0.5 text-[12.5px] text-text-muted">
                Todo o histórico financeiro do cliente no escritório: entradas já recebidas e parcelas a vencer,
                atrasadas ou pagas.
              </p>
            </div>
            <Link href="/financeiro?tab=recebimentos" className="text-[13px] font-semibold text-brand-navy hover:underline">
              + Novo plano de pagamento →
            </Link>
          </div>
          <FinanceiroClienteSection lancamentos={lancamentosCliente} parcelas={parcelasCliente} />
        </div>
      )}

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
          <AtendimentoForm clienteId={id} atendimentos={atendimentoRows} />
        </div>
      </div>
    </div>
  );
}
