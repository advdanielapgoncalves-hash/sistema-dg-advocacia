"use client";

import { useState, useTransition } from "react";
import { addAtendimento } from "../actions";

export default function AtendimentoForm({ clienteId }: { clienteId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
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

  return (
    <form id="atendimento-form" action={handleSubmit} className="flex flex-col gap-2 rounded-lg bg-background p-4">
      <div className="flex gap-2">
        <select name="tipo" className="rounded-md border border-border bg-white px-3 py-2 text-sm">
          <option value="Ligação">Ligação</option>
          <option value="E-mail">E-mail</option>
          <option value="Reunião">Reunião</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <textarea
        name="descricao"
        required
        rows={2}
        placeholder="O que foi tratado com o cliente..."
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      {error && <p className="text-[12px] text-status-critical">{error}</p>}
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
  );
}
