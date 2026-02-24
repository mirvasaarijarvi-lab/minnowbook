export type Language = "en" | "fi" | "sv";

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fi", label: "Suomi", flag: "🇫🇮" },
  { code: "sv", label: "Svenska", flag: "🇸🇪" },
];

type TranslationKeys = {
  // Common
  "common.logIn": string;
  "common.logOut": string;
  "common.signUp": string;
  "common.startFreeTrial": string;
  "common.startYourFreeTrial": string;
  "common.getStartedFree": string;
  "common.cancel": string;
  "common.save": string;
  "common.edit": string;
  "common.delete": string;
  "common.create": string;
  "common.update": string;
  "common.back": string;
  "common.continue": string;
  "common.saving": string;
  "common.loading": string;
  "common.email": string;
  "common.password": string;
  "common.name": string;
  "common.phone": string;
  "common.address": string;
  "common.description": string;
  "common.status": string;
  "common.type": string;
  "common.price": string;
  "common.guests": string;
  "common.date": string;
  "common.noResults": string;

  // Nav
  "nav.home": string;
  "nav.pricing": string;
  "nav.overview": string;
  "nav.calendar": string;
  "nav.reservations": string;
  "nav.resources": string;

  // Hero
  "hero.badge": string;
  "hero.title": string;
  "hero.titleHighlight": string;
  "hero.subtitle": string;
  "hero.viewPricing": string;
  "hero.noCreditCard": string;
  "hero.cancelAnytime": string;

  // Features
  "features.title": string;
  "features.subtitle": string;
  "features.smartReservations": string;
  "features.smartReservationsDesc": string;
  "features.customBranding": string;
  "features.customBrandingDesc": string;
  "features.teamManagement": string;
  "features.teamManagementDesc": string;
  "features.brandedPages": string;
  "features.brandedPagesDesc": string;
  "features.reportsInsights": string;
  "features.reportsInsightsDesc": string;
  "features.automatedEmails": string;
  "features.automatedEmailsDesc": string;

  // How it works
  "howItWorks.title": string;
  "howItWorks.subtitle": string;
  "howItWorks.step1Title": string;
  "howItWorks.step1Desc": string;
  "howItWorks.step2Title": string;
  "howItWorks.step2Desc": string;
  "howItWorks.step3Title": string;
  "howItWorks.step3Desc": string;

  // Pricing
  "pricing.title": string;
  "pricing.subtitle": string;
  "pricing.simpleTitle": string;
  "pricing.simpleSubtitle": string;
  "pricing.comparePlans": string;
  "pricing.faq": string;
  "pricing.feature": string;
  "pricing.monthlyPrice": string;
  "pricing.freeTrial": string;
  "pricing.days30": string;
  "pricing.reservationTypes": string;
  "pricing.staffUsers": string;
  "pricing.trialIncluded": string;
  "pricing.perMonth": string;
  "pricing.mostPopular": string;
  "pricing.ctaTitle": string;
  "pricing.ctaSubtitle": string;

  // CTA
  "cta.title": string;
  "cta.subtitle": string;

  // Login
  "login.title": string;
  "login.subtitle": string;
  "login.welcomeBack": string;
  "login.welcomeBackSubtitle": string;
  "login.forgotPassword": string;
  "login.noAccount": string;
  "login.loggingIn": string;

  // Signup
  "signup.title": string;
  "signup.subtitle": string;
  "signup.heroTitle": string;
  "signup.heroSubtitle": string;
  "signup.businessName": string;
  "signup.yourName": string;
  "signup.creatingAccount": string;
  "signup.alreadyHaveAccount": string;
  "signup.accountCreated": string;

  // Forgot password
  "forgot.title": string;
  "forgot.subtitle": string;
  "forgot.sendLink": string;
  "forgot.sending": string;
  "forgot.checkEmail": string;
  "forgot.checkEmailDesc": string;
  "forgot.backToLogin": string;

  // Dashboard
  "dashboard.welcome": string;
  "dashboard.todaysReservations": string;
  "dashboard.pending": string;
  "dashboard.confirmed": string;
  "dashboard.cancelled": string;
  "dashboard.activeResources": string;
  "dashboard.noReservations": string;
  "dashboard.noReservationsDay": string;
  "dashboard.selectDate": string;
  "dashboard.allStatuses": string;
  "dashboard.allTypes": string;
  "dashboard.addResource": string;
  "dashboard.editResource": string;
  "dashboard.noResources": string;
  "dashboard.capacity": string;
  "dashboard.perNight": string;
  "dashboard.resourceCreated": string;
  "dashboard.resourceUpdated": string;
  "dashboard.resourceDeleted": string;
  "dashboard.restaurant": string;
  "dashboard.venue": string;
  "dashboard.guesthouse": string;

  // Onboarding
  "onboarding.tierStep": string;
  "onboarding.typesStep": string;
  "onboarding.brandingStep": string;
  "onboarding.choosePlan": string;
  "onboarding.choosePlanSubtitle": string;
  "onboarding.whatDoYouNeed": string;
  "onboarding.whatDoYouNeedSubtitle": string;
  "onboarding.brandWorkspace": string;
  "onboarding.brandWorkspaceSubtitle": string;
  "onboarding.businessDetails": string;
  "onboarding.businessNameRequired": string;
  "onboarding.brandColors": string;
  "onboarding.presets": string;
  "onboarding.primary": string;
  "onboarding.secondary": string;
  "onboarding.accent": string;
  "onboarding.preview": string;
  "onboarding.finishSetup": string;
  "onboarding.creatingWorkspace": string;
  "onboarding.selected": string;
  "onboarding.restaurantDesc": string;
  "onboarding.venueDesc": string;
  "onboarding.guesthouseDesc": string;

  // Tiers
  "tier.basic": string;
  "tier.basicDesc": string;
  "tier.pro": string;
  "tier.proDesc": string;
  "tier.professional": string;
  "tier.professionalDesc": string;
  "tier.business": string;
  "tier.businessDesc": string;
  "tier.enterprise": string;
  "tier.enterpriseDesc": string;

  // Footer
  "footer.tagline": string;
  "footer.product": string;
  "footer.company": string;
  "footer.legal": string;
  "footer.featuresComingSoon": string;
  "footer.aboutComingSoon": string;
  "footer.contactComingSoon": string;
  "footer.privacyPolicy": string;
  "footer.termsOfService": string;
  "footer.allRightsReserved": string;
};

