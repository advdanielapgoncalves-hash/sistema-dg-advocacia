"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createProcesso,
  createPrazo,
  createTarefa,
  updatePrazoStatus,
  updateTarefaStatus,
  marcarIntimacaoRevisada,
  createApontamento,
  deleteApontamento,
  createAndamentoManual,
  sincronizarDataJudManual,
} from "./actions";
import type { ResumoSincronizacao } from "@/lib/datajudSync";
import { URGENCIA_CLASSES, URGENCIA_LABEL, type PrazoUrgencia } from "@/lib/businessDays";

export type Option = { id: string; label: string };

export type ProcessoRow = {
  id: string;
  cliente_id: string;
  numero_processo: string;
  descricao: string | null;
  status: string;
  cliente_nome: string;
  responsavel_nome: string | null;
  segredoJustica: boolean;
  prazoFatal: { data_vencimento: string; diasUteis: number; urgencia: PrazoUrgencia } | null;
};

export type PrazoRow = {
  id: string;
  tipo: string;
  descricao: string | null;
  data_vencimento: string;
  status: "pendente" | "concluido";
  responsavel_nome: string | null;
  cliente_nome: string | null;
  processo_numero: string | null;
  diasUteis: number;
  urgencia: PrazoUrgencia;
};

export type TarefaRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: "pendente" | "em_andamento" | "concluida";
  data_limite: string | null;
  responsavel_nome: string | null;
  atribuido_por_nome: string | null;
};

export type PublicacaoRow = {
  id: string;
  descricao: string;
  data_andamento: string;
  data_push: string;
  processo_numero: string;
  cliente_nome: string;
  revisado: boolean;
};

export type TimesheetRow = {
  id: string;
  descricao: string;
  minutos: number;
  data: string;
  tarefa_titulo: string | null;
  prazo_tipo: string | null;
  profile_nome: string;
  isMine: boolean;
};

type Tab = "processos" | "prazos" | "tarefas" | "publicacoes" | "timesheet";

