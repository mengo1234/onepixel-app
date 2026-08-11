import { PlatformNav } from "@/components/platform-nav";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { emailCookie, roleCookie, sessionCookie } from "@/lib/control-plane";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  if (!cookieStore.has(sessionCookie)) redirect("/login");
  const role = cookieStore.get(roleCookie)?.value === "super_admin" ? "super_admin" : "organization_admin";
  const email = cookieStore.get(emailCookie)?.value ?? "regia@onepixel.app";
  return (
    <div className="min-h-[100dvh] bg-[#0b0d0e]">
      <PlatformNav role={role} email={email} />
      <main className="min-h-[100dvh] px-4 py-6 sm:px-6 lg:ml-[248px] lg:px-10 lg:py-9 xl:px-14">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
