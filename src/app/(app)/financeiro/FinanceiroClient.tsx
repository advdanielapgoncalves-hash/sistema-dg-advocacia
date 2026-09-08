"use client";

import { useState, useTransition } from "react";
import { createLancamento, createParcela, darBaixaParcela, desfazerBaixaParcela } from "./actions";
import type { Option } from "../operacional/OperacionalClient";

export type LancamentoRow = {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  categoria: string | null;
  valor: number;
  data: string;
  cliente_nome: string | null;
};

export type ParcelaRow = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  processo_id: string | null;
  descricao: string;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  forma_recebimento: string | null;
  data_vencimento: string;
  // Status efetivo já calculado no servidor (comparando com a data de hoje);
  // "pago" só muda quando alguém dá baixa manualmente.
  status: "a_vencer" | "atrasado" | "pago";
  data_pagamento: string | null;
};

type Tab = "lancamentos" | "recebimentos";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

const STATUS_LABEL: Record<ParcelaRow["status"], string> = {
  a_vencer: "A vencer",
  atrasado: "Atrasado",
  pago: "Pago",
};

const STATUS_CLASSES: Record<ParcelaRow["status"], string> = {
  a_vencer: "text-status-warning bg-status-warning-bg",
  atrasado: "text-status-critical bg-status-critical-bg",
  pago: "text-status-good bg-status-good-bg",
};

