"use server";

import { headers } from "next/headers";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function requestMagicLink(email: string): Promise<Result> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Введите корректный email." };
  }

  // Whitelist-проверка через service-role клиент (обходит RLS).
  const admin = createSupabaseAdminClient();
  const { data, error: lookupError } = await admin
    .from("allowed_users")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();

  if (lookupError) {
    console.error("[requestMagicLink] whitelist lookup failed", lookupError);
    return { ok: false, error: "Сервис недоступен. Попробуйте позже." };
  }

  if (!data) {
    return {
      ok: false,
      error: "Этот email не в списке доступа.",
    };
  }

  // Отправка magic-link через обычный (anon) клиент.
  const supabase = await createSupabaseServerClient();
  const headerStore = await headers();
  const origin =
    headerStore.get("origin") ?? headerStore.get("host")
      ? `https://${headerStore.get("host")}`
      : "";

  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    console.error("[requestMagicLink] signInWithOtp failed", error);
    return { ok: false, error: "Не удалось отправить письмо. Попробуйте позже." };
  }

  return { ok: true };
}
