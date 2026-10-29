"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Field, Input, Textarea } from "@/components/ui";
import type { GeneratedListing } from "@/lib/prompts/output-schema";
import type { MarketplaceConstraints } from "@/lib/export/types";
import { splitList } from "@/lib/generation/options";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  shortDescription: z.string().trim(),
  longDescription: z.string().trim(),
  bullets: z.array(z.object({ value: z.string().trim() })),
  faqs: z.array(z.object({ question: z.string().trim().min(1, "Question required"), answer: z.string().trim().min(1, "Answer required") })),
  metaTitle: z.string().trim(),
  metaDescription: z.string().trim(),
  keywords: z.string(),
  urlSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$|^$/, "Lower-case letters, numbers and hyphens only"),
  missingInformation: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

function toForm(l: GeneratedListing): FormValues {
  return {
    title: l.title,
    shortDescription: l.shortDescription,
    longDescription: l.longDescription,
    bullets: l.bullets.map((value) => ({ value })),
    faqs: l.faqs,
    metaTitle: l.seo.metaTitle,
    metaDescription: l.seo.metaDescription,
    keywords: l.seo.keywords.join(", "),
    urlSlug: l.seo.urlSlug,
    missingInformation: l.missingInformation.join("\n"),
  };
}

function fromForm(v: FormValues): GeneratedListing {
  return {
    title: v.title,
    shortDescription: v.shortDescription,
    longDescription: v.longDescription,
    bullets: v.bullets.map((b) => b.value).filter(Boolean),
    faqs: v.faqs,
    seo: { metaTitle: v.metaTitle, metaDescription: v.metaDescription, keywords: splitList(v.keywords), urlSlug: v.urlSlug },
    missingInformation: v.missingInformation.split("\n").map((s) => s.trim()).filter(Boolean),
  };
}

function Counter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={over ? "font-medium text-red-600" : "text-slate-500"}>
      {value.length}/{max}
    </span>
  );
}

export function ListingEditor({
  listing,
  constraints,
  onSave,
}: {
  listing: GeneratedListing;
  constraints: MarketplaceConstraints;
  onSave: (l: GeneratedListing) => void;
}) {
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: toForm(listing) });
  const { register, control, handleSubmit, watch, formState } = form;
  const bullets = useFieldArray({ control, name: "bullets" });
  const faqs = useFieldArray({ control, name: "faqs" });
  const v = watch();

  return (
    <form
      onSubmit={handleSubmit((data) => {
        onSave(fromForm(data));
        form.reset(data);
      })}
      className="space-y-4"
      noValidate
    >
      <Field label="Title" htmlFor="l-title" error={formState.errors.title?.message} hint={<Counter value={v.title ?? ""} max={constraints.titleMaxLength} />}>
        <Input id="l-title" {...register("title")} />
      </Field>
      <Field label="Short description" htmlFor="l-short" hint={<Counter value={v.shortDescription ?? ""} max={constraints.shortDescriptionMaxLength} />}>
        <Textarea id="l-short" rows={2} {...register("shortDescription")} />
      </Field>
      <Field label="Long description" htmlFor="l-long" hint={<Counter value={v.longDescription ?? ""} max={constraints.longDescriptionMaxLength} />}>
        <Textarea id="l-long" rows={7} {...register("longDescription")} />
      </Field>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            Feature bullets ({bullets.fields.length}/{constraints.bulletCount})
          </span>
          <Button size="sm" variant="ghost" onClick={() => bullets.append({ value: "" })}>
            Add bullet
          </Button>
        </div>
        <ol className="space-y-2">
          {bullets.fields.map((f, i) => (
            <li key={f.id} className="flex gap-2">
              <Textarea rows={2} aria-label={`Bullet ${i + 1}`} {...register(`bullets.${i}.value`)} />
              <div className="flex flex-col items-end gap-1 text-xs">
                <Counter value={v.bullets?.[i]?.value ?? ""} max={constraints.bulletMaxLength} />
                <button type="button" className="text-red-600 hover:underline" onClick={() => bullets.remove(i)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">FAQs ({faqs.fields.length})</span>
          <Button size="sm" variant="ghost" onClick={() => faqs.append({ question: "", answer: "" })}>
            Add FAQ
          </Button>
        </div>
        <div className="space-y-3">
          {faqs.fields.map((f, i) => (
            <div key={f.id} className="space-y-1 rounded-md border border-slate-200 p-2">
              <Input aria-label={`FAQ ${i + 1} question`} placeholder="Question" invalid={Boolean(formState.errors.faqs?.[i]?.question)} {...register(`faqs.${i}.question`)} />
              <Textarea aria-label={`FAQ ${i + 1} answer`} rows={2} placeholder="Answer" invalid={Boolean(formState.errors.faqs?.[i]?.answer)} {...register(`faqs.${i}.answer`)} />
              <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => faqs.remove(i)}>
                Remove FAQ
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Meta title" htmlFor="l-mt" hint={<Counter value={v.metaTitle ?? ""} max={constraints.metaTitleMaxLength} />}>
          <Input id="l-mt" {...register("metaTitle")} />
        </Field>
        <Field label="URL slug" htmlFor="l-slug" error={formState.errors.urlSlug?.message}>
          <Input id="l-slug" {...register("urlSlug")} />
        </Field>
        <Field label="Meta description" htmlFor="l-md" className="sm:col-span-2" hint={<Counter value={v.metaDescription ?? ""} max={constraints.metaDescriptionMaxLength} />}>
          <Textarea id="l-md" rows={2} {...register("metaDescription")} />
        </Field>
        <Field label="SEO keywords / tags" htmlFor="l-kw" className="sm:col-span-2" hint={`Comma separated. Up to ${constraints.keywordLimit}${constraints.keywordMaxLength ? `, ${constraints.keywordMaxLength} characters each` : ""}.`}>
          <Textarea id="l-kw" rows={2} {...register("keywords")} />
        </Field>
        <Field label="Missing information (notes)" htmlFor="l-miss" className="sm:col-span-2" hint="One per line. Exported in the generic format.">
          <Textarea id="l-miss" rows={2} {...register("missingInformation")} />
        </Field>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white py-3">
        <Button variant="ghost" disabled={!formState.isDirty} onClick={() => form.reset(toForm(listing))}>
          Discard changes
        </Button>
        <Button type="submit" disabled={!formState.isDirty}>
          Save edits
        </Button>
      </div>
    </form>
  );
}
