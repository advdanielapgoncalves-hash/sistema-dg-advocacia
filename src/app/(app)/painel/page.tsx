import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { businessDaysUntil, classificarPrazo } from "@/lib/businessDays";
import PrazosPainelWidget from "./PrazosPainelWidget";

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PainelPage() {
  const session = await getCurrentProfile();
  const firstName = session?.profile.full_name.split(" ")[0] ?? "";
  if (!session) {
    return null;
  }

  const supabase = await createClient();

  const canPrazos = session.permissions.prazos;
  const canFinanceiro = session.permissions.financeiro;

  type PrazoPainel = {
    id: string;
    tipo: string;
    descricao: string | null;
    data_vencimento: string;
    processo_id: string | null;
    cliente_id: string | null;
  };

  const [{ data: prazos }, { data: tarefas }] = await Promise.all([
    canPrazos
      ? supabase
          .from("prazos")
          .select("id, tipo, descricao, data_vencimento, processo_id, cliente_id")
          .eq("status", "pendente")
          .order("data_vencimento", { ascending: true })
          .limit(6)
      : Promise.resolve({ data: [] as PrazoPainel[] }),
    supabase
      .from("tarefas")
      .select("id, titulo, data_limite")
      .eq("responsavel_id", session.profile.id)
      .neq("status", "concluida")
      .order("data_limite", { ascending: true })
      .limit(6),
  ]);

  // Pra mostrar "processo/cliente vinculado" logo no início de cada prazo,
  // sem precisar buscar todo mundo — só os processos/clientes referenciados
  // pelos prazos que já vieram na consulta acima.
  const processoIdsPrazos = Array.from(
    new Set((prazos ?? []).map((p) => p.processo_id).filter((id): id is string => Boolean(id)))
  );
  const { data: processosPrazos } =
    processoIdsPrazos.length > 0
      ? await supabase.from("processos").select("id, cliente_id, numero_processo").in("id", processoIdsPrazos)
      : { data: [] as { id: string; cliente_id: string; numero_processo: string }[] };
  const processoPrazoById = new Map((processosPrazos ?? []).map((p) => [p.id, p]));

  const clienteIdsPrazos = Array.from(
    new Set(
      (prazos ?? [])
        .map((p) => p.cliente_id ?? (p.processo_id ? processoPrazoById.get(p.processo_id)?.cliente_id : null))
        .filter((id): id is string => Boolean(id))
    )
  );
  const { data: clientesPrazos } =
    clienteIdsPrazos.length > 0
      ? await supabase.from("clientes").select("id, nome_completo").in("id", clienteIdsPrazos)
      : { data: [] as { id: string; nome_completo: string }[] };
  const clienteNomePrazoById = new Map((clientesPrazos ?? []).map((c) => [c.id, c.nome_completo]));

  const prazosComUrgencia = (prazos ?? []).map((p) => {
    const diasUteis = businessDaysUntil(p.data_vencimento);
    const processo = p.processo_id ? processoPrazoById.get(p.processo_id) : null;
    const clienteId = p.cliente_id ?? processo?.cliente_id ?? null;
    return {
      ...p,
      cliente_id: clienteId,
      diasUteis,
      urgencia: classificarPrazo(diasUteis),
      processo_numero: processo?.numero_processo ?? null,
      cliente_nome: clienteId ? clienteNomePrazoById.get(clienteId) ?? null : null,
    };
  });
  const prazosFataisOuVencidos = prazosComUrgencia.filter((p) => p.urgencia === "fatal" || p.urgencia === "vencido").length;

  let margemMes: number | null = null;
  let recebimentosSemana: { id: string; cliente_nome: string; valor: number; data_vencimento: string }[] = [];
  let clientesEmAtraso: { id: string; cliente_nome: string; valor: number; data_vencimento: string; diasAtraso: number }[] = [];

  if (canFinanceiro) {
    const hoje = new Date();
    const todayISO = hoje.toISOString().slice(0, 10);
    const de = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    const ate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
    const em7Dias = new Date(hoje);
    em7Dias.setDate(em7Dias.getDate() + 7);
    const em7DiasISO = em7Dias.toISOString().slice(0, 10);
    const ha10Dias = new Date(hoje);
    ha10Dias.setDate(ha10Dias.getDate() - 10);
    const ha10DiasISO = ha10Dias.toISOString().slice(0, 10);

    const [{ data: lancamentos }, { data: clientes }, { data: parcelasSemana }, { data: parcelasAtraso }] = await Promise.all([
      supabase.from("financeiro_lancamentos").select("tipo, valor").gte("data", de).lte("data", ate),
      supabase.from("clientes").select("id, nome_completo"),
      supabase
        .from("financeiro_parcelas")
        .select("id, cliente_id, valor, data_vencimento")
        .neq("status", "pago")
        .gte("data_vencimento", todayISO)
        .lte("data_vencimento", em7DiasISO)
        .order("data_vencimento", { ascending: true })
        .limit(6),
      supabase
        .from("financeiro_parcelas")
        .select("id, cliente_id, valor, data_vencimento")
        .neq("status", "pago")
        .lt("data_vencimento", todayISO)
        .gte("data_vencimento", ha10DiasISO)
        .order("data_vencimento", { ascending: true })
        .limit(6),
    ]);

    const faturamento = (lancamentos ?? []).filter((l) => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
    const despesas = (lancamentos ?? []).filter((l) => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
    margemMes = faturamento - despesas;

    const clienteName = new Map((clientes ?? []).map((c) => [c.id, c.nome_completo]));

    recebimentosSemana = (parcelasSemana ?? []).map((p) => ({
      id: p.id,
      cliente_nome: clienteName.get(p.cliente_id) ?? "—",
      valor: Number(p.valor),
      data_vencimento: p.data_vencimento,
    }));

    clientesEmAtraso = (parcelasAtraso ?? []).map((p) => {
      const diasAtraso = Math.round((hoje.getTime() - new Date(`${p.data_vencimento}T00:00:00`).getTime()) / (24 * 3600 * 1000));
      return {
        id: p.id,
        cliente_nome: clienteName.get(p.cliente_id) ?? "—",
        valor: Number(p.valor),
        data_vencimento: p.data_vencimento,
        diasAtraso,
      };
    });
  }

  const totalRecebimentosSemana = recebimentosSemana.reduce((s, r) => s + r.valor, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-foreground">Olá, {firstName}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>

      {canPrazos && prazosFataisOuVencidos > 0 && (
        <div className="mb-6 rounded-xl border border-status-critical/30 bg-status-critical-bg p-4 text-sm font-semibold text-status-critical">
          {prazosFataisOuVencidos} prazo(s) fatal(is) ou vencido(s) precisam de atenção agora.{" "}
          <Link href="/operacional?tab=prazos" className="underline">Ver em Operacional →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {canPrazos && (
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[15px] font-bold text-foreground">Próximos prazos</span>
              <Link href="/operacional?tab=prazos" className="text-[13px] font-semibold text-brand-navy hover:underline">Ver todos →</Link>
            </div>
            <PrazosPainelWidget prazos={prazosComUrgencia} />
          </div>
        )}

        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[15px] font-bold text-foreground">Minhas tarefas pendentes</span>
            <Link href="/operacional?tab=tarefas" className="text-[13px] font-semibold text-brand-navy hover:underline">Ver todas →</Link>
          </div>
          <ul className="flex flex-col divide-y divide-border/60">
            {(tarefas ?? []).length === 0 && <li className="py-3 text-sm text-text-muted">Nenhuma tarefa pendente. 🎉</li>}
            {(tarefas ?? []).map((t) => (
              <li key={t.id} className="py-2.5 text-sm">
                <div className="font-semibold text-foreground">{t.titulo}</div>
                {t.data_limite && <div className="text-[12px] text-text-muted">até {fmtDate(t.data_limite)}</div>}
              </li>
            ))}
          </ul>
        </div>

        {canFinanceiro && margemMes !== null && (
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-bold text-foreground">Margem do mês</span>
              <Link href="/financeiro" className="text-[13px] font-semibold text-brand-navy hover:underline">Ver Financeiro →</Link>
            </div>
            <div className={`mt-2 text-[24px] font-bold ${margemMes >= 0 ? "text-foreground" : "text-status-critical"}`}>
              {formatBRL(margemMes)}
            </div>
          </div>
        )}

        {canFinanceiro && (
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-bold text-foreground">Recebimentos desta semana</span>
              <Link href="/financeiro?tab=recebimentos" className="text-[13px] font-semibold text-brand-navy hover:underline">Ver todos →</Link>
            </div>
            <div className="mb-2 text-[13px] text-text-secondary">
              {recebimentosSemana.length} recebimento(s) · {formatBRL(totalRecebimentosSemana)}
            </div>
            <ul className="flex flex-col divide-y divide-border/60">
              {recebimentosSemana.length === 0 && (
                <li className="py-3 text-sm text-text-muted">Nenhum recebimento pendente nos próximos 7 dias.</li>
              )}
              {recebimentosSemana.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-semibold text-foreground">{r.cliente_nome}</div>
                    <div className="text-[12px] text-text-muted">vence {fmtDate(r.data_vencimento)}</div>
                  </div>
                  <span className="font-semibold text-foreground">{formatBRL(r.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canFinanceiro && (
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-bold text-foreground">Clientes em atraso (últimos 10 dias)</span>
              <Link href="/financeiro?tab=recebimentos" className="text-[13px] font-semibold text-brand-navy hover:underline">Ver todos →</Link>
            </div>
            <ul className="mt-2 flex flex-col divide-y divide-border/60">
              {clientesEmAtraso.length === 0 && (
                <li className="py-3 text-sm text-text-muted">Nenhum cliente em atraso nos últimos 10 dias.</li>
              )}
              {clientesEmAtraso.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-semibold text-foreground">{c.cliente_nome}</div>
                    <div className="text-[12px] text-text-muted">venceu {fmtDate(c.data_vencimento)} · {c.diasAtraso} dia(s) de atraso</div>
                  </div>
                  <span className="font-semibold text-status-critical">{formatBRL(c.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
