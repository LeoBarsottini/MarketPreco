/** Extrai possíveis preços de etiquetas sem assumir que o OCR está correto. */
export function extractPriceCandidates(text: string): number[] {
  // Aceita 12,90; 12.90; R$ 12,90; e 1.234,56, mas não códigos inteiros.
  const re = /(?<![\d.,])(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d{1,5})[,.]\d{2})(?![\d.,])/gi;
  const candidates = new Set<number>();
  for (const match of text.matchAll(re)) {
    const captured = match[1];
    if (!captured) continue;
    const value = Number(captured.replace(/\.(?=\d{3},)/g, "").replace(",", "."));
    if (Number.isFinite(value) && value > 0 && value < 100000) {
      candidates.add(value);
    }
  }
  return [...candidates].slice(0, 12);
}
