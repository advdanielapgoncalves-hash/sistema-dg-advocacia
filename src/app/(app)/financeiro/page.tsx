import { requireModule } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import FinanceiroClient, { type LancamentoRow, type ParcelaRow } from "./FinanceiroClient";
import type { Option } from "../operacional/OperacionalClient";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function firstDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; mes?: string; tab?: string }>;
}) {
  await requireModule("financeiro");

  const { from, to, mes, tab } = await searchParams;
  const hoje = new Date();
  const de = from || toISODate(firstDayOfMonth(hoje));
  const ate = to || toISODate(lastDayOfMonth(hoje));

  // "Recebimentos do mês" usa seu próprio seletor de mês (mes=AAAA-MM),
  // independente do filtro de data dos lançamentos acima — são duas visões
  // diferentes, de propósito (ver README / conversa com a Daniela).
  const mesRecebimentos = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : toISODate(hoje).slice(0, 7);
  const [anoRec, mesNumRec] = mesRecebimentos.split("-").map(Number);
  const deRecebimentos = toISODate(new Date(anoRec, mesNumRec - 1, 1));
  const ateRecebimentos = toISODate(new Date(anoRec, mesNumRec, 0));

  const supabase = await createClient();

  const [{ data: lancamentos }, { data: clientes }, { data: parcelas }, { data: processos }] = await Promise.all([
    supabase
      .from("financeiro_lancamentos")
      .select("id, tipo, descricao, categoria, valor, data, cliente_id")
      .gte("data", de)
      .lte("data", ate)
      .order("data", { ascending: false }),
    supabase.from("clientes").select("id, nome_completo").order("nome_completo"),
    supabase
      .from("financeiro_parcelas")
      .select("id, cliente_id, processo_id, descricao, numero_parcela, total_parcelas, valor, forma_recebimento, data_vencimento, status, data_pagamento")
      .gte("data_vencimento", deRecebimentos)
      .lte("data_vencimento", ateRecebimentos)
      .order("data_vencimento", { ascending: true }),
    supabase.from("processos").select("id, cliente_id, numero_processo").order("numero_processo"),
  ]);

  const clienteName = new Map((clientes ?? []).map((c) => [c.id, c.nome_completo]));

  const rows: LancamentoRow[] = (lancamentos ?? []).map((l) => ({
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao,
    categoria: l.categoria,
    valor: Number(l.valor),
    data: l.data,
    cliente_nome: l.cliente_id ? clienteName.get(l.cliente_id) ?? null : null,
  }));

  const faturamento = rows.filter((r) => r.tipo === "entrada").reduce((sum, r) => sum + r.valor, 0);
  const despesas = rows.filter((r) => r.tipo === "saida").reduce((sum, r) => sum + r.valor, 0);
  const margem = faturamento - despesas;

  const clientesOptions: Option[] = (clientes ?? []).map((c) => ({ id: c.id, label: c.nome_completo }));
  const processosOptions: (Option & { cliente_id: string })[] = (processos ?? []).map((p) => ({
    id: p.id,
    label: p.numero_processo,
    cliente_id: p.cliente_id,
  }));

  const todayISO = toISODate(hoje);
  const parcelaRows: ParcelaRow[] = (parcelas ?? []).map((p) => {
    const efetiva: "a_vencer" | "atrasado" | "pago" =
      p.status === "pago" ? "pago" : p.data_vencimento < todayISO ? "atrasado" : "a_vencer";
    return {
      id: p.id,
      cliente_id: p.cliente_id,
      cliente_nome: clienteName.get(p.cliente_id) ?? "—",
      processo_id: p.processo_id,
      descricao: p.descricao,
      numero_parcela: p.numero_parcela,
      total_parcelas: p.total_parcelas,
      valor: Number(p.valor),
      forma_recebimento: p.forma_recebimento,
      data_vencimento: p.data_vencimento,
      status: efetiva,
      data_pagamento: p.data_pagamento,
    };
  });

  const initialTab: "lancamentos" | "recebimentos" = tab === "recebimentos" ? "recebimentos" : "lancamentos";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-foreground">Financeiro</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Fluxo de caixa (entradas/saídas) e, numa aba separada, o controle de recebimentos do mês com baixa manual.
        </p>
      </div>

      <FinanceiroClient
        initialTab={initialTab}
        lancamentos={rows}
        de={de}
        ate={ate}
        faturamento={faturamento}
        despesas={despesas}
        margem={margem}
        parcelas={parcelaRows}
        mesRecebimentos={mesRecebimentos}
        clientesOptions={clientesOptions}
        processosOptions={processosOptions}
      />
    </div>
  );
}
