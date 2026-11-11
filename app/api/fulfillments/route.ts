import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

// POST: Create a fulfillment
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const userJwt = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
    if (!userJwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getUserSupabase(userJwt);
    const body = await req.json();
    const { order_id, seller_id, items, tracking_number, carrier, notes } = body;

    if (!order_id || !seller_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields: order_id, seller_id, items" }, { status: 400 });
    }

    for (const item of items) {
      if (!item.order_item_id || !item.quantity || item.quantity <= 0) {
        return NextResponse.json({ error: "Each item must have order_item_id and quantity > 0" }, { status: 400 });
      }
    }

    // Use SECURITY DEFINER RPC to create fulfillment (bypasses RLS)
    const { data, error } = await supabase.rpc("create_fulfillment_rpc", {
      p_order_id: order_id,
      p_seller_id: seller_id,
      p_tracking_number: tracking_number || null,
      p_carrier: carrier || null,
      p_notes: notes || null,
      p_items: items,
    });

    if (error) {
      console.error("Create fulfillment RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, fulfillment_id: data.fulfillment_id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH: Update a fulfillment (tracking, status)
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const userJwt = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
    if (!userJwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getUserSupabase(userJwt);
    const body = await req.json();
    const { fulfillment_id, status } = body;

    if (!fulfillment_id) {
      return NextResponse.json({ error: "Missing fulfillment_id" }, { status: 400 });
    }

    if (status) {
      const validStatuses = ["pending", "shipped", "in_transit", "out_for_delivery", "delivered", "cancelled"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
      }

      // Use SECURITY DEFINER RPC to update fulfillment status (bypasses RLS)
      const { data, error } = await supabase.rpc("update_fulfillment_status_rpc", {
        p_fulfillment_id: fulfillment_id,
        p_status: status,
      });

      if (error) {
        console.error("Update fulfillment RPC error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data.success) {
        return NextResponse.json({ error: data.error }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE: Cancel a fulfillment
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const userJwt = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
    if (!userJwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getUserSupabase(userJwt);
    const { searchParams } = new URL(req.url);
    const fulfillment_id = searchParams.get("fulfillment_id");

    if (!fulfillment_id) {
      return NextResponse.json({ error: "Missing fulfillment_id" }, { status: 400 });
    }

    // Use SECURITY DEFINER RPC to cancel fulfillment (bypasses RLS)
    const { data, error } = await supabase.rpc("cancel_fulfillment_rpc", {
      p_fulfillment_id: fulfillment_id,
    });

    if (error) {
      console.error("Cancel fulfillment RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
