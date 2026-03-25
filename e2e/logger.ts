const PREFIX = "[ayncor-e2e]";

const verbose = (): boolean =>
  Boolean(process.env.E2E_VERBOSE && process.env.E2E_VERBOSE !== "0" && process.env.E2E_VERBOSE !== "false");

const debugEnabled = (): boolean =>
  Boolean(process.env.DEBUG) || verbose();

function formatMessage(level: string, msg: string, err?: unknown): string {
  const base = `${PREFIX} ${level} ${msg}`;
  if (err === undefined) return base;
  if (err instanceof Error) return `${base} ${err.message} ${err.stack ?? ""}`.trim();
  return `${base} ${String(err)}`;
}

/**
 * Jest E2E harness logger — prefixed, opt-in verbosity.
 *
 * - `error` / `warn` / `info`: always printed (keep info rare in tests).
 * - `debug`: when DEBUG or E2E_VERBOSE is set.
 * - `phase`: test-step breadcrumbs only when E2E_VERBOSE=1 (keeps default CI output clean).
 */
export const logger = {
  error(msg: string, err?: unknown): void {
    console.error(formatMessage("ERROR", msg, err));
  },
  warn(msg: string, err?: unknown): void {
    console.warn(formatMessage("WARN", msg, err));
  },
  info(msg: string, err?: unknown): void {
    console.info(err !== undefined ? formatMessage("INFO", msg, err) : `${PREFIX} INFO ${msg}`);
  },
  debug(msg: string, err?: unknown): void {
    if (debugEnabled()) {
      console.debug(err !== undefined ? formatMessage("DEBUG", msg, err) : `${PREFIX} DEBUG ${msg}`);
    }
  },
  /** High-level step label; only logs when E2E_VERBOSE is set. */
  phase(msg: string): void {
    if (verbose()) {
      console.info(`${PREFIX} STEP ${msg}`);
    }
  }
};
