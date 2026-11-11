import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (token_hash && type) {
    // Email confirmation via token hash (magic link / email confirm)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "email",
    });

    if (error) {
      return NextResponse.redirect(
        `${siteUrl}/auth/login?error=${encodeURIComponent("Email verification failed. Please try again or request a new link.")}`
      );
    }

    // Verification successful — redirect to login with success message
    // Preserve the `next` param so sellers land back on /seller/register after login
    const loginUrl = new URL(`${siteUrl}/auth/login`);
    loginUrl.searchParams.set("verified", "true");
    if (next && next !== "/") {
      loginUrl.searchParams.set("redirect", next);
    }
    return NextResponse.redirect(loginUrl.toString());
  }

  if (code) {
    // PKCE flow — exchange code for session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  // Fallback — redirect to login
  return NextResponse.redirect(`${siteUrl}/auth/login`);
}