export type TranslationKey = keyof TranslationKeys;

const en: TranslationKeys = {
  // Common
  "common.logIn": "Log in",
  "common.logOut": "Log out",
  "common.signUp": "Sign up",
  "common.startFreeTrial": "Start Free Trial",
  "common.startYourFreeTrial": "Start Your Free Trial",
  "common.getStartedFree": "Get Started Free",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.create": "Create",
  "common.update": "Update",
  "common.back": "Back",
  "common.continue": "Continue",
  "common.saving": "Saving...",
  "common.loading": "Loading...",
  "common.email": "Email",
  "common.password": "Password",
  "common.name": "Name",
  "common.phone": "Phone",
  "common.address": "Address",
  "common.description": "Description",
  "common.status": "Status",
  "common.type": "Type",
  "common.price": "Price",
  "common.guests": "guests",
  "common.date": "Date",
  "common.noResults": "No results found.",

  // Nav
  "nav.home": "Home",
  "nav.pricing": "Pricing",
  "nav.overview": "Overview",
  "nav.calendar": "Calendar",
  "nav.reservations": "Reservations",
  "nav.resources": "Resources",

  // Hero
  "hero.badge": "Now in beta. 30-day free trial",
  "hero.title": "The reservation tool built for",
  "hero.titleHighlight": "the ones who do it all",
  "hero.subtitle": "Manage restaurant bookings, venue inquiries, and guesthouse reservations all from one elegant dashboard. Branded booking pages, automated emails, and team management included.",
  "hero.viewPricing": "View Pricing",
  "hero.noCreditCard": "No credit card required",
  "hero.cancelAnytime": "Cancel anytime",

  // Features
  "features.title": "Everything you need to manage reservations",
  "features.subtitle": "A complete toolkit for hospitality businesses, from booking pages to team management.",
  "features.smartReservations": "Smart Reservations",
  "features.smartReservationsDesc": "Handle restaurant bookings, venue inquiries, and guesthouse stays, all from one dashboard.",
  "features.customBranding": "Custom Branding",
  "features.customBrandingDesc": "Your logo, your colors, your images. Every booking page matches your brand identity.",
  "features.teamManagement": "Team Management",
  "features.teamManagementDesc": "Invite staff members, assign roles, and manage permissions with ease.",
  "features.brandedPages": "Branded Booking Pages",
  "features.brandedPagesDesc": "Give customers a polished booking experience on your own subdomain.",
  "features.reportsInsights": "Reports & Insights",
  "features.reportsInsightsDesc": "Track reservation trends, occupancy rates, and revenue at a glance.",
  "features.automatedEmails": "Automated Emails",
  "features.automatedEmailsDesc": "Send confirmation, reminder, and cancellation emails automatically.",

  // How it works
  "howItWorks.title": "Up and running in minutes",
  "howItWorks.subtitle": "Three simple steps to start accepting online reservations.",
  "howItWorks.step1Title": "Sign up & pick your plan",
  "howItWorks.step1Desc": "Create your account in seconds and start your 30-day free trial.",
  "howItWorks.step2Title": "Set up your business",
  "howItWorks.step2Desc": "Upload your branding, add your resources, and configure opening hours.",
  "howItWorks.step3Title": "Share your booking link",
  "howItWorks.step3Desc": "Send your custom booking page to customers and start receiving reservations.",

  // Pricing
  "pricing.title": "Plans for every stage of growth",
  "pricing.subtitle": "Start with a 30-day free trial on any plan. No credit card required. Scale up as your business grows.",
  "pricing.simpleTitle": "Simple, transparent pricing",
  "pricing.simpleSubtitle": "Start with a 30-day free trial. No credit card required. Upgrade or cancel anytime.",
  "pricing.comparePlans": "Compare plans in detail",
  "pricing.faq": "Frequently asked questions",
  "pricing.feature": "Feature",
  "pricing.monthlyPrice": "Monthly price",
  "pricing.freeTrial": "Free trial",
  "pricing.days30": "30 days",
  "pricing.reservationTypes": "Reservation types",
  "pricing.staffUsers": "Staff users",
  "pricing.trialIncluded": "30-day free trial included",
  "pricing.perMonth": "/month",
  "pricing.mostPopular": "Most Popular",
  "pricing.ctaTitle": "Start your free trial today",
  "pricing.ctaSubtitle": "No credit card required. Set up in minutes.",

  // CTA
  "cta.title": "Ready to modernize your reservations?",
  "cta.subtitle": "Join hospitality businesses already using MinnowBook to streamline their bookings.",

  // Login
  "login.title": "Log in to your account",
  "login.subtitle": "Enter your credentials to access your dashboard.",
  "login.welcomeBack": "Welcome back",
  "login.welcomeBackSubtitle": "Log in to manage your reservations and team.",
  "login.forgotPassword": "Forgot password?",
  "login.noAccount": "Don't have an account?",
  "login.loggingIn": "Logging in...",

  // Signup
  "signup.title": "Create your account",
  "signup.subtitle": "Start your 30-day free trial, no credit card required.",
  "signup.heroTitle": "Start managing reservations today",
  "signup.heroSubtitle": "30-day free trial. No credit card required. Set up in minutes.",
  "signup.businessName": "Business name",
  "signup.yourName": "Your name",
  "signup.creatingAccount": "Creating account...",
  "signup.alreadyHaveAccount": "Already have an account?",
  "signup.accountCreated": "Account created! Please check your email to verify your account before logging in.",

  // Forgot password
  "forgot.title": "Reset your password",
  "forgot.subtitle": "Enter your email and we'll send you a link to reset your password.",
  "forgot.sendLink": "Send reset link",
  "forgot.sending": "Sending...",
  "forgot.checkEmail": "Check your email",
  "forgot.checkEmailDesc": "We sent a password reset link to",
  "forgot.backToLogin": "Back to login",

  // Dashboard
  "dashboard.welcome": "Welcome",
  "dashboard.todaysReservations": "Today's Reservations",
  "dashboard.pending": "Pending",
  "dashboard.confirmed": "Confirmed",
  "dashboard.cancelled": "Cancelled",
  "dashboard.activeResources": "Active Resources",
  "dashboard.noReservations": "No reservations found.",
  "dashboard.noReservationsDay": "No reservations on this day.",
  "dashboard.selectDate": "Select a date",
  "dashboard.allStatuses": "All statuses",
  "dashboard.allTypes": "All types",
  "dashboard.addResource": "Add Resource",
  "dashboard.editResource": "Edit Resource",
  "dashboard.noResources": "No resources yet. Add your first room, table, or venue.",
  "dashboard.capacity": "capacity",
  "dashboard.perNight": "/night",
  "dashboard.resourceCreated": "Resource created",
  "dashboard.resourceUpdated": "Resource updated",
  "dashboard.resourceDeleted": "Resource deleted",
  "dashboard.restaurant": "Restaurant",
  "dashboard.venue": "Venue",
  "dashboard.guesthouse": "Guesthouse",

  // Onboarding
  "onboarding.tierStep": "Tier",
  "onboarding.typesStep": "Reservation Types",
  "onboarding.brandingStep": "Branding",
  "onboarding.choosePlan": "Choose your plan",
  "onboarding.choosePlanSubtitle": "All plans include a 30-day free trial.",
  "onboarding.whatDoYouNeed": "What do you need?",
  "onboarding.whatDoYouNeedSubtitle": "Select the reservation types for your business.",
  "onboarding.brandWorkspace": "Brand your workspace",
  "onboarding.brandWorkspaceSubtitle": "Customize colors and add business details.",
  "onboarding.businessDetails": "Business Details",
  "onboarding.businessNameRequired": "Business Name *",
  "onboarding.brandColors": "Brand Colors",
  "onboarding.presets": "Presets",
  "onboarding.primary": "Primary",
  "onboarding.secondary": "Secondary",
  "onboarding.accent": "Accent",
  "onboarding.preview": "Preview",
  "onboarding.finishSetup": "Finish Setup",
  "onboarding.creatingWorkspace": "Creating workspace...",
  "onboarding.selected": "Selected",
  "onboarding.restaurantDesc": "Table reservations and dining",
  "onboarding.venueDesc": "Event spaces, meetings, celebrations",
  "onboarding.guesthouseDesc": "Room bookings and accommodation",

  // Tiers
  "tier.basic": "Basic",
  "tier.basicDesc": "Perfect for small businesses just getting started.",
  "tier.pro": "Pro",
  "tier.proDesc": "For growing businesses that need more control.",
  "tier.professional": "Professional",
  "tier.professionalDesc": "Multiple reservation types, team management.",
  "tier.business": "Business",
  "tier.businessDesc": "Full-featured platform for established businesses.",
  "tier.enterprise": "Enterprise",
  "tier.enterpriseDesc": "Unlimited everything for large operations.",

  // Footer
  "footer.tagline": "The modern reservation platform for restaurants, venues, and guesthouses.",
  "footer.product": "Product",
  "footer.company": "Company",
  "footer.legal": "Legal",
  "footer.featuresComingSoon": "Features (coming soon)",
  "footer.aboutComingSoon": "About (coming soon)",
  "footer.contactComingSoon": "Contact (coming soon)",
  "footer.privacyPolicy": "Privacy Policy",
  "footer.termsOfService": "Terms of Service",
  "footer.allRightsReserved": "All rights reserved.",
};

