import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { RegisterForm } from "./RegisterForm";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.meta.page(m.auth.registerTitle) };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
