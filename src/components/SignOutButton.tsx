"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="mt-2 w-full rounded-md px-1.5 py-1.5 text-left text-[11px] text-white/50 transition-colors hover:text-white"
    >
      Sair da conta
    </button>
  );
}
