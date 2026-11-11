import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Returns a mapping of productId -> first image path for all locally uploaded product images.
 * GET /api/product-uploads
 */
export async function GET() {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const mapping: Record<string, string> = {};

  try {
    if (fs.existsSync(uploadsDir)) {
      const productDirs = fs.readdirSync(uploadsDir);
      for (const productId of productDirs) {
        const productDir = path.join(uploadsDir, productId);
        if (fs.statSync(productDir).isDirectory()) {
          const files = fs.readdirSync(productDir).filter((f) =>
            /\.(jpe?g|png|webp|avif)$/i.test(f)
          );
          if (files.length > 0) {
            mapping[productId] = `/uploads/${productId}/${files[0]}`;
          }
        }
      }
    }
  } catch {
    // Ignore filesystem errors
  }

  return NextResponse.json(mapping);
}
