"use client";

import { useState, useTransition } from "react";
import { addAtendimento, updateAtendimento } from "../actions";

export type AtendimentoRow = {
  id: string;
  data: string; // ISO (timestamptz)
  tipo: string | null;
  descricao: string;
  registrado_por_nome: string | null;
};

const TIPOS = ["Ligação", "E-mail", "Reunião", "WhatsApp", "Outro"];

// Converte um ISO timestamp pro formato que <input type="datetime-local">
// espera ("AAAA-MM-DDTHH:mm"), usando o horário local do navegador.
function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AtendimentoForm({
  clienteId,
  atendimentos,
}: {
  clienteId: string;
  atendimentos: AtendimentoRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addAtendimento(clienteId, formData);
        const form = document.getElementById("atendimento-form") as HTMLFormElement | null;
        form?.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    });
  }

  function handleUpdate(id: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateAtendimento(id, clienteId, formData);
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form id="atendimento-form" action={handleCreate} className="flex flex-col gap-2 rounded-lg bg-background p-4">
        <div className="flex gap-2">
          <select name="tipo" className="rounded-md border border-border bg-white px-3 py-2 text-sm">
            {TIPOS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <textarea
          name="descricao"
          required
          rows={2}
          placeholder="O que foi tratado com o cliente..."
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
        {error && !editingId && <p className="text-[12px] text-status-critical">{error}</p>}
        <div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {isPending ? "Salvando..." : "Registrar atendimento"}
          </button>
        </div>
      </form>

      <ul className="flex flex-col divide-y divide-border/60">
        {atendimentos.length === 0 && (
          <li className="py-3 text-sm text-text-muted">Nenhum atendimento registrado ainda.</li>
        )}
        {atendimentos.map((a) => (
          <li key={a.id} className="py-3 text-sm">
            {editingId === a.id ? (
              <form
                action={(fd) => handleUpdate(a.id, fd)}
                className="flex flex-col gap-2 rounded-lg bg-background p-3"
              >
                <div className="flex flex-wrap gap-2">
                  <select
                    name="tipo"
                    defaultValue={a.tipo ?? "Outro"}
                    className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    name="data"
                    type="datetime-local"
                    defaultValue={toDatetimeLocalValue(a.data)}
                    required
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  name="descricao"
                  defaultValue={a.descricao}
                  required
                  rows={2}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                />
                {error && <p className="text-[12px] text-status-critical">{error}</p>}
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md bg-brand-navy px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
                  >
                    {isPending ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setError(null);
                    }}
                    className="text-[12px] text-text-muted hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-foreground">{a.tipo || "Atendimento"}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-text-muted">
                      {new Date(a.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      {a.registrado_por_nome ? ` · ${a.registrado_por_nome}` : ""}
                    </span>
                    <button
                      onClick={() => {
                        setError(null);
                        setEditingId(a.id);
                      }}
                      className="text-[12px] font-semibold text-brand-navy hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-text-secondary">{a.descricao}</p>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
