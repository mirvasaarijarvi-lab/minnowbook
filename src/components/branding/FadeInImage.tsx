/**
 * Image wrapper that crossfades from a placeholder (skeleton) to the
 * decoded image once it has finished loading. The placeholder and the
 * image are stacked absolutely inside a positioned wrapper so the
 * footprint is reserved by the wrapper from the very first paint,
 * which prevents the layout shift that otherwise happens when the
 * skeleton element is unmounted and replaced by the real <img>.
 *
 * Used by the public booking header for the tenant logo and hero
 * image, both of which arrive asynchronously through
 * `useBrandingSignedUrlState`.
 *
 * Accessibility:
 *  - The wrapper carries `role="img"` plus the consumer-provided
 *    `alt` text as its accessible name, so the whole slot reads as a
 *    single image to assistive tech regardless of which layer is
 *    currently visible.
 *  - While loading, the wrapper sets `aria-busy="true"` and the inner
 *    `<img>` is hidden from the accessibility tree (`aria-hidden`,
 *    `role="presentation"`). The skeleton placeholder is also
 *    `aria-hidden`, so screen readers don't see two competing nodes
 *    or announce the decorative pulse.
 *  - Optional `loadingLabel` mounts a `aria-live="polite"` status node
 *    (visually hidden) that announces e.g. "Loading logo" while the
 *    image resolves. Opt-in to avoid spamming AT for purely decorative
 *    images.
 *  - Decorative usage (`alt=""`) keeps the slot out of the AT tree
 *    entirely by collapsing to `role="presentation"`.
 */
import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FadeInImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Rendered underneath the image while it decodes; faded out on load. */
  placeholder?: ReactNode;
  /** Class applied to the positioned wrapper that reserves layout space. */
  wrapperClassName?: string;
  /** Fade duration in ms. Defaults to 300. */
  fadeDurationMs?: number;
  /**
   * Final opacity once the image has loaded. Use a value below 1 for
   * decorative overlays (e.g. a hero behind tinted text). Defaults to 1.
   */
  loadedOpacity?: number;
  /**
   * If provided, mounts a visually-hidden `aria-live="polite"` status
   * node that announces this label while the image is loading (e.g.
   * "Loading tenant logo"). Cleared once the image is ready so the
   * announcement only fires for the loading transition.
   */
  loadingLabel?: string;
}

export function FadeInImage({
  placeholder,
  wrapperClassName,
  fadeDurationMs = 300,
  loadedOpacity = 1,
  loadingLabel,
  className,
  src,
  alt,
  onLoad,
  onError,
  style,
  ...imgProps
}: FadeInImageProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset the fade whenever the source changes so a re-mint after a
  // retry crossfades again instead of popping the new bytes in.
  useEffect(() => {
    setLoaded(false);
    // If the browser already has the image cached, `onLoad` may not
    // fire on remount. Detect that synchronously via `complete`.
    const node = imgRef.current;
    if (node && node.complete && node.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const isBusy = !loaded && !!src;
  const isDecorative = alt === "";
  // Promote the wrapper to the single accessible image node when the
  // consumer supplied a non-empty `alt`. For decorative slots we keep
  // the wrapper out of the tree entirely so AT users don't hear an
  // empty "image" announcement.
  const wrapperRole = isDecorative ? "presentation" : "img";
  const wrapperAriaLabel = isDecorative ? undefined : alt;

  return (
    <span
      className={cn("relative inline-block", wrapperClassName)}
      role={wrapperRole}
      aria-label={wrapperAriaLabel}
      aria-busy={isBusy || undefined}
    >
      {placeholder ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 transition-opacity ease-out",
            loaded ? "opacity-0" : "opacity-100",
          )}
          style={{ transitionDuration: `${fadeDurationMs}ms` }}
        >
          {placeholder}
        </span>
      ) : null}
      <img
        ref={imgRef}
        src={src}
        // The wrapper now owns the accessible name. Always hide the
        // raw <img> from AT so we don't double-announce, and so the
        // invisible (opacity 0) image during loading isn't read out.
        alt=""
        aria-hidden="true"
        role="presentation"
        {...imgProps}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setLoaded(false);
          onError?.(e);
        }}
        className={cn("transition-opacity ease-out", className)}
        style={{
          ...style,
          transitionDuration: `${fadeDurationMs}ms`,
          opacity: loaded ? loadedOpacity : 0,
        }}
      />
      {loadingLabel ? (
        <span
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {isBusy ? loadingLabel : ""}
        </span>
      ) : null}
    </span>
  );
}
