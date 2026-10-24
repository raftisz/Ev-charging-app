import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.meta.page(m.auth.signInTitle) };
}

export default function LoginPage() {
  return <LoginForm />;
}
