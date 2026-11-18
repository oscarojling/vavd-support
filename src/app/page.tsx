import { redirect } from "next/navigation";
import Panel from "@/components/Panel";
import { inloggadAnvandare } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Hem() {
  const anvandare = await inloggadAnvandare();
  if (!anvandare) redirect("/logga-in");
  return <Panel anvandare={anvandare} />;
}
