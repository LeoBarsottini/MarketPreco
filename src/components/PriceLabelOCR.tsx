import { useRef, useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { formatBRL } from "@/lib/money";
import { extractPriceCandidates } from "@/lib/price-ocr";

type OcrWorker = {
  recognize: (image: File) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};
type OcrEngine = { createWorker: (
  language: string, oem: number, options: {
    workerPath: string;
    corePath: string;
    langPath: string;
    workerBlobURL: boolean;
  },
) => Promise<OcrWorker> };

let enginePromise: Promise<OcrEngine> | undefined;

/**
 * Tesseract's API is loaded as an application-owned JS chunk. Its worker and
 * WASM core are copied from pinned npm packages to /vendor/tesseract by our
 * prebuild script, avoiding execution of remote CDN JavaScript.
 *
 * The Portuguese language model is still downloaded from the language-data
 * provider and cached by Tesseract in the browser (separate from source code).
 */
function loadOcr(): Promise<OcrEngine> {
  if (!enginePromise) {
    enginePromise = import("tesseract.js")
      .then((module) => module as unknown as OcrEngine)
      .catch((error: unknown) => {
        enginePromise = undefined;
        throw new Error("Não foi possível iniciar o reconhecimento de texto.", { cause: error });
      });
  }
  return enginePromise;
}

const LOCAL_OCR_DIRECTORY = "/vendor/tesseract";
const LANGUAGE_DATA_URL = "https://tessdata.projectnaptha.com/4.0.0";
export function PriceLabelOCR({ onSelect }: { onSelect: (price: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<number[]>([]);
  const processing = useRef(false);

  async function analyze(file: File) {
    if (processing.current) return;
    setError(null);
    setText("");
    setCandidates([]);
    if (!file.type.startsWith("image/")) {
      setError("Escolha uma foto de etiqueta (JPG, PNG ou outro formato de imagem).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Imagem grande demais. Utilize uma foto com até 8 MB.");
      return;
    }
    processing.current = true;
    setBusy(true);
    let worker: OcrWorker | undefined;
    try {
      const ocr = await loadOcr();
      worker = await ocr.createWorker("por", 1, {
        workerPath: new URL(`${LOCAL_OCR_DIRECTORY}/worker.min.js`, window.location.origin).href,
        corePath: new URL(LOCAL_OCR_DIRECTORY, window.location.origin).href,
        langPath: LANGUAGE_DATA_URL,
        workerBlobURL: false,
      });
      const recognized = await worker.recognize(file);
      const extracted = recognized.data.text.trim();
      setText(extracted);
      setCandidates(extractPriceCandidates(extracted));
      if (!extracted) setError("Nenhum texto encontrado. Digite o valor manualmente.");
    } catch {
      setError("Não foi possível reconhecer a etiqueta. Confira sua conexão ou digite o preço.");
    } finally {
      if (worker) await worker.terminate().catch(() => undefined);
      processing.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-dashed p-3">
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
        Ler preço pela foto (opcional)
      </label>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        disabled={busy}
        aria-label="Fotografar ou escolher foto da etiqueta de preço"
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-primary"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void analyze(file);
        }}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        A foto é processada no navegador e não é salva na lista. O modelo de português pode ser baixado na primeira utilização. Confira sempre o preço sugerido na etiqueta.
      </p>
      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm" role="status">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Lendo etiqueta…
        </p>
      )}
      {error && <p className="mt-2 text-sm text-warning-foreground" role="alert">{error}</p>}
      {candidates.length > 0 && (
        <>
          <p className="mt-3 text-sm font-medium">Valores identificados (selecione o preço correto):</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {candidates.map((price) => (
              <button
                key={price}
                type="button"
                className="rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-sm font-semibold text-primary hover:border-primary"
                onClick={() => onSelect(price.toFixed(2).replace(".", ","))}
              >
                {formatBRL(price)}
              </button>
            ))}
          </div>
        </>
      )}
      {text && candidates.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">O texto foi lido, mas nenhum preço confiável pôde ser sugerido. Digite manualmente.</p>
      )}
    </section>
  );
}
