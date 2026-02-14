import { db } from "@/lib/db";

export async function getDefaultUserId() {
  const existing = await db.user.findFirst();
  if (existing) {
    return existing.id;
  }

  const created = await db.user.create({
    data: {
      name: "Default User",
    },
  });

  return created.id;
}
