"use client";

import { useState, useTransition } from "react";
import { saveCredencial, deleteCredencial } from "./actions";

export type CredencialRow = {
  tribunal_sistema: string;
  identificador: string;
  updated_at: string;
};

const TRIBUNAL_LABEL: Record<string, string> = {
  esaj: "e-SAJ (TJSP, TJSC e outros)",
  pje: "PJe",
  eproc: "Eproc",
  projudi: "Projudi",
};

export default function TribunalClient({ credenciais }: { credenciais: CredencialRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byTribunal = new Map(credenciais.map((c) => [c.tribunal_sistema, c]));

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await saveCredencial(formData);
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-status-warning/40 bg-status-warning-bg p-4 text-[13px] text-status-warning">
        Isso guarda o SEU login do portal do tribunal (cifrado, ninguém — nem a Daniela — consegue ler a senha de
        volta pela tela). Use só se você entende que está confiando esse acesso ao sistema. A sincronização
        automática ainda não está ligada — por enquanto isso só prepara o cadastro pra quando estiver.
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold text-foreground">Minhas credenciais de tribunal</span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-navy-hover"
          >
            {showForm ? "Cancelar" : "+ Cadastrar credencial"}
          </button>
        </div>

        {showForm && (
          <form action={handleSave} className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-4">
            <div className="col-span-1">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Tribunal</label>
              <select name="tribunal_sistema" required className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
                <option value="esaj">e-SAJ (TJSP, TJSC e outros)</option>
                <option value="pje">PJe</option>
                <option value="eproc">Eproc</option>
                <option value="projudi">Projudi</option>
              </select>
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">CPF/CNPJ ou usuário</label>
              <input name="identificador" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Senha</label>
              <input name="senha" type="password" required autoComplete="new-password" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
            </div>
            {error && (
              <p className="col-span-2 rounded-md bg-status-critical-bg px-3 py-2 text-[13px] text-status-critical">{error}</p>
            )}
            <div className="col-span-2">
              <button type="submit" disabled={isPending} className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                {isPending ? "Salvando..." : "Salvar (cifrada)"}
              </button>
            </div>
          </form>
        )}

        <ul className="flex flex-col divide-y divide-border/60">
          {credenciais.length === 0 && (
            <li className="py-4 text-sm text-text-muted">Nenhuma credencial cadastrada ainda.</li>
          )}
          {credenciais.map((c) => (
            <li key={c.tribunal_sistema} className="flex items-center justify-between py-3 text-sm">
              <div>
                <div className="font-semibold text-foreground">{TRIBUNAL_LABEL[c.tribunal_sistema] ?? c.tribunal_sistema}</div>
                <div className="text-[12px] text-text-muted">
                  Login: {c.identificador} · atualizado em{" "}
                  {new Date(c.updated_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <button
                disabled={isPending}
                onClick={() => startTransition(() => deleteCredencial(c.tribunal_sistema))}
                className="text-[12px] text-text-muted hover:text-status-critical disabled:opacity-50"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      </div>

      {byTribunal.has("esaj") && (
        <p className="text-[12px] text-text-muted">
          Credencial do e-SAJ cadastrada. Falta ligar a sincronização automática — ver pendência no README.
        </p>
      )}
    </div>
  );
}
