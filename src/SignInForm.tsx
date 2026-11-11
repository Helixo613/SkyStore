"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const isSignIn = flow === "signIn";

  return (
    <div className="mx-auto w-full max-w-sm pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isSignIn ? "Sign in to SkyStore" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Your files, stored privately and available from any browser.
      </p>

      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch(() => {
            toast.error(
              isSignIn
                ? "Email or password is incorrect. New here? Create an account instead."
                : "Couldn't create the account. If you already have one, sign in instead.",
            );
            setSubmitting(false);
          });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input className="input-field" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input
            className="input-field"
            type="password"
            name="password"
            autoComplete={isSignIn ? "current-password" : "new-password"}
            minLength={8}
            required
          />
          {!isSignIn && <span className="text-xs font-normal text-muted">At least 8 characters.</span>}
        </label>
        <button className="btn-primary mt-2 py-2.5" type="submit" disabled={submitting}>
          {submitting ? "Please wait…" : isSignIn ? "Sign in" : "Create account"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2 border-t border-line pt-6 text-sm text-muted">
        <p>
          {isSignIn ? "No account yet? " : "Already have an account? "}
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={() => setFlow(isSignIn ? "signUp" : "signIn")}
          >
            {isSignIn ? "Create one" : "Sign in"}
          </button>
        </p>
        <p>
          Just looking?{" "}
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={() => void signIn("anonymous")}
          >
            Continue without an account
          </button>
        </p>
      </div>
    </div>
  );
}
