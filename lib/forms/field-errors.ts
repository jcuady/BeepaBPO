import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

/** Map server-action fieldErrors onto a react-hook-form instance. */
export function applyFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldErrors?: Record<string, string[] | undefined>,
) {
  if (!fieldErrors) return;
  for (const [name, messages] of Object.entries(fieldErrors)) {
    const message = messages?.[0];
    if (!message) continue;
    form.setError(name as Path<T>, { type: "server", message });
  }
}