function formatHoras(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function UrgenciaBadge({ urgencia }: { urgencia: PrazoUrgencia }) {
  const c = URGENCIA_CLASSES[urgencia];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${c.text} ${c.bg}`}>
      {URGENCIA_LABEL[urgencia]}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

export default function OperacionalClient({
  initialTab,
  canProcessos,
  canPrazos,
  canPublicacoes,
  processos,
  prazos,
  tarefas,
  publicacoes,
  timesheet,
  clientesOptions,
  staffOptions,
  processosOptions,
  prazosOptions,
}: {
  initialTab: Tab;
  canProcessos: boolean;
  canPrazos: boolean;
  canPublicacoes: boolean;
  processos: ProcessoRow[];
  prazos: PrazoRow[];
  tarefas: TarefaRow[];
  publicacoes: PublicacaoRow[];
  timesheet: TimesheetRow[];
  clientesOptions: Option[];
  staffOptions: Option[];
  processosOptions: Option[];
  prazosOptions: Option[];
}) {
  const tabs: { key: Tab; label: string; visible: boolean }[] = [
    { key: "processos", label: "Processos", visible: canProcessos },
    { key: "prazos", label: "Prazos", visible: canPrazos },
    { key: "tarefas", label: "Tarefas", visible: true },
    { key: "timesheet", label: "Timesheet", visible: true },
    { key: "publicacoes", label: "Publicações", visible: canPublicacoes },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);
  const [tab, setTab] = useState<Tab>(
    visibleTabs.some((t) => t.key === initialTab) ? initialTab : visibleTabs[0]?.key ?? "tarefas"
  );

  const [isPending, startTransition] = useTransition();
  const [showProcessoForm, setShowProcessoForm] = useState(false);
  const [showPrazoForm, setShowPrazoForm] = useState(false);
  const [showTarefaForm, setShowTarefaForm] = useState(false);
  const [showTimesheetForm, setShowTimesheetForm] = useState(false);
  const [showAndamentoForm, setShowAndamentoForm] = useState(false);
  const [vinculoTipo, setVinculoTipo] = useState<"nenhum" | "tarefa" | "prazo">("nenhum");
  const [formError, setFormError] = useState<string | null>(null);
  const [syncPending, startSync] = useTransition();
  const [syncResult, setSyncResult] = useState<ResumoSincronizacao | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  function handleSincronizarDataJud() {
    setSyncError(null);
    setSyncResult(null);
    startSync(async () => {
      try {
        const resumo = await sincronizarDataJudManual();
        setSyncResult(resumo);
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "Erro ao sincronizar.");
      }
    });
  }

  function submit(action: (fd: FormData) => Promise<void>, onDone?: () => void) {
    return (formData: FormData) => {
      setFormError(null);
      startTransition(async () => {
        try {
          await action(formData);
          onDone?.();
        } catch (err) {
          setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
        }
      });
    };
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2 border-b border-border">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t-md px-4 py-2 text-[13px] font-semibold transition-colors ${
              tab === t.key
                ? "border-b-2 border-brand-navy text-brand-navy"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {formError && (
        <p className="rounded-md bg-status-critical-bg px-3 py-2 text-[13px] text-status-critical">{formError}</p>
      )}

      {tab === "processos" && (
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[15px] font-bold text-foreground">Processos</span>
            <button
              onClick={() => setShowProcessoForm((v) => !v)}
              className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-navy-hover"
            >
              {showProcessoForm ? "Cancelar" : "+ Novo processo"}
            </button>
          </div>

          {showProcessoForm && (
            <form
              action={submit(createProcesso, () => setShowProcessoForm(false))}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-4"
            >
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Cliente</label>
                <select name="cliente_id" required className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {clientesOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Número do processo</label>
                <input name="numero_processo" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Descrição</label>
                <input name="descricao" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Responsável</label>
                <select name="responsavel_id" className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                  <option value="">Não definido</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1 flex items-center gap-2 pt-6">
                <input id="monitoramento" type="checkbox" name="monitoramento_diario_oficial" className="h-4 w-4" />
                <label htmlFor="monitoramento" className="text-[13px] text-text-secondary">
                  Monitorar automaticamente via DataJud (só processos públicos, não sigilosos)
                </label>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input id="segredo" type="checkbox" name="segredo_justica" className="h-4 w-4" />
                <label htmlFor="segredo" className="text-[13px] text-text-secondary">
                  Processo em segredo de justiça (e-SAJ) — não aparece em nenhuma captura pública; precisa da
                  credencial de tribunal cadastrada em &ldquo;Credenciais de Tribunal&rdquo;.
                </label>
              </div>
              <div className="col-span-2">
                <button type="submit" disabled={isPending} className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                  {isPending ? "Salvando..." : "Criar processo"}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Processo</th>
                  <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Descrição</th>
                  <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Responsável</th>
                  <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Status</th>
                  <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Prazo fatal</th>
                  <th className="pb-3 text-right text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Ações</th>
                </tr>
              </thead>
              <tbody>
                {processos.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-text-muted">Nenhum processo cadastrado ainda.</td></tr>
                )}
                {processos.map((p) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{p.numero_processo}</span>
                        {p.segredoJustica && (
                          <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-[11px] font-semibold text-status-warning">
                            Sigiloso
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-text-muted">{p.cliente_nome}</div>
                    </td>
                    <td className="py-3 text-text-secondary">{p.descricao || "—"}</td>
                    <td className="py-3 text-text-secondary">{p.responsavel_nome || "—"}</td>
                    <td className="py-3 text-text-secondary capitalize">{p.status}</td>
                    <td className="py-3">
                      {p.prazoFatal ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-text-secondary">{fmtDate(p.prazoFatal.data_vencimento)}</span>
                          <UrgenciaBadge urgencia={p.prazoFatal.urgencia} />
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <Link href={`/clientes/${p.cliente_id}`} className="text-[13px] font-semibold text-brand-navy hover:underline">
                        Ver cliente →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "prazos" && (
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[15px] font-bold text-foreground">Prazos</span>
            <button
              onClick={() => setShowPrazoForm((v) => !v)}
              className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-navy-hover"
            >
              {showPrazoForm ? "Cancelar" : "+ Novo prazo"}
            </button>
          </div>

          {showPrazoForm && (
            <form
              action={submit(createPrazo, () => setShowPrazoForm(false))}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-4"
            >
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Processo (opcional)</label>
                <select name="processo_id" className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                  <option value="">Nenhum</option>
                  {processosOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Tipo de prazo</label>
                <input name="tipo" required placeholder="Ex: Contestação, Recurso..." className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Vencimento</label>
                <input name="data_vencimento" type="date" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Responsável</label>
                <select name="responsavel_id" className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                  <option value="">Não definido</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Descrição</label>
                <input name="descricao" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <button type="submit" disabled={isPending} className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                  {isPending ? "Salvando..." : "Criar prazo"}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Vencimento</th>
                  <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Tipo</th>
                  <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Processo / Cliente</th>
                  <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Responsável</th>
                  <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Urgência</th>
                  <th className="pb-3 text-right text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Ações</th>
                </tr>
              </thead>
              <tbody>
                {prazos.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-text-muted">Nenhum prazo pendente.</td></tr>
                )}
                {prazos.map((p) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="py-3 font-semibold text-foreground">{fmtDate(p.data_vencimento)}</td>
                    <td className="py-3 text-text-secondary">
                      {p.tipo}
                      {p.descricao && <div className="text-[12px] text-text-muted">{p.descricao}</div>}
                    </td>
                    <td className="py-3 text-text-secondary">
                      {p.processo_numero || "—"}
                      {p.cliente_nome && <div className="text-[12px] text-text-muted">{p.cliente_nome}</div>}
                    </td>
                    <td className="py-3 text-text-secondary">{p.responsavel_nome || "—"}</td>
                    <td className="py-3"><UrgenciaBadge urgencia={p.urgencia} /></td>
                    <td className="py-3 text-right">
                      <button
                        disabled={isPending}
                        onClick={() => startTransition(() => updatePrazoStatus(p.id, "concluido"))}
                        className="text-[13px] font-semibold text-brand-navy hover:underline disabled:opacity-50"
                      >
                        Concluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-text-muted">
            Dias úteis considera só segunda a sexta — feriados ainda não entram nessa conta (pendência conhecida).
          </p>
        </div>
      )}

      {tab === "tarefas" && (
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[15px] font-bold text-foreground">Tarefas</span>
            <button
              onClick={() => setShowTarefaForm((v) => !v)}
              className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-navy-hover"
            >
              {showTarefaForm ? "Cancelar" : "+ Delegar tarefa"}
            </button>
          </div>

          {showTarefaForm && (
            <form
              action={submit(createTarefa, () => setShowTarefaForm(false))}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-4"
            >
              <div className="col-span-2">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Título</label>
                <input name="titulo" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Responsável</label>
                <select name="responsavel_id" required className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Data limite</label>
                <input name="data_limite" type="date" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Descrição</label>
                <input name="descricao" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <button type="submit" disabled={isPending} className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                  {isPending ? "Salvando..." : "Delegar"}
                </button>
              </div>
            </form>
          )}

          <ul className="flex flex-col divide-y divide-border/60">
            {tarefas.length === 0 && <li className="py-6 text-center text-sm text-text-muted">Nenhuma tarefa em aberto.</li>}
            {tarefas.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-semibold text-foreground">{t.titulo}</div>
                  <div className="text-[12px] text-text-muted">
                    {t.responsavel_nome ? `Para: ${t.responsavel_nome}` : ""}
                    {t.data_limite ? ` · até ${fmtDate(t.data_limite)}` : ""}
                    {t.atribuido_por_nome ? ` · delegado por ${t.atribuido_por_nome}` : ""}
                  </div>
                  {t.descricao && <div className="mt-0.5 text-text-secondary">{t.descricao}</div>}
                </div>
                <select
                  value={t.status}
                  disabled={isPending}
                  onChange={(e) =>
                    startTransition(() =>
                      updateTarefaStatus(t.id, e.target.value as "pendente" | "em_andamento" | "concluida")
                    )
                  }
                  className="rounded-md border border-border bg-white px-2 py-1.5 text-[12.5px]"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluida">Concluída</option>
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "timesheet" && (
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-[15px] font-bold text-foreground">Timesheet</span>
              <p className="mt-0.5 text-[12.5px] text-text-muted">
                Lance o tempo de uma atividade — pode vincular a um prazo ou deixar avulso, só com a descrição.
              </p>
            </div>
            <button
              onClick={() => setShowTimesheetForm((v) => !v)}
              className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-navy-hover"
            >
              {showTimesheetForm ? "Cancelar" : "+ Apontar tempo"}
            </button>
          </div>

          {showTimesheetForm && (
            <form
              action={submit(createApontamento, () => {
                setShowTimesheetForm(false);
                setVinculoTipo("nenhum");
              })}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-4"
            >
              <div className="col-span-2">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Descrição da atividade</label>
                <input name="descricao" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Tempo (horas)</label>
                <input name="horas" type="number" step="0.25" min="0.25" required placeholder="Ex: 1.5" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Data</label>
                <input name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Vincular a</label>
                <select
                  value={vinculoTipo}
                  onChange={(e) => setVinculoTipo(e.target.value as "nenhum" | "tarefa" | "prazo")}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                >
                  <option value="nenhum">Nada — só a descrição acima</option>
                  <option value="tarefa">Uma tarefa</option>
                  <option value="prazo">Um prazo</option>
                </select>
              </div>
              {vinculoTipo === "tarefa" && (
                <div className="col-span-2">
                  <select name="tarefa_id" required className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                    <option value="">Selecione a tarefa...</option>
                    {tarefas.map((t) => (
                      <option key={t.id} value={t.id}>{t.titulo}</option>
                    ))}
                  </select>
                </div>
              )}
              {vinculoTipo === "prazo" && (
                <div className="col-span-2">
                  <select name="prazo_id" required className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                    <option value="">Selecione o prazo...</option>
                    {prazosOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <button type="submit" disabled={isPending} className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                  {isPending ? "Salvando..." : "Salvar apontamento"}
                </button>
              </div>
            </form>
          )}

          <ul className="flex flex-col divide-y divide-border/60">
            {timesheet.length === 0 && <li className="py-6 text-center text-sm text-text-muted">Nenhum apontamento ainda.</li>}
            {timesheet.map((ts) => (
              <li key={ts.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-semibold text-foreground">{ts.descricao}</div>
                  <div className="text-[12px] text-text-muted">
                    {fmtDate(ts.data)} · {ts.profile_nome}
                    {ts.tarefa_titulo ? ` · tarefa: ${ts.tarefa_titulo}` : ""}
                    {ts.prazo_tipo ? ` · prazo: ${ts.prazo_tipo}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-brand-navy">{formatHoras(ts.minutos)}</span>
                  {ts.isMine && (
                    <button
                      disabled={isPending}
                      onClick={() => startTransition(() => deleteApontamento(ts.id))}
                      className="text-[12px] text-text-muted hover:text-status-critical disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {timesheet.length > 0 && (
            <p className="mt-3 text-right text-[13px] font-semibold text-foreground">
              Total: {formatHoras(timesheet.reduce((sum, t) => sum + t.minutos, 0))}
            </p>
          )}
        </div>
      )}

      {tab === "publicacoes" && (
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[15px] font-bold text-foreground">Publicações da semana</span>
              <p className="mt-0.5 text-[12.5px] text-text-muted">
                Data de push = quando este sistema recebeu/registrou a intimação. Processos públicos marcados
                para monitoramento são sincronizados automaticamente 1x por dia com o DataJud (CNJ). Processos em
                segredo de justiça <strong>não</strong> entram nessa sincronização — pra eles, use o botão de
                registro manual abaixo até a sincronização com o e-SAJ existir.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setShowAndamentoForm((v) => !v)}
                className="rounded-md border border-border px-4 py-2 text-[13px] font-bold text-foreground hover:bg-background"
              >
                {showAndamentoForm ? "Cancelar" : "+ Registrar manualmente"}
              </button>
              <button
                disabled={syncPending}
                onClick={handleSincronizarDataJud}
                className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-navy-hover disabled:opacity-60"
              >
                {syncPending ? "Sincronizando..." : "Sincronizar DataJud agora"}
              </button>
            </div>
          </div>

          {showAndamentoForm && (
            <form
              action={submit(createAndamentoManual, () => setShowAndamentoForm(false))}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-4"
            >
              <div className="col-span-2">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Processo</label>
                <select name="processo_id" required className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {processosOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Data do andamento</label>
                <input name="data_andamento" type="date" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Tipo</label>
                <select name="tipo" required className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                  <option value="intimacao">Intimação (exige ação/prazo)</option>
                  <option value="andamento">Andamento informativo</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Descrição</label>
                <input name="descricao" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <button type="submit" disabled={isPending} className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                  {isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          )}

          {syncError && (
            <p className="mb-3 rounded-md bg-status-critical-bg px-3 py-2 text-[13px] text-status-critical">{syncError}</p>
          )}
          {syncResult && (
            <p
              className={`mb-3 rounded-md px-3 py-2 text-[13px] ${
                syncResult.erros.length > 0
                  ? "bg-status-warning-bg text-status-warning"
                  : "bg-status-good-bg text-status-good"
              }`}
            >
              {syncResult.processosVerificados} processo(s) verificado(s), {syncResult.novosAndamentos} andamento(s)
              novo(s) encontrado(s).
              {syncResult.erros.length > 0 && (
                <>
                  {" "}
                  {syncResult.erros.length} erro(s): {syncResult.erros.map((e) => `${e.numero_processo} (${e.erro})`).join("; ")}
                </>
              )}
            </p>
          )}

          <ul className="flex flex-col divide-y divide-border/60">
            {publicacoes.length === 0 && <li className="py-6 text-center text-sm text-text-muted">Nenhuma intimação registrada.</li>}
            {publicacoes.map((pub) => (
              <li key={pub.id} className="flex items-start justify-between py-3 text-sm">
                <div>
                  <div className="font-semibold text-foreground">{pub.processo_numero} — {pub.cliente_nome}</div>
                  <div className="text-text-secondary">{pub.descricao}</div>
                  <div className="mt-0.5 text-[12px] text-text-muted">
                    Andamento em {fmtDate(pub.data_andamento)} · recebida em{" "}
                    {new Date(pub.data_push).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
                {pub.revisado ? (
                  <span className="rounded-full bg-status-good-bg px-2.5 py-0.5 text-[12px] font-semibold text-status-good">Revisada</span>
                ) : (
                  <button
                    disabled={isPending}
                    onClick={() => startTransition(() => marcarIntimacaoRevisada(pub.id))}
                    className="text-[13px] font-semibold text-brand-navy hover:underline disabled:opacity-50"
                  >
                    Marcar revisada
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
