import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const STORE_PATH = path.join(process.cwd(), "data", "runs.json");

async function readAll(): Promise<unknown[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const entry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...body,
    };

    try {
      await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
      const existing = await readAll();
      existing.unshift(entry);
      await fs.writeFile(STORE_PATH, JSON.stringify(existing, null, 2));
    } catch (err) {
      // Read-only filesystems (e.g. Vercel) — fall back to log only.
      console.warn("Run log not persisted to disk:", err);
    }

    return NextResponse.json({ id: entry.id, ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json(await readAll());
}
