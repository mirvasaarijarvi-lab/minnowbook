import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import SupportChatWidget from "@/components/SupportChatWidget";
import SEOHead from "@/components/SEOHead";
import { useT } from "@/contexts/I18nContext";
import { posts, buildBlogPostJsonLd } from "@/lib/blogJsonLd";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const t = useT();
  const post = slug ? posts[slug] : undefined;

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <MarketingHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-serif font-bold text-foreground mb-4">Post not found</h1>
            <Link to="/blog">
              <Button variant="outline">Back to Blog</Button>
            </Link>
          </div>
        </div>
        <MarketingFooter />
      </div>
    );
  }

  const jsonLd = buildBlogPostJsonLd(post, (k) => t(k as any));



  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title={post.seoTitle}
        description={post.seoDescription}
        path={`/blog/${post.slug}`}
        type="article"
        image={post.image}
        imageAlt={post.imageAlt}
        jsonLd={jsonLd}
      />


      <MarketingHeader />

      <article className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
              <ArrowLeft className="h-4 w-4" />
              {t("blog.backToBlog")}
            </Link>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {post.dateKey}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {post.readTime}
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground leading-tight mb-8">
              {t(post.titleKey as any)}
            </h1>

            <div className="prose prose-lg max-w-none">
              {post.contentKeys.map((key, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed mb-6">
                  {t(key as any)}
                </p>
              ))}
            </div>

            <div className="mt-12 p-8 rounded-xl bg-primary/5 text-center">
              <h3 className="font-serif text-xl font-bold text-foreground mb-3">{t("blog.postCta")}</h3>
              <Link to="/signup">
                <Button variant="hero" size="lg">{t("common.startFreeTrial")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </article>

      <MarketingFooter />
      <SupportChatWidget />
    </div>
  );
};

export default BlogPost;
