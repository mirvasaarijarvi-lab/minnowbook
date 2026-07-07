import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/contexts/I18nContext";
import {
  posts,
  buildBlogPostJsonLd,
  type BlogAuthor,
} from "@/lib/blogJsonLd";
import SEOHead from "@/components/SEOHead";

/**
 * Superadmin-only tool: preview the exact JSON-LD array that /blog/:slug
 * will emit, before publishing. Renders the shared buildBlogPostJsonLd so
 * what you see here is byte-identical to production.
 *
 * Draft overrides (updatedKey, authors JSON) let you dry-run edits
 * without changing the posts map.
 */
const BlogJsonLdPreview = () => {
  const t = useT();
  const slugs = useMemo(() => Object.keys(posts).sort(), []);
  const [slug, setSlug] = useState<string>(slugs[0] ?? "");
  const [updatedOverride, setUpdatedOverride] = useState<string>("");
  const [authorsText, setAuthorsText] = useState<string>("");

  const post = posts[slug];

  const authorsParse = useMemo(() => {
    const trimmed = authorsText.trim();
    if (!trimmed) return { authors: undefined as BlogAuthor[] | undefined, error: null as string | null };
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        return { authors: undefined, error: "authors override must be a JSON array" };
      }
      return { authors: parsed as BlogAuthor[], error: null };
    } catch (e) {
      return { authors: undefined, error: (e as Error).message };
    }
  }, [authorsText]);

  const jsonLd = useMemo(() => {
    if (!post) return null;
    return buildBlogPostJsonLd(post, (k) => t(k as any), {
      updatedKey: updatedOverride.trim() || undefined,
      authors: authorsParse.authors,
    });
  }, [post, t, updatedOverride, authorsParse.authors]);

  const jsonText = useMemo(
    () => (jsonLd ? JSON.stringify(jsonLd, null, 2) : ""),
    [jsonLd],
  );

  const previewUrl = post
    ? `https://mimmobook.com/blog/${post.slug}`
    : "";
  const richResultsUrl = previewUrl
    ? `https://search.google.com/test/rich-results?url=${encodeURIComponent(previewUrl)}`
    : "";
  const schemaValidatorUrl = previewUrl
    ? `https://validator.schema.org/#url=${encodeURIComponent(previewUrl)}`
    : "";

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      toast.success("JSON-LD copied to clipboard");
    } catch {
      toast.error("Copy failed, select the text manually");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Blog JSON-LD Preview"
        description="Superadmin tool to preview blog post JSON-LD before publishing."
        path="/superadmin/blog-json-ld"
      />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link
          to="/superadmin"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Superadmin
        </Link>

        <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
          Blog JSON-LD Preview
        </h1>
        <p className="text-muted-foreground mb-8">
          Renders the exact JSON-LD array that /blog/:slug will ship. Optional draft
          overrides let you dry-run <code>updatedKey</code> or a different authors list.
        </p>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <div>
            <Label htmlFor="slug-select">Post</Label>
            <Select value={slug} onValueChange={setSlug}>
              <SelectTrigger id="slug-select" className="mt-1.5">
                <SelectValue placeholder="Select a post" />
              </SelectTrigger>
              <SelectContent>
                {slugs.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {post && (
              <p className="text-xs text-muted-foreground mt-2">
                {post.seoTitle}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="updated-override">
              Draft <code>updatedKey</code> (optional)
            </Label>
            <Input
              id="updated-override"
              placeholder="YYYY-MM-DD"
              value={updatedOverride}
              onChange={(e) => setUpdatedOverride(e.target.value)}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Leave blank to use the post's own <code>updatedKey</code> (falls back
              to <code>dateKey</code>).
            </p>
          </div>
        </div>

        <div className="mb-6">
          <Label htmlFor="authors-override">
            Draft authors override (optional JSON array)
          </Label>
          <Textarea
            id="authors-override"
            placeholder='[{"name":"Anna Virtanen","url":"https://mimmobook.com/team/anna"}]'
            value={authorsText}
            onChange={(e) => setAuthorsText(e.target.value)}
            className="mt-1.5 font-mono text-xs h-24"
          />
          {authorsParse.error && (
            <p className="text-xs text-destructive mt-2">
              {authorsParse.error}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Empty = use the post's own <code>authors</code> (falls back to the
            default Organization).
          </p>
        </div>

        {post && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={copyJson}>
              <Copy className="h-4 w-4 mr-2" />
              Copy JSON-LD
            </Button>
            <a href={richResultsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Google Rich Results Test
              </Button>
            </a>
            <a href={schemaValidatorUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Schema Markup Validator
              </Button>
            </a>
            <Link to={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open live post
              </Button>
            </Link>
          </div>
        )}

        {!post ? (
          <p className="text-muted-foreground">Select a post to preview.</p>
        ) : (
          <pre
            data-testid="jsonld-output"
            className="bg-muted text-foreground text-xs md:text-sm p-4 rounded-lg overflow-auto max-h-[70vh] border"
          >
            {jsonText}
          </pre>
        )}
      </div>
    </div>
  );
};

export default BlogJsonLdPreview;
