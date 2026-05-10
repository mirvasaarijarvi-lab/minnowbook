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
}

export function FadeInImage({
  placeholder,
  wrapperClassName,
  fadeDurationMs = 300,
  loadedOpacity = 1,
  className,
  src,
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

  const transitionStyle = { transitionDuration: `${fadeDurationMs}ms` };

  return (
    <span className={cn("relative inline-block", wrapperClassName)}>
      {placeholder ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 transition-opacity ease-out",
            loaded ? "opacity-0" : "opacity-100",
          )}
          style={transitionStyle}
        >
          {placeholder}
        </span>
      ) : null}
      <img
        ref={imgRef}
        src={src}
        {...imgProps}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setLoaded(false);
          onError?.(e);
        }}
        className={cn(
          "transition-opacity ease-out",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        style={transitionStyle}
      />
    </span>
  );
}
