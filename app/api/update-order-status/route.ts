import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

export async function PATCH(req: NextRequest) {
  try {
    const { orderId, newStatus } = await req.json();

    if (!orderId || !newStatus) {
      return NextResponse.json({ error: "Missing orderId or newStatus" }, { status: 400 });
    }

    const validStatuses = ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: `Invalid status: ${newStatus}` }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = getUserSupabase(token);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // The RPC now enforces seller/staff ownership internally
    const { data, error } = await supabase.rpc("update_order_status_rpc", {
      p_order_id: orderId,
      p_status: newStatus,
    });

    if (error) {
      console.error("Failed to update order status:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check for application-level errors from the RPC
    const result = data as { success?: boolean; error?: string } | null;
    if (result && typeof result === "object" && "success" in result && !result.success) {
      return NextResponse.json({ error: result.error || "Not authorized" }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("update-order-status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
