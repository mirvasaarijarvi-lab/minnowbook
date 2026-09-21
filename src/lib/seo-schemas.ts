// Reusable JSON-LD helpers. Kept out of SEOHead.tsx so that component module
// only exports a component. See docs/linting-policy.md.
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MimmoBook",
  url: "https://mimmobook.com",
  logo: "https://mimmobook.com/logos/logo-color-large.png",
  description:
    "MimmoBook is a SaaS reservation management platform for restaurants, venues, hotels, and guesthouses.",
  sameAs: [],
  address: {
    "@type": "PostalAddress",
    addressCountry: "FI",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://mimmobook.com/support",
      email: "support@mimmobook.com",
      availableLanguage: ["English", "Finnish", "Swedish"],
    },
    {
      "@type": "ContactPoint",
      contactType: "sales",
      url: "https://mimmobook.com/pricing",
      email: "sales@mimmobook.com",
      availableLanguage: ["English", "Finnish", "Swedish"],
    },
  ],
};

export const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MimmoBook",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://mimmobook.com",
  description:
    "Cloud-based reservation management for restaurants, venues, hotels and guesthouses. Multi-site support, branded booking pages, automated emails, team management and real-time reporting.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "EUR",
    lowPrice: "29",
    highPrice: "149",
    offerCount: "3",
  },
  featureList:
    "Online reservations, Multi-site management, Branded booking pages, Automated emails, Team roles & permissions, Reports & analytics, Discount codes, Catering & popup support",
};

export const faqSchema = (items: { question: string; answer: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
});

export const breadcrumbSchema = (items: { name: string; url: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: item.url,
  })),
});
