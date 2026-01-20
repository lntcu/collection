import { NextResponse } from "next/server";
import { TagDefinition } from "@/lib/types";
import { dataPaths, readJsonFile, writeJsonFile } from "@/lib/storage/file";

export async function GET() {
  const tags = await readJsonFile<TagDefinition[]>(dataPaths.tags, []);
  return NextResponse.json({ tags });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { tags?: TagDefinition[] };

  if (!Array.isArray(body.tags)) {
    return NextResponse.json(
      { error: "Expected tags array." },
      { status: 400 },
    );
  }

  await writeJsonFile(dataPaths.tags, body.tags);
  return NextResponse.json({ ok: true });
}
