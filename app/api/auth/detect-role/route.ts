import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Detects the user's role after login — uses service_role to bypass all RLS.
 * Returns: { role: "admin" | "seller" | "staff" | "customer", sellerId?, staffRole?, sellerName? }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Extract JWT from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    // 2. Create a client to verify the JWT
    const userClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // 3. Use service_role client to bypass ALL RLS
    console.log("[detect-role] User ID:", user.id, "Email:", user.email);
    const svc = createClient(supabaseUrl, serviceKey);

    // 4. Get profile
    const { data: profile } = await svc
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("auth_uid", user.id)
      .maybeSingle();

    console.log("[detect-role] Profile:", profile ? `${profile.id} (${profile.role})` : "NOT FOUND");
    if (!profile) {
      return NextResponse.json({ role: "customer" });
    }

    // 5. Check role
    if (profile.role === "admin") {
      return NextResponse.json({ role: "admin", profileId: profile.id });
    }

    if (profile.role === "seller") {
      const { data: seller } = await svc
        .from("sellers")
        .select("id, business_name, status")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (seller?.status === "approved") {
        return NextResponse.json({
          role: "seller",
          profileId: profile.id,
          sellerId: seller.id,
          sellerName: seller.business_name,
        });
      }
      return NextResponse.json({
        role: "seller_pending",
        profileId: profile.id,
        sellerStatus: seller?.status,
      });
    }

    // 6. Check if staff (this uses service_role — no RLS issues!)
    // Use .limit(1).single-like logic to handle edge cases
    const { data: staffRecords, error: staffErr } = await svc
      .from("seller_staff")
      .select("id, seller_id, role, status, name")
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .limit(1);

    if (staffErr) {
      console.error("[detect-role] Staff query error:", staffErr);
    }
    const staffRecord = staffRecords?.[0] ?? null;

    console.log("[detect-role] Staff record:", staffRecord ? `${staffRecord.id} (${staffRecord.role}, ${staffRecord.status})` : "NOT FOUND");
    if (staffRecord) {
      const { data: seller } = await svc
        .from("sellers")
        .select("business_name")
        .eq("id", staffRecord.seller_id)
        .maybeSingle();

      // Also fetch location assignments
      const { data: assignments } = await svc
        .from("staff_location_assignments")
        .select("location_id, permissions")
        .eq("staff_id", staffRecord.id);

      return NextResponse.json({
        role: "staff",
        profileId: profile.id,
        staffId: staffRecord.id,
        staffRole: staffRecord.role,
        staffName: staffRecord.name,
        sellerId: staffRecord.seller_id,
        sellerName: seller?.business_name || "Store",
        locationAssignments: assignments || [],
      });
    }

    // 7. Not admin, seller, or staff — customer
    return NextResponse.json({ role: "customer", profileId: profile.id });
  } catch (err) {
    console.error("detect-role error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
