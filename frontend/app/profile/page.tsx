import { redirect } from "next/navigation";

/** Legacy route — settings live at `/settings`. */
export default function ProfileRedirectPage() {
  redirect("/settings");
}
