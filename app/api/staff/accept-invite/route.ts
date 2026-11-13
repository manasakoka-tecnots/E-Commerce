import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Server-side invite acceptance — uses service_role to bypass all RLS.
 * Body: { token: string }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Validate JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "You must be logged in to accept an invite." }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    const userClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session. Please log in again." }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const token = body.token;
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid invite token." }, { status: 400 });
    }

    // 3. Use service_role to call the RPC (bypasses all RLS)
    const svc = createClient(supabaseUrl, serviceKey);

    // 4. First ensure the user has a profile (auto-create if missing)
    const { data: existingProfile } = await svc
      .from("profiles")
      .select("id")
      .eq("auth_uid", user.id)
      .maybeSingle();

    if (!existingProfile) {
      // Look up the invite to get the staff name
      const { data: staffRecord } = await svc
        .from("seller_staff")
        .select("name, email")
        .eq("invite_token", token)
        .eq("status", "invited")
        .maybeSingle();

      const name = staffRecord?.name || user.email?.split("@")[0] || "Staff";
      const email = user.email || staffRecord?.email || "";

      const { error: insertErr } = await svc.from("profiles").insert({
        auth_uid: user.id,
        full_name: name,
        email: email,
        role: "customer",
      });

      if (insertErr) {
        console.error("Profile creation error:", insertErr);
        return NextResponse.json({ error: "Failed to set up your account." }, { status: 500 });
      }
    }

    // 5. Call accept_staff_invite using service_role + impersonation via RPC
    // Since the RPC checks auth.uid(), we need to call it AS the user
    // We'll do the acceptance manually with service_role instead

    // Find the invite
    const { data: invite } = await svc
      .from("seller_staff")
      .select("id, seller_id, invite_token, invite_expires_at, status, email")
      .eq("invite_token", token)
      .eq("status", "invited")
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ error: "This invite link is invalid or has already been used." }, { status: 400 });
    }

    // Check expiry
    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
      return NextResponse.json({ error: "This invitation has expired. Please ask the store owner to send a new one." }, { status: 400 });
    }

    // Get the user's profile id
    const { data: profile } = await svc
      .from("profiles")
      .select("id, email")
      .eq("auth_uid", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Account setup incomplete. Please try again." }, { status: 400 });
    }

    // Check if already staff for this seller
    const { data: existingStaff } = await svc
      .from("seller_staff")
      .select("id")
      .eq("seller_id", invite.seller_id)
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingStaff) {
      return NextResponse.json({ error: "You are already a staff member of this store." }, { status: 400 });
    }

    // Accept the invite: update the record
    const { error: updateErr } = await svc
      .from("seller_staff")
      .update({
        profile_id: profile.id,
        status: "active",
        invite_token: null,
        invite_expires_at: null,
        activated_at: new Date().toISOString(),
      })
      .eq("id", invite.id)
      .eq("status", "invited"); // Double-check status to prevent race

    if (updateErr) {
      console.error("Invite acceptance error:", updateErr);
      return NextResponse.json({ error: "Failed to accept the invitation. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("accept-invite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
