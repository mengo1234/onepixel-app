import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { Localized } from "./dashboard-language";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <Localized><header className="flex flex-col gap-6 border-b border-white/8 pb-7 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#d1e66a]">
          {eyebrow}
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-none tracking-[-0.05em] text-[#f2f3ed] md:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-[62ch] text-sm leading-6 text-[#929a98]">{description}</p>
      </div>
      {action && (
        <Link
          href={action.href}
          className="image-skin inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-[#0b0d0e] transition duration-300 hover:-translate-y-0.5 active:translate-y-px"
          style={{ borderImageSource: "url('/buttons/primary-signal-v1.png')" }}
        >
          {action.label}
          <ArrowRightIcon size={17} weight="bold" />
        </Link>
      )}
    </header></Localized>
  );
}
