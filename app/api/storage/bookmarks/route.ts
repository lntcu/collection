import { NextResponse } from "next/server";
import { Bookmark } from "@/lib/types";
import { dataPaths, readJsonFile, writeJsonFile } from "@/lib/storage/file";

export async function GET() {
  const bookmarks = await readJsonFile<Bookmark[]>(dataPaths.bookmarks, []);
  return NextResponse.json({ bookmarks });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { bookmarks?: Bookmark[] };

  if (!Array.isArray(body.bookmarks)) {
    return NextResponse.json(
      { error: "Expected bookmarks array." },
      { status: 400 },
    );
  }

  await writeJsonFile(dataPaths.bookmarks, body.bookmarks);
  return NextResponse.json({ ok: true });
}
