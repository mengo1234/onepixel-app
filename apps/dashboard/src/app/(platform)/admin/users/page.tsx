import { UserListIcon } from "@phosphor-icons/react/dist/ssr";
import { AdminUserActions } from "@/components/admin-user-actions";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { controlPlaneGet, roleCookie } from "@/lib/control-plane";

type User = { id: string; email: string; name: string; role: string; enabled: boolean; last_login_at?: string; organization_name?: string };

export default async function AdminUsersPage() {
  if ((await cookies()).get(roleCookie)?.value !== "super_admin") notFound();
  const users = await controlPlaneGet<User[]>("/v1/admin/users");
  return <div className="space-y-8"><PageHeader eyebrow="Super amministratore" title="Utenti e accessi." description="Un’unica vista su amministratori onePixel e account delle organizzazioni." /><div className="overflow-x-auto rounded-[28px] border border-white/10 bg-[#111516]"><table className="w-full min-w-[880px] text-left"><thead><tr className="border-b border-white/8 font-mono text-[9px] uppercase tracking-[.15em] text-[#697170]"><th className="px-5 py-4">Utente</th><th className="px-5 py-4">Organizzazione</th><th className="px-5 py-4">Ruolo</th><th className="px-5 py-4">Stato</th><th className="px-5 py-4">Ultimo accesso</th><th className="px-5 py-4">Azione</th></tr></thead><tbody className="divide-y divide-white/8">{users.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-xs text-[#737b79]">Nessun utente registrato.</td></tr>}{users.map((user) => <tr key={user.id} className="hover:bg-white/[.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white/5 text-[#d1e66a]"><UserListIcon size={16} /></span><div><p className="text-xs text-white">{user.name || "Senza nome"}</p><p className="mt-1 text-[10px] text-[#737b79]">{user.email}</p></div></div></td><td className="px-5 py-4 text-xs text-[#aab1af]">{user.organization_name ?? "onePixel"}</td><td className="px-5 py-4 font-mono text-[10px] text-[#aab1af]">{user.role}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] ${user.enabled ? "bg-[#d1e66a]/10 text-[#d1e66a]" : "bg-[#d17667]/10 text-[#d17667]"}`}>{user.enabled ? "Attivo" : "Disabilitato"}</span></td><td className="px-5 py-4 text-[10px] text-[#737b79]">{user.last_login_at ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(user.last_login_at)) : "Mai"}</td><td className="px-5 py-4"><AdminUserActions userId={user.id} enabled={user.enabled} /></td></tr>)}</tbody></table></div></div>;
}
