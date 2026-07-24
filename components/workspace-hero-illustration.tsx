import Image from "next/image";

export function WorkspaceHeroIllustration() {
  return (
    <div aria-hidden="true" className="pointer-events-none hidden h-44 w-80 shrink-0 lg:block">
      <Image
        src="/images/workspaces-hero.webp"
        alt=""
        width={480}
        height={320}
        priority
        className="h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(109,61,245,0.18)]"
      />
    </div>
  );
}
