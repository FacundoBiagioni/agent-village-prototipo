import { redirect } from "next/navigation";

// PROTOTIPO: no hay login, se entra directo al panel.
export default function LoginPage() {
  redirect("/");
}
