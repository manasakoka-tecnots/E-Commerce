import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { supabaseAdmin } from "@/src/lib/supabase/server";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  try {
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

    // Save to database using admin client (bypasses RLS)
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
        // Image is still saved to disk, return success with warning
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
