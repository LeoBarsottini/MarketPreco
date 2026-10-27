import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Store = Tables<"stores">;
export type Product = Tables<"products">;
export type ShoppingList = Tables<"shopping_lists">;

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const storesQuery = () =>
  queryOptions({
    queryKey: ["stores"],
    queryFn: async () => must(await supabase.from("stores").select("*").order("name").limit(500)),
  });

export const listsQuery = () =>
  queryOptions({
    queryKey: ["lists"],
    queryFn: async () =>
      must(
        await supabase
          .from("shopping_lists")
          .select("*, stores(name), shopping_list_items(quantity, unit_price, checked)")
          .order("created_at", { ascending: false }),
      ),
  });

export const listQuery = (id: string) =>
  queryOptions({
    queryKey: ["list", id],
    queryFn: async () => {
      const list = must(await supabase.from("shopping_lists").select("*, stores(id, name, city)").eq("id", id).single());
      const items = must(
        await supabase
          .from("shopping_list_items")
          .select("*, products(id, name, brand, package_size, package_unit, barcode), stores(name)")
          .eq("list_id", id)
          .order("created_at"),
      );
      return { list, items };
    },
  });

export const productPricesQuery = (productId: string) =>
  queryOptions({
    queryKey: ["prices", productId],
    queryFn: async () =>
      must(await supabase.rpc("public_prices_for_product", { _product_id: productId })),
  });

export function productLabel(p: Pick<Product, "name" | "brand" | "package_size" | "package_unit">) {
  const pack = p.package_size ? ` ${String(p.package_size).replace(".", ",").replace(/,?0+$/, "")}${p.package_unit ?? ""}` : "";
  return `${p.name}${p.brand ? " · " + p.brand : ""}${pack}`;
}
