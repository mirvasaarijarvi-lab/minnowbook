import { describe, it, expect } from "vitest";
import DOMPurify from "dompurify";

describe("XSS Prevention - Security Regression Tests", () => {
  describe("DOMPurify sanitization", () => {
    it("strips script tags", () => {
      const dirty = '<script>alert("xss")</script><p>Safe</p>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain("<script>");
      expect(clean).toContain("<p>Safe</p>");
    });

    it("strips event handlers", () => {
      const dirty = '<img src="x" onerror="alert(1)" />';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain("onerror");
    });

    it("strips javascript: URLs", () => {
      const dirty = '<a href="javascript:alert(1)">click</a>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain("javascript:");
    });

    it("strips dangerous data: URIs when using ALLOWED_URI_REGEXP", () => {
      const dirty = '<a href="data:text/html,<script>alert(1)</script>">click</a>';
      // DOMPurify strips dangerous href schemes on anchors by default
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toMatch(/href="data:/);
    });

    it("strips iframe tags", () => {
      const dirty = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain("<iframe");
      expect(clean).toContain("<p>Safe</p>");
    });

    it("preserves safe HTML", () => {
      const safe = '<p>Hello <strong>world</strong></p>';
      expect(DOMPurify.sanitize(safe)).toBe(safe);
    });

    it("strips SVG-based XSS", () => {
      const dirty = '<svg onload="alert(1)"><circle r="10"/></svg>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain("onload");
    });

    it("strips inline styles when FORBID_ATTR is used", () => {
      const dirty = '<div style="background:expression(alert(1))">test</div>';
      const clean = DOMPurify.sanitize(dirty, { FORBID_ATTR: ["style"] });
      expect(clean).not.toContain("style");
      expect(clean).toContain("test");
    });
  });
});
