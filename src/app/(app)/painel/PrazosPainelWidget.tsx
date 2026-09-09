"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { concluirPrazo } from "../operacional/actions";
import { URGENCIA_CLASSES, URGENCIA_LABEL, diaSegurancaD1, type PrazoUrgencia } from "@/lib/businessDays";

export type PrazoPainelRow = {
  id: string;
  tipo: string;
  descricao: string | null;
  data_vencimento: string;
  processo_numero: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  urgencia: PrazoUrgencia;
};

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

function fmtD1(dataVencimento: string) {
  return new Date(`${diaSegurancaD1(dataVencimento)}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

// Widget interativo do Painel: além de listar os próximos prazos (como já
// era), agora dá pra clicar num prazo e concluí-lo ali mesmo — com uma
// observação do que foi feito (pedido da Daniela, ex: "protocolo na pasta,
// pendente informar o cliente") e, opcionalmente, já lançar o tempo gasto
// no timesheet, sem precisar ir até o Operacional.
export default function PrazosPainelWidget({ prazos }: { prazos: PrazoPainelRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleConcluir(id: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await concluirPrazo(id, formData);
        setOpenId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao concluir o prazo.");
      }
    });
  }

  if (prazos.length === 0) {
    return <p className="py-3 text-sm text-text-muted">Nenhum prazo pendente.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border/60">
      {error && (
        <p className="mb-2 rounded-md bg-status-critical-bg px-3 py-2 text-[13px] text-status-critical">{error}</p>
      )}
      {prazos.map((p) => {
        const c = URGENCIA_CLASSES[p.urgencia];
        const isOpen = openId === p.id;
        return (
          <div key={p.id} className="py-2.5 text-sm">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setOpenId(isOpen ? null : p.id);
              }}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <div className="text-[12px] font-semibold text-brand-navy">
                  {p.processo_numero || "Sem processo vinculado"}
                  {p.cliente_nome && ` — ${p.cliente_nome}`}
                </div>
                <div className="font-semibold text-foreground">{p.tipo}</div>
                <div className="text-[12px] text-text-muted">
                  {fmtDate(p.data_vencimento)}
                  <span className="ml-2 font-semibold text-status-critical">D-1: {fmtD1(p.data_vencimento)}</span>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${c.text} ${c.bg}`}>
                {URGENCIA_LABEL[p.urgencia]}
              </span>
            </button>

            {isOpen && (
              <div className="mt-3 rounded-lg bg-background p-3">
                {p.descricao && (
                  <p className="mb-2 text-[12.5px] text-text-secondary">
                    <span className="font-semibold text-text-muted">Do que se trata: </span>
                    {p.descricao}
                  </p>
                )}
                {p.cliente_id && (
                  <Link
                    href={`/clientes/${p.cliente_id}`}
                    className="mb-2 inline-block text-[12.5px] font-semibold text-brand-navy hover:underline"
                  >
                    Ver cliente →
                  </Link>
                )}
                <form action={(fd) => handleConcluir(p.id, fd)} className="flex flex-col gap-2">
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-text-secondary">
                      Concluir prazo — o que foi feito?
                    </label>
                    <textarea
                      name="observacao"
                      required
                      rows={2}
                      placeholder='Ex: "Protocolo na pasta, pendente informar o cliente"'
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="mb-1 block text-[12px] font-semibold text-text-secondary">
                        Tempo gasto (minutos)
                      </label>
                      <input
                        name="minutos"
                        type="number"
                        min="1"
                        step="1"
                        required
                        placeholder="Ex: 45"
                        className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
                    >
                      {isPending ? "Salvando..." : "Concluir prazo"}
                    </button>
                  </div>
                  <p className="text-[11.5px] text-text-muted">
                    O tempo lançado aqui entra no timesheet vinculado a este prazo — é obrigatório para concluir.
                  </p>
                </form>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
