"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createCliente } from "./actions";

export type ClienteRow = {
  id: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  processos_count: number;
};

export default function ClientesClient({ clientes }: { clientes: ClienteRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function handleCreate(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      try {
        await createCliente(formData);
      } catch (err) {
        // redirect() lança um erro especial do Next que não é erro de verdade
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
        setFormError(err instanceof Error ? err.message : "Erro ao cadastrar cliente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[15px] font-bold text-foreground">Clientes cadastrados</span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-brand-navy-hover"
          >
            {showForm ? "Cancelar" : "+ Novo cliente"}
          </button>
        </div>

        {showForm && (
          <form action={handleCreate} className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-4">
            <div className="col-span-2">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Nome completo</label>
              <input name="nome_completo" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">CPF/CNPJ</label>
              <input name="cpf_cnpj" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Telefone</label>
              <input name="telefone" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">E-mail</label>
              <input name="email" type="email" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Endereço</label>
              <input name="endereco" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
            </div>
            {formError && (
              <p className="col-span-2 rounded-md bg-status-critical-bg px-3 py-2 text-[13px] text-status-critical">
                {formError}
              </p>
            )}
            <div className="col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
              >
                {isPending ? "Salvando..." : "Cadastrar cliente"}
              </button>
              <p className="mt-2 text-[12px] text-text-muted">
                Processo vinculado e forma de recebimento/parcelamento são cadastrados depois, na página do
                próprio cliente ou em Operacional → Processos.
              </p>
            </div>
          </form>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white p-5">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Nome</th>
              <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Contato</th>
              <th className="pb-3 text-center text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Processos</th>
              <th className="pb-3 text-right text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-text-muted">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
            {clientes.map((c) => (
              <tr key={c.id} className="border-t border-border/60">
                <td className="py-3 font-semibold text-foreground">{c.nome_completo}</td>
                <td className="py-3 text-text-secondary">
                  {c.telefone || c.email ? (
                    <>
                      {c.telefone && <div>{c.telefone}</div>}
                      {c.email && <div className="text-[12px] text-text-muted">{c.email}</div>}
                    </>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="py-3 text-center text-text-secondary">{c.processos_count}</td>
                <td className="py-3 text-right">
                  <Link href={`/clientes/${c.id}`} className="text-[13px] font-semibold text-brand-navy hover:underline">
                    Ver ficha →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
