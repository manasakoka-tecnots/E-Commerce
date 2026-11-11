import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getUserSupabase(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const supabase = getUserSupabase(token);

    // Verify user identity and role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_uid", user.id)
      .single();
    if (!profile || !["seller", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await req.json();
    const { action, categoryId, name } = body;

    if (action === "add") {
      if (!name?.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      const insertData: Record<string, unknown> = { name: name.trim() };
      if (body.image_url !== undefined) insertData.image_url = body.image_url || null;
      const { data, error } = await supabase
        .from("categories")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, data });
    }

    if (action === "update") {
      if (!categoryId || !name?.trim()) {
        return NextResponse.json({ error: "Category ID and name are required" }, { status: 400 });
      }
      const updateData: Record<string, unknown> = { name: name.trim() };
      if (body.image_url !== undefined) updateData.image_url = body.image_url || null;
      const { error } = await supabase
        .from("categories")
        .update(updateData)
        .eq("id", categoryId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      if (!categoryId) {
        return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
      }
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
