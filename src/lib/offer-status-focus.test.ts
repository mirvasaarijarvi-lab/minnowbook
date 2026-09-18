import { describe, it, expect, beforeEach } from "vitest";

import {
  decideOfferStatusFocus,
  focusOfferStatusPanel,
} from "./offer-status-focus";

function panelEl(): HTMLElement {
  const el = document.createElement("div");
  el.tabIndex = -1;
  document.body.appendChild(el);
  return el;
}

function buttonEl(): HTMLButtonElement {
  const el = document.createElement("button");
  document.body.appendChild(el);
  return el;
}

describe("decideOfferStatusFocus", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("skips when there is no panel", () => {
    expect(
      decideOfferStatusFocus({
        panel: null,
        active: buttonEl(),
        trigger: null,
      }),
    ).toBe("skip-no-panel");
  });

  it("focuses when the confirm button was removed and focus was dropped", () => {
    const panel = panelEl();
    const trigger = buttonEl();
    trigger.remove();
    expect(
      decideOfferStatusFocus({ panel, active: document.body, trigger }),
    ).toBe("focus");
  });

  it("focuses when focus is still on the confirm button", () => {
    const panel = panelEl();
    const trigger = buttonEl();
    expect(decideOfferStatusFocus({ panel, active: trigger, trigger })).toBe(
      "focus",
    );
  });

  it("focuses when the focused element is no longer in the document", () => {
    const panel = panelEl();
    const gone = buttonEl();
    gone.remove();
    expect(decideOfferStatusFocus({ panel, active: gone, trigger: null })).toBe(
      "focus",
    );
  });

  it("does not re-focus when focus is already inside the panel", () => {
    const panel = panelEl();
    const inner = document.createElement("button");
    panel.appendChild(inner);
    expect(
      decideOfferStatusFocus({ panel, active: panel, trigger: null }),
    ).toBe("skip-already-inside");
    expect(
      decideOfferStatusFocus({ panel, active: inner, trigger: null }),
    ).toBe("skip-already-inside");
  });

  it("does not steal focus the user moved elsewhere", () => {
    const panel = panelEl();
    const trigger = buttonEl();
    const search = document.createElement("input");
    document.body.appendChild(search);
    expect(decideOfferStatusFocus({ panel, active: search, trigger })).toBe(
      "skip-user-moved",
    );
  });
});

describe("focusOfferStatusPanel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("moves focus to the panel when the decision allows it", () => {
    const panel = panelEl();
    const trigger = buttonEl();
    expect(focusOfferStatusPanel({ panel, active: trigger, trigger })).toBe(
      true,
    );
    expect(document.activeElement).toBe(panel);
  });

  it("leaves focus alone when the user moved it", () => {
    const panel = panelEl();
    const search = document.createElement("input");
    document.body.appendChild(search);
    search.focus();
    expect(
      focusOfferStatusPanel({ panel, active: search, trigger: null }),
    ).toBe(false);
    expect(document.activeElement).toBe(search);
  });
});
