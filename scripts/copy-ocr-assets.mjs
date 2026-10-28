/**
 * Prepare self-hosted OCR worker and WebAssembly assets before Vite starts.
 * Do not modify generated files manually. Only language-traineddata may still
 * be fetched from a language-data provider at runtime.
 */
import { mkdir, copyFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules");
const destination = join(root, "public", "vendor", "tesseract");

const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ...[
    "tesseract-core",
    "tesseract-core-simd",
    "tesseract-core-lstm",
    "tesseract-core-simd-lstm",
  ].flatMap((name) => [
    [`tesseract.js-core/${name}.wasm.js`, `${name}.wasm.js`],
    [`tesseract.js-core/${name}.wasm`, `${name}.wasm`],
  ]),
];

await mkdir(destination, { recursive: true });
for (const [from, to] of files) {
  try {
    await copyFile(join(source, from), join(destination, to));
  } catch (error) {
    throw new Error(`Falha ao preparar recurso OCR ${from}. Execute a instalação das dependências.`, { cause: error });
  }
}
console.log("[MarketPreço] Recursos locais do OCR preparados.");
