/** How a failed AI request is shown: i18n keys for title and hint, and whether asking again can help. */
export interface AiError {
  icon: string;
  title: string;
  hint: string | null;
  retry: boolean;
}

/**
 * Maps an HttpErrorResponse of the AI endpoints to what the user sees. The
 * server's `code` decides first, then the status. `failedKey` is the title for
 * "it did not work" and `nothingKey` the one for "nothing to analyse".
 */
export function aiError(err: unknown, failedKey: string, nothingKey: string): AiError {
  const e = err as { status?: number; error?: { code?: string } } | null;
  const status = e?.status;
  const code = e?.error?.code;

  if (code === 'analysis_not_configured') {
    return { icon: 'sparkles', title: 'analysis.err.notConfigured', hint: 'analysis.err.notConfigured.hint', retry: false };
  }
  if (code === 'analysis_busy' || (!code && status === 503)) {
    return { icon: 'timer', title: 'analysis.err.busy', hint: 'analysis.err.busy.hint', retry: true };
  }
  if (code === 'analysis_forbidden' || status === 403) {
    return { icon: 'sparkles', title: 'analysis.err.forbidden', hint: 'analysis.err.forbidden.hint', retry: false };
  }
  if (code === 'nothing_to_analyse' || status === 422) {
    return { icon: 'dumbbell', title: nothingKey, hint: null, retry: false };
  }
  if (status === 429) {
    return { icon: 'timer', title: 'analysis.err.limit', hint: 'analysis.err.limit.hint', retry: false };
  }
  if (status === 0) {
    return { icon: 'search-x', title: failedKey, hint: 'toast.offline', retry: true };
  }
  return { icon: 'search-x', title: failedKey, hint: 'analysis.err.failed.hint', retry: true };
}
