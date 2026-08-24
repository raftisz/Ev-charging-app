import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create an account · Volt Grid" };

export default function RegisterPage() {
  return <RegisterForm />;
}