const fi: TranslationKeys = {
  // Common
  "common.logIn": "Kirjaudu",
  "common.logOut": "Kirjaudu ulos",
  "common.signUp": "Rekisteröidy",
  "common.startFreeTrial": "Aloita ilmainen kokeilu",
  "common.startYourFreeTrial": "Aloita ilmainen kokeilusi",
  "common.getStartedFree": "Aloita ilmaiseksi",
  "common.cancel": "Peruuta",
  "common.save": "Tallenna",
  "common.edit": "Muokkaa",
  "common.delete": "Poista",
  "common.create": "Luo",
  "common.update": "Päivitä",
  "common.back": "Takaisin",
  "common.continue": "Jatka",
  "common.saving": "Tallennetaan...",
  "common.loading": "Ladataan...",
  "common.email": "Sähköposti",
  "common.password": "Salasana",
  "common.name": "Nimi",
  "common.phone": "Puhelin",
  "common.address": "Osoite",
  "common.description": "Kuvaus",
  "common.status": "Tila",
  "common.type": "Tyyppi",
  "common.price": "Hinta",
  "common.guests": "vierasta",
  "common.date": "Päivämäärä",
  "common.noResults": "Ei tuloksia.",

  // Nav
  "nav.home": "Etusivu",
  "nav.pricing": "Hinnoittelu",
  "nav.overview": "Yleiskatsaus",
  "nav.calendar": "Kalenteri",
  "nav.reservations": "Varaukset",
  "nav.resources": "Resurssit",

  // Hero
  "hero.badge": "Nyt betassa. 30 päivän ilmainen kokeilu",
  "hero.title": "Varaustyökalu niille,",
  "hero.titleHighlight": "jotka hoitavat kaiken",
  "hero.subtitle": "Hallitse ravintolavarauksia, tilakyselyitä ja majoitusvarauksia yhdestä tyylikkäästä hallintapaneelista. Brändätyt varaussivut, automaattiset sähköpostit ja tiiminhallinta mukana.",
  "hero.viewPricing": "Katso hinnoittelu",
  "hero.noCreditCard": "Ei luottokorttia tarvita",
  "hero.cancelAnytime": "Peruuta milloin tahansa",

  // Features
  "features.title": "Kaikki mitä tarvitset varausten hallintaan",
  "features.subtitle": "Täydellinen työkalupakki ravintola-alan yrityksille, varaussivuista tiiminhallintaan.",
  "features.smartReservations": "Älykkäät varaukset",
  "features.smartReservationsDesc": "Hallitse ravintolavarauksia, tilakyselyitä ja majoituksia yhdestä hallintapaneelista.",
  "features.customBranding": "Oma brändäys",
  "features.customBrandingDesc": "Oma logosi, omat värisi, omat kuvasi. Jokainen varaussivu vastaa brändi-identiteettiäsi.",
  "features.teamManagement": "Tiiminhallinta",
  "features.teamManagementDesc": "Kutsu henkilökuntaa, määritä rooleja ja hallitse käyttöoikeuksia helposti.",
  "features.brandedPages": "Brändätyt varaussivut",
  "features.brandedPagesDesc": "Tarjoa asiakkaille viimeistelty varauskokemus omalla alidomainillasi.",
  "features.reportsInsights": "Raportit ja analytiikka",
  "features.reportsInsightsDesc": "Seuraa varaustrendejä, käyttöasteita ja liikevaihtoa yhdellä silmäyksellä.",
  "features.automatedEmails": "Automaattiset sähköpostit",
  "features.automatedEmailsDesc": "Lähetä vahvistus-, muistutus- ja peruutussähköpostit automaattisesti.",

  // How it works
  "howItWorks.title": "Käyttövalmis minuuteissa",
  "howItWorks.subtitle": "Kolme yksinkertaista vaihetta verkkovarausten vastaanottamiseen.",
  "howItWorks.step1Title": "Rekisteröidy ja valitse suunnitelma",
  "howItWorks.step1Desc": "Luo tilisi sekunneissa ja aloita 30 päivän ilmainen kokeilu.",
  "howItWorks.step2Title": "Määritä yrityksesi",
  "howItWorks.step2Desc": "Lataa brändäyksesi, lisää resurssit ja määritä aukioloajat.",
  "howItWorks.step3Title": "Jaa varauslinkkisi",
  "howItWorks.step3Desc": "Lähetä mukautettu varaussivusi asiakkaille ja ala vastaanottaa varauksia.",

  // Pricing
  "pricing.title": "Suunnitelmat jokaiseen kasvuvaiheeseen",
  "pricing.subtitle": "Aloita 30 päivän ilmaisella kokeilulla millä tahansa suunnitelmalla. Ei luottokorttia tarvita. Skaalaa ylöspäin yrityksesi kasvaessa.",
  "pricing.simpleTitle": "Yksinkertainen, läpinäkyvä hinnoittelu",
  "pricing.simpleSubtitle": "Aloita 30 päivän ilmaisella kokeilulla. Ei luottokorttia tarvita. Päivitä tai peruuta milloin tahansa.",
  "pricing.comparePlans": "Vertaa suunnitelmia yksityiskohtaisesti",
  "pricing.faq": "Usein kysytyt kysymykset",
  "pricing.feature": "Ominaisuus",
  "pricing.monthlyPrice": "Kuukausihinta",
  "pricing.freeTrial": "Ilmainen kokeilu",
  "pricing.days30": "30 päivää",
  "pricing.reservationTypes": "Varaustyypit",
  "pricing.staffUsers": "Henkilökunta",
  "pricing.trialIncluded": "30 päivän ilmainen kokeilu sisältyy",
  "pricing.perMonth": "/kk",
  "pricing.mostPopular": "Suosituin",
  "pricing.ctaTitle": "Aloita ilmainen kokeilusi tänään",
  "pricing.ctaSubtitle": "Ei luottokorttia tarvita. Käyttövalmis minuuteissa.",

  // CTA
  "cta.title": "Valmis modernisoimaan varauksesi?",
  "cta.subtitle": "Liity ravintola-alan yrityksiin, jotka jo käyttävät MinnowBookia varausten sujuvoittamiseen.",

  // Login
  "login.title": "Kirjaudu tilillesi",
  "login.subtitle": "Syötä tunnuksesi päästäksesi hallintapaneeliin.",
  "login.welcomeBack": "Tervetuloa takaisin",
  "login.welcomeBackSubtitle": "Kirjaudu hallitsemaan varauksiasi ja tiimiäsi.",
  "login.forgotPassword": "Unohditko salasanan?",
  "login.noAccount": "Eikö sinulla ole tiliä?",
  "login.loggingIn": "Kirjaudutaan...",

  // Signup
  "signup.title": "Luo tilisi",
  "signup.subtitle": "Aloita 30 päivän ilmainen kokeilu, luottokorttia ei tarvita.",
  "signup.heroTitle": "Aloita varausten hallinta tänään",
  "signup.heroSubtitle": "30 päivän ilmainen kokeilu. Ei luottokorttia tarvita. Käyttövalmis minuuteissa.",
  "signup.businessName": "Yrityksen nimi",
  "signup.yourName": "Nimesi",
  "signup.creatingAccount": "Luodaan tiliä...",
  "signup.alreadyHaveAccount": "Onko sinulla jo tili?",
  "signup.accountCreated": "Tili luotu! Tarkista sähköpostisi ja vahvista tilisi ennen kirjautumista.",

  // Forgot password
  "forgot.title": "Nollaa salasanasi",
  "forgot.subtitle": "Syötä sähköpostisi ja lähetämme sinulle linkin salasanan nollaamiseen.",
  "forgot.sendLink": "Lähetä nollauslinkki",
  "forgot.sending": "Lähetetään...",
  "forgot.checkEmail": "Tarkista sähköpostisi",
  "forgot.checkEmailDesc": "Lähetimme salasanan nollauslinkin osoitteeseen",
  "forgot.backToLogin": "Takaisin kirjautumiseen",

  // Dashboard
  "dashboard.welcome": "Tervetuloa",
  "dashboard.todaysReservations": "Tämän päivän varaukset",
  "dashboard.pending": "Odottaa",
  "dashboard.confirmed": "Vahvistettu",
  "dashboard.cancelled": "Peruutettu",
  "dashboard.activeResources": "Aktiiviset resurssit",
  "dashboard.noReservations": "Ei varauksia.",
  "dashboard.noReservationsDay": "Ei varauksia tänä päivänä.",
  "dashboard.selectDate": "Valitse päivämäärä",
  "dashboard.allStatuses": "Kaikki tilat",
  "dashboard.allTypes": "Kaikki tyypit",
  "dashboard.addResource": "Lisää resurssi",
  "dashboard.editResource": "Muokkaa resurssia",
  "dashboard.noResources": "Ei resursseja vielä. Lisää ensimmäinen huone, pöytä tai tila.",
  "dashboard.capacity": "kapasiteetti",
  "dashboard.perNight": "/yö",
  "dashboard.resourceCreated": "Resurssi luotu",
  "dashboard.resourceUpdated": "Resurssi päivitetty",
  "dashboard.resourceDeleted": "Resurssi poistettu",
  "dashboard.restaurant": "Ravintola",
  "dashboard.venue": "Tila",
  "dashboard.guesthouse": "Majatalo",

  // Onboarding
  "onboarding.tierStep": "Suunnitelma",
  "onboarding.typesStep": "Varaustyypit",
  "onboarding.brandingStep": "Brändäys",
  "onboarding.choosePlan": "Valitse suunnitelmasi",
  "onboarding.choosePlanSubtitle": "Kaikki suunnitelmat sisältävät 30 päivän ilmaisen kokeilun.",
  "onboarding.whatDoYouNeed": "Mitä tarvitset?",
  "onboarding.whatDoYouNeedSubtitle": "Valitse yrityksellesi sopivat varaustyypit.",
  "onboarding.brandWorkspace": "Brändää työtilasi",
  "onboarding.brandWorkspaceSubtitle": "Mukauta värit ja lisää yritystiedot.",
  "onboarding.businessDetails": "Yritystiedot",
  "onboarding.businessNameRequired": "Yrityksen nimi *",
  "onboarding.brandColors": "Brändivärit",
  "onboarding.presets": "Esiasetukset",
  "onboarding.primary": "Pääväri",
  "onboarding.secondary": "Toissijainen",
  "onboarding.accent": "Korostus",
  "onboarding.preview": "Esikatselu",
  "onboarding.finishSetup": "Viimeistele asetukset",
  "onboarding.creatingWorkspace": "Luodaan työtilaa...",
  "onboarding.selected": "Valittu",
  "onboarding.restaurantDesc": "Pöytävaraukset ja ruokailu",
  "onboarding.venueDesc": "Tapahtumatilat, kokoukset, juhlat",
  "onboarding.guesthouseDesc": "Huonevaraukset ja majoitus",

  // Tiers
  "tier.basic": "Basic",
  "tier.basicDesc": "Täydellinen pienille yrityksille, jotka ovat vasta aloittamassa.",
  "tier.pro": "Pro",
  "tier.proDesc": "Kasvaville yrityksille, jotka tarvitsevat enemmän hallintaa.",
  "tier.professional": "Professional",
  "tier.professionalDesc": "Useita varaustyyppejä, tiiminhallinta.",
  "tier.business": "Business",
  "tier.businessDesc": "Täysivarusteinen alusta vakiintuneille yrityksille.",
  "tier.enterprise": "Enterprise",
  "tier.enterpriseDesc": "Rajaton kaikessa suurille toiminnoille.",

  // Footer
  "footer.tagline": "Moderni varausalusta ravintoloille, tiloille ja majataloille.",
  "footer.product": "Tuote",
  "footer.company": "Yritys",
  "footer.legal": "Juridiikka",
  "footer.featuresComingSoon": "Ominaisuudet (tulossa pian)",
  "footer.aboutComingSoon": "Tietoa meistä (tulossa pian)",
  "footer.contactComingSoon": "Yhteystiedot (tulossa pian)",
  "footer.privacyPolicy": "Tietosuojakäytäntö",
  "footer.termsOfService": "Käyttöehdot",
  "footer.allRightsReserved": "Kaikki oikeudet pidätetään.",
};

