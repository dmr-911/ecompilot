"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { PRODUCT_FIELDS, type ProductFields } from "@/lib/products/fields";
import { emptyFormValues, productFieldsSchema } from "@/lib/products/schema";
import type { z } from "zod";

const LONG_FIELDS = new Set(["specifications", "description", "features", "materials"]);

export function ProductEditor({
  initial,
  onSave,
  onCancel,
  submitLabel = "Save product",
}: {
  initial: ProductFields;
  onSave: (fields: ProductFields) => void;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const form = useForm<z.input<typeof productFieldsSchema>, unknown, z.output<typeof productFieldsSchema>>({
    resolver: zodResolver(productFieldsSchema),
    defaultValues: { ...emptyFormValues(), ...initial },
    mode: "onBlur",
  });
  const { register, handleSubmit, formState } = form;

  return (
    <form
      onSubmit={handleSubmit((data) => {
        const out: ProductFields = {};
        for (const [k, v] of Object.entries(data)) if (v !== undefined && v !== "") out[k as keyof ProductFields] = String(v);
        onSave(out);
      })}
      className="space-y-4"
      noValidate
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PRODUCT_FIELDS.map((f) => {
          const err = formState.errors[f.key]?.message;
          const id = `pf-${f.key}`;
          const long = LONG_FIELDS.has(f.key);
          return (
            <Field key={f.key} label={f.label + (f.required ? " *" : "")} htmlFor={id} error={err ? String(err) : undefined} hint={f.help} className={long ? "sm:col-span-2" : undefined}>
              {long ? <Textarea id={id} rows={3} invalid={Boolean(err)} {...register(f.key)} /> : <Input id={id} invalid={Boolean(err)} {...register(f.key)} />}
            </Field>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
