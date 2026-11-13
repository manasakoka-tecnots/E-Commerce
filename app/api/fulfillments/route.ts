import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

async function getAuthenticatedUserAndProfile(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const userJwt = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
  if (!userJwt) return null;

  const supabase = getUserSupabase(userJwt);
  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser?.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_uid", authUser.user.id)
    .maybeSingle();

  if (!profile) return null;

  return { supabase, user: authUser.user, profileId: profile.id };
}

async function verifySellerOrStaff(
  supabase: ReturnType<typeof getUserSupabase>,
  profileId: string,
  sellerId: string
): Promise<boolean> {
  const { data: sellerCheck } = await supabase
    .from("sellers")
    .select("id")
    .eq("id", sellerId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (sellerCheck) return true;

  const { data: staffCheck } = await supabase
    .from("seller_staff")
    .select("id")
    .eq("seller_id", sellerId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  return !!staffCheck;
}

// POST: Create a fulfillment
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUserAndProfile(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { order_id, seller_id, items, tracking_number, carrier, notes, location_id } = body;

    if (!order_id || !seller_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields: order_id, seller_id, items" }, { status: 400 });
    }

    const isAuthorized = await verifySellerOrStaff(auth.supabase, auth.profileId, seller_id);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: seller does not belong to current user" }, { status: 403 });
    }

    for (const item of items) {
      if (!item.order_item_id || !item.quantity || item.quantity <= 0) {
        return NextResponse.json({ error: "Each item must have order_item_id and quantity > 0" }, { status: 400 });
      }
    }

    const { data, error } = await auth.supabase.rpc("create_fulfillment_rpc", {
      p_order_id: order_id,
      p_seller_id: seller_id,
      p_tracking_number: tracking_number || null,
      p_carrier: carrier || null,
      p_notes: notes || null,
      p_items: items,
      p_location_id: location_id || null,
    });

    if (error) {
      console.error("Create fulfillment RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, fulfillment_id: data.fulfillment_id, location_id: data.location_id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH: Update a fulfillment (tracking, status)
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUserAndProfile(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fulfillment_id, status } = body;

    if (!fulfillment_id) {
      return NextResponse.json({ error: "Missing fulfillment_id" }, { status: 400 });
    }

    // Verify the caller owns the fulfillment's seller
    const { data: fulfillment } = await auth.supabase
      .from("fulfillments")
      .select("seller_id")
      .eq("id", fulfillment_id)
      .maybeSingle();

    if (!fulfillment) {
      return NextResponse.json({ error: "Fulfillment not found" }, { status: 404 });
    }

    const isAuthorized = await verifySellerOrStaff(auth.supabase, auth.profileId, fulfillment.seller_id);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Not authorized for this fulfillment" }, { status: 403 });
    }

    if (status) {
      const validStatuses = ["pending", "shipped", "in_transit", "out_for_delivery", "delivered", "cancelled"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
      }

      const { data, error } = await auth.supabase.rpc("update_fulfillment_status_rpc", {
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
    const auth = await getAuthenticatedUserAndProfile(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fulfillment_id = searchParams.get("fulfillment_id");

    if (!fulfillment_id) {
      return NextResponse.json({ error: "Missing fulfillment_id" }, { status: 400 });
    }

    // Verify the caller owns the fulfillment's seller
    const { data: fulfillment } = await auth.supabase
      .from("fulfillments")
      .select("seller_id")
      .eq("id", fulfillment_id)
      .maybeSingle();

    if (!fulfillment) {
      return NextResponse.json({ error: "Fulfillment not found" }, { status: 404 });
    }

    const isAuthorized = await verifySellerOrStaff(auth.supabase, auth.profileId, fulfillment.seller_id);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Not authorized for this fulfillment" }, { status: 403 });
    }

    const { data, error } = await auth.supabase.rpc("cancel_fulfillment_rpc", {
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
