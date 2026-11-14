import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

// Whitelist of allowed product update fields
const ALLOWED_PRODUCT_FIELDS = new Set([
  "name", "slug", "description", "sku", "brand", "brand_id",
  "category_id", "status", "is_active", "weight", "weight_unit",
  "tags", "meta_title", "meta_description", "updated_at",
]);

// Whitelist of allowed listing update fields
const ALLOWED_LISTING_FIELDS = new Set([
  "price", "compare_at_price", "cost_price", "stock", "sku",
  "is_active", "status", "condition", "updated_at",
]);

function filterFields(obj: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (allowed.has(key)) {
      filtered[key] = obj[key];
    }
  }
  return filtered;
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const supabase = getUserSupabase(token);
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

    let isStaffMember = false;
    let staffRole: string | null = null;
    if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
      const { data: staffRecord } = await supabase
        .from("seller_staff")
        .select("id, seller_id, role")
        .eq("profile_id", profile?.id ?? "")
        .eq("status", "active")
        .maybeSingle();

      if (!staffRecord) {
        return NextResponse.json({ error: "Not a seller" }, { status: 403 });
      }
      isStaffMember = true;
      staffRole = staffRecord.role;

      // Associates need explicit inventory_manage or products_manage permission
      if (staffRole === "associate") {
        const svc = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: assignments } = await svc
          .from("staff_location_assignments")
          .select("permissions")
          .eq("staff_id", staffRecord.id);

        const allPerms = (assignments || []).flatMap(a => a.permissions || []);
        if (!allPerms.includes("inventory_manage") && !allPerms.includes("products_manage")) {
          return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
      }
    }

    const body = await request.json();
    const { productId, updates, listingUpdates, listingId, sellerId } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    if (profile!.role !== "admin") {
      let resolvedSellerId: string | null = null;

      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("profile_id", profile!.id)
        .maybeSingle();

      if (seller) {
        resolvedSellerId = seller.id;
      } else if (isStaffMember) {
        const { data: staffRecord } = await supabase
          .from("seller_staff")
          .select("seller_id")
          .eq("profile_id", profile!.id)
          .eq("status", "active")
          .maybeSingle();
        resolvedSellerId = staffRecord?.seller_id ?? null;
      }

      if (!resolvedSellerId) {
        return NextResponse.json({ error: "Seller account not found" }, { status: 403 });
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("seller_id")
        .eq("id", productId)
        .single();

      if (productError || !product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      if (product.seller_id !== resolvedSellerId) {
        return NextResponse.json({ error: "Not authorized to update this product" }, { status: 403 });
      }
    }

    // Update product — apply field whitelist
    if (updates && Object.keys(updates).length > 0) {
      const safeUpdates = filterFields(updates, ALLOWED_PRODUCT_FIELDS);

      if (Object.keys(safeUpdates).length === 0) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from("products")
        .update(safeUpdates)
        .eq("id", productId)
        .select("id");

      if (updateError) {
        return NextResponse.json(
          { error: `Failed to update product: ${updateError.message}` },
          { status: 500 }
        );
      }

      if (!updatedRows || updatedRows.length === 0) {
        return NextResponse.json(
          { error: "Product update failed — no rows updated." },
          { status: 403 }
        );
      }
    }

    // Update or create seller listing — apply field whitelist
    if (listingUpdates) {
      const safeListingUpdates = filterFields(listingUpdates, ALLOWED_LISTING_FIELDS);

      if (listingId) {
        const { data: updatedListings, error: listingError } = await supabase
          .from("seller_listings")
          .update(safeListingUpdates)
          .eq("id", listingId)
          .select("id");

        if (listingError) {
          return NextResponse.json(
            { error: `Failed to update listing: ${listingError.message}` },
            { status: 500 }
          );
        }

        if (!updatedListings || updatedListings.length === 0) {
          return NextResponse.json(
            { error: "Listing update failed — no rows updated." },
            { status: 403 }
          );
        }
      } else if (sellerId) {
        const { data: newListing, error: listingError } = await supabase
          .from("seller_listings")
          .insert({ ...safeListingUpdates, seller_id: sellerId, product_id: productId })
          .select("id")
          .single();

        if (listingError) {
          return NextResponse.json(
            { error: `Failed to create listing: ${listingError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, newListingId: newListing?.id });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
