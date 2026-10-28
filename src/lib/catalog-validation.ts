import { cleanBarcode, isValidGtin } from "@/lib/gtin";
import { parseDecimal } from "@/lib/money";

export interface ProductDraft {
  name: string;
  brand: string;
  size: string;
  unit: string;
  barcode: string;
}
export interface StoreDraft {
  name: string;
  chain: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
}

type Coords = { lat: number; lng: number } | null;
const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const optional = (value: string) => clean(value) || null;

export function normalizedProduct(draft: ProductDraft) {
  const name = clean(draft.name);
  const brand = optional(draft.brand);
  if (name.length < 2 || name.length > 120) throw new Error("Nome do produto deve ter entre 2 e 120 caracteres.");
  if (brand && brand.length > 120) throw new Error("Marca deve ter no máximo 120 caracteres.");

  const sizeString = draft.size.trim();
  const packageSize = sizeString ? parseDecimal(sizeString) : null;
  if (sizeString && (packageSize == null || packageSize <= 0 || packageSize > 999_999_999 ||
    Math.abs(packageSize * 1000 - Math.round(packageSize * 1000)) > 1e-6)) {
    throw new Error("Embalagem inválida. Use um número positivo com até 3 casas decimais.");
  }

  const units = ["un", "g", "kg", "ml", "l"];
  if (packageSize != null && !units.includes(draft.unit)) {
    throw new Error("Unidade da embalagem inválida.");
  }
  const barcode = cleanBarcode(draft.barcode);
  if (barcode && !isValidGtin(barcode)) {
    throw new Error("Código de barras inválido. Confira o dígito verificador.");
  }

  return {
    name,
    brand,
    package_size: packageSize,
    package_unit: packageSize != null ? draft.unit : null,
    barcode: barcode || null,
  };
}

export function normalizedStore(draft: StoreDraft, coords: Coords) {
  const name = clean(draft.name);
  const address = clean(draft.address);
  const city = clean(draft.city);
  const chain = optional(draft.chain);
  const neighborhood = optional(draft.neighborhood);
  const state = clean(draft.state).toUpperCase();

  if (name.length < 2 || name.length > 120) throw new Error("Nome da unidade deve ter entre 2 e 120 caracteres.");
  if (address.length < 3 || address.length > 200) throw new Error("Endereço deve ter entre 3 e 200 caracteres.");
  if (city.length < 2 || city.length > 80) throw new Error("Cidade deve ter entre 2 e 80 caracteres.");
  if (chain && chain.length > 120) throw new Error("Rede deve ter no máximo 120 caracteres.");
  if (neighborhood && neighborhood.length > 120) throw new Error("Bairro deve ter no máximo 120 caracteres.");
  if (state && !/^[A-Z]{2}$/.test(state)) throw new Error("UF deve ter exatamente duas letras.");

  if (coords && (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng) ||
    Math.abs(coords.lat) > 90 || Math.abs(coords.lng) > 180)) {
    throw new Error("Localização inválida. Escolha novamente no mapa.");
  }
  return {
    name, chain, address, neighborhood, city, state: state || null,
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
  };
}

/**
 * Only include plain words in the PostgREST .or(...) filter expression.
 * This prevents filter syntax (commas, dots, parentheses, wildcards) from
 * being interpreted as part of the query rather than as user input.
 */
export function sanitizeCatalogSearch(raw: string): string {
  return raw.trim()
    .replace(/[^a-zA-Z0-9À-ÿ -]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .trim();
}
