import { site } from "@/content/site";

function ArrowDown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 4.5v15M5.5 13l6.5 6.5 6.5-6.5" />
    </svg>
  );
}

/**
 * Large cut-corner download button. Its ::before stretches over the parent tile (which must be
 * `relative`), so the whole card is the hit area; hovering anywhere on the card fills the button.
 */
export function ResumeLink() {
  return (
    <a
      href={site.links.resume}
      download
      aria-label="Download résumé (PDF)"
      className="group/dl inline-flex shrink-0 before:absolute before:inset-0 before:content-['']"
    >
      <span className="grid size-16 chamfer-outline place-items-center overflow-hidden text-fg transition-colors duration-500 ease-out [--cut:0.875rem] group-hover/tile:text-on-accent group-hover/tile:[--outline:transparent] group-focus-visible/dl:text-on-accent group-focus-visible/dl:[--outline:transparent] lg:size-20 lg:[--cut:1rem]">
        <span
          aria-hidden
          className="chamfer absolute inset-0 scale-0 bg-accent transition duration-500 ease-out group-hover/tile:scale-100 group-focus-visible/dl:scale-100 motion-reduce:scale-100 motion-reduce:opacity-0 motion-reduce:group-hover/tile:opacity-100 motion-reduce:group-focus-visible/dl:opacity-100"
        />
        <span className="relative size-6 overflow-hidden lg:size-7">
          <ArrowDown className="size-full transition-transform duration-500 ease-out motion-safe:group-hover/tile:translate-y-full" />
          <ArrowDown className="absolute inset-0 size-full -translate-y-full transition-transform duration-500 ease-out motion-safe:group-hover/tile:translate-y-0 motion-reduce:hidden" />
        </span>
      </span>
    </a>
  );
}
