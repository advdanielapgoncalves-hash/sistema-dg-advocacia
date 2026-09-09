import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { businessDaysUntil, classificarPrazo } from "@/lib/businessDays";
import OperacionalClient, {
  type Option,
  type ProcessoRow,
  type PrazoRow,
  type TarefaRow,
  type PublicacaoRow,
  type TimesheetRow,
} from "./OperacionalClient";

export default async function OperacionalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  if (session.profile.role === "cliente") redirect("/portal");

  const canProcessos = session.permissions.processos;
  const canPrazos = session.permissions.prazos;
  const canPublicacoes = session.permissions.processos; // andamentos usam a mesma permissão de "processos"

  const { tab } = await searchParams;

  const supabase = await createClient();

  const [{ data: profiles }, { data: clientes }, { data: processos }, { data: prazos }, { data: tarefas }, { data: andamentos }, { data: apontamentos }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, role, active"),
      supabase.from("clientes").select("id, nome_completo").order("nome_completo"),
      supabase
        .from("processos")
        .select("id, cliente_id, numero_processo, descricao, status, responsavel_id, segredo_justica, autor, reu, valor_causa")
        .order("created_at", { ascending: false }),
      supabase
        .from("prazos")
        .select("id, tipo, descricao, data_vencimento, status, processo_id, cliente_id, responsavel_id")
        .eq("status", "pendente")
        .order("data_vencimento", { ascending: true }),
      supabase
        .from("tarefas")
        .select("id, titulo, descricao, status, data_limite, responsavel_id, atribuido_por, cliente_id")
        .order("created_at", { ascending: false }),
      supabase
        .from("andamentos_processuais")
        .select(
          "id, processo_id, descricao, data_andamento, data_push, tipo, revisado_por, revisado_em, tratamento, descricao_tratamento, prazo_id, prazos(tipo, data_vencimento)"
        )
        .eq("tipo", "intimacao")
        .order("data_push", { ascending: false })
        .limit(200),
      supabase
        .from("apontamentos_tempo")
        .select("id, descricao, minutos, data, tarefa_id, prazo_id, profile_id")
        .order("data", { ascending: false }),
    ]);

  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const clienteName = new Map((clientes ?? []).map((c) => [c.id, c.nome_completo]));
  const processoById = new Map((processos ?? []).map((p) => [p.id, p]));
  const tarefaById = new Map((tarefas ?? []).map((t) => [t.id, t]));
  const prazoById = new Map((prazos ?? []).map((p) => [p.id, p]));

  // menor data_vencimento pendente por processo, pra coluna "Prazo fatal"
  const prazoFatalPorProcesso = new Map<string, { data_vencimento: string }>();
  for (const pr of prazos ?? []) {
    if (!pr.processo_id) continue;
    const atual = prazoFatalPorProcesso.get(pr.processo_id);
    if (!atual || pr.data_vencimento < atual.data_vencimento) {
      prazoFatalPorProcesso.set(pr.processo_id, { data_vencimento: pr.data_vencimento });
    }
  }

  const processoRows: ProcessoRow[] = (processos ?? []).map((p) => {
    const fatal = prazoFatalPorProcesso.get(p.id);
    const diasUteis = fatal ? businessDaysUntil(fatal.data_vencimento) : null;
    return {
      id: p.id,
      cliente_id: p.cliente_id,
      numero_processo: p.numero_processo,
      descricao: p.descricao,
      status: p.status,
      cliente_nome: clienteName.get(p.cliente_id) ?? "—",
      responsavel_nome: p.responsavel_id ? profileName.get(p.responsavel_id) ?? null : null,
      segredoJustica: Boolean(p.segredo_justica),
      prazoFatal:
        fatal && diasUteis !== null
          ? { data_vencimento: fatal.data_vencimento, diasUteis, urgencia: classificarPrazo(diasUteis) }
          : null,
    };
  });

  const prazoRows: PrazoRow[] = (prazos ?? []).map((p) => {
    const diasUteis = businessDaysUntil(p.data_vencimento);
    const processo = p.processo_id ? processoById.get(p.processo_id) : null;
    const clienteIdResolvido = p.cliente_id ?? processo?.cliente_id ?? null;
    return {
      id: p.id,
      tipo: p.tipo,
      descricao: p.descricao,
      data_vencimento: p.data_vencimento,
      status: p.status,
      responsavel_id: p.responsavel_id,
      responsavel_nome: p.responsavel_id ? profileName.get(p.responsavel_id) ?? null : null,
      cliente_id: clienteIdResolvido,
      cliente_nome: clienteIdResolvido ? clienteName.get(clienteIdResolvido) ?? null : null,
      processo_numero: processo?.numero_processo ?? null,
      autor: processo?.autor ?? null,
      reu: processo?.reu ?? null,
      valor_causa: processo?.valor_causa != null ? Number(processo.valor_causa) : null,
      diasUteis,
      urgencia: classificarPrazo(diasUteis),
    };
  });

  const tarefaRows: TarefaRow[] = (tarefas ?? []).map((t) => ({
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao,
    status: t.status,
    data_limite: t.data_limite,
    responsavel_nome: t.responsavel_id ? profileName.get(t.responsavel_id) ?? null : null,
    atribuido_por_nome: t.atribuido_por ? profileName.get(t.atribuido_por) ?? null : null,
    cliente_id: t.cliente_id,
    cliente_nome: t.cliente_id ? clienteName.get(t.cliente_id) ?? null : null,
  }));

  const publicacaoRows: PublicacaoRow[] = (andamentos ?? []).map((a) => {
    const processo = processoById.get(a.processo_id);
    const prazoVinculado = Array.isArray(a.prazos) ? a.prazos[0] : a.prazos;
    return {
      id: a.id,
      descricao: a.descricao,
      data_andamento: a.data_andamento,
      data_push: a.data_push,
      processo_numero: processo?.numero_processo ?? "—",
      cliente_nome: processo ? clienteName.get(processo.cliente_id) ?? "—" : "—",
      tratamento: a.tratamento as "prazo_agendado" | "descartado" | null,
      descricao_tratamento: a.descricao_tratamento,
      revisado_em: a.revisado_em,
      prazo_tipo: prazoVinculado?.tipo ?? null,
      prazo_vencimento: prazoVinculado?.data_vencimento ?? null,
    };
  });

  const timesheetRows: TimesheetRow[] = (apontamentos ?? []).map((a) => ({
    id: a.id,
    descricao: a.descricao,
    minutos: a.minutos,
    data: a.data,
    tarefa_titulo: a.tarefa_id ? tarefaById.get(a.tarefa_id)?.titulo ?? null : null,
    prazo_tipo: a.prazo_id ? prazoById.get(a.prazo_id)?.tipo ?? null : null,
    profile_nome: profileName.get(a.profile_id) ?? "—",
    isMine: a.profile_id === session.profile.id,
  }));

  const staffOptions: Option[] = (profiles ?? [])
    .filter((p) => p.active && p.role !== "cliente")
    .map((p) => ({ id: p.id, label: p.full_name }));
  const clientesOptions: Option[] = (clientes ?? []).map((c) => ({ id: c.id, label: c.nome_completo }));
  const processosOptions: Option[] = (processos ?? []).map((p) => ({
    id: p.id,
    label: `${p.numero_processo} — ${clienteName.get(p.cliente_id) ?? ""}`,
  }));
  const prazosOptions: Option[] = (prazos ?? []).map((p) => ({
    id: p.id,
    label: `${p.tipo} — vence ${p.data_vencimento}`,
  }));

  const hoje = new Date();
  const em7dias = new Date(hoje);
  em7dias.setDate(em7dias.getDate() + 7);
  const processosAtivos = processoRows.filter((p) => p.status === "ativo").length;
  const prazosProximos7 = prazoRows.filter((p) => {
    const venc = new Date(`${p.data_vencimento}T00:00:00`);
    return venc >= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) && venc <= em7dias;
  }).length;
  const tarefasAbertas = tarefaRows.filter((t) => t.status !== "concluida").length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-foreground">Operacional</h1>
          <p className="mt-1 text-sm text-text-secondary">Processos, prazos e tarefas em andamento.</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-white p-5">
          <span className="text-[13px] text-text-secondary">Processos ativos</span>
          <div className="mt-2 text-[26px] font-bold text-foreground">{processosAtivos}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <span className="text-[13px] text-text-secondary">Prazos nos próximos 7 dias</span>
          <div className="mt-2 text-[26px] font-bold text-foreground">{prazosProximos7}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <span className="text-[13px] text-text-secondary">Tarefas em aberto</span>
          <div className="mt-2 text-[26px] font-bold text-foreground">{tarefasAbertas}</div>
        </div>
      </div>

      <OperacionalClient
        initialTab={(tab as "processos" | "prazos" | "tarefas" | "publicacoes" | "timesheet") ?? "processos"}
        canProcessos={canProcessos}
        canPrazos={canPrazos}
        canPublicacoes={canPublicacoes}
        processos={processoRows}
        prazos={prazoRows}
        tarefas={tarefaRows}
        publicacoes={publicacaoRows}
        timesheet={timesheetRows}
        clientesOptions={clientesOptions}
        staffOptions={staffOptions}
        processosOptions={processosOptions}
        prazosOptions={prazosOptions}
      />
    </div>
  );
}
