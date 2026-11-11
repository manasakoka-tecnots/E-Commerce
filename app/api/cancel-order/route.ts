import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

// Statuses that allow cancellation (before shipping)
const CANCELLABLE_STATUSES = ["pending", "confirmed", "processing"];

const CANCELLATION_REASONS = [
  "Changed my mind",
  "Found a better price elsewhere",
  "Ordered by mistake",
  "Delivery time is too long",
  "Want to change address/payment",
  "Duplicate order",
  "Other",
];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const userJwt = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
    if (!userJwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getUserSupabase(userJwt);
    const body = await req.json();
    const { order_id, reason, reason_details } = body;

    if (!order_id) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: "Please select a cancellation reason" }, { status: 400 });
    }

    // Get the order and verify ownership (uses user's JWT — RLS ensures they can only read their own)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, profile_id")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if order can be cancelled
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      const statusLabel = order.status.replace(/_/g, " ");
      return NextResponse.json(
        { error: `This order cannot be cancelled because it is already "${statusLabel}". You can only cancel orders before they are shipped.` },
        { status: 400 }
      );
    }

    // Use SECURITY DEFINER RPC to cancel order and restore stock (bypasses RLS)
    const { data, error } = await supabase.rpc("cancel_order_rpc", {
      p_order_id: order_id,
      p_reason: `${reason}${reason_details ? ": " + reason_details : ""}`,
    });

    if (error) {
      console.error("Cancel order RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Order cancelled successfully. Refund will be processed within 5-7 business days.",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: Check if an order is cancellable
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order_id");

  if (!orderId) {
    return NextResponse.json({ cancellable: false });
  }

  const authHeader = req.headers.get("authorization");
  const userJwt = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
  if (!userJwt) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getUserSupabase(userJwt);
  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  return NextResponse.json({
    cancellable: order ? CANCELLABLE_STATUSES.includes(order.status) : false,
    reasons: CANCELLATION_REASONS,
  });
}
