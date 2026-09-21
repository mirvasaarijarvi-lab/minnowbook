import { createFileRoute } from "@tanstack/react-router";
import BlogPost from "@/pages/BlogPost";
import { posts } from "@/lib/blogJsonLd";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogPost,
  head: ({ params }) => {
    const post = posts[params.slug];
    if (!post) {
      return routeHead({
        title: "Article Not Found, MimmoBook Blog",
        description:
          "This article could not be found. Browse the MimmoBook blog for booking guides for service professionals and hospitality businesses.",
        path: `/blog/${params.slug}`,
        noindex: true,
      });
    }
    const image = post.image
      ? post.image.startsWith("http")
        ? post.image
        : `https://mimmobook.com${post.image}`
      : undefined;
    return routeHead({
      title: post.seoTitle,
      description: post.seoDescription,
      path: `/blog/${post.slug}`,
      type: "article",
      image,
      imageAlt: post.imageAlt,
    });
  },
});
