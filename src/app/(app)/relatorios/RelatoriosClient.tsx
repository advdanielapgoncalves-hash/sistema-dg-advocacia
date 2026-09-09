"use client";

import { useState, useTransition } from "react";
import { salvarConteudoAdicional, enviarRelatorio, gerarRelatoriosAgora } from "./actions";

export type RelatorioRow = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_email: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  status: "rascunho" | "enviado";
  conteudo_gerado: string;
  conteudo_adicional: string | null;
  enviado_em: string | null;
};

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

export default function RelatoriosClient({ relatorios }: { relatorios: RelatorioRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [resumoGeracao, setResumoGeracao] = useState<string | null>(null);

  function handleGerar() {
    setError(null);
    setResumoGeracao(null);
    setGerando(true);
    startTransition(async () => {
      try {
        const r = await gerarRelatoriosAgora();
        setResumoGeracao(
          `Período ${fmtDate(r.periodo.inicio)} a ${fmtDate(r.periodo.fim)}: ${r.relatoriosCriados} rascunho(s) gerado(s)/atualizado(s) (${r.relatoriosSemNovidade} sem novidade). ${
            r.erros.length > 0 ? `${r.erros.length} erro(s) — veja com a equipe técnica.` : ""
          }`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao gerar relatórios.");
      } finally {
        setGerando(false);
      }
    });
  }

  function handleSalvar(id: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await salvarConteudoAdicional(id, formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    });
  }

  function handleEnviar(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await enviarRelatorio(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar.");
      }
    });
  }

  const rascunhos = relatorios.filter((r) => r.status === "rascunho");
  const enviados = relatorios.filter((r) => r.status === "enviado");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-white p-5">
        <div>
          <span className="text-[15px] font-bold text-foreground">Gerar rascunhos do período atual</span>
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            Isso roda sozinho todo dia 1 e dia 15, mas você pode disparar manualmente pra testar ou atualizar agora.
          </p>
        </div>
        <button
          onClick={handleGerar}
          disabled={gerando || isPending}
          className="shrink-0 rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {gerando ? "Gerando..." : "Gerar agora"}
        </button>
      </div>

      {resumoGeracao && (
        <p className="rounded-md bg-status-good-bg px-3 py-2 text-[13px] text-status-good">{resumoGeracao}</p>
      )}
      {error && <p className="rounded-md bg-status-critical-bg px-3 py-2 text-[13px] text-status-critical">{error}</p>}

      <div className="rounded-xl border border-border bg-white p-5">
        <span className="text-[15px] font-bold text-foreground">Rascunhos pendentes de revisão</span>
        <div className="mt-3 flex flex-col gap-4">
          {rascunhos.length === 0 && <p className="text-sm text-text-muted">Nenhum rascunho pendente.</p>}
          {rascunhos.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-foreground">{r.cliente_nome}</div>
                  <div className="text-[12px] text-text-muted">
                    Período {fmtDate(r.periodo_inicio)} a {fmtDate(r.periodo_fim)}
                    {!r.cliente_email && (
                      <span className="ml-2 font-semibold text-status-critical">— cliente sem e-mail cadastrado</span>
                    )}
                  </div>
                </div>
                <button
                  disabled={isPending || !r.cliente_email}
                  onClick={() => handleEnviar(r.id)}
                  className="shrink-0 rounded-md bg-brand-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
                >
                  {isPending ? "..." : "Enviar por e-mail"}
                </button>
              </div>

              <div className="mb-3 whitespace-pre-line rounded-md bg-background p-3 text-[13px] text-text-secondary">
                {r.conteudo_gerado}
              </div>

              <form action={(fd) => handleSalvar(r.id, fd)} className="flex flex-col gap-2">
                <label className="text-[12px] font-semibold text-text-secondary">
                  Conteúdo adicional (opcional) — ex: tratativas internas ou observações que você queira incluir
                  no e-mail
                </label>
                <textarea
                  name="conteudo_adicional"
                  rows={3}
                  defaultValue={r.conteudo_adicional ?? ""}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm"
                />
                <div>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md border border-border px-3 py-1.5 text-[12.5px] font-semibold text-brand-navy hover:bg-background disabled:opacity-60"
                  >
                    Salvar observação
                  </button>
                </div>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <span className="text-[15px] font-bold text-foreground">Já enviados</span>
        <div className="mt-3 flex flex-col divide-y divide-border/60">
          {enviados.length === 0 && <p className="py-3 text-sm text-text-muted">Nenhum relatório enviado ainda.</p>}
          {enviados.map((r) => (
            <div key={r.id} className="py-2.5 text-sm">
              <div className="font-semibold text-foreground">{r.cliente_nome}</div>
              <div className="text-[12px] text-text-muted">
                Período {fmtDate(r.periodo_inicio)} a {fmtDate(r.periodo_fim)}
                {r.enviado_em && ` · enviado em ${fmtDate(r.enviado_em.slice(0, 10))}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
