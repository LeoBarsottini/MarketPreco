import { describe, expect, it } from "vitest";
import { priceLabelImageError } from "@/lib/ocr-image-validation";

const image = (type: string, size = 1024) => ({ type, size });

describe("Validação das fotos usadas pelo OCR", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/bmp", "image/gif"])(
    "aceita formato %s com tamanho permitido", (mime) => {
      expect(priceLabelImageError(image(mime))).toBeNull();
    },
  );
  it("recusa SVG e arquivos não-imagem", () => {
    expect(priceLabelImageError(image("image/svg+xml"))).toMatch(/Formato/);
    expect(priceLabelImageError(image("application/pdf"))).toMatch(/Formato/);
    expect(priceLabelImageError(image("text/html"))).toMatch(/Formato/);
    expect(priceLabelImageError(image(""))).toMatch(/Formato/);
  });
  it("explica incompatibilidade com fotos HEIC/HEIF", () => {
    expect(priceLabelImageError(image("image/heic"))).toMatch(/HEIC/);
    expect(priceLabelImageError(image("image/heif"))).toMatch(/HEIC/);
  });
  it("recusa arquivo vazio ou acima de 8 MB", () => {
    expect(priceLabelImageError(image("image/jpeg", 0))).toMatch(/vazia/);
    expect(priceLabelImageError(image("image/jpeg", 8 * 1024 * 1024 + 1))).toMatch(/8 MB/);
    expect(priceLabelImageError(image("image/jpeg", 8 * 1024 * 1024))).toBeNull();
  });
});
