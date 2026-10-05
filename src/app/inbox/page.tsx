import type { Metadata } from "next";
import { connection } from "next/server";
import { InboxList } from "@/components/inbox-list";
import { getInbox } from "@/lib/data";
import { age } from "@/lib/time";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  await connection();
  const { items, repos } = await getInbox();
  const fresh = items.filter((i) => i.status === "new").length;
  const ages = Object.fromEntries(items.map((i) => [i.id, age(i.receivedAt)]));

  return (
    <>
      <header className="mb-8 lg:mb-10">
        <h1 className="type-display text-[2.5rem] leading-none sm:text-[3rem]">Inbox</h1>
        <p className="mt-2 max-w-[62ch] text-ink-2">
          {fresh ? `${fresh} message${fresh === 1 ? "" : "s"} to file. ` : ""}
          Approvals move a loop forward, your own asks start a new one, and everything else goes on the repo’s timeline.
        </p>
      </header>
      <div className="max-w-3xl">
        <InboxList items={items} repos={repos.map(({ repo }) => ({ id: repo.id, code: repo.code, colorIndex: repo.colorIndex, name: repo.name, owner: repo.owner }))} ages={ages} />
      </div>
    </>
  );
}
