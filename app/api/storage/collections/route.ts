import { NextResponse } from "next/server";
import { Collection } from "@/lib/types";
import { dataPaths, readJsonFile, writeJsonFile } from "@/lib/storage/file";

export async function GET() {
  const collections = await readJsonFile<Collection[]>(
    dataPaths.collections,
    [],
  );
  return NextResponse.json({ collections });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { collections?: Collection[] };

  if (!Array.isArray(body.collections)) {
    return NextResponse.json(
      { error: "Expected collections array." },
      { status: 400 },
    );
  }

  await writeJsonFile(dataPaths.collections, body.collections);
  return NextResponse.json({ ok: true });
}
