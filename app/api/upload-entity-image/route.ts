import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// SVG removed from allowed types to prevent stored XSS
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

export async function POST(request: NextRequest) {
  try {
    // ── Authentication ──
    const authHeader = request.headers.get("authorization");
    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getUserSupabase(jwt);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // ── Authorization: Only sellers, admins, and staff can upload ──
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("auth_uid", user.id)
      .maybeSingle();

    if (!profile || !["seller", "admin"].includes(profile.role)) {
      const { data: staffRecord } = await supabase
        .from("seller_staff")
        .select("id")
        .eq("profile_id", profile?.id ?? "")
        .eq("status", "active")
        .maybeSingle();

      if (!staffRecord) {
        return NextResponse.json({ error: "Not authorized to upload images" }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!entityType || !["categories", "brands"].includes(entityType)) {
      return NextResponse.json({ error: "entityType must be 'categories' or 'brands'" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not supported. Use JPEG, PNG, WebP, or AVIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 5 MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    if (!/^[a-z0-9]+$/.test(ext)) {
      return NextResponse.json({ error: "Invalid file extension" }, { status: 400 });
    }
    const safeName = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", entityType);

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadDir, safeName);
    await writeFile(filePath, buffer);

    const publicPath = `/uploads/${entityType}/${safeName}`;

    return NextResponse.json({ path: publicPath });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
