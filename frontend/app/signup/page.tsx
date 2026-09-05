import { redirect } from "next/navigation";

/** Legacy alias — Privy entry is `/login`. */
export default function SignupRedirectPage() {
  redirect("/login");
}
