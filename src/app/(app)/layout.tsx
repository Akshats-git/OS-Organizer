import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { getNetwork } from "@/lib/data";
import { requireAuth } from "@/lib/require-auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await connection();
  await requireAuth();
  const { groups, inboxCount } = await getNetwork();
  // The rail and the palette list repos under the program each one is aimed at.
  const lineGroups = groups.map((g) => ({
    key: g.key,
    label: g.label,
    repos: g.items.map((l) => ({ id: l.repo.id, slug: l.repo.slug, code: l.repo.code, colorIndex: l.repo.colorIndex, name: l.repo.name, owner: l.repo.owner })),
  }));

  return (
    <AppShell groups={lineGroups} inboxCount={inboxCount}>
      {children}
    </AppShell>
  );
}
