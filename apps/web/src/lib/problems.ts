/**
 * Problems shown on a page that loads several things at once.
 *
 * A bad date or an unknown site makes SEVERAL requests fail with the same problem document, and
 * each panel used to print its own copy, so a screen reader announced the same sentence two to
 * four times (#173). The page now collects the messages, keeps each distinct one once, in the
 * order the panels appear, and shows them in one place.
 */
export type Panel = { name: string; message: string | null };

/** Distinct messages in order. Whitespace and case differences do not make a new message. */
export function uniqueProblems(messages: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of messages) {
    if (!m) continue;
    const key = m.replace(/\s+/g, " ").trim().toLowerCase();
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/**
 * When the page already explains why nothing can load (unknown site, unreadable date), the
 * requests that failed because of it add nothing, so they are left out.
 */
export function problemsToShow(opts: {
  explained: boolean;
  messages: (string | null | undefined)[];
}): string[] {
  return opts.explained ? [] : uniqueProblems(opts.messages);
}
