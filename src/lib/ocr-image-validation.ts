/** Client-side checks only; the browser never uploads this image to MarketPreço. */
const MAX_OCR_FILE_SIZE = 8 * 1024 * 1024;
const SUPPORTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/gif",
]);

export function priceLabelImageError(file: Pick<File, "type" | "size">): string | null {
  const mime = file.type.toLowerCase().trim();
  if (mime === "image/heic" || mime === "image/heif") {
    return "Fotos HEIC/HEIF não são suportadas pelo leitor. Selecione JPEG, PNG ou WebP, ou digite o preço.";
  }
  if (!SUPPORTED_MIME.has(mime)) {
    return "Formato de imagem não aceito. Utilize uma foto JPG, PNG ou WebP.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "A imagem está vazia ou inválida. Tire outra foto.";
  }
  if (file.size > MAX_OCR_FILE_SIZE) {
    return "Imagem grande demais. Utilize uma foto com até 8 MB.";
  }
  return null;
}
