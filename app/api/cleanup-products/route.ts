import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  const supabase = getUserSupabase(token);

  // Verify JWT and admin role
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const namesToDelete = [
    "JBL Go 4 Portable Bluetooth Speaker",
    "JBL Flip 6 Portable Bluetooth Speaker",
    "Apple 20W USB-C Power Adapter",
    "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
    "Sony WH-1000XM5",
  ];

  const results: Record<string, string> = {};

  for (const name of namesToDelete) {
    // Find matching products (case-insensitive partial match)
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .ilike("name", `%${name}%`);

    if (!products || products.length === 0) {
      results[name] = "not found";
      continue;
    }

    for (const product of products) {
      // Delete related data first
      await supabase.from("seller_listings").delete().eq("product_id", product.id);
      await supabase.from("product_images").delete().eq("product_id", product.id);
      await supabase.from("product_variants").delete().eq("product_id", product.id);
      await supabase.from("collection_products").delete().eq("product_id", product.id);

      // Delete the product
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      results[product.name] = error ? `error: ${error.message}` : "deleted";
    }
  }

  // Also find any remaining JBL, adapter, or headphone products
  const { data: remaining } = await supabase
    .from("products")
    .select("id, name")
    .or("name.ilike.%JBL%,name.ilike.%adapter%,name.ilike.%headphone%");

  if (remaining && remaining.length > 0) {
    for (const product of remaining) {
      await supabase.from("seller_listings").delete().eq("product_id", product.id);
      await supabase.from("product_images").delete().eq("product_id", product.id);
      await supabase.from("product_variants").delete().eq("product_id", product.id);
      await supabase.from("collection_products").delete().eq("product_id", product.id);
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      results[product.name] = error ? `error: ${error.message}` : "deleted (catch-all)";
    }
  }

  return NextResponse.json({ results, remaining: remaining?.map(p => p.name) || [] });
}
