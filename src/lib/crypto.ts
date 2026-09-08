import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";

// Criptografia simétrica (AES-256-GCM) pra guardar credenciais sensíveis
// (por enquanto: login do e-SAJ pra consulta de processos em segredo de
// justiça). A chave NUNCA fica no banco — só na variável de ambiente
// CREDENTIALS_ENCRYPTION_KEY. Mesmo que o banco inteiro vaze, sem essa chave
// (que só existe no ambiente do servidor, nunca no client) o conteúdo
// continua ilegível.
//
// Isso é mais forte do que confiar só na Row Level Security do Postgres: RLS
// controla quem pode consultar a linha, mas não criptografa o dado — quem
// tiver acesso direto ao banco (ex: a própria Daniela pelo painel do
// Supabase, ou um vazamento da service_role key) veria o texto puro se não
// fosse isso.

function getKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY não configurada. Gere uma com `openssl rand -base64 32` e coloque no .env.local / nas variáveis de ambiente da Vercel."
    );
  }
  // aceita a chave em base64 (32 bytes) OU deriva de uma string qualquer via scrypt,
  // pra não quebrar se alguém colocar uma senha simples em vez de gerar com openssl.
  try {
    const buf = Buffer.from(secret, "base64");
    if (buf.length === 32) return buf;
  } catch {
    // ignora e cai no fallback abaixo
  }
  return scryptSync(secret, "dg-sistema-credenciais-tribunal", 32);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const key = getKey();
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
