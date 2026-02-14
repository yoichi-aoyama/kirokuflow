"use server";

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { ensureUploadsDir, UPLOAD_DIR } from "@/lib/uploads";

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

function normalizeDateInput(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatEntryForReport(entry: { createdAt: Date; text: string; workMinutes: number }) {
  const time = entry.createdAt.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const minuteLabel = `${entry.workMinutes}分`;
  return `[${time}] (${minuteLabel}) ${entry.text}`;
}

export async function createEntry(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  const file = formData.get("image");
  const workMinutesRaw = Number(formData.get("workMinutes") ?? 0);
  const workMinutes = Number.isFinite(workMinutesRaw)
    ? Math.max(0, Math.floor(workMinutesRaw))
    : 0;

  if (!text && !(file instanceof File && file.size > 0)) {
    return;
  }

  const userId = await getDefaultUserId();
  const entry = await db.entry.create({
    data: {
      userId,
      text: text || "(画像のみ)",
      workMinutes,
    },
  });

  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      throw new Error("画像ファイルのみアップロードできます。");
    }

    await ensureUploadsDir();

    const extension =
      path.extname(file.name).toLowerCase() ||
      IMAGE_MIME_TO_EXT[file.type] ||
      ".bin";
    const fileName = `${randomUUID()}${extension}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());

    await fs.writeFile(filePath, buffer);

    await db.attachment.create({
      data: {
        entryId: entry.id,
        url: `/uploads/${fileName}`,
        mimeType: file.type,
        size: file.size,
      },
    });
  }

  revalidatePath("/");
}

export async function createDailyReport(formData: FormData) {
  const dateValue = String(formData.get("date") ?? "");
  const summary = String(formData.get("summary") ?? "").trim();

  if (!dateValue || !summary) {
    return;
  }

  const userId = await getDefaultUserId();
  const date = normalizeDateInput(dateValue);
  const endExclusive = new Date(date);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const dayEntries = await db.entry.findMany({
    where: {
      userId,
      createdAt: {
        gte: date,
        lt: endExclusive,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
      text: true,
      workMinutes: true,
    },
  });

  const totalWorkMinutes = dayEntries.reduce(
    (acc, entry) => acc + entry.workMinutes,
    0,
  );
  const aggregatedEntries = dayEntries.map(formatEntryForReport).join("\n");

  await db.dailyReport.upsert({
    where: {
      userId_date: {
        userId,
        date,
      },
    },
    update: {
      summary,
      totalWorkMinutes,
      aggregatedEntries,
    },
    create: {
      userId,
      date,
      summary,
      totalWorkMinutes,
      aggregatedEntries,
    },
  });

  revalidatePath("/");
}
