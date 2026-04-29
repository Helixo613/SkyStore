"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="glass-panel w-full p-10 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-500 to-amber-500 shadow-[0_0_40px_rgba(244,63,94,0.3)]">
         <span className="text-4xl text-white">✨</span>
      </div>
      <h3 className="mb-2 text-3xl font-black tracking-tighter text-white">
        Enter the Vault
      </h3>
      <p className="mb-8 text-sm font-medium text-neutral-400">
        {flow === "signIn"
          ? "Welcome back. Authenticate to continue."
          : "Create an identity to secure your files."}
      </p>
      <form
        className="space-y-6 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((_error) => {
            const toastTitle =
              flow === "signIn"
                ? "Could not sign in, did you mean to sign up?"
                : "Could not sign up, did you mean to sign in?";
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-bold text-neutral-300">
            Email
          </label>
          <input
            className="input-field"
            id="email"
            type="email"
            name="email"
            placeholder="name@company.com"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-bold text-neutral-300">
            Password
          </label>
          <input
            className="input-field"
            id="password"
            type="password"
            name="password"
            placeholder="Enter your password"
            required
          />
        </div>
        <button className="btn-primary w-full py-4 text-base" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Authenticate" : "Create Vault"}
        </button>
        <div className="text-center text-sm font-medium text-neutral-500">
          <span>
            {flow === "signIn"
              ? "Don't have an identity? "
              : "Already have an identity? "}
          </span>
          <button
            type="button"
            className="link-text ml-1"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
      <div className="my-8 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-neutral-600">
        <span className="h-px flex-1 bg-white/10" />
        <span>OR</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <button
        className="btn-secondary w-full py-4 text-base"
        onClick={() => void signIn("anonymous")}
      >
        Access Anonymously
      </button>
    </div>
  );
}
