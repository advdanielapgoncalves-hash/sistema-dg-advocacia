import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentProfile } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";

export default async function PortalPage() {
  const session = await getCurrentProfile();

  if (!session) {
    redirect("/login");
  }

  if (session.profile.role !== "cliente") {
    redirect("/painel");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-white px-8 py-4">
        <div className="flex items-center gap-3">
          <Image src="/logo-mark.png" alt="Daniela Gonçalves" width={32} height={31} className="h-8 w-auto" />
          <span className="text-sm font-bold text-foreground">Portal do Cliente</span>
        </div>
        <SignOutButton />
      </header>

      <main className="mx-auto max-w-2xl px-8 py-10">
        <h1 className="text-[20px] font-bold text-foreground">
          Olá, {session.profile.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Acompanhe aqui o andamento do seu processo.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-white p-6 text-sm text-text-secondary">
          Portal em construção (Fase 6 do plano) — em breve aqui aparece a linha do tempo do andamento
          processual vinculado a você, sem acesso a nenhuma outra informação do escritório.
        </div>
      </main>
    </div>
  );
}
