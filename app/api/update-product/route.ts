import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

export async function PUT(request: NextRequest) {
  try {
    // Verify auth from the Authorization header
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

    // Verify seller role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("auth_uid", user.id)
      .maybeSingle();

    if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Not a seller" }, { status: 403 });
    }

    const body = await request.json();
    const { productId, updates, listingUpdates, listingId, sellerId } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    // Verify the seller owns this product (admins can update any product)
    if (profile.role !== "admin") {
      // Look up the seller record for this profile
      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (!seller) {
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

      if (product.seller_id !== seller.id) {
        return NextResponse.json({ error: "Not authorized to update this product" }, { status: 403 });
      }
    }

    // Update product
    if (updates && Object.keys(updates).length > 0) {
      const { data: updatedRows, error: updateError } = await supabase
        .from("products")
        .update(updates)
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
          { error: "Product update failed — no rows updated. This may be a permissions issue." },
          { status: 403 }
        );
      }
    }

    // Update or create seller listing
    if (listingUpdates) {
      if (listingId) {
        const { data: updatedListings, error: listingError } = await supabase
          .from("seller_listings")
          .update(listingUpdates)
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
            { error: "Listing update failed — no rows updated. This may be a permissions issue." },
            { status: 403 }
          );
        }
      } else if (sellerId) {
        const { data: newListing, error: listingError } = await supabase
          .from("seller_listings")
          .insert({ ...listingUpdates, seller_id: sellerId, product_id: productId })
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
