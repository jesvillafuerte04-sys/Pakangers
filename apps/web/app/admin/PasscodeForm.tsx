"use client";

import { useActionState } from "react";
import { unlockOrganizer, type UnlockState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: UnlockState = {};

export function PasscodeForm() {
  const [state, formAction, pending] = useActionState(unlockOrganizer, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-[var(--surface-card)] p-8 shadow-[var(--shadow-lg)]">
      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase text-[var(--color-navy)]">
          Organizer Console
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          One shared passcode, across every tournament. Your name is attached to every score you record.
        </p>
      </div>

      <Input
        label="Your name"
        name="name"
        type="text"
        autoComplete="name"
        required
        placeholder="Jes"
      />

      <Input
        label="Passcode"
        name="passcode"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        required
        placeholder="••••"
      />

      {state.error && (
        <p className="rounded-lg border border-[var(--color-error)] bg-red-50 px-3 py-2 text-sm text-[var(--color-error)]">
          {state.error}
        </p>
      )}

      <Button type="submit" fullWidth size="lg" disabled={pending}>
        {pending ? "Checking…" : "Unlock"}
      </Button>
    </form>
  );
}
