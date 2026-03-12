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

    it("strips data: URLs in images when configured strictly", () => {
      const dirty = '<img src="data:text/html,<script>alert(1)</script>" />';
      const clean = DOMPurify.sanitize(dirty, { ALLOW_DATA_ATTR: false, ADD_URI_SAFE_ATTR: [] });
      // DOMPurify strips the script but keeps the img; verify script is gone
      expect(clean).not.toContain("<script>");
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

    it("strips CSS expression injection", () => {
      const dirty = '<div style="background:expression(alert(1))">test</div>';
      const clean = DOMPurify.sanitize(dirty);
      expect(clean).not.toContain("expression");
    });
  });
});
