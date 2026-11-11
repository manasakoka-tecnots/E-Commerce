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
    const body = await request.json();
    const { action } = body;

    if (action === "validate_and_decrement") {
      const { items } = body as {
        items: { seller_listing_id: string; quantity: number; product_name?: string }[];
      };

      if (!items || items.length === 0) {
        return NextResponse.json({ error: "No items provided" }, { status: 400 });
      }

      const { data, error } = await supabase.rpc("validate_and_decrement_stock", {
        p_items: items,
      });

      if (error) {
        console.error("Stock RPC error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data.success) {
        return NextResponse.json(
          { error: "Insufficient stock", details: data.details },
          { status: 409 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "restore") {
      const { order_id } = body as { order_id: string };
      if (!order_id) {
        return NextResponse.json({ error: "order_id is required" }, { status: 400 });
      }

      const { data, error } = await supabase.rpc("restore_order_stock", {
        p_order_id: order_id,
      });

      if (error) {
        console.error("Stock restore RPC error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Stock API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
