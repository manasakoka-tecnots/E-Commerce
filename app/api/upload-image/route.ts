import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/src/lib/supabase/server";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const productId = formData.get("productId") as string | null;
    const altText = formData.get("altText") as string | null;
    const isMain = formData.get("isMain") === "true";
    const order = parseInt(formData.get("order") as string) || 0;
    const saveToDb = formData.get("saveToDb") === "true";

    if (!file || !productId) {
      return NextResponse.json(
        { error: "Missing file or productId" },
        { status: 400 }
      );
    }

    // ── Path traversal prevention ──
    if (!SAFE_ID_PATTERN.test(productId)) {
      return NextResponse.json(
        { error: "Invalid productId format" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not supported. Use JPEG, PNG, WebP, or AVIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    if (!/^[a-z0-9]+$/.test(ext)) {
      return NextResponse.json({ error: "Invalid file extension" }, { status: 400 });
    }
    const safeName = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      productId
    );

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadDir, safeName);
    await writeFile(filePath, buffer);

    const storagePath = `uploads/${productId}/${safeName}`;

    if (saveToDb && supabaseAdmin) {
      const { error: dbError } = await supabaseAdmin
        .from("product_images")
        .insert({
          product_id: productId,
          storage_path: storagePath,
          alt_text: altText || null,
          is_representative: isMain,
          order: order,
        });

      if (dbError) {
        console.error("Failed to save image record:", dbError.message);
        return NextResponse.json({ storagePath, dbWarning: dbError.message });
      }
    }

    return NextResponse.json({ storagePath });
  } catch {
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
