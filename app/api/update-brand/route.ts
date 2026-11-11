import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

export async function POST(request: NextRequest) {
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

    if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { brand } = body;

    if (!brand || !brand.name) {
      return NextResponse.json({ error: "Brand data required" }, { status: 400 });
    }

    const { data, error: insertError } = await supabase
      .from("brands")
      .insert(brand)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.code === "23505" ? "Brand name already exists" : insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
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

    // Verify seller/admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("auth_uid", user.id)
      .maybeSingle();

    if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { brandId, updates, oldName } = body;

    if (!brandId) {
      return NextResponse.json({ error: "Brand ID required" }, { status: 400 });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    // Update the brands table
    const { error: updateError } = await supabase
      .from("brands")
      .update(updates)
      .eq("id", brandId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.code === "23505" ? "Brand name already exists" : updateError.message },
        { status: 500 }
      );
    }

    // If brand name changed, update all products that reference the old brand name
    if (updates.name && oldName && updates.name !== oldName) {
      // Try using the RPC function first (SECURITY DEFINER bypasses RLS)
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc("update_product_brand", { old_brand: oldName, new_brand: updates.name });

      if (rpcError) {
        console.error("[update-brand] RPC failed, trying direct update:", rpcError.message);
        // Fallback: direct update with user client (only updates seller's own products)
        const { error: productsError } = await supabase
          .from("products")
          .update({ brand: updates.name })
          .eq("brand", oldName);
        if (productsError) {
          console.error("[update-brand] Direct update also failed:", productsError.message);
        }
      } else {
        console.log("[update-brand] RPC updated products:", rpcResult);
      }

      // Also update seller_listings if they have a brand field
      const { error: listingsError } = await supabase
        .from("seller_listings")
        .update({ brand: updates.name })
        .eq("brand", oldName);

      if (listingsError) {
        console.log("[update-brand] seller_listings brand update skipped:", listingsError.message);
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

export async function DELETE(request: NextRequest) {
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

    if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { brandId } = body;

    if (!brandId) {
      return NextResponse.json({ error: "Brand ID required" }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from("brands")
      .delete()
      .eq("id", brandId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
