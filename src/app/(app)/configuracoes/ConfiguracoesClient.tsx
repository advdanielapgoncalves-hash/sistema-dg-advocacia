"use client";

import { useState, useTransition } from "react";
import type { Module, UserRole } from "@/lib/auth";
import { createStaffUser, setPermission, setActive } from "./actions";

export type StaffMember = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  active: boolean;
  permissions: Record<Module, boolean>;
};

const MODULE_LABELS: Record<Module, string> = {
  clientes: "Clientes",
  processos: "Andamento Processual",
  prazos: "Prazos",
  tarefas: "Tarefas",
  financeiro: "Financeiro",
  configuracoes: "Configurações",
};

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-[42px] shrink-0 rounded-full transition-colors disabled:opacity-40"
      style={{ background: checked ? "#44596E" : "#D9DCE3" }}
    >
      <span
        className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all"
        style={{ left: checked ? "21px" : "3px" }}
      />
    </button>
  );
}

export default function ConfiguracoesClient({
  staff,
  modules,
}: {
  staff: StaffMember[];
  modules: Module[];
}) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function handleCreate(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      try {
        await createStaffUser(formData);
        setShowForm(false);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Erro ao criar usuário.");
      }
    });
  }

  function handleTogglePermission(profileId: string, module: Module, current: boolean) {
    startTransition(async () => {
      await setPermission(profileId, module, !current);
    });
  }

  function handleToggleActive(profileId: string, current: boolean) {
    startTransition(async () => {
      await setActive(profileId, !current);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[15px] font-bold text-foreground">Equipe</span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-brand-navy-hover"
          >
            {showForm ? "Cancelar" : "+ Novo usuário"}
          </button>
        </div>

        {showForm && (
          <form action={handleCreate} className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-background p-4">
            <div className="col-span-1">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Nome completo</label>
              <input name="full_name" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">E-mail</label>
              <input name="email" type="email" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Papel</label>
              <select name="role" className="w-full rounded-md border border-border px-3 py-2 text-sm">
                <option value="funcionario">Funcionário(a)</option>
                <option value="admin">Administrador(a)</option>
              </select>
            </div>
            <div className="col-span-1">
              <label className="mb-1 block text-[12px] font-semibold text-text-secondary">Senha temporária</label>
              <input name="temp_password" type="text" required minLength={6} className="w-full rounded-md border border-border px-3 py-2 text-sm" />
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
                {isPending ? "Salvando..." : "Criar acesso"}
              </button>
              <p className="mt-2 text-[12px] text-text-muted">
                Combine essa senha temporária com a pessoa por fora — ela poderá trocá-la depois de entrar.
              </p>
            </div>
          </form>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white p-5">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Nome</th>
              <th className="pb-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Papel</th>
              {modules.map((m) => (
                <th key={m} className="pb-3 text-center text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">
                  {MODULE_LABELS[m]}
                </th>
              ))}
              <th className="pb-3 text-center text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-t border-border/60">
                <td className="py-3">
                  <div className="font-semibold text-foreground">{member.full_name}</div>
                  <div className="text-[12px] text-text-muted">{member.email}</div>
                </td>
                <td className="py-3 text-text-secondary">
                  {member.role === "admin" ? "Administrador(a)" : "Funcionário(a)"}
                </td>
                {modules.map((m) => (
                  <td key={m} className="py-3 text-center">
                    <div className="flex justify-center">
                      <Toggle
                        checked={member.permissions[m]}
                        disabled={member.role === "admin" || isPending}
                        onChange={() => handleTogglePermission(member.id, m, member.permissions[m])}
                      />
                    </div>
                  </td>
                ))}
                <td className="py-3 text-center">
                  <div className="flex justify-center">
                    <Toggle
                      checked={member.active}
                      disabled={isPending}
                      onChange={() => handleToggleActive(member.id, member.active)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[12px] text-text-muted">
          Administrador(a) sempre tem acesso completo. Para funcionários, desligue o módulo que ele não deve ver —
          a restrição vale mesmo que a pessoa tente acessar a página diretamente pelo link.
        </p>
      </div>
    </div>
  );
}
