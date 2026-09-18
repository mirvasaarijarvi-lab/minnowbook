/**
 * Consistency check between the offer form's kitchen preview and the kitchen
 * order lines an accepted offer actually writes.
 *
 * The preview staff see and the rows the confirmation writes come from the same
 * rules, so they must always agree. This module makes that agreement checkable
 * anywhere: in tests, in the offer form, and around the confirm action. It
 * reports which menu field disagrees and how, so a drift can never pass
 * silently as "the preview said something else".
 */

import {
  buildKitchenOrderRows,
  type KitchenOrderRow,
} from "./offer-kitchen-orders";
import {
  buildKitchenPreview,
  type PreviewLegInput,
} from "./offer-kitchen-preview";

export type KitchenMismatchKind =
  | "missing-lines"
  | "extra-lines"
  | "wrong-target"
  | "wrong-line"
  | "wrong-order";

export interface KitchenMismatch {
  /** Menu field (function) the problem belongs to, or the receiving one. */
  legKey: string;
  legName: string;
  kind: KitchenMismatchKind;
  /** Plain description, safe to log. */
  detail: string;
}

export interface KitchenConsistencyResult {
  ok: boolean;
  mismatches: KitchenMismatch[];
  /** Lines the preview promised, in preview order. */
  previewedLines: number;
  /** Rows the confirmation would write. */
  writtenLines: number;
}

/** One comparable line: what it is and whose kitchen order it lands on. */
interface Line {
  target: string;
  item: string;
  quantity: number;
  category: string;
  notes: string | null;
}

const fromRow = (row: KitchenOrderRow): Line => ({
  target: row.reservation_id,
  item: row.item_name,
  quantity: row.quantity,
  category: row.category,
  notes: row.notes,
});

const describe = (line: Line) =>
  `${line.quantity} x ${line.item} [${line.category}]${line.notes ? ` (${line.notes})` : ""} -> ${line.target}`;

/**
 * Compare the preview of every menu field with the rows an accepted offer
 * writes. Returns ok: true only when each field's lines, their order, their
 * details and their receiving kitchen order match exactly.
 *
 * `rowsOverride` lets a caller (and the tests) check a concrete set of rows,
 * for example the rows actually about to be inserted, instead of recomputing
 * them from the menu fields.
 */
export function checkKitchenPreviewMatchesOutput(
  tenantId: string,
  inputs: PreviewLegInput[],
  rowsOverride?: KitchenOrderRow[],
): KitchenConsistencyResult {
  const preview = buildKitchenPreview(inputs);
  const rows =
    rowsOverride ??
    buildKitchenOrderRows(
      tenantId,
      inputs.map((i) => ({
        reservationId: i.key,
        reservationType: i.reservationType,
        menu: i.menu,
      })),
    );
  const nameByKey = new Map(inputs.map((i) => [i.key, i.name]));
  const mismatches: KitchenMismatch[] = [];

  // Expected lines, per field, exactly as the preview shows them.
  const expectedByLeg = new Map<string, Line[]>();
  for (const leg of preview.legs) {
    if (!leg.targetKey) continue;
    expectedByLeg.set(
      leg.key,
      leg.lines.map((l) => ({
        target: leg.targetKey as string,
        item: l.item_name,
        quantity: l.quantity,
        category: l.category,
        notes: l.notes,
      })),
    );
  }

  // Written lines, grouped by the kitchen order they land on, in write order.
  const writtenByTarget = new Map<string, Line[]>();
  for (const row of rows) {
    const line = fromRow(row);
    writtenByTarget.set(line.target, [
      ...(writtenByTarget.get(line.target) ?? []),
      line,
    ]);
  }

  // Walk each field's expectation against the written stream of its target.
  const cursor = new Map<string, number>();
  for (const leg of preview.legs) {
    const legName = leg.name;
    const expected = expectedByLeg.get(leg.key) ?? [];
    if (expected.length === 0) {
      // Nothing promised: nothing may be attributed to this field.
      continue;
    }
    const target = expected[0].target;
    const written = writtenByTarget.get(target) ?? [];
    let at = cursor.get(target) ?? 0;

    for (const want of expected) {
      const got = written[at];
      if (!got) {
        mismatches.push({
          legKey: leg.key,
          legName,
          kind: "missing-lines",
          detail: `the preview shows ${describe(want)} but nothing was written`,
        });
        at += 1;
        continue;
      }
      if (got.target !== want.target) {
        mismatches.push({
          legKey: leg.key,
          legName,
          kind: "wrong-target",
          detail: `the preview sends ${describe(want)} to ${nameByKey.get(want.target) ?? want.target} but it was written to ${nameByKey.get(got.target) ?? got.target}`,
        });
      } else if (
        got.item !== want.item ||
        got.quantity !== want.quantity ||
        got.category !== want.category ||
        (got.notes ?? null) !== (want.notes ?? null)
      ) {
        mismatches.push({
          legKey: leg.key,
          legName,
          kind: "wrong-line",
          detail: `the preview shows ${describe(want)} but ${describe(got)} was written`,
        });
      }
      at += 1;
    }
    cursor.set(target, at);
  }

  // Anything written beyond what the preview promised is unexplained output.
  for (const [target, written] of writtenByTarget) {
    const used = cursor.get(target) ?? 0;
    for (const extra of written.slice(used)) {
      mismatches.push({
        legKey: target,
        legName: nameByKey.get(target) ?? target,
        kind: "extra-lines",
        detail: `${describe(extra)} was written but the preview does not show it`,
      });
    }
  }

  if (mismatches.length === 0 && rows.length !== preview.totalLines) {
    mismatches.push({
      legKey: "*",
      legName: "*",
      kind: "wrong-order",
      detail: `the preview promises ${preview.totalLines} line(s) but ${rows.length} were written`,
    });
  }

  return {
    ok: mismatches.length === 0,
    mismatches,
    previewedLines: preview.totalLines,
    writtenLines: rows.length,
  };
}

/** One-line summary of a failed check, for logs and test failures. */
export function formatKitchenMismatches(
  result: KitchenConsistencyResult,
): string {
  if (result.ok) return "";
  return result.mismatches
    .map((m) => `${m.legName} [${m.kind}]: ${m.detail}`)
    .join("; ");
}
