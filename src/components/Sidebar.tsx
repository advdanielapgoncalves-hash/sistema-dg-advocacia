"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Module, Profile } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";

type NavItem = {
  href: string;
  label: string;
  module: Module | "painel" | "operacional" | "tribunal";
  icon: React.ReactNode;
};

const ICONS = {
  painel: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7" /><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" /></svg>
  ),
  clientes: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
  ),
  processos: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18" /><path d="M5 7h14" /><path d="M5 7l-3 6a3 3 0 0 0 6 0z" /><path d="M19 7l-3 6a3 3 0 0 0 6 0z" /><path d="M9 21h6" /></svg>
  ),
  prazos: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
  ),
  financeiro: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.2" /><path d="M3 10.2h18" /><circle cx="16" cy="14.4" r="1.1" fill="currentColor" stroke="none" /></svg>
  ),
  tarefas: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l2 2 4-4" /><rect x="3" y="4" width="18" height="16" rx="2.2" /></svg>
  ),
  configuracoes: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
  ),
  relatorios: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h13l3 3v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M8 12h8M8 16h8M8 8h4" /></svg>
  ),
};

const ALL_ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", module: "painel", icon: ICONS.painel },
  { href: "/clientes", label: "Clientes", module: "clientes", icon: ICONS.clientes },
  { href: "/operacional", label: "Operacional", module: "operacional", icon: ICONS.processos },
  { href: "/relatorios", label: "Relatórios", module: "clientes", icon: ICONS.relatorios },
  { href: "/financeiro", label: "Financeiro", module: "financeiro", icon: ICONS.financeiro },
  { href: "/tribunal", label: "Credenciais de Tribunal", module: "tribunal", icon: ICONS.configuracoes },
  { href: "/configuracoes", label: "Configurações", module: "configuracoes", icon: ICONS.configuracoes },
];

export default function Sidebar({
  profile,
  permissions,
}: {
  profile: Profile;
  permissions: Record<Module, boolean>;
}) {
  const activePath = usePathname();
  // "Operacional" junta Processos/Prazos/Tarefas — aparece se a pessoa tiver
  // qualquer uma dessas permissões (a própria tela esconde as abas que não
  // se aplicam); Tarefas fica sempre visível dentro dela porque todo mundo
  // vê pelo menos as próprias tarefas.
  const items = ALL_ITEMS.filter((item) => {
    if (item.module === "painel") return true;
    if (item.module === "operacional") {
      return permissions.processos || permissions.prazos || permissions.tarefas;
    }
    // "Credenciais de Tribunal" é pessoal (cada um cadastra a própria), não
    // um módulo com permissão — só não aparece pro papel cliente (já
    // filtrado antes desta função rodar, mas reforça aqui).
    if (item.module === "tribunal") {
      return profile.role !== "cliente";
    }
    return permissions[item.module];
  });

  return (
    <aside className="flex h-screen w-[236px] shrink-0 flex-col bg-brand-navy px-[18px] py-7">
      <div className="mb-8 flex flex-col items-center px-1 text-center">
        <Image src="/logo-mark.png" alt="Daniela Gonçalves" width={56} height={54} className="mb-2.5 h-auto w-14" />
        <span className="text-[13px] font-semibold tracking-[0.06em] text-white">
          DANIELA GONÇALVES
        </span>
        <div
          className="my-2 h-0.5 w-[26px]"
          style={{ background: "linear-gradient(90deg, var(--brand-gold-light), var(--brand-gold-dark))" }}
        />
        <span className="text-[8.5px] tracking-[0.09em] text-white/60">
          ADVOCACIA &amp; CONSULTORIA JURÍDICA
        </span>
      </div>

      <nav className="flex flex-col gap-[3px]">
        {items.map((item) => {
          const isActive = activePath.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3.5 py-[11px] text-sm font-medium transition-colors ${
                isActive ? "bg-white/[0.14] text-white" : "text-white/60 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/[0.14] pt-4">
        <div className="flex items-center gap-2.5 rounded-md p-1.5">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white/[0.16] text-[12.5px] font-bold text-white">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-semibold text-white">
              {profile.full_name}
            </span>
            <span className="text-[11px] text-white/50">
              {profile.role === "admin" ? "Administradora" : "Funcionário(a)"}
            </span>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
