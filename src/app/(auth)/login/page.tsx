import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · Volt Grid" };

export default function LoginPage() {
  return <LoginForm />;
}
