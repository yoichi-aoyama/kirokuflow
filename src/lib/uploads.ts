import { promises as fs } from "fs";
import path from "path";

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function ensureUploadsDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}
