"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError("E-mail ou senha incorretos.");
      return;
    }

    router.push("/painel");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center rounded-2xl bg-brand-navy px-8 py-8 text-center">
          <Image src="/logo-mark.png" alt="Daniela Gonçalves" width={64} height={62} className="mb-3 h-auto w-16" />
          <span className="text-[15px] font-semibold tracking-[0.06em] text-white">
            DANIELA GONÇALVES
          </span>
          <div
            className="my-2.5 h-0.5 w-7"
            style={{ background: "linear-gradient(90deg, var(--brand-gold-light), var(--brand-gold-dark))" }}
          />
          <span className="text-[9px] tracking-[0.09em] text-white/60">
            ADVOCACIA &amp; CONSULTORIA JURÍDICA
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-white p-7"
        >
          <h1 className="mb-1 text-lg font-bold text-foreground">Entrar</h1>
          <p className="mb-5 text-sm text-text-secondary">
            Acesse com o e-mail e senha cadastrados pelo escritório.
          </p>

          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
            E-mail
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
            placeholder="voce@escritorio.com.br"
          />

          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-secondary">
            Senha
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-5 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
            placeholder="••••••••"
          />

          {error && (
            <p className="mb-4 rounded-lg bg-status-critical-bg px-3 py-2 text-[13px] font-medium text-status-critical">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-navy py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-navy-hover disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-5 text-center text-[12px] text-text-muted">
          É cliente do escritório e recebeu um acesso? Use o link de portal enviado a você.
        </p>
      </div>
    </div>
  );
}
