/**
 * The phones' rail: a hairline down the left plus the accent line TimelineMotion draws with DrawSVG,
 * from the first node's centre, fading out below the last entry (the present goes on). The SVG is
 * 1px wide and stretched (preserveAspectRatio="none"), so its length is always 100 user units: the
 * drawn proportion survives any reflow without re-measuring. Wider screens use TimelineAxis.
 */
export function TimelineTrack() {
  return (
    <div
      aria-hidden
      data-tl-track="y"
      className="pointer-events-none absolute top-[7.5px] bottom-0 left-[5px] w-px [mask-image:linear-gradient(to_bottom,black_calc(100%-8rem),transparent)] md:hidden"
    >
      <div className="absolute inset-0 bg-line" />
      <svg
        data-tl-svg
        data-reveal
        className="absolute inset-0 size-full"
        viewBox="0 0 1 100"
        preserveAspectRatio="none"
        focusable="false"
      >
        <line data-tl-line x1="0.5" y1="0" x2="0.5" y2="100" strokeWidth="1" className="stroke-accent-ink" />
      </svg>
    </div>
  );
}
