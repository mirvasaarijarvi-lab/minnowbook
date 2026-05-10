/**
 * Verifies the loading-state contract of <FadeInImage>: while the
 * signed URL is still being decoded the skeleton placeholder is
 * visible and the <img> is invisible + hidden from assistive tech.
 * Once `onLoad` fires, the placeholder fades out (opacity 0) and the
 * image fades in (opacity = loadedOpacity), with `aria-busy` cleared
 * on the wrapper.
 *
 * These tests are deliberately library-level (not a full PublicBooking
 * render) because the page mounts a large tree of unrelated providers
 * and the fade behavior is centralised in this one component.
 */
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FadeInImage } from "@/components/branding/FadeInImage";

function renderLogo(props?: Partial<React.ComponentProps<typeof FadeInImage>>) {
  return render(
    <FadeInImage
      src="https://example.test/logo.png"
      alt="Tenant logo"
      wrapperClassName="h-8 w-8"
      placeholder={
        <span data-testid="logo-skeleton" className="h-8 w-8 animate-pulse" />
      }
      {...props}
    />,
  );
}

describe("FadeInImage skeleton lifecycle", () => {
  it("renders the skeleton at full opacity while the image is loading", () => {
    renderLogo();
    const skeletonWrapper = screen.getByTestId("logo-skeleton").parentElement!;
    expect(skeletonWrapper).toHaveClass("opacity-100");
    expect(skeletonWrapper).not.toHaveClass("opacity-0");
  });

  it("keeps the underlying <img> invisible and aria-hidden while loading", () => {
    const { container } = renderLogo();
    const img = container.querySelector("img")!;
    expect(img).toHaveStyle({ opacity: "0" });
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  it("marks the wrapper aria-busy until the image has loaded", () => {
    renderLogo();
    const wrapper = screen.getByRole("img", { name: "Tenant logo" });
    expect(wrapper).toHaveAttribute("aria-busy", "true");
  });

  it("hides the skeleton and reveals the image after onLoad fires", () => {
    const { container } = renderLogo();
    const img = container.querySelector("img")!;
    const skeletonWrapper = screen.getByTestId("logo-skeleton").parentElement!;

    fireEvent.load(img);

    expect(skeletonWrapper).toHaveClass("opacity-0");
    expect(skeletonWrapper).not.toHaveClass("opacity-100");
    expect(img).toHaveStyle({ opacity: "1" });
    expect(
      screen.getByRole("img", { name: "Tenant logo" }),
    ).not.toHaveAttribute("aria-busy");
  });

  it("respects loadedOpacity for translucent overlays (e.g. hero)", () => {
    const { container } = render(
      <FadeInImage
        src="https://example.test/hero.jpg"
        alt=""
        loadedOpacity={0.4}
        placeholder={<span data-testid="hero-skeleton" />}
      />,
    );
    const img = container.querySelector("img")!;
    fireEvent.load(img);
    expect(img).toHaveStyle({ opacity: "0.4" });
  });

  it("re-shows the skeleton if the image errors after loading", () => {
    const { container } = renderLogo();
    const img = container.querySelector("img")!;
    fireEvent.load(img);

    fireEvent.error(img);

    const skeletonWrapper = screen.getByTestId("logo-skeleton").parentElement!;
    expect(skeletonWrapper).toHaveClass("opacity-100");
    expect(img).toHaveStyle({ opacity: "0" });
  });

  it("resets to the loading state when the src changes (retry / re-mint)", () => {
    const { container, rerender } = renderLogo();
    const initialImg = container.querySelector("img")!;
    fireEvent.load(initialImg);
    expect(initialImg).toHaveStyle({ opacity: "1" });

    rerender(
      <FadeInImage
        src="https://example.test/logo.png?retry=2"
        alt="Tenant logo"
        wrapperClassName="h-8 w-8"
        placeholder={
          <span data-testid="logo-skeleton" className="h-8 w-8 animate-pulse" />
        }
      />,
    );

    const nextImg = container.querySelector("img")!;
    expect(nextImg).toHaveStyle({ opacity: "0" });
    const skeletonWrapper = screen.getByTestId("logo-skeleton").parentElement!;
    expect(skeletonWrapper).toHaveClass("opacity-100");
  });
});