const sv: TranslationKeys = {
  // Common
  "common.logIn": "Logga in",
  "common.logOut": "Logga ut",
  "common.signUp": "Registrera dig",
  "common.startFreeTrial": "Starta gratis provperiod",
  "common.startYourFreeTrial": "Starta din gratis provperiod",
  "common.getStartedFree": "Kom igång gratis",
  "common.cancel": "Avbryt",
  "common.save": "Spara",
  "common.edit": "Redigera",
  "common.delete": "Radera",
  "common.create": "Skapa",
  "common.update": "Uppdatera",
  "common.back": "Tillbaka",
  "common.continue": "Fortsätt",
  "common.saving": "Sparar...",
  "common.loading": "Laddar...",
  "common.email": "E-post",
  "common.password": "Lösenord",
  "common.name": "Namn",
  "common.phone": "Telefon",
  "common.address": "Adress",
  "common.description": "Beskrivning",
  "common.status": "Status",
  "common.type": "Typ",
  "common.price": "Pris",
  "common.guests": "gäster",
  "common.date": "Datum",
  "common.noResults": "Inga resultat hittades.",

  // Nav
  "nav.home": "Hem",
  "nav.pricing": "Priser",
  "nav.overview": "Översikt",
  "nav.calendar": "Kalender",
  "nav.reservations": "Bokningar",
  "nav.resources": "Resurser",

  // Hero
  "hero.badge": "Nu i beta. 30 dagars gratis provperiod",
  "hero.title": "Bokningsverktyget byggt för",
  "hero.titleHighlight": "dem som gör allt",
  "hero.subtitle": "Hantera restaurangbokningar, lokalförfrågningar och gästhusreservationer från en elegant instrumentpanel. Varumärkta bokningssidor, automatiska e-postmeddelanden och teamhantering ingår.",
  "hero.viewPricing": "Se priser",
  "hero.noCreditCard": "Inget kreditkort krävs",
  "hero.cancelAnytime": "Avbryt när som helst",

  // Features
  "features.title": "Allt du behöver för att hantera bokningar",
  "features.subtitle": "En komplett verktygslåda för besöksnäringsföretag, från bokningssidor till teamhantering.",
  "features.smartReservations": "Smarta bokningar",
  "features.smartReservationsDesc": "Hantera restaurangbokningar, lokalförfrågningar och gästhusvistelser från en instrumentpanel.",
  "features.customBranding": "Egen varumärkesprofil",
  "features.customBrandingDesc": "Din logotyp, dina färger, dina bilder. Varje bokningssida matchar din varumärkesidentitet.",
  "features.teamManagement": "Teamhantering",
  "features.teamManagementDesc": "Bjud in personal, tilldela roller och hantera behörigheter enkelt.",
  "features.brandedPages": "Varumärkta bokningssidor",
  "features.brandedPagesDesc": "Ge kunderna en polerad bokningsupplevelse på din egen subdomän.",
  "features.reportsInsights": "Rapporter och insikter",
  "features.reportsInsightsDesc": "Följ bokningstrender, beläggningsgrad och intäkter med ett ögonkast.",
  "features.automatedEmails": "Automatiska e-postmeddelanden",
  "features.automatedEmailsDesc": "Skicka bekräftelse-, påminnelse- och avbokningsmeddelanden automatiskt.",

  // How it works
  "howItWorks.title": "Igång på minuter",
  "howItWorks.subtitle": "Tre enkla steg för att börja ta emot onlinebokningar.",
  "howItWorks.step1Title": "Registrera dig och välj plan",
  "howItWorks.step1Desc": "Skapa ditt konto på sekunder och starta din 30 dagars gratis provperiod.",
  "howItWorks.step2Title": "Konfigurera ditt företag",
  "howItWorks.step2Desc": "Ladda upp din varumärkesprofil, lägg till resurser och konfigurera öppettider.",
  "howItWorks.step3Title": "Dela din bokningslänk",
  "howItWorks.step3Desc": "Skicka din anpassade bokningssida till kunder och börja ta emot bokningar.",

  // Pricing
  "pricing.title": "Planer för varje tillväxtfas",
  "pricing.subtitle": "Börja med en 30 dagars gratis provperiod på valfri plan. Inget kreditkort krävs. Skala upp när ditt företag växer.",
  "pricing.simpleTitle": "Enkel, transparent prissättning",
  "pricing.simpleSubtitle": "Börja med en 30 dagars gratis provperiod. Inget kreditkort krävs. Uppgradera eller avbryt när som helst.",
  "pricing.comparePlans": "Jämför planer i detalj",
  "pricing.faq": "Vanliga frågor",
  "pricing.feature": "Funktion",
  "pricing.monthlyPrice": "Månadspris",
  "pricing.freeTrial": "Gratis provperiod",
  "pricing.days30": "30 dagar",
  "pricing.reservationTypes": "Bokningstyper",
  "pricing.staffUsers": "Personalanvändare",
  "pricing.trialIncluded": "30 dagars gratis provperiod ingår",
  "pricing.perMonth": "/mån",
  "pricing.mostPopular": "Mest populär",
  "pricing.ctaTitle": "Starta din gratis provperiod idag",
  "pricing.ctaSubtitle": "Inget kreditkort krävs. Igång på minuter.",

  // CTA
  "cta.title": "Redo att modernisera dina bokningar?",
  "cta.subtitle": "Gå med besöksnäringsföretag som redan använder MinnowBook för att effektivisera sina bokningar.",

  // Login
  "login.title": "Logga in på ditt konto",
  "login.subtitle": "Ange dina uppgifter för att komma åt din instrumentpanel.",
  "login.welcomeBack": "Välkommen tillbaka",
  "login.welcomeBackSubtitle": "Logga in för att hantera dina bokningar och ditt team.",
  "login.forgotPassword": "Glömt lösenord?",
  "login.noAccount": "Har du inget konto?",
  "login.loggingIn": "Loggar in...",

  // Signup
  "signup.title": "Skapa ditt konto",
  "signup.subtitle": "Starta din 30 dagars gratis provperiod, inget kreditkort krävs.",
  "signup.heroTitle": "Börja hantera bokningar idag",
  "signup.heroSubtitle": "30 dagars gratis provperiod. Inget kreditkort krävs. Igång på minuter.",
  "signup.businessName": "Företagsnamn",
  "signup.yourName": "Ditt namn",
  "signup.creatingAccount": "Skapar konto...",
  "signup.alreadyHaveAccount": "Har du redan ett konto?",
  "signup.accountCreated": "Konto skapat! Kontrollera din e-post för att verifiera kontot innan du loggar in.",

  // Forgot password
  "forgot.title": "Återställ ditt lösenord",
  "forgot.subtitle": "Ange din e-post så skickar vi en länk för att återställa ditt lösenord.",
  "forgot.sendLink": "Skicka återställningslänk",
  "forgot.sending": "Skickar...",
  "forgot.checkEmail": "Kontrollera din e-post",
  "forgot.checkEmailDesc": "Vi har skickat en länk för lösenordsåterställning till",
  "forgot.backToLogin": "Tillbaka till inloggning",

  // Dashboard
  "dashboard.welcome": "Välkommen",
  "dashboard.todaysReservations": "Dagens bokningar",
  "dashboard.pending": "Väntande",
  "dashboard.confirmed": "Bekräftad",
  "dashboard.cancelled": "Avbokad",
  "dashboard.activeResources": "Aktiva resurser",
  "dashboard.noReservations": "Inga bokningar hittades.",
  "dashboard.noReservationsDay": "Inga bokningar denna dag.",
  "dashboard.selectDate": "Välj ett datum",
  "dashboard.allStatuses": "Alla statusar",
  "dashboard.allTypes": "Alla typer",
  "dashboard.addResource": "Lägg till resurs",
  "dashboard.editResource": "Redigera resurs",
  "dashboard.noResources": "Inga resurser ännu. Lägg till ditt första rum, bord eller lokal.",
  "dashboard.capacity": "kapacitet",
  "dashboard.perNight": "/natt",
  "dashboard.resourceCreated": "Resurs skapad",
  "dashboard.resourceUpdated": "Resurs uppdaterad",
  "dashboard.resourceDeleted": "Resurs raderad",
  "dashboard.restaurant": "Restaurang",
  "dashboard.venue": "Lokal",
  "dashboard.guesthouse": "Gästhus",

  // Onboarding
  "onboarding.tierStep": "Plan",
  "onboarding.typesStep": "Bokningstyper",
  "onboarding.brandingStep": "Varumärke",
  "onboarding.choosePlan": "Välj din plan",
  "onboarding.choosePlanSubtitle": "Alla planer inkluderar en 30 dagars gratis provperiod.",
  "onboarding.whatDoYouNeed": "Vad behöver du?",
  "onboarding.whatDoYouNeedSubtitle": "Välj bokningstyperna för ditt företag.",
  "onboarding.brandWorkspace": "Varumärk din arbetsyta",
  "onboarding.brandWorkspaceSubtitle": "Anpassa färger och lägg till företagsinformation.",
  "onboarding.businessDetails": "Företagsinformation",
  "onboarding.businessNameRequired": "Företagsnamn *",
  "onboarding.brandColors": "Varumärkesfärger",
  "onboarding.presets": "Förval",
  "onboarding.primary": "Primär",
  "onboarding.secondary": "Sekundär",
  "onboarding.accent": "Accent",
  "onboarding.preview": "Förhandsvisning",
  "onboarding.finishSetup": "Slutför konfiguration",
  "onboarding.creatingWorkspace": "Skapar arbetsyta...",
  "onboarding.selected": "Vald",
  "onboarding.restaurantDesc": "Bordsreservationer och matservering",
  "onboarding.venueDesc": "Evenemangslokaler, möten, festligheter",
  "onboarding.guesthouseDesc": "Rumsreservationer och boende",

  // Tiers
  "tier.basic": "Basic",
  "tier.basicDesc": "Perfekt för småföretag som precis har börjat.",
  "tier.pro": "Pro",
  "tier.proDesc": "För växande företag som behöver mer kontroll.",
  "tier.professional": "Professional",
  "tier.professionalDesc": "Flera bokningstyper, teamhantering.",
  "tier.business": "Business",
  "tier.businessDesc": "Fullfjädrad plattform för etablerade företag.",
  "tier.enterprise": "Enterprise",
  "tier.enterpriseDesc": "Obegränsat allt för stora verksamheter.",

  // Footer
  "footer.tagline": "Den moderna bokningsplattformen för restauranger, lokaler och gästhus.",
  "footer.product": "Produkt",
  "footer.company": "Företag",
  "footer.legal": "Juridik",
  "footer.featuresComingSoon": "Funktioner (kommer snart)",
  "footer.aboutComingSoon": "Om oss (kommer snart)",
  "footer.contactComingSoon": "Kontakt (kommer snart)",
  "footer.privacyPolicy": "Integritetspolicy",
  "footer.termsOfService": "Användarvillkor",
  "footer.allRightsReserved": "Alla rättigheter förbehållna.",
};

export const translations: Record<Language, TranslationKeys> = { en, fi, sv };
