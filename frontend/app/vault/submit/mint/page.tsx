import { redirect } from "next/navigation";

/** Legacy alias — real mint lives at `/vault/submit`. */
export default function VaultSubmitMintPage() {
  redirect("/vault/submit");
}
