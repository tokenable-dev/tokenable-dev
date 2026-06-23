/** Short, UI-friendly auth API errors. */
export function formatAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("not verified") || m.includes("verify your email")) {
    return "Verify your email first.";
  }
  if (m.includes("google sign-in") || m.includes("sign in with google")) {
    return "Use Google for this account.";
  }
  if (m.includes("invalid email or password")) {
    return "Wrong email or password.";
  }
  if (m.includes("already exists")) {
    return "Account exists — sign in.";
  }
  if (m.includes("please wait")) {
    return message;
  }
  if (message.length > 72) {
    return "Something went wrong.";
  }
  return message;
}
