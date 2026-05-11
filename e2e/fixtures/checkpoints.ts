/**
 * Step-level diagnostics for flaky E2E flows.
 *
 * `captureCheckpoint` snapshots a screenshot, the current URL, and a JSON
 * blob describing the SPA's hydration state at a named checkpoint, then
 * attaches all three to the Playwright report. The intent is that when a
 * flaky cross-booking test fails, the report contains enough breadcrumbs
 * to pinpoint *which* step regressed without rerunning anything.
 */

import type { Page, TestInfo } from "@playwright/test";

export interface CheckpointDetails {
  /** Free-form extras to merge into the JSON state blob. */
  extra?: Record<string, unknown>;
  /** Take a full-page screenshot. Default true. */
  screenshot?: boolean;
  /** CSS selectors whose presence/visibility/text we should record. */
  probeSelectors?: string[];
}

export interface SpaProbe {
  selector: string;
  exists: boolean;
  visible: boolean;
  child_element_count: number | null;
  text_excerpt: string | null;
  error?: string;
}

/**
 * Sanitize a label into something safe for an attachment filename.
 */
function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64) || "checkpoint";
}

/**
 * Attach a screenshot + SPA wait state details for a named checkpoint.
 *
 * Never throws: if any individual capture fails (page closed, element gone,
 * etc.) the failure is recorded inside the attached JSON instead of being
 * propagated, so a checkpoint can never mask the real test failure.
 */
export async function captureCheckpoint(
  page: Page,
  testInfo: TestInfo,
  label: string,
  details: CheckpointDetails = {},
): Promise<void> {
  const stem = `${String(testInfo.annotations.length).padStart(2, "0")}-${slug(label)}`;
  const takeScreenshot = details.screenshot !== false;

  const state: Record<string, unknown> = {
    label,
    timestamp: new Date().toISOString(),
    test_retry: testInfo.retry,
    extra: details.extra ?? null,
  };

  let pageOpen = false;
  try {
    pageOpen = !!page && !page.isClosed();
  } catch {
    pageOpen = false;
  }
  state.page_open = pageOpen;

  if (pageOpen) {
    try {
      state.url = page.url();
    } catch (err) {
      state.url_error = err instanceof Error ? err.message : String(err);
    }

    try {
      state.title = await page.title();
    } catch (err) {
      state.title_error = err instanceof Error ? err.message : String(err);
    }

    try {
      state.spa = await page.evaluate(() => {
        const root = document.querySelector("#root");
        const main = document.querySelector("main");
        return {
          ready_state: document.readyState,
          root_child_count: root ? root.childElementCount : null,
          main_present: !!main,
          main_visible: !!(main && (main as HTMLElement).offsetParent !== null),
          h1_text: document.querySelector("h1")?.textContent?.trim() ?? null,
          location: window.location.href,
        };
      });
    } catch (err) {
      state.spa_error = err instanceof Error ? err.message : String(err);
    }

    if (details.probeSelectors?.length) {
      const probes: SpaProbe[] = [];
      for (const selector of details.probeSelectors) {
        try {
          const probe = await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            return {
              exists: !!el,
              visible: !!(el && el.offsetParent !== null),
              child_element_count: el ? el.childElementCount : null,
              text_excerpt: el ? (el.textContent ?? "").trim().slice(0, 200) : null,
            };
          }, selector);
          probes.push({ selector, ...probe });
        } catch (err) {
          probes.push({
            selector,
            exists: false,
            visible: false,
            child_element_count: null,
            text_excerpt: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      state.probes = probes;
    }

    if (takeScreenshot) {
      try {
        const buffer = await page.screenshot({ fullPage: true });
        await testInfo.attach(`${stem}.png`, {
          body: buffer,
          contentType: "image/png",
        });
      } catch (err) {
        state.screenshot_error = err instanceof Error ? err.message : String(err);
      }
    }
  } else {
    state.note = "skipped page-driven capture: no open page";
  }

  await testInfo.attach(`${stem}.json`, {
    body: JSON.stringify(state, null, 2),
    contentType: "application/json",
  });
  testInfo.annotations.push({
    type: "checkpoint",
    description: `${label} (${stem})`,
  });
}
