export type ProviderErrorKind =
  | "invalid_api_key"
  | "permission_denied"
  | "rate_limited"
  | "quota_exceeded"
  | "bad_request"
  | "model_not_found"
  | "provider_unavailable"
  | "timeout"
  | "network"
  | "invalid_output"
  | "refused"
  | "output_truncated"
  | "cancelled";

const RETRYABLE: ReadonlySet<ProviderErrorKind> = new Set([
  "rate_limited",
  "provider_unavailable",
  "timeout",
  "network",
  "invalid_output",
  "output_truncated",
]);

/** Provider-neutral error. Adapters translate their SDK/HTTP errors into this. */
export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly retryable: boolean;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(kind: ProviderErrorKind, message: string, opts: { status?: number; retryAfterMs?: number; cause?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = "ProviderError";
    this.kind = kind;
    this.retryable = RETRYABLE.has(kind);
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

/** Messages shown to customers. They explain what to do, not just what failed. */
export const ERROR_HELP: Record<ProviderErrorKind, string> = {
  invalid_api_key: "The API key was rejected. Check it in Settings, and that it belongs to the selected provider.",
  permission_denied: "The API key does not have access to this model. Pick another model or check your provider account.",
  rate_limited: "The provider rate-limited the request. Wait a moment and retry the failed products, or reduce the batch size.",
  quota_exceeded: "Your provider account has no remaining credit or quota. Add billing on the provider's site, then retry.",
  bad_request: "The provider rejected the request. Check the model name and settings.",
  model_not_found: "The provider does not recognise that model name. Pick another model in Settings.",
  provider_unavailable: "The provider is temporarily unavailable. Retry in a few minutes.",
  timeout: "The provider took too long to respond. Retry, or try a faster model.",
  network: "Could not reach the provider. Check the server's network connection and base URL.",
  invalid_output: "The model returned output that did not match the listing format. Retry this product.",
  refused: "The model declined to write this listing. Review the product data, then retry or edit manually.",
  output_truncated: "The output was cut off before it finished. Retry, or reduce the number of FAQs.",
  cancelled: "Generation was cancelled.",
};

export function parseRetryAfter(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return undefined;
}

export function fromHttpStatus(status: number, message: string, retryAfter?: string | null, body?: string): ProviderError {
  const lower = (body ?? message).toLowerCase();
  if (status === 401) return new ProviderError("invalid_api_key", message, { status });
  if (status === 403) return new ProviderError("permission_denied", message, { status });
  if (status === 404) return new ProviderError("model_not_found", message, { status });
  if (status === 402 || (status === 429 && /(insufficient_quota|quota|billing|credit)/.test(lower))) {
    return new ProviderError("quota_exceeded", message, { status });
  }
  if (status === 429) return new ProviderError("rate_limited", message, { status, retryAfterMs: parseRetryAfter(retryAfter) });
  if (status === 408) return new ProviderError("timeout", message, { status });
  if (status === 400 && /credit balance/.test(lower)) return new ProviderError("quota_exceeded", message, { status });
  if (status >= 500) return new ProviderError("provider_unavailable", message, { status, retryAfterMs: parseRetryAfter(retryAfter) });
  return new ProviderError("bad_request", message, { status });
}
