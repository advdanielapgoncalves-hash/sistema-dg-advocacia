import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a chave service_role — só pode ser usado em código
 * de servidor (Server Actions, Route Handlers), NUNCA importado por um
 * Client Component. Serve pra ações administrativas que a API pública não
 * permite, como criar o login de um funcionário sem passar pelo fluxo de
 * autoconfirmação de e-mail.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
