"use client";

import { useState, useTransition } from "react";
import { darBaixaParcela, desfazerBaixaParcela } from "../../financeiro/actions";

export type FinLancamentoRow = {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  data: string;
};

export type FinParcelaRow = {
  id: string;
  descricao: string;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  forma_recebimento: string | null;
  data_vencimento: string;
  status: "a_vencer" | "atrasado" | "pago";
  data_pagamento: string | null;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

const STATUS_LABEL: Record<FinParcelaRow["status"], string> = {
  a_vencer: "A vencer",
  atrasado: "Atrasado",
  pago: "Pago",
};

const STATUS_CLASSES: Record<FinParcelaRow["status"], string> = {
  a_vencer: "text-status-warning bg-status-warning-bg",
  atrasado: "text-status-critical bg-status-critical-bg",
  pago: "text-status-good bg-status-good-bg",
};

export default function FinanceiroClienteSection({
  lancamentos,
  parcelas,
}: {
  lancamentos: FinLancamentoRow[];
  parcelas: FinParcelaRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleBaixa(id: string, jaPago: boolean) {
    setError(null);
    setPendingId(id);
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
        setPendingId(null);
      }
    });
  }

  const entradas = lancamentos.filter((l) => l.tipo === "entrada");
  const totalEntradas = entradas.reduce((s, l) => s + l.valor, 0);
  const totalParcelasPagas = parcelas.filter((p) => p.status === "pago").reduce((s, p) => s + p.valor, 0);
  const totalRecebido = totalEntradas + totalParcelasPagas;
  const totalPendente = parcelas.filter((p) => p.status !== "pago").reduce((s, p) => s + p.valor, 0);
  const totalContratado = totalRecebido + totalPendente;

  const proximaParcela = parcelas
    .filter((p) => p.status !== "pago")
    .slice()
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))[0];

  const semDados = entradas.length === 0 && parcelas.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-background p-4">
          <span className="text-[12px] text-text-secondary">Total contratado</span>
          <div className="mt-1 text-[20px] font-bold text-foreground">{formatBRL(totalContratado)}</div>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <span className="text-[12px] text-text-secondary">Já recebido</span>
          <div className="mt-1 text-[20px] font-bold text-status-good">{formatBRL(totalRecebido)}</div>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <span className="text-[12px] text-text-secondary">Ainda pendente</span>
          <div className="mt-1 text-[20px] font-bold text-status-warning">{formatBRL(totalPendente)}</div>
        </div>
      </div>

      {proximaParcela && (
        <p className="text-[12.5px] text-text-secondary">
          Próximo recebimento pendente:{" "}
          <span className="font-semibold text-foreground">{fmtDate(proximaParcela.data_vencimento)}</span> —{" "}
          {formatBRL(proximaParcela.valor)} ({proximaParcela.descricao})
        </p>
      )}

      {error && (
        <p className="rounded-md bg-status-critical-bg px-3 py-2 text-[13px] text-status-critical">{error}</p>
      )}

      {semDados ? (
        <p className="text-sm text-text-muted">Nenhum lançamento financeiro registrado para este cliente ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="pb-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Data</th>
                <th className="pb-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Descrição</th>
                <th className="pb-2 text-right text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Valor</th>
                <th className="pb-2 pl-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Status</th>
                <th className="pb-2 pl-4 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Ação</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((l) => (
                <tr key={`l-${l.id}`} className="border-t border-border/60">
                  <td className="py-2 text-text-secondary">{fmtDate(l.data)}</td>
                  <td className="py-2 text-foreground">{l.descricao}</td>
                  <td className="py-2 text-right font-semibold text-status-good">{formatBRL(l.valor)}</td>
                  <td className="py-2 pl-2">
                    <span className="rounded-full bg-status-good-bg px-2.5 py-0.5 text-[12px] font-semibold text-status-good">
                      Recebido
                    </span>
                  </td>
                  <td className="py-2 pl-4 text-text-muted">—</td>
                </tr>
              ))}
              {parcelas
                .slice()
                .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
                .map((p) => (
                  <tr key={`p-${p.id}`} className="border-t border-border/60">
                    <td className="py-2 text-text-secondary">{fmtDate(p.data_vencimento)}</td>
                    <td className="py-2 text-foreground">
                      {p.descricao} <span className="text-text-muted">({p.numero_parcela}/{p.total_parcelas})</span>
                    </td>
                    <td className="py-2 text-right font-semibold text-foreground">{formatBRL(p.valor)}</td>
                    <td className="py-2 pl-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${STATUS_CLASSES[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="py-2 pl-4">
                      <button
                        disabled={isPending && pendingId === p.id}
                        onClick={() => handleBaixa(p.id, p.status === "pago")}
                        className={`rounded-md px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60 ${
                          p.status === "pago"
                            ? "border border-border text-text-secondary hover:bg-white"
                            : "bg-brand-navy text-white hover:bg-brand-navy-hover"
                        }`}
                      >
                        {isPending && pendingId === p.id ? "..." : p.status === "pago" ? "Desfazer baixa" : "Dar baixa"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
