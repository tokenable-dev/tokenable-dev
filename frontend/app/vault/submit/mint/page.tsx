import { redirect } from "next/navigation";

/** Legacy alias — mint lives at `/vault/submit`. */
export default function VaultSubmitMintRedirectPage() {
  redirect("/vault/submit");
}
