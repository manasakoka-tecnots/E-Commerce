import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Upload an image for a category or brand.
 * Saves to public/uploads/{entityType}/{filename}
 * Returns the public path.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string | null; // "categories" or "brands"

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!entityType || !["categories", "brands"].includes(entityType)) {
      return NextResponse.json({ error: "entityType must be 'categories' or 'brands'" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not supported. Use JPEG, PNG, WebP, AVIF, or SVG." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 5 MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
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
