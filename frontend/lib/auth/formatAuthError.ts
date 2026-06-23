/** Short, UI-friendly auth API errors. */
export function formatAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("changing your password") || m.includes("before changing")) {
    return "Verify your email before changing your password.";
  }
  if (m.includes("not verified") || m.includes("verify your email")) {
    return "Please verify your email before signing in.";
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
  if (m.includes("password is incorrect") || m.includes("current password")) {
    return "Password is incorrect.";
  }
  if (m.includes("must be different")) {
    return "Choose a different password.";
  }
  if (m.includes("reset link") || m.includes("invalid or expired")) {
    return "Link expired. Request a new reset email.";
  }
  if (message.length > 72) {
    return "Something went wrong.";
  }
  return message;
}
