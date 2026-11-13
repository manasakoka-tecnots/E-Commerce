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
    const jwt = authHeader?.replace("Bearer ", "");
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getUserSupabase(jwt);

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { profile_id, address_id, total_amount, items } = body;

    if (!profile_id || !address_id || !total_amount || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── IDOR Prevention: Verify profile_id belongs to the authenticated user ──
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", profile_id)
      .eq("auth_uid", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile does not belong to authenticated user" }, { status: 403 });
    }

    // Verify address belongs to the user's profile
    const { data: address } = await supabase
      .from("addresses")
      .select("id")
      .eq("id", address_id)
      .eq("profile_id", profile_id)
      .maybeSingle();

    if (!address) {
      return NextResponse.json({ error: "Address not found or does not belong to user" }, { status: 403 });
    }

    const { data, error } = await supabase.rpc("place_order", {
      p_profile_id: profile_id,
      p_address_id: address_id,
      p_total_amount: total_amount,
      p_items: items,
    });

    if (error) {
      console.error("Place order RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error || "Failed to place order" }, { status: 403 });
    }

    // Commit stock at location level (best-effort)
    try {
      await supabase.rpc("commit_location_stock_for_order", {
        p_order_id: data.order_id,
      });
    } catch (locErr) {
      console.warn("Location stock commit (non-blocking):", locErr);
    }

    return NextResponse.json({ order_id: data.order_id });
  } catch (err) {
    console.error("Place order error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
