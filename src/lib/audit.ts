import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export async function audit(action: string, entity: string, entityId?: string, detail?: string) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return;
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, detail } }).catch(() => {});
}
