import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Resend is optional — invite links work without it
let resend: import("resend").Resend | null = null;
if (process.env.RESEND_API_KEY) {
  const { Resend } = require("resend") as typeof import("resend");
  resend = new Resend(process.env.RESEND_API_KEY);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

// POST /api/staff-invite — Generate invite token and send email via Resend
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { staffId, sellerId, action } = body;

    if (!staffId || !sellerId) {
      return NextResponse.json({ error: "Missing staffId or sellerId" }, { status: 400 });
    }

    // ── Authentication: Validate JWT and get user ──
    const authHeader = req.headers.get('authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userSupabase = getUserSupabase(jwt);
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // ── Authorization: Verify caller is the seller owner or admin staff ──
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("auth_uid", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    // Check if user is the direct seller owner
    const { data: sellerOwner } = await supabaseAdmin
      .from("sellers")
      .select("id")
      .eq("id", sellerId)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!sellerOwner) {
      // Check if user is admin staff for this seller
      const { data: adminStaff } = await supabaseAdmin
        .from("seller_staff")
        .select("id, role")
        .eq("seller_id", sellerId)
        .eq("profile_id", profile.id)
        .eq("status", "active")
        .in("role", ["admin"])
        .maybeSingle();

      if (!adminStaff && profile.role !== "admin") {
        return NextResponse.json({ error: "Only the store owner or admin staff can invite team members" }, { status: 403 });
      }
    }

    // Verify the staff record belongs to this seller
    const { data: staff, error: staffErr } = await supabaseAdmin
      .from("seller_staff")
      .select("id, name, email, role, status, seller_id, invite_token")
      .eq("id", staffId)
      .eq("seller_id", sellerId)
      .single();

    if (staffErr || !staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    if (staff.status !== "invited") {
      return NextResponse.json({ error: "Staff member is already activated or removed" }, { status: 400 });
    }

    // Generate a cryptographically secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Update the staff record with the token
    const { error: updateErr } = await supabaseAdmin
      .from("seller_staff")
      .update({
        invite_token: token,
        invite_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staffId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Build the invite URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const inviteUrl = `${siteUrl}/invite/${token}`;

    // Get seller business name
    const { data: seller } = await supabaseAdmin
      .from("sellers")
      .select("business_name")
      .eq("id", sellerId)
      .single();

    const storeName = seller?.business_name || "the store";

    // Get assigned locations for the email
    const { data: locationData } = await supabaseAdmin
      .from("staff_location_assignments")
      .select("seller_locations(name)")
      .eq("staff_id", staffId);

    const locationNames = (locationData || [])
      .map((la: Record<string, unknown>) => {
        const loc = la.seller_locations as { name: string } | { name: string }[] | null;
        if (Array.isArray(loc)) return loc[0]?.name ?? "";
        return loc?.name ?? "";
      })
      .filter(Boolean);

    // Send email via Resend (if configured)
    if ((action === "send_email" || action === "resend") && resend) {
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
        const roleName = staff.role.charAt(0).toUpperCase() + staff.role.slice(1);

        const { error: emailError } = await resend.emails.send({
          from: `${escapeHtml(storeName)} <${fromEmail}>`,
          to: [staff.email],
          subject: `You're invited to join ${storeName} on Shopora`,
          html: buildInviteEmailHtml({
            staffName: staff.name,
            storeName,
            role: roleName,
            locations: locationNames,
            inviteUrl,
            expiresAt,
          }),
        });

        if (emailError) {
          return NextResponse.json({
            success: true,
            inviteUrl,
            storeName,
            emailSent: false,
            emailError: emailError.message,
          });
        }

        return NextResponse.json({
          success: true,
          inviteUrl,
          storeName,
          emailSent: true,
        });
      } catch {
        return NextResponse.json({
          success: true,
          inviteUrl,
          storeName,
          emailSent: false,
          emailError: "Failed to send email. Share the invite link manually.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      inviteUrl,
      storeName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Branded HTML email template ──
function buildInviteEmailHtml(params: {
  staffName: string;
  storeName: string;
  role: string;
  locations: string[];
  inviteUrl: string;
  expiresAt: string;
}): string {
  const { staffName: rawStaffName, storeName: rawStoreName, role, locations, inviteUrl, expiresAt } = params;
  const staffName = escapeHtml(rawStaffName);
  const storeName = escapeHtml(rawStoreName);
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const locationHtml =
    locations.length > 0
      ? `<tr>
          <td style="padding:4px 0;color:#64748b;font-size:14px;">Locations</td>
          <td style="padding:4px 0;text-align:right;font-size:14px;font-weight:600;color:#0f172a;">
            ${locations.map(l => escapeHtml(l)).join(", ")}
          </td>
        </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:28px;font-weight:800;color:#ff3f6c;letter-spacing:-0.5px;">Shopora</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;text-align:center;">
                Hi ${staffName}!
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;text-align:center;line-height:1.5;">
                You've been invited to join <strong style="color:#0f172a;">${storeName}</strong> as a team member on Shopora.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
                <tr>
                  <td style="padding:4px 0;color:#64748b;font-size:14px;">Store</td>
                  <td style="padding:4px 0;text-align:right;font-size:14px;font-weight:600;color:#0f172a;">${storeName}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#64748b;font-size:14px;">Role</td>
                  <td style="padding:4px 0;text-align:right;">
                    <span style="display:inline-block;background-color:${role === "Admin" ? "#f3e8ff" : role === "Manager" ? "#dbeafe" : "#f1f5f9"};color:${role === "Admin" ? "#7c3aed" : role === "Manager" ? "#2563eb" : "#475569"};font-size:12px;font-weight:600;padding:2px 10px;border-radius:12px;">
                      ${escapeHtml(role)}
                    </span>
                  </td>
                </tr>
                ${locationHtml}
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" style="display:inline-block;background-color:#ff3f6c;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 40px;border-radius:8px;letter-spacing:0.3px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5;">
                This invitation expires on <strong>${expiryDate}</strong>.<br/>
                If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Powered by <span style="color:#ff3f6c;font-weight:600;">Shopora</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