export default function FinanceiroClient({
  initialTab,
  lancamentos,
  de,
  ate,
  faturamento,
  despesas,
  margem,
  parcelas,
  mesRecebimentos,
  clientesOptions,
  processosOptions,
}: {
  initialTab: Tab;
  lancamentos: LancamentoRow[];
  de: string;
  ate: string;
  faturamento: number;
  despesas: number;
  margem: number;
  parcelas: ParcelaRow[];
  mesRecebimentos: string;
  clientesOptions: Option[];
  processosOptions: (Option & { cliente_id: string })[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [isPending, startTransition] = useTransition();
  const [showLancamentoForm, setShowLancamentoForm] = useState(false);
  const [showParcelaForm, setShowParcelaForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baixaPendingId, setBaixaPendingId] = useState<string | null>(null);

  function handleLancamento(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createLancamento(formData);
        setShowLancamentoForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    });
  }

  function handleParcela(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createParcela(formData);
        setShowParcelaForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    });
  }

  function handleBaixa(id: string, jaPago: boolean) {
    setError(null);
    setBaixaPendingId(id);
    startTransition(async () => {
      try {
        if (jaPago) {
          await desfazerBaixaParcela(id);
        } else {
          await darBaixaParcela(id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar.");
      } finally {
        setBaixaPendingId(null);
      }
    });
  }

  const totalMes = parcelas.reduce((s, p) => s + p.valor, 0);
  const totalRecebido = parcelas.filter((p) => p.status === "pago").reduce((s, p) => s + p.valor, 0);
  const totalPendente = totalMes - totalRecebido;
  const qtdPendente = parcelas.filter((p) => p.status !== "pago").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2 border-b border-border">
        <button
          onClick={() => setTab("lancamentos")}
          className={`rounded-t-md px-4 py-2 text-[13px] font-semibold transition-colors ${
            tab === "lancamentos" ? "border-b-2 border-brand-navy text-brand-navy" : "text-text-secondary hover:text-foreground"
          }`}
        >
          Fluxo de caixa
        </button>
        <button
          onClick={() => setTab("recebimentos")}
          className={`rounded-t-md px-4 py-2 text-[13px] font-semibold transition-colors ${
            tab === "recebimentos" ? "border-b-2 border-brand-navy text-brand-navy" : "text-text-secondary hover:text-foreground"
          }`}
        >
          Recebimentos do mês
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-status-critical-bg px-3 py-2 text-[13px] text-status-critical">{error}</p>
      )}

      {tab === "lancamentos" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="text-sm text-text-secondary">Entradas e saídas manuais, com margem calculada no período.</p>
            <form method="get" className="flex items-end gap-2">
              <input type="hidden" name="tab" value="lancamentos" />
              <input type="hidden" name="mes" value={mesRecebimentos} />
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">De</label>
                <input type="date" name="from" defaultValue={de} className="rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Até</label>
                <input type="date" name="to" defaultValue={ate} className="rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-navy-hover">
                Filtrar
              </button>
            </form>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-white p-5">
              <span className="text-[13px] text-text-secondary">Faturamento (entradas)</span>
              <div className="mt-2 text-[24px] font-bold text-status-good">{formatBRL(faturamento)}</div>
            </div>
            <div className="rounded-xl border border-border bg-white p-5">
              <span className="text-[13px] text-text-secondary">Despesas (saídas)</span>
              <div className="mt-2 text-[24px] font-bold text-status-critical">{formatBRL(despesas)}</div>
            </div>
            <div className="rounded-xl border border-border bg-white p-5">
              <span className="text-[13px] text-text-secondary">Margem do período</span>
              <div className={`mt-2 text-[24px] font-bold ${margem >= 0 ? "text-foreground" : "text-status-critical"}`}>
                {formatBRL(margem)}
              </div>
              <span className="text-[11.5px] text-text-muted">Faturamento − despesas no período</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[15px] font-bold text-foreground">Lançamentos do período</span>
              <button
                onClick={() => setShowLancamentoForm((v) => !v)}
                className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-navy-hover"
              >
                {showLancamentoForm ? "Cancelar" : "+ Novo lançamento"}
              </button>
            </div>

            {showLancamentoForm && (
              <form action={handleLancamento} className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-4">
                <div className="col-span-1">
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Tipo</label>
                  <select name="tipo" required className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                    <option value="entrada">Entrada (faturamento)</option>
                    <option value="saida">Saída (despesa)</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Valor (R$)</label>
                  <input name="valor" type="number" step="0.01" min="0.01" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                </div>
                <div className="col-span-1">
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Data</label>
                  <input name="data" type="date" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                </div>
                <div className="col-span-1">
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Categoria</label>
                  <input name="categoria" placeholder="Ex: Honorários, Aluguel..." className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                </div>
                <div className="col-span-1">
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Cliente (opcional)</label>
                  <select name="cliente_id" className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                    <option value="">—</option>
                    {clientesOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Descrição</label>
                  <input name="descricao" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <button type="submit" disabled={isPending} className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                    {isPending ? "Salvando..." : "Salvar lançamento"}
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Data</th>
                    <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Descrição</th>
                    <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Categoria</th>
                    <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Cliente</th>
                    <th className="pb-3 text-right text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-text-muted">Nenhum lançamento neste período.</td></tr>
                  )}
                  {lancamentos.map((l) => (
                    <tr key={l.id} className="border-t border-border/60">
                      <td className="py-3 text-text-secondary">{fmtDate(l.data)}</td>
                      <td className="py-3 text-foreground">{l.descricao}</td>
                      <td className="py-3 text-text-secondary">{l.categoria || "—"}</td>
                      <td className="py-3 text-text-secondary">{l.cliente_nome || "—"}</td>
                      <td className={`py-3 text-right font-semibold ${l.tipo === "entrada" ? "text-status-good" : "text-status-critical"}`}>
                        {l.tipo === "entrada" ? "+" : "-"} {formatBRL(l.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "recebimentos" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="text-sm text-text-secondary">
              Controle de recebimentos esperados no mês, com baixa manual conforme cada um é pago — separado do fluxo de caixa acima.
            </p>
            <form method="get" className="flex items-end gap-2">
              <input type="hidden" name="tab" value="recebimentos" />
              <input type="hidden" name="from" value={de} />
              <input type="hidden" name="to" value={ate} />
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Mês</label>
                <input type="month" name="mes" defaultValue={mesRecebimentos} className="rounded-md border border-border px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-navy-hover">
                Ver mês
              </button>
            </form>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-white p-5">
              <span className="text-[13px] text-text-secondary">Total esperado no mês</span>
              <div className="mt-2 text-[22px] font-bold text-foreground">{formatBRL(totalMes)}</div>
            </div>
            <div className="rounded-xl border border-border bg-white p-5">
              <span className="text-[13px] text-text-secondary">Já recebido</span>
              <div className="mt-2 text-[22px] font-bold text-status-good">{formatBRL(totalRecebido)}</div>
            </div>
            <div className="rounded-xl border border-border bg-white p-5">
              <span className="text-[13px] text-text-secondary">Ainda pendente</span>
              <div className="mt-2 text-[22px] font-bold text-status-warning">{formatBRL(totalPendente)}</div>
            </div>
            <div className="rounded-xl border border-border bg-white p-5">
              <span className="text-[13px] text-text-secondary">Recebimentos pendentes</span>
              <div className="mt-2 text-[22px] font-bold text-foreground">{qtdPendente}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[15px] font-bold text-foreground">Recebimentos de {fmtMes(mesRecebimentos)}</span>
              <button
                onClick={() => setShowParcelaForm((v) => !v)}
                className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-navy-hover"
              >
                {showParcelaForm ? "Cancelar" : "+ Novo recebimento"}
              </button>
            </div>

            {showParcelaForm && (
              <form action={handleParcela} className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-4">
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
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Processo (opcional)</label>
                  <select name="processo_id" className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                    <option value="">—</option>
                    {processosOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Descrição</label>
                  <input name="descricao" required placeholder="Ex: Honorários — 2ª parcela" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                </div>
                <div className="col-span-1">
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Valor (R$)</label>
                  <input name="valor" type="number" step="0.01" min="0.01" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                </div>
                <div className="col-span-1">
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Data de vencimento</label>
                  <input name="data_vencimento" type="date" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                </div>
                <div className="col-span-1">
                  <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Forma de recebimento</label>
                  <input name="forma_recebimento" placeholder="Pix, boleto, cartão..." className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                </div>
                <div className="col-span-1 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Parcela nº</label>
                    <input name="numero_parcela" type="number" min="1" defaultValue={1} className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Total de parcelas</label>
                    <input name="total_parcelas" type="number" min="1" defaultValue={1} className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="col-span-2">
                  <button type="submit" disabled={isPending} className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                    {isPending ? "Salvando..." : "Salvar recebimento"}
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Vencimento</th>
                    <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Cliente</th>
                    <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Descrição</th>
                    <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Parcela</th>
                    <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Forma</th>
                    <th className="pb-3 pr-6 text-right text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Valor</th>
                    <th className="pb-3 pl-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Status</th>
                    <th className="pb-3 pl-4 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-text-muted">Nenhum recebimento cadastrado para este mês.</td></tr>
                  )}
                  {parcelas.map((p) => (
                    <tr key={p.id} className="border-t border-border/60">
                      <td className="py-3 text-text-secondary">{fmtDate(p.data_vencimento)}</td>
                      <td className="py-3 text-foreground">{p.cliente_nome}</td>
                      <td className="py-3 text-text-secondary">{p.descricao}</td>
                      <td className="py-3 text-text-secondary">{p.numero_parcela}/{p.total_parcelas}</td>
                      <td className="py-3 text-text-secondary">{p.forma_recebimento || "—"}</td>
                      <td className="py-3 pr-6 text-right font-semibold text-foreground">{formatBRL(p.valor)}</td>
                      <td className="py-3 pl-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${STATUS_CLASSES[p.status]}`}>
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      <td className="py-3 pl-4">
                        <button
                          disabled={isPending && baixaPendingId === p.id}
                          onClick={() => handleBaixa(p.id, p.status === "pago")}
                          className={`rounded-md px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60 ${
                            p.status === "pago"
                              ? "border border-border text-text-secondary hover:bg-background"
                              : "bg-brand-navy text-white hover:bg-brand-navy-hover"
                          }`}
                        >
                          {isPending && baixaPendingId === p.id ? "..." : p.status === "pago" ? "Desfazer baixa" : "Dar baixa"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtMes(mes: string) {
  const [ano, mesNum] = mes.split("-").map(Number);
  return new Date(ano, mesNum - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
