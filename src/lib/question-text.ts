export function toPlainQuestionText(input: string | undefined | null) {
  const original = String(input ?? "").trim();
  if (!original) {
    return "";
  }

  let text = original;
  let changed = true;

  // Repeatedly strip common list markers like "1.", "Q2:", "a)", "(B)", "ii." from the start.
  while (changed) {
    changed = false;

    const next = text
      .replace(/^\s*(?:q(?:uestion)?\s*\d+\s*[:.)-]?\s*)/i, "")
      .replace(/^\s*(?:(?:\(?\d{1,3}\)?|\(?[a-z]\)?|\(?[ivxlcdm]{1,6}\)?)\s*[:.)-]\s*)+/i, "")
      .trim();

    if (next !== text) {
      text = next;
      changed = true;
    }
  }

  return text || original;
}
