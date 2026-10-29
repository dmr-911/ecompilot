import Link from "next/link";
import { WorkflowDemo } from "@/components/landing/workflow-demo";

const FEATURES = [
  { title: "Import any CSV", body: "Comma, semicolon or tab separated. Map your columns once, get row-level errors, duplicate detection and a preview before anything is processed." },
  { title: "Facts stay facts", body: "Prompts forbid invented certifications, warranties, ingredients and performance claims. Every output is checked for unsupported claims and changed numbers." },
  { title: "Your rules", body: "Prohibited phrases and required keywords per job. Tone, style, language and marketplace limits are applied to every product." },
  { title: "Review before export", body: "Original data and generated copy side by side. Edit anything, approve what's ready, retry what failed." },
  { title: "Marketplace exports", body: "Amazon, Shopify, Etsy, eBay, WooCommerce and a generic all-fields CSV. Each profile is a small adapter you can extend." },
  { title: "Bring your own key", body: "Use your Anthropic or OpenAI-compatible key. It's stored encrypted on the server and never exposed to the browser. You see a usage estimate before large jobs." },
];

const STEPS = ["Import CSV", "Map columns", "Validate", "Select products", "Choose style", "Generate", "Review & edit", "Export CSV"];

export default function LandingPage() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="text-lg font-semibold">
          ListingPilot <span className="text-indigo-600">AI</span>
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#how" className="hidden text-slate-600 hover:text-slate-900 sm:inline">
            How it works
          </a>
          <a href="#pricing" className="hidden text-slate-600 hover:text-slate-900 sm:inline">
            Pricing
          </a>
          <Link href="/app" className="rounded-md bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-500">
            Open app
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-indigo-600">For online sellers, marketplaces and catalogue agencies</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Turn a messy product spreadsheet into publish-ready listings.</h1>
          <p className="mt-5 text-lg text-slate-600">
            ListingPilot writes titles, descriptions, feature bullets, FAQs and SEO metadata for hundreds of products at once, using only the facts in your data, and flags anything that needs a human look.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app?demo=1" className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500">
              Try the demo with sample products
            </Link>
            <a href="/templates/sample-products.csv" download className="rounded-md px-4 py-2.5 text-sm font-medium text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
              Download sample CSV
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-500">The demo uses a free template generator, so no API key or payment is needed to try the workflow.</p>
        </div>
      </section>

      <section id="how" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-slate-900">How it works</h2>
          <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <span className="text-xs font-medium text-indigo-600">Step {i + 1}</span>
                <p className="mt-1 text-sm font-medium text-slate-900">{s}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <WorkflowDemo />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold text-slate-900">Built for accuracy at catalogue scale</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg p-5 ring-1 ring-slate-200">
              <h3 className="font-medium text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-slate-900">What it costs</h2>
          <p className="mt-3 max-w-3xl text-slate-600">
            ListingPilot runs on your own AI provider account. Your provider charges you for each request at its published rates; ListingPilot shows an estimate before large jobs so there are no surprises. The demo generator is free because it does not call an AI model.
          </p>
          <div className="mt-8">
            <Link href="/app" className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500">
              Open the app
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-500 sm:px-6">
        ListingPilot AI. Generated content must be reviewed before publishing. Marketplace names are trademarks of their owners; export profiles are not affiliated with or endorsed by them.
      </footer>
    </div>
  );
}
