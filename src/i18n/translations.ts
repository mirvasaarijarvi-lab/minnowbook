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
  "nav.admin": string;
  "nav.settings": string;
  "nav.reports": string;
  "nav.support": string;

  // Reports
  "reports.total": string;
  "reports.confirmed": string;
  "reports.pending": string;
  "reports.guest": string;
  "reports.invoiced": string;
  "reports.notInvoiced": string;
  "reports.notes": string;
  "reports.yes": string;
  "reports.no": string;
  "reports.grandTotal": string;
  "reports.totalPrice": string;
  "reports.totalRevenue": string;
  "reports.invoicing": string;
  "reports.details": string;
  "reports.chart.title": string;
  "reports.print": string;
  "reports.print.title": string;
  "reports.print.period": string;
  "reports.print.generated": string;
  "reports.print.summary": string;
  "reports.exportCsv": string;
  "reports.compare": string;
  "reports.vs": string;
  "reports.today": string;
  "reports.filter.all": string;
  "reports.filter.notInvoiced": string;
  "reports.period.week": string;
  "reports.period.month": string;
  "reports.period.quarter": string;
  "reports.period.half": string;
  "reports.period.year": string;
  "reports.period.custom": string;
  "reports.breakfast": string;
  "reports.breakfastRevenue": string;
  "reports.used": string;
  "reports.notUsed": string;
  "reports.roomPrice": string;
  "reports.subtitle": string;
  "reports.roomRevenue": string;
  "reports.breakfastLabel": string;
  "reports.accommodationTotal": string;
  "reports.roomAndBreakfast": string;
  "reports.uninvoicedAlert": string;
  "reports.breakfastAlert": string;
  "reports.nights": string;
  "reports.reservations": string;
  "reports.ofTotal": string;
  "reports.invoicedPercent": string;

  // Settings
  "settings.businessDetails": string;
  "settings.brandColors": string;
  "settings.presets": string;
  "settings.primary": string;
  "settings.secondary": string;
  "settings.accent": string;
  "settings.preview": string;
  "settings.primaryBtn": string;
  "settings.accentBtn": string;
  "settings.saved": string;
  "settings.saveError": string;
  "settings.availabilityThresholds": string;
  "settings.availabilityThresholdsDesc": string;
  "settings.fullThreshold": string;
  "settings.logo": string;
  "settings.uploadLogo": string;
  "settings.uploading": string;
  "settings.logoHint": string;
  "settings.logoUploaded": string;
  "settings.logoUploadError": string;
  "settings.logoInvalidType": string;
  "settings.logoTooLarge": string;
  "settings.heroImage": string;
  "settings.uploadHeroImage": string;
  "settings.heroImageHint": string;
  "settings.heroImageUploaded": string;
  "settings.heroImageUploadError": string;

  // Booking (public)
  "booking.title": string;
  "booking.selectType": string;
  "booking.typeDescRestaurant": string;
  "booking.typeDescVenue": string;
  "booking.typeDescGuesthouse": string;
  "booking.selectDateTime": string;
  "booking.selectTime": string;
  "booking.selectResource": string;
  "booking.yourDetails": string;
  "booking.guestCount": string;
  "booking.specialRequests": string;
  "booking.preferredTime": string;
  "booking.closedDay": string;
  "booking.pickDate": string;
  "booking.checkOutDate": string;
  "booking.roomType": string;
  "booking.breakfastIncluded": string;
  "booking.eventType": string;
  "booking.estimatedGuests": string;
  "booking.cateringNeeded": string;
  "booking.roomSingle": string;
  "booking.roomDouble": string;
  "booking.roomSuite": string;
  "booking.roomDorm": string;
  "booking.eventWedding": string;
  "booking.eventCorporate": string;
  "booking.eventBirthday": string;
  "booking.eventConference": string;
  "booking.eventOther": string;
  "booking.priceSummary": string;
  "booking.night": string;
  "booking.nights": string;
  "booking.accommodation": string;
  "booking.estimatedTotal": string;
  "booking.selectRoomForPrice": string;
  "booking.submit": string;
  "booking.availabilityCalendar": string;
  "booking.availabilityDesc": string;
  "booking.available": string;
  "booking.busy": string;
  "booking.full": string;
  "booking.reservations": string;
  "booking.submitting": string;
  "booking.submitError": string;
  "booking.thankYou": string;
  "booking.confirmationMsg": string;
  "booking.makeAnother": string;
  "booking.notFound": string;
  "booking.notFoundDesc": string;
  "booking.emailPreviewTitle": string;
  "booking.whatGuestReceives": string;
  "booking.pricingType": string;
  "booking.pricingMenu": string;
  "booking.pricingFixed": string;
  "booking.fixedPrice": string;

  // Email
  "email.subject": string;
  "email.confirmationSubject": string;
  "email.confirmationTitle": string;
  "email.greeting": string;
  "email.confirmationBody": string;
  "email.confirmationFooter": string;
  "email.cancellationSubject": string;
  "email.cancellationTitle": string;
  "email.cancellationBody": string;
  "email.cancellationFooter": string;
  "email.confirmationTab": string;
  "email.cancellationTab": string;
  "email.at": string;
  "email.duration": string;
  "email.preview": string;
  "email.customMessage": string;
  "email.customMessagePlaceholder": string;
  "email.editDetails": string;
  "email.previewTab": string;

  // Admin
  "admin.addUser": string;
  "admin.role": string;
  "admin.staff": string;
  "admin.adminRole": string;
  "admin.owner": string;
  "admin.changePassword": string;
  "admin.newPassword": string;
  "admin.removeUser": string;
  "admin.userCreated": string;
  "admin.roleUpdated": string;
  "admin.passwordChanged": string;
  "admin.userRemoved": string;
  "admin.noUsers": string;
  "admin.loginHistory": string;
  "admin.noLoginHistory": string;
  "admin.auditLog": string;
  "admin.noAuditLog": string;
  "admin.permissions": string;
  "admin.addRole": string;
  "admin.roleName": string;
  "admin.roleKey": string;
  "admin.roleCreated": string;
  "admin.userManagement": string;
  "admin.userManagementDesc": string;
  "admin.approvedUsers": string;
  "admin.colName": string;
  "admin.colEmail": string;
  "admin.colRole": string;
  "admin.colStatus": string;
  "admin.colActions": string;
  "admin.statusApproved": string;
  "admin.statusPending": string;
  "admin.confirmRemove": string;
  "admin.confirmRemoveDesc": string;
  "admin.cancel": string;
  "admin.remove": string;
  "admin.supportRequests": string;
  "admin.noSupportRequests": string;
  "admin.supportRequestsDesc": string;
  "admin.colTime": string;
  "admin.colUser": string;
  "admin.colDevice": string;
  "admin.loginCount": string;
  "admin.auditLogDesc": string;
  "admin.colDate": string;
  "admin.colUserAudit": string;
  "admin.colEntity": string;
  "admin.colAction": string;
  "admin.colSummary": string;
  "admin.downloadPdf": string;
  "admin.previous": string;
  "admin.next": string;
  "admin.page": string;
  "admin.filtered": string;
  "admin.allActions": string;
  "admin.allEntities": string;
  "admin.created": string;
  "admin.updated": string;
  "admin.deleted": string;
  "admin.fieldsChanged": string;
  "admin.revert": string;
  "admin.revertConfirm": string;
  "admin.revertUpdate": string;
  "admin.revertInsert": string;
  "admin.revertDelete": string;
  "admin.reverting": string;
  "admin.reverted": string;
  "admin.revertedDesc": string;
  "admin.clear": string;
  "admin.from": string;
  "admin.to": string;
  "admin.allUsers": string;
  "admin.noMatchFilters": string;
  "admin.respondMarkFixed": string;
  "admin.sending": string;
  "admin.open": string;
  "admin.resolved": string;

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
  "dashboard.checkedIn": string;
  "dashboard.notCheckedIn": string;
  "dashboard.todayFilter": string;
  "dashboard.activeResources": string;
  "dashboard.bookingLink": string;
  "dashboard.bookingLinkDesc": string;
  "dashboard.copyLink": string;
  "dashboard.linkCopied": string;
  "dashboard.noReservations": string;
  "dashboard.confirmReservation": string;
  "dashboard.cancelReservation": string;
  "dashboard.confirmReservationMsg": string;
  "dashboard.cancelReservationMsg": string;
  "dashboard.statusUpdated": string;
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
  "dashboard.uploadImage": string;
  "dashboard.imageUploaded": string;
  "dashboard.imageUploadError": string;
  "dashboard.restaurant": string;
  "dashboard.venue": string;
  "dashboard.guesthouse": string;
  "dashboard.hotel": string;
  "dashboard.editReservation": string;
  "dashboard.reservationUpdated": string;
  "dashboard.reservationUpdateError": string;
  "dashboard.checkOutDate": string;
  "dashboard.priceEur": string;
  "dashboard.internalNotes": string;
  "dashboard.staffNotes": string;
  "dashboard.gallery": string;
  "dashboard.galleryHint": string;
  "dashboard.imageDeleted": string;
  "dashboard.maxImages": string;
  "dashboard.roomMultipliers": string;
  "dashboard.roomMultipliersDesc": string;
  "dashboard.roomSingle": string;
  "dashboard.roomDouble": string;
  "dashboard.roomSuite": string;
  "dashboard.roomDorm": string;
  "dashboard.newReservation": string;
  "dashboard.createReservation": string;
  "dashboard.reservationCreated": string;
  "dashboard.guestsToday": string;
  "dashboard.arrived": string;
  "dashboard.weekRevenue": string;
  "dashboard.weekReservations": string;
  "dashboard.weekGuests": string;
  "dashboard.utilizationToday": string;
  "dashboard.weekRevenueChart": string;
  "dashboard.todayByType": string;
  "dashboard.quickInfo": string;
  "dashboard.checkoutsToday": string;
  "dashboard.uninvoiced": string;
  "dashboard.calendarHotel": string;
  "dashboard.calendarVenue": string;
  "dashboard.calendarRestaurant": string;
  "dashboard.legendHasReservations": string;
  "dashboard.legendBlocked": string;
  "dashboard.legendRecurring": string;
  "dashboard.legendBoth": string;
  "dashboard.calendarTooltip": string;
  "dashboard.resourceManagement": string;
  "dashboard.resourceManagementDesc": string;
  "dashboard.actions": string;
  "dashboard.active": string;
  "dashboard.inactive": string;
  "dashboard.namePlaceholder": string;
  "dashboard.descriptionPlaceholder": string;
  "dashboard.capacityPlaceholder": string;
  "dashboard.pricePlaceholder": string;
  "dashboard.breakfastPlaceholder": string;
  "dashboard.venuePrice": string;
  "dashboard.roomPrice": string;
  "dashboard.breakfastPrice": string;
  "dashboard.pricingHint": string;
  "blocking.title": string;
  "blocking.tooltip": string;
  "blocking.addBlock": string;
  "blocking.clearRange": string;
  "blocking.removeByRange": string;
  "blocking.blockDates": string;
  "blocking.resourceType": string;
  "blocking.blockSpecific": string;
  "blocking.allWillBeBlocked": string;
  "blocking.selectResource": string;
  "blocking.dates": string;
  "blocking.pickDate": string;
  "blocking.dateHint": string;
  "blocking.duration": string;
  "blocking.fullDay": string;
  "blocking.specificHours": string;
  "blocking.startTime": string;
  "blocking.endTime": string;
  "blocking.timeHint": string;
  "blocking.reason": string;
  "blocking.reasonPlaceholder": string;
  "blocking.creating": string;
  "blocking.createBlock": string;
  "blocking.blockDays": string;
  "blocking.daysBlocked": string;
  "blocking.blockRemoved": string;
  "blocking.blocksRemoved": string;
  "blocking.removeBlock": string;
  "blocking.removeBlockDesc": string;
  "blocking.remove": string;
  "blocking.noBlocks": string;
  "blocking.noMatch": string;
  "blocking.allTypes": string;
  "blocking.allResources": string;
  "blocking.clearFilters": string;
  "blocking.filter": string;
  "blocking.dateRange": string;
  "blocking.rangeHint": string;
  "blocking.noBlocksInRange": string;
  "blocking.blocksWillBeRemoved": string;
  "blocking.removing": string;
  "blocking.removeCount": string;
  "blocking.allDay": string;
  "blocking.hotelGuesthouse": string;
  "blocking.restaurant": string;
  "blocking.venueEventSpace": string;
  "blocking.room": string;
  "blocking.tableArea": string;
  "blocking.eventSpace": string;
  "blocking.recurringTitle": string;
  "blocking.recurringTooltip": string;
  "blocking.addRecurring": string;
  "blocking.addRecurringTitle": string;
  "blocking.daysOfWeek": string;
  "blocking.recurringTimeHint": string;
  "blocking.recurringReasonPlaceholder": string;
  "blocking.blockWeekly": string;
  "blocking.recurringCreated": string;
  "blocking.recurringRemoved": string;
  "blocking.removeRecurring": string;
  "blocking.removeRecurringDesc": string;
  "blocking.noRecurring": string;
  "blocking.every": string;
  "blocking.dayNames": string;
  "booking.calculatePrice": string;

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
  "onboarding.hotelDesc": string;

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

  // Nav extras
  "nav.about": string;
  "nav.accessibility": string;

  // About
  "about.heroBadge": string;
  "about.heroTitle": string;
  "about.heroSubtitle": string;
  "about.missionBadge": string;
  "about.missionTitle": string;
  "about.missionP1": string;
  "about.missionP2": string;
  "about.point1Title": string;
  "about.point1Desc": string;
  "about.point2Title": string;
  "about.point2Desc": string;
  "about.point3Title": string;
  "about.point3Desc": string;
  "about.valuesTitle": string;
  "about.valuesSubtitle": string;
  "about.valuePrecision": string;
  "about.valuePrecisionDesc": string;
  "about.valueInnovation": string;
  "about.valueInnovationDesc": string;
  "about.valueCollaboration": string;
  "about.valueCollaborationDesc": string;
  "about.valueTrust": string;
  "about.valueTrustDesc": string;
  "about.valuePassion": string;
  "about.valuePassionDesc": string;
  "about.valueGlobal": string;
  "about.valueGlobalDesc": string;
  "about.ctaTitle": string;
  "about.ctaSubtitle": string;

  // Privacy
  "privacy.title": string;
  "privacy.lastUpdated": string;
  "privacy.s1Title": string;
  "privacy.s1P1": string;
  "privacy.s2Title": string;
  "privacy.s2P1": string;
  "privacy.s3Title": string;
  "privacy.s3P1": string;
  "privacy.s3Item1": string;
  "privacy.s3Item2": string;
  "privacy.s3Item3": string;
  "privacy.s3Item4": string;
  "privacy.s4Title": string;
  "privacy.s4P1": string;
  "privacy.s4Item1": string;
  "privacy.s4Item2": string;
  "privacy.s4Item3": string;
  "privacy.s5Title": string;
  "privacy.s5P1": string;
  "privacy.s6Title": string;
  "privacy.s6P1": string;
  "privacy.s6Item1": string;
  "privacy.s6Item2": string;
  "privacy.s6Item3": string;
  "privacy.s6Item4": string;
  "privacy.s6Item5": string;
  "privacy.s7Title": string;
  "privacy.s7P1": string;
  "privacy.s8Title": string;
  "privacy.s8P1": string;

  // Accessibility
  "a11y.title": string;
  "a11y.lastUpdated": string;
  "a11y.s1Title": string;
  "a11y.s1P1": string;
  "a11y.s2Title": string;
  "a11y.s2P1": string;
  "a11y.s2Item1": string;
  "a11y.s2Item2": string;
  "a11y.s2Item3": string;
  "a11y.s2Item4": string;
  "a11y.s2Item5": string;
  "a11y.s2Item6": string;
  "a11y.s3Title": string;
  "a11y.s3P1": string;
  "a11y.s3Item1": string;
  "a11y.s3Item2": string;
  "a11y.s3Item3": string;
  "a11y.s4Title": string;
  "a11y.s4P1": string;
  "a11y.s5Title": string;
  "a11y.s5P1": string;
  "a11y.widgetTitle": string;
  "a11y.fontSize": string;
  "a11y.highContrast": string;
  "a11y.dyslexiaFont": string;
  "a11y.reducedMotion": string;
  "a11y.focusHighlight": string;
  "a11y.resetAll": string;
  "a11y.on": string;
  "a11y.off": string;

  // Cookie
  "cookie.message": string;
  "cookie.privacyPolicy": string;
  "cookie.accept": string;
  "cookie.reject": string;

  // Password validation
  "password.minLength": string;
  "password.uppercase": string;
  "password.lowercase": string;
  "password.number": string;
  "password.checking": string;
  "password.breached": string;
  "password.safe": string;
  "password.strengthWeak": string;
  "password.strengthFair": string;
  "password.strengthStrong": string;
  "password.strengthVeryStrong": string;

  // Reset password
  "resetPassword.title": string;
  "resetPassword.subtitle": string;
  "resetPassword.newPassword": string;
  "resetPassword.confirmPassword": string;
  "resetPassword.confirmPlaceholder": string;
  "resetPassword.mismatch": string;
  "resetPassword.updating": string;
  "resetPassword.updateButton": string;
  "resetPassword.success": string;
  "resetPassword.updated": string;
  "resetPassword.redirecting": string;
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
  "nav.admin": "Admin",
  "nav.settings": "Settings",
  "nav.reports": "Reports",
  "nav.support": "Support",

  "reports.total": "Total",
  "reports.confirmed": "Confirmed",
  "reports.pending": "Pending",
  "reports.guest": "Guest",
  "reports.invoiced": "Invoiced",
  "reports.notInvoiced": "Not invoiced",
  "reports.notes": "Notes",
  "reports.yes": "Yes",
  "reports.no": "No",
  "reports.grandTotal": "Grand Total",
  "reports.totalPrice": "Total",
  "reports.totalRevenue": "Total Revenue",
  "reports.invoicing": "Invoicing",
  "reports.details": "Detailed list",
  "reports.chart.title": "Reservations by type",
  "reports.print": "Print",
  "reports.print.title": "Reservation Report",
  "reports.print.period": "Period",
  "reports.print.generated": "Generated",
  "reports.print.summary": "Summary",
  "reports.exportCsv": "Export CSV",
  "reports.compare": "Compare",
  "reports.vs": "vs",
  "reports.today": "Today",
  "reports.filter.all": "All",
  "reports.filter.notInvoiced": "Not invoiced",
  "reports.period.week": "Week",
  "reports.period.month": "Month",
  "reports.period.quarter": "Quarter",
  "reports.period.half": "Half year",
  "reports.period.year": "Year",
  "reports.period.custom": "Custom",
  "reports.breakfast": "Breakfast",
  "reports.breakfastRevenue": "Breakfast revenue",
  "reports.used": "Used",
  "reports.notUsed": "Not used",
  "reports.roomPrice": "Room",
  "reports.subtitle": "Reservation summary and invoicing overview",
  "reports.roomRevenue": "Room Revenue",
  "reports.breakfastLabel": "Breakfast",
  "reports.accommodationTotal": "Accommodation Total",
  "reports.roomAndBreakfast": "room + breakfast",
  "reports.uninvoicedAlert": "{count} uninvoiced out of {total} — {amount} uninvoiced",
  "reports.breakfastAlert": "{count} reservations, {nights} nights — estimated breakfast revenue {amount}",
  "reports.nights": "nights",
  "reports.reservations": "reservations",
  "reports.ofTotal": "total",
  "reports.invoicedPercent": "invoiced",

  // Settings
  "settings.businessDetails": "Business Details",
  "settings.brandColors": "Brand Colors",
  "settings.presets": "Presets",
  "settings.primary": "Primary",
  "settings.secondary": "Secondary",
  "settings.accent": "Accent",
  "settings.preview": "Preview",
  "settings.primaryBtn": "Primary Button",
  "settings.accentBtn": "Accent Button",
  "settings.saved": "Settings saved",
  "settings.saveError": "Failed to save settings",
  "settings.availabilityThresholds": "Availability Thresholds",
  "settings.availabilityThresholdsDesc": "Number of reservations before a day shows as 'Full' in the calendar.",
  "settings.fullThreshold": "Full at",
  "settings.logo": "Logo",
  "settings.uploadLogo": "Upload logo",
  "settings.uploading": "Uploading...",
  "settings.logoHint": "PNG, JPG, WebP or SVG. Max 2 MB.",
  "settings.logoUploaded": "Logo uploaded",
  "settings.logoUploadError": "Failed to upload logo",
  "settings.logoInvalidType": "Invalid file type. Use PNG, JPG, WebP or SVG.",
  "settings.logoTooLarge": "File too large. Max 2 MB.",
  "settings.heroImage": "Hero Image",
  "settings.uploadHeroImage": "Upload hero image",
  "settings.heroImageHint": "Recommended: 1600×600 px. PNG, JPG or WebP. Max 5 MB.",
  "settings.heroImageUploaded": "Hero image uploaded",
  "settings.heroImageUploadError": "Failed to upload hero image",

  // Booking
  "booking.title": "Make a Reservation",
  "booking.selectType": "What would you like to book?",
  "booking.typeDescRestaurant": "Reserve a table for dining",
  "booking.typeDescVenue": "Book a space for your event",
  "booking.typeDescGuesthouse": "Book a room for your stay",
  "booking.selectDateTime": "Select Date & Time",
  "booking.selectTime": "Select a time",
  "booking.selectResource": "Choose a space",
  "booking.yourDetails": "Your Details",
  "booking.guestCount": "Number of guests",
  "booking.specialRequests": "Special requests",
  "booking.preferredTime": "Preferred time",
  "booking.closedDay": "Closed on this day.",
  "booking.pickDate": "Pick a date",
  "booking.checkOutDate": "Check-out date",
  "booking.roomType": "Room type",
  "booking.breakfastIncluded": "Include breakfast",
  "booking.eventType": "Event type",
  "booking.estimatedGuests": "Estimated guests",
  "booking.cateringNeeded": "Catering needed",
  "booking.roomSingle": "Single",
  "booking.roomDouble": "Double",
  "booking.roomSuite": "Suite",
  "booking.roomDorm": "Dormitory",
  "booking.eventWedding": "Wedding",
  "booking.eventCorporate": "Corporate event",
  "booking.eventBirthday": "Birthday party",
  "booking.eventConference": "Conference",
  "booking.eventOther": "Other",
  "booking.priceSummary": "Price estimate",
  "booking.night": "night",
  "booking.nights": "nights",
  "booking.accommodation": "Accommodation",
  "booking.estimatedTotal": "Estimated total",
  "booking.selectRoomForPrice": "Select a room to see pricing",
  "booking.submit": "Submit Reservation",
  "booking.availabilityCalendar": "Availability",
  "booking.availabilityDesc": "See which dates are available for booking.",
  "booking.available": "Available",
  "booking.busy": "Busy",
  "booking.full": "Full",
  "booking.reservations": "reservations",
  "booking.submitting": "Submitting...",
  "booking.submitError": "Failed to submit reservation. Please try again.",
  "booking.thankYou": "Thank you!",
  "booking.confirmationMsg": "Your reservation has been received. We will confirm it shortly via email.",
  "booking.makeAnother": "Make another reservation",
  "booking.notFound": "Business not found",
  "booking.notFoundDesc": "The booking page you're looking for doesn't exist.",
  "booking.emailPreviewTitle": "Confirmation email preview",
  "booking.whatGuestReceives": "This is what the guest will receive via email:",
  "booking.pricingType": "Pricing",
  "booking.pricingMenu": "According to menu",
  "booking.pricingFixed": "Fixed price",
  "booking.fixedPrice": "Fixed price (€)",
  "email.subject": "Subject",
  "email.confirmationSubject": "Booking Confirmation",
  "email.confirmationTitle": "Booking Confirmed!",
  "email.greeting": "Dear",
  "email.confirmationBody": "We're pleased to confirm your reservation. Here are the details:",
  "email.confirmationFooter": "If you have any questions, don't hesitate to contact us. We look forward to welcoming you!",
  "email.cancellationSubject": "Booking Cancellation",
  "email.cancellationTitle": "Booking Cancelled",
  "email.cancellationBody": "We're sorry to inform you that your reservation has been cancelled. Here were the details:",
  "email.cancellationFooter": "If you believe this is an error or would like to rebook, please don't hesitate to contact us.",
  "email.confirmationTab": "Confirmation",
  "email.cancellationTab": "Cancellation",
  "email.at": "at",
  "email.duration": "Duration",
  "email.preview": "Email Preview",
  "email.customMessage": "Custom message",
  "email.customMessagePlaceholder": "Add a personal message to include in the email...",
  "email.editDetails": "Edit Details",
  "email.previewTab": "Email Preview",

  "admin.addUser": "Add User",
  "admin.role": "Role",
  "admin.staff": "Staff",
  "admin.adminRole": "Admin",
  "admin.owner": "Owner",
  "admin.changePassword": "Change Password",
  "admin.newPassword": "New Password",
  "admin.removeUser": "Remove User",
  "admin.userCreated": "User created",
  "admin.roleUpdated": "Role updated",
  "admin.passwordChanged": "Password changed",
  "admin.userRemoved": "User removed",
  "admin.noUsers": "No users found.",
  "admin.loginHistory": "Login History",
  "admin.noLoginHistory": "No login activity recorded yet.",
  "admin.auditLog": "Change Log",
  "admin.noAuditLog": "No changes recorded yet.",
  "admin.permissions": "Role Permissions",
  "admin.addRole": "Add Role",
  "admin.roleName": "Role Name",
  "admin.roleKey": "Role Key",
  "admin.roleCreated": "Role created",
  "admin.userManagement": "User Management",
  "admin.userManagementDesc": "Manage team members, assign roles, and control access.",
  "admin.approvedUsers": "Approved Users",
  "admin.colName": "Name",
  "admin.colEmail": "Email",
  "admin.colRole": "Role",
  "admin.colStatus": "Status",
  "admin.colActions": "Actions",
  "admin.statusApproved": "Approved",
  "admin.statusPending": "Pending",
  "admin.confirmRemove": "Are you sure?",
  "admin.confirmRemoveDesc": "Are you sure you want to remove this user? This action cannot be undone.",
  "admin.cancel": "Cancel",
  "admin.remove": "Remove",
  "admin.supportRequests": "Support Requests",
  "admin.noSupportRequests": "No support requests yet.",
  "admin.supportRequestsDesc": "Business tier users can submit requests via the chat widget.",
  "admin.colTime": "Time",
  "admin.colUser": "User",
  "admin.colDevice": "Device",
  "admin.loginCount": "entries",
  "admin.auditLogDesc": "A chronological record of all changes.",
  "admin.colDate": "Date",
  "admin.colUserAudit": "User",
  "admin.colEntity": "Entity",
  "admin.colAction": "Action",
  "admin.colSummary": "Summary",
  "admin.downloadPdf": "Download PDF",
  "admin.previous": "Previous",
  "admin.next": "Next",
  "admin.page": "Page",
  "admin.filtered": "filtered",
  "admin.allActions": "All actions",
  "admin.allEntities": "All entities",
  "admin.created": "Created",
  "admin.updated": "Updated",
  "admin.deleted": "Deleted",
  "admin.fieldsChanged": "fields changed",
  "admin.revert": "Revert",
  "admin.revertConfirm": "Revert this change?",
  "admin.revertUpdate": "This will restore the record to its previous values.",
  "admin.revertInsert": "This will delete the record that was created.",
  "admin.revertDelete": "This will re-create the record that was deleted.",
  "admin.reverting": "Reverting...",
  "admin.reverted": "Change reverted",
  "admin.revertedDesc": "The record has been restored to its previous state.",
  "admin.clear": "Clear",
  "admin.from": "From",
  "admin.to": "To",
  "admin.allUsers": "All users",
  "admin.noMatchFilters": "No entries match the selected filters.",
  "admin.respondMarkFixed": "Respond & Mark as Fixed",
  "admin.sending": "Sending...",
  "admin.open": "Open",
  "admin.resolved": "Resolved",

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
  "dashboard.checkedIn": "Checked in",
  "dashboard.notCheckedIn": "Not checked in",
  "dashboard.todayFilter": "Today",
  "dashboard.activeResources": "Active Resources",
  "dashboard.bookingLink": "Booking Link",
  "dashboard.bookingLinkDesc": "Share this link with your customers so they can make reservations.",
  "dashboard.copyLink": "Copy link",
  "dashboard.linkCopied": "Link copied to clipboard!",
  "dashboard.noReservations": "No reservations found.",
  "dashboard.confirmReservation": "Confirm",
  "dashboard.cancelReservation": "Cancel",
  "dashboard.confirmReservationMsg": "Confirm this reservation?",
  "dashboard.cancelReservationMsg": "Cancel this reservation?",
  "dashboard.statusUpdated": "Status updated",
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
  "dashboard.uploadImage": "Upload image",
  "dashboard.imageUploaded": "Image uploaded",
  "dashboard.imageUploadError": "Failed to upload image",
  "dashboard.restaurant": "Restaurant",
  "dashboard.venue": "Venue",
  "dashboard.guesthouse": "Hotel / Gasthaus",
  "dashboard.hotel": "Hotel / Gasthaus",
  "dashboard.editReservation": "Edit Reservation",
  "dashboard.reservationUpdated": "Reservation updated",
  "dashboard.reservationUpdateError": "Failed to update reservation",
  "dashboard.checkOutDate": "Check-out date",
  "dashboard.priceEur": "Price (EUR)",
  "dashboard.internalNotes": "Internal notes",
  "dashboard.staffNotes": "Staff notes",
  "dashboard.gallery": "Image Gallery",
  "dashboard.galleryHint": "Up to 5 images. PNG, JPG or WebP. Max 5 MB each.",
  "dashboard.imageDeleted": "Image deleted",
  "dashboard.maxImages": "Maximum 5 images reached",
  "dashboard.roomMultipliers": "Room type price multipliers",
  "dashboard.roomMultipliersDesc": "Multiplied by base price per night. E.g. 1.5× at €100 base = €150.",
  "dashboard.roomSingle": "Single",
  "dashboard.roomDouble": "Double",
  "dashboard.roomSuite": "Suite",
  "dashboard.roomDorm": "Dorm",
  "dashboard.newReservation": "New Reservation",
  "dashboard.createReservation": "Create Reservation",
  "dashboard.reservationCreated": "Reservation created successfully",
  "dashboard.guestsToday": "Guests today",
  "dashboard.arrived": "Arrived",
  "dashboard.weekRevenue": "Week's revenue",
  "dashboard.weekReservations": "Week's reservations",
  "dashboard.weekGuests": "Week's guests",
  "dashboard.utilizationToday": "Utilization today",
  "dashboard.weekRevenueChart": "Week's revenue trend",
  "dashboard.todayByType": "Today by type",
  "dashboard.quickInfo": "Quick info",
  "dashboard.checkoutsToday": "Check-outs today",
  "dashboard.uninvoiced": "Uninvoiced",
  "dashboard.calendarHotel": "Hotel / Guesthouse",
  "dashboard.calendarVenue": "Event Spaces",
  "dashboard.calendarRestaurant": "Restaurant",
  "dashboard.legendHasReservations": "Has reservations",
  "dashboard.legendBlocked": "Blocked",
  "dashboard.legendRecurring": "Recurring block",
  "dashboard.legendBoth": "Both",
  "dashboard.calendarTooltip": "Click a date to see its reservations. Highlighted dates have bookings. Red dates have one-off blocks. Purple dashed dates have recurring blocks.",
  "dashboard.resourceManagement": "Resource Management",
  "dashboard.resourceManagementDesc": "Manage spaces, rooms and tables",
  "dashboard.actions": "Actions",
  "dashboard.active": "Active",
  "dashboard.inactive": "Inactive",
  "dashboard.namePlaceholder": "e.g. Banquet Hall",
  "dashboard.descriptionPlaceholder": "Short description...",
  "dashboard.capacityPlaceholder": "e.g. 50",
  "dashboard.pricePlaceholder": "e.g. 140",
  "dashboard.breakfastPlaceholder": "e.g. 15",
  "dashboard.venuePrice": "Space price (€)",
  "dashboard.roomPrice": "Room price (€/night)",
  "dashboard.breakfastPrice": "Breakfast price (€/person/morning)",
  "dashboard.pricingHint": "Default price for new reservations. Individual reservation prices can be adjusted in the reservation details.",
  "blocking.title": "Blocked Dates & Times",
  "blocking.tooltip": "Block entire resource types or specific resources on chosen dates or date ranges. Optionally restrict to specific hours.",
  "blocking.addBlock": "Add Block",
  "blocking.clearRange": "Clear Range",
  "blocking.removeByRange": "Remove Blocks by Date Range",
  "blocking.blockDates": "Block Dates / Times",
  "blocking.resourceType": "Resource Type",
  "blocking.blockSpecific": "Block specific",
  "blocking.allWillBeBlocked": "All {count} {type} will be blocked.",
  "blocking.selectResource": "Select {type}...",
  "blocking.dates": "Date(s)",
  "blocking.pickDate": "Pick a date or range",
  "blocking.dateHint": "Click once for a single day, or click two dates to select a range.",
  "blocking.duration": "Duration",
  "blocking.fullDay": "Full day",
  "blocking.specificHours": "Specific hours",
  "blocking.startTime": "Start Time",
  "blocking.endTime": "End Time",
  "blocking.timeHint": "Only the selected hours will be blocked. Bookings outside this window remain available.",
  "blocking.reason": "Reason (optional)",
  "blocking.reasonPlaceholder": "e.g. Maintenance, Private event...",
  "blocking.creating": "Creating...",
  "blocking.createBlock": "Create Block",
  "blocking.blockDays": "Block {count} days",
  "blocking.daysBlocked": "{count} day(s) blocked",
  "blocking.blockRemoved": "Block removed",
  "blocking.blocksRemoved": "Blocks removed",
  "blocking.removeBlock": "Remove Block",
  "blocking.removeBlockDesc": "This will remove the block for {date}. Bookings will be allowed again.",
  "blocking.remove": "Remove",
  "blocking.noBlocks": "No blocked dates or times configured.",
  "blocking.noMatch": "No blocks match the current filter.",
  "blocking.allTypes": "All types",
  "blocking.allResources": "All resources",
  "blocking.clearFilters": "Clear filters",
  "blocking.filter": "Filter:",
  "blocking.dateRange": "Date Range",
  "blocking.rangeHint": "All blocks within this range will be removed.",
  "blocking.noBlocksInRange": "No blocks found in this range.",
  "blocking.blocksWillBeRemoved": "{count} block(s) will be removed.",
  "blocking.removing": "Removing...",
  "blocking.removeCount": "Remove {count} block(s)",
  "blocking.allDay": "All day",
  "blocking.hotelGuesthouse": "Hotel / Guesthouse",
  "blocking.restaurant": "Restaurant",
  "blocking.venueEventSpace": "Venue / Event Space",
  "blocking.room": "room",
  "blocking.tableArea": "table/area",
  "blocking.eventSpace": "event space",
  "blocking.recurringTitle": "Recurring Blocks",
  "blocking.recurringTooltip": "Block specific days of the week on a recurring basis. E.g. block every Monday for restaurant.",
  "blocking.addRecurring": "Add Recurring Block",
  "blocking.addRecurringTitle": "Add Recurring Block",
  "blocking.daysOfWeek": "Days of Week",
  "blocking.recurringTimeHint": "Only the selected hours will be blocked each week. Bookings outside this window remain available.",
  "blocking.recurringReasonPlaceholder": "e.g. Closed on Mondays, Staff day off...",
  "blocking.blockWeekly": "Block {count} day(s) weekly",
  "blocking.recurringCreated": "Recurring block created",
  "blocking.recurringRemoved": "Recurring block removed",
  "blocking.removeRecurring": "Remove Recurring Block",
  "blocking.removeRecurringDesc": "This will remove the recurring block for every {day}.",
  "blocking.noRecurring": "No recurring blocks configured.",
  "blocking.every": "Every",
  "blocking.dayNames": "Sun,Mon,Tue,Wed,Thu,Fri,Sat",
  "booking.calculatePrice": "Calculate Price",

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
  "onboarding.hotelDesc": "Hotel and gasthaus rooms.",
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

  "nav.about": "About",
  "nav.accessibility": "Accessibility",

  "about.heroBadge": "Our Story",
  "about.heroTitle": "The reservation platform built with care",
  "about.heroSubtitle": "We help hospitality businesses manage their bookings effortlessly — so they can focus on creating memorable guest experiences.",
  "about.missionBadge": "Our Mission",
  "about.missionTitle": "Making reservation management simple and elegant",
  "about.missionP1": "Small hospitality businesses deserve the same powerful tools that large chains use. We started MinnowBook to make that happen.",
  "about.missionP2": "Our platform brings reservations, branding, team management, and reporting into one unified workspace — eliminating scattered notebooks and missed bookings.",
  "about.point1Title": "Speed without compromise",
  "about.point1Desc": "Get your branded booking page live in minutes, not weeks.",
  "about.point2Title": "Data-driven insights",
  "about.point2Desc": "Track reservation trends, occupancy, and revenue at a glance.",
  "about.point3Title": "Built for teams",
  "about.point3Desc": "Role-based access and multi-staff support built in.",
  "about.valuesTitle": "Our core values",
  "about.valuesSubtitle": "These principles guide every decision we make, from product design to customer support.",
  "about.valuePrecision": "Precision",
  "about.valuePrecisionDesc": "Every detail matters — from pixel-perfect booking pages to accurate availability calendars.",
  "about.valueInnovation": "Innovation",
  "about.valueInnovationDesc": "We continuously improve our platform with the latest technology and user feedback.",
  "about.valueCollaboration": "Collaboration",
  "about.valueCollaborationDesc": "We work closely with hospitality businesses to understand their real needs.",
  "about.valueTrust": "Trust",
  "about.valueTrustDesc": "Your data is secure. We follow GDPR standards and best security practices.",
  "about.valuePassion": "Passion",
  "about.valuePassionDesc": "We're passionate about helping small businesses succeed in hospitality.",
  "about.valueGlobal": "Accessibility",
  "about.valueGlobalDesc": "Our platform is multilingual and designed to be accessible to everyone.",
  "about.ctaTitle": "Ready to simplify your reservations?",
  "about.ctaSubtitle": "Join hospitality businesses already using MinnowBook to streamline their bookings.",

  "privacy.title": "Privacy Policy",
  "privacy.lastUpdated": "Last updated:",
  "privacy.s1Title": "1. Introduction",
  "privacy.s1P1": "This privacy policy explains how MinnowBook collects, uses, stores, and protects your personal data when you use our reservation management platform. We are committed to protecting your privacy in accordance with the EU General Data Protection Regulation (GDPR).",
  "privacy.s2Title": "2. Data Controller",
  "privacy.s2P1": "MinnowBook is the data controller for the personal data processed through this platform. For data protection inquiries, please contact us through the Support page.",
  "privacy.s3Title": "3. Data We Collect",
  "privacy.s3P1": "We collect the following categories of personal data:",
  "privacy.s3Item1": "Account information: name, email address, password (hashed)",
  "privacy.s3Item2": "Business information: business name, address, phone number",
  "privacy.s3Item3": "Reservation data: guest names, emails, phone numbers, booking details",
  "privacy.s3Item4": "Usage data: pages visited, features used, browser type",
  "privacy.s4Title": "4. Purpose of Processing",
  "privacy.s4P1": "We process your data for the following purposes:",
  "privacy.s4Item1": "To provide and maintain our reservation management service",
  "privacy.s4Item2": "To send booking confirmations, reminders, and cancellation notices",
  "privacy.s4Item3": "To improve our platform and develop new features",
  "privacy.s5Title": "5. Data Retention",
  "privacy.s5P1": "We retain your personal data for as long as your account is active or as needed to provide our services. Reservation data is retained for the duration of your subscription plus 12 months. You can request deletion of your data at any time.",
  "privacy.s6Title": "6. Your Rights",
  "privacy.s6P1": "Under GDPR, you have the following rights regarding your personal data:",
  "privacy.s6Item1": "Right of access — request a copy of your personal data",
  "privacy.s6Item2": "Right to rectification — correct inaccurate data",
  "privacy.s6Item3": "Right to erasure — request deletion of your data",
  "privacy.s6Item4": "Right to restrict processing",
  "privacy.s6Item5": "Right to data portability — receive your data in a structured format",
  "privacy.s7Title": "7. Cookies",
  "privacy.s7P1": "We use essential cookies required for the platform to function. Analytics cookies are only loaded after you give explicit consent via our cookie banner. You can change your cookie preferences at any time.",
  "privacy.s8Title": "8. Contact",
  "privacy.s8P1": "For any questions about this privacy policy or to exercise your data protection rights, please contact us through the Support page.",

  "a11y.title": "Accessibility Statement",
  "a11y.lastUpdated": "Last updated:",
  "a11y.s1Title": "1. Our Commitment",
  "a11y.s1P1": "MinnowBook is committed to ensuring digital accessibility for people of all abilities. We continually improve the user experience for everyone and apply relevant accessibility standards.",
  "a11y.s2Title": "2. Accessibility Features",
  "a11y.s2P1": "Our platform includes the following accessibility features:",
  "a11y.s2Item1": "Adjustable font size (80%–150%)",
  "a11y.s2Item2": "High contrast mode for improved readability",
  "a11y.s2Item3": "Dyslexia-friendly font option",
  "a11y.s2Item4": "Reduced motion mode to minimize animations",
  "a11y.s2Item5": "Enhanced focus indicators for keyboard navigation",
  "a11y.s2Item6": "Keyboard shortcut (Alt+A) to open the accessibility widget",
  "a11y.s3Title": "3. Standards",
  "a11y.s3P1": "We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. Key areas include:",
  "a11y.s3Item1": "Semantic HTML for screen reader compatibility",
  "a11y.s3Item2": "Sufficient color contrast ratios",
  "a11y.s3Item3": "Keyboard-navigable interface throughout",
  "a11y.s4Title": "4. Known Limitations",
  "a11y.s4P1": "While we strive for full accessibility, some third-party components or dynamically loaded content may not yet meet all WCAG 2.1 AA criteria. We are actively working to address these.",
  "a11y.s5Title": "5. Feedback",
  "a11y.s5P1": "We welcome your feedback on the accessibility of MinnowBook. Please contact us through the Support page if you encounter any barriers or have suggestions for improvement.",
  "a11y.widgetTitle": "Accessibility",
  "a11y.fontSize": "Font size",
  "a11y.highContrast": "High contrast",
  "a11y.dyslexiaFont": "Dyslexia font",
  "a11y.reducedMotion": "Reduced motion",
  "a11y.focusHighlight": "Focus highlight",
  "a11y.resetAll": "Reset all",
  "a11y.on": "On",
  "a11y.off": "Off",

  "cookie.message": "We use cookies to improve your experience.",
  "cookie.privacyPolicy": "Privacy Policy",
  "cookie.accept": "Accept",
  "cookie.reject": "Reject",
  "password.minLength": "At least 12 characters",
  "password.uppercase": "One uppercase letter",
  "password.lowercase": "One lowercase letter",
  "password.number": "One number",
  "password.checking": "Checking for leaked passwords…",
  "password.breached": "This password has been found in data breaches — choose a different one",
  "password.safe": "Password not found in known breaches",
  "password.strengthWeak": "Weak",
  "password.strengthFair": "Fair",
  "password.strengthStrong": "Strong",
  "password.strengthVeryStrong": "Very strong",
  "resetPassword.title": "Set new password",
  "resetPassword.subtitle": "Enter your new password below.",
  "resetPassword.newPassword": "New password",
  "resetPassword.confirmPassword": "Confirm new password",
  "resetPassword.confirmPlaceholder": "Repeat your password",
  "resetPassword.mismatch": "Passwords do not match",
  "resetPassword.updating": "Updating...",
  "resetPassword.updateButton": "Update password",
  "resetPassword.success": "Password updated successfully!",
  "resetPassword.updated": "Password updated",
  "resetPassword.redirecting": "Redirecting you to login...",
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
  "nav.admin": "Hallinta",
  "nav.settings": "Asetukset",
  "nav.reports": "Raportit",
  "nav.support": "Tuki",

  "reports.total": "Yhteensä",
  "reports.confirmed": "Vahvistettu",
  "reports.pending": "Odottaa",
  "reports.guest": "Vieras",
  "reports.invoiced": "Laskutettu",
  "reports.notInvoiced": "Laskuttamatta",
  "reports.notes": "Muistiinpanot",
  "reports.yes": "Kyllä",
  "reports.no": "Ei",
  "reports.grandTotal": "Kokonaissumma",
  "reports.totalPrice": "Yhteensä",
  "reports.totalRevenue": "Kokonaistulo",
  "reports.invoicing": "Laskutus",
  "reports.details": "Yksityiskohtainen lista",
  "reports.chart.title": "Varaukset tyypeittäin",
  "reports.print": "Tulosta",
  "reports.print.title": "Varausraportti",
  "reports.print.period": "Jakso",
  "reports.print.generated": "Luotu",
  "reports.print.summary": "Yhteenveto",
  "reports.exportCsv": "Vie CSV",
  "reports.compare": "Vertaa",
  "reports.vs": "vs",
  "reports.today": "Tänään",
  "reports.filter.all": "Kaikki",
  "reports.filter.notInvoiced": "Laskuttamatta",
  "reports.period.week": "Viikko",
  "reports.period.month": "Kuukausi",
  "reports.period.quarter": "Neljännes",
  "reports.period.half": "Puoli vuotta",
  "reports.period.year": "Vuosi",
  "reports.period.custom": "Mukautettu",
  "reports.breakfast": "Aamiainen",
  "reports.breakfastRevenue": "Aamiaistulo",
  "reports.used": "Käytetty",
  "reports.notUsed": "Ei käytetty",
  "reports.roomPrice": "Huone",
  "reports.subtitle": "Varausten yhteenveto ja laskutuksen seuranta",
  "reports.roomRevenue": "Huonetulo",
  "reports.breakfastLabel": "Aamupala",
  "reports.accommodationTotal": "Yhteensä",
  "reports.roomAndBreakfast": "huone + aamupala",
  "reports.uninvoicedAlert": "{count} ei laskutettu kaikista {total} — {amount} ei laskutettu",
  "reports.breakfastAlert": "{count} varausta, {nights} yötä — arvioitu aamupalatulo {amount}",
  "reports.nights": "yötä",
  "reports.reservations": "varausta",
  "reports.ofTotal": "yhteensä",
  "reports.invoicedPercent": "laskutettu",

  // Settings
  "settings.businessDetails": "Yritystiedot",
  "settings.brandColors": "Brändivärit",
  "settings.presets": "Esiasetukset",
  "settings.primary": "Pääväri",
  "settings.secondary": "Toissijainen",
  "settings.accent": "Korostus",
  "settings.preview": "Esikatselu",
  "settings.primaryBtn": "Pääpainike",
  "settings.accentBtn": "Korostuspainike",
  "settings.saved": "Asetukset tallennettu",
  "settings.saveError": "Asetusten tallennus epäonnistui",
  "settings.availabilityThresholds": "Saatavuusrajat",
  "settings.availabilityThresholdsDesc": "Varausten määrä, jolloin päivä näytetään kalenterissa 'Täynnä'-tilassa.",
  "settings.fullThreshold": "Täynnä kun",
  "settings.logo": "Logo",
  "settings.uploadLogo": "Lataa logo",
  "settings.uploading": "Ladataan...",
  "settings.logoHint": "PNG, JPG, WebP tai SVG. Maks. 2 Mt.",
  "settings.logoUploaded": "Logo ladattu",
  "settings.logoUploadError": "Logon lataus epäonnistui",
  "settings.logoInvalidType": "Virheellinen tiedostotyyppi. Käytä PNG, JPG, WebP tai SVG.",
  "settings.logoTooLarge": "Tiedosto liian suuri. Maks. 2 Mt.",
  "settings.heroImage": "Hero-kuva",
  "settings.uploadHeroImage": "Lataa hero-kuva",
  "settings.heroImageHint": "Suositus: 1600×600 px. PNG, JPG tai WebP. Maks. 5 Mt.",
  "settings.heroImageUploaded": "Hero-kuva ladattu",
  "settings.heroImageUploadError": "Hero-kuvan lataus epäonnistui",

  // Booking
  "booking.title": "Tee varaus",
  "booking.selectType": "Mitä haluat varata?",
  "booking.typeDescRestaurant": "Varaa pöytä ravintolasta",
  "booking.typeDescVenue": "Varaa tila tapahtumallesi",
  "booking.typeDescGuesthouse": "Varaa huone yöpymiseen",
  "booking.selectDateTime": "Valitse päivä ja aika",
  "booking.selectTime": "Valitse aika",
  "booking.selectResource": "Valitse tila",
  "booking.yourDetails": "Omat tiedot",
  "booking.guestCount": "Vieraiden määrä",
  "booking.specialRequests": "Erityistoiveet",
  "booking.preferredTime": "Toivottu aika",
  "booking.closedDay": "Suljettu tänä päivänä.",
  "booking.pickDate": "Valitse päivämäärä",
  "booking.checkOutDate": "Lähtöpäivä",
  "booking.roomType": "Huonetyyppi",
  "booking.breakfastIncluded": "Sisällytä aamiainen",
  "booking.eventType": "Tapahtumatyyppi",
  "booking.estimatedGuests": "Arvioitu vierasmäärä",
  "booking.cateringNeeded": "Catering-palvelu",
  "booking.roomSingle": "Yhden hengen",
  "booking.roomDouble": "Kahden hengen",
  "booking.roomSuite": "Sviitti",
  "booking.roomDorm": "Makuusali",
  "booking.eventWedding": "Häät",
  "booking.eventCorporate": "Yritystilaisuus",
  "booking.eventBirthday": "Syntymäpäiväjuhlat",
  "booking.eventConference": "Konferenssi",
  "booking.eventOther": "Muu",
  "booking.priceSummary": "Hinta-arvio",
  "booking.night": "yö",
  "booking.nights": "yötä",
  "booking.accommodation": "Majoitus",
  "booking.estimatedTotal": "Arvioitu kokonaishinta",
  "booking.selectRoomForPrice": "Valitse huone nähdäksesi hinnat",
  "booking.submit": "Lähetä varaus",
  "booking.availabilityCalendar": "Saatavuus",
  "booking.availabilityDesc": "Katso mitkä päivät ovat vapaana varauksille.",
  "booking.available": "Vapaa",
  "booking.busy": "Varattu",
  "booking.full": "Täynnä",
  "booking.reservations": "varausta",
  "booking.submitting": "Lähetetään...",
  "booking.submitError": "Varauksen lähetys epäonnistui. Yritä uudelleen.",
  "booking.thankYou": "Kiitos!",
  "booking.confirmationMsg": "Varauksesi on vastaanotettu. Vahvistamme sen pian sähköpostitse.",
  "booking.makeAnother": "Tee uusi varaus",
  "booking.notFound": "Yritystä ei löytynyt",
  "booking.notFoundDesc": "Etsimääsi varaussivua ei ole olemassa.",
  "booking.emailPreviewTitle": "Vahvistussähköpostin esikatselu",
  "booking.whatGuestReceives": "Tämän vierailija saa sähköpostitse:",
  "booking.pricingType": "Hinnoittelu",
  "booking.pricingMenu": "Listan mukaan",
  "booking.pricingFixed": "Kiinteä hinta",
  "booking.fixedPrice": "Kiinteä hinta (€)",
  "email.subject": "Aihe",
  "email.confirmationSubject": "Varausvahvistus",
  "email.confirmationTitle": "Varaus vahvistettu!",
  "email.greeting": "Hyvä",
  "email.confirmationBody": "Meillä on ilo vahvistaa varauksenne. Tässä ovat tiedot:",
  "email.confirmationFooter": "Jos sinulla on kysyttävää, ota rohkeasti yhteyttä. Odotamme innolla vierailuasi!",
  "email.cancellationSubject": "Varauksen peruutus",
  "email.cancellationTitle": "Varaus peruutettu",
  "email.cancellationBody": "Valitettavasti varauksesi on peruutettu. Tässä olivat varauksen tiedot:",
  "email.cancellationFooter": "Jos uskot tämän olevan virhe tai haluat tehdä uuden varauksen, ota meihin yhteyttä.",
  "email.confirmationTab": "Vahvistus",
  "email.cancellationTab": "Peruutus",
  "email.at": "klo",
  "email.duration": "Kesto",
  "email.preview": "Sähköpostin esikatselu",
  "email.customMessage": "Mukautettu viesti",
  "email.customMessagePlaceholder": "Lisää henkilökohtainen viesti sähköpostiin...",
  "email.editDetails": "Muokkaa tietoja",
  "email.previewTab": "Sähköpostin esikatselu",

  "admin.addUser": "Lisää käyttäjä",
  "admin.role": "Rooli",
  "admin.staff": "Henkilökunta",
  "admin.adminRole": "Ylläpitäjä",
  "admin.owner": "Omistaja",
  "admin.changePassword": "Vaihda salasana",
  "admin.newPassword": "Uusi salasana",
  "admin.removeUser": "Poista käyttäjä",
  "admin.userCreated": "Käyttäjä luotu",
  "admin.roleUpdated": "Rooli päivitetty",
  "admin.passwordChanged": "Salasana vaihdettu",
  "admin.userRemoved": "Käyttäjä poistettu",
  "admin.noUsers": "Ei käyttäjiä.",
  "admin.loginHistory": "Kirjautumishistoria",
  "admin.noLoginHistory": "Kirjautumistietoja ei ole vielä tallennettu.",
  "admin.auditLog": "Muutosloki",
  "admin.noAuditLog": "Muutoksia ei ole vielä tallennettu.",
  "admin.permissions": "Roolien oikeudet",
  "admin.addRole": "Lisää rooli",
  "admin.roleName": "Roolin nimi",
  "admin.roleKey": "Roolin avain",
  "admin.roleCreated": "Rooli luotu",
  "admin.userManagement": "Käyttäjähallinta",
  "admin.userManagementDesc": "Hallitse tiimin jäseniä, rooleja ja käyttöoikeuksia.",
  "admin.approvedUsers": "Hyväksytyt käyttäjät",
  "admin.colName": "Nimi",
  "admin.colEmail": "Sähköposti",
  "admin.colRole": "Rooli",
  "admin.colStatus": "Tila",
  "admin.colActions": "Toiminnot",
  "admin.statusApproved": "Hyväksytty",
  "admin.statusPending": "Odottaa",
  "admin.confirmRemove": "Oletko varma?",
  "admin.confirmRemoveDesc": "Haluatko varmasti poistaa tämän käyttäjän? Toimintoa ei voi perua.",
  "admin.cancel": "Peruuta",
  "admin.remove": "Poista",
  "admin.supportRequests": "Avustajapyynnöt",
  "admin.noSupportRequests": "Ei avustajapyyntöjä vielä.",
  "admin.supportRequestsDesc": "Business-tason käyttäjät voivat lähettää pyyntöjä chat-widgetin kautta.",
  "admin.colTime": "Aika",
  "admin.colUser": "Käyttäjä",
  "admin.colDevice": "Laite",
  "admin.loginCount": "merkintää",
  "admin.auditLogDesc": "Kronologinen lokitiedosto kaikista muutoksista.",
  "admin.colDate": "Päivämäärä",
  "admin.colUserAudit": "Käyttäjä",
  "admin.colEntity": "Kohde",
  "admin.colAction": "Toiminto",
  "admin.colSummary": "Yhteenveto",
  "admin.downloadPdf": "Tulosta PDF",
  "admin.previous": "Edellinen",
  "admin.next": "Seuraava",
  "admin.page": "Sivu",
  "admin.filtered": "suodatettu",
  "admin.allActions": "Kaikki toiminnot",
  "admin.allEntities": "Kaikki kohteet",
  "admin.created": "Luotu",
  "admin.updated": "Päivitetty",
  "admin.deleted": "Poistettu",
  "admin.fieldsChanged": "kenttää muutettu",
  "admin.revert": "Palauta",
  "admin.revertConfirm": "Palautetaanko tämä muutos?",
  "admin.revertUpdate": "Tämä palauttaa tietueen aiempiin arvoihin.",
  "admin.revertInsert": "Tämä poistaa luodun tietueen.",
  "admin.revertDelete": "Tämä luo uudelleen poistetun tietueen.",
  "admin.reverting": "Palautetaan...",
  "admin.reverted": "Muutos palautettu",
  "admin.revertedDesc": "Tietue on palautettu aiempaan tilaansa.",
  "admin.clear": "Tyhjennä",
  "admin.from": "Alkaen",
  "admin.to": "Päättyen",
  "admin.allUsers": "Kaikki käyttäjät",
  "admin.noMatchFilters": "Valitut suodattimet eivät tuottaneet tuloksia.",
  "admin.respondMarkFixed": "Vastaa ja merkitse ratkaistuksi",
  "admin.sending": "Lähetetään...",
  "admin.open": "Avoin",
  "admin.resolved": "Ratkaistu",

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
  "dashboard.checkedIn": "Kirjautunut",
  "dashboard.notCheckedIn": "Ei kirjautunut",
  "dashboard.todayFilter": "Tänään",
  "dashboard.activeResources": "Aktiiviset resurssit",
  "dashboard.bookingLink": "Varauslinkki",
  "dashboard.bookingLinkDesc": "Jaa tämä linkki asiakkaillesi, jotta he voivat tehdä varauksia.",
  "dashboard.copyLink": "Kopioi linkki",
  "dashboard.linkCopied": "Linkki kopioitu leikepöydälle!",
  "dashboard.noReservations": "Ei varauksia.",
  "dashboard.confirmReservation": "Vahvista",
  "dashboard.cancelReservation": "Peruuta",
  "dashboard.confirmReservationMsg": "Vahvista tämä varaus?",
  "dashboard.cancelReservationMsg": "Peruuta tämä varaus?",
  "dashboard.statusUpdated": "Tila päivitetty",
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
  "dashboard.uploadImage": "Lataa kuva",
  "dashboard.imageUploaded": "Kuva ladattu",
  "dashboard.imageUploadError": "Kuvan lataus epäonnistui",
  "dashboard.restaurant": "Ravintola",
  "dashboard.venue": "Tila",
  "dashboard.guesthouse": "Hotelli / Gasthaus",
  "dashboard.hotel": "Hotelli / Gasthaus",
  "dashboard.editReservation": "Muokkaa varausta",
  "dashboard.reservationUpdated": "Varaus päivitetty",
  "dashboard.reservationUpdateError": "Varauksen päivitys epäonnistui",
  "dashboard.checkOutDate": "Lähtöpäivä",
  "dashboard.priceEur": "Hinta (EUR)",
  "dashboard.internalNotes": "Sisäiset muistiinpanot",
  "dashboard.staffNotes": "Henkilökunnan muistiinpanot",
  "dashboard.gallery": "Kuvagalleria",
  "dashboard.galleryHint": "Enintään 5 kuvaa. PNG, JPG tai WebP. Max 5 MB/kuva.",
  "dashboard.imageDeleted": "Kuva poistettu",
  "dashboard.maxImages": "Enintään 5 kuvaa",
  "dashboard.roomMultipliers": "Huonetyyppien hintakertoimet",
  "dashboard.roomMultipliersDesc": "Kerrotaan yöhinnalla. Esim. 1,5× ja €100 pohja = €150.",
  "dashboard.roomSingle": "Yhden hengen",
  "dashboard.roomDouble": "Kahden hengen",
  "dashboard.roomSuite": "Sviitti",
  "dashboard.roomDorm": "Makuusali",
  "dashboard.newReservation": "Uusi varaus",
  "dashboard.createReservation": "Luo varaus",
  "dashboard.reservationCreated": "Varaus luotu onnistuneesti",
  "dashboard.guestsToday": "Vieraita tänään",
  "dashboard.arrived": "Saapunut",
  "dashboard.weekRevenue": "Viikon liikevaihto",
  "dashboard.weekReservations": "Viikon varaukset",
  "dashboard.weekGuests": "Viikon vieraat",
  "dashboard.utilizationToday": "Käyttöaste tänään",
  "dashboard.weekRevenueChart": "Viikon liikevaihdon kehitys",
  "dashboard.todayByType": "Tänään tyypeittäin",
  "dashboard.quickInfo": "Pikatiedot",
  "dashboard.checkoutsToday": "Uloskirjaukset tänään",
  "dashboard.uninvoiced": "Laskuttamatta",
  "dashboard.calendarHotel": "Hotelli / Majatalo",
  "dashboard.calendarVenue": "Juhlatilat",
  "dashboard.calendarRestaurant": "Ravintola",
  "dashboard.legendHasReservations": "Varauksia",
  "dashboard.legendBlocked": "Estetty",
  "dashboard.legendRecurring": "Toistuva esto",
  "dashboard.legendBoth": "Molemmat",
  "dashboard.calendarTooltip": "Klikkaa päivää nähdäksesi sen varaukset. Korostetut päivät sisältävät varauksia. Punaiset päivät sisältävät yksittäisiä estoja. Violetit katkoviivapäivät sisältävät toistuvia estoja.",
  "dashboard.resourceManagement": "Resurssien hallinta",
  "dashboard.resourceManagementDesc": "Hallitse tiloja, huoneita ja pöytiä",
  "dashboard.actions": "Toiminnot",
  "dashboard.active": "Aktiivinen",
  "dashboard.inactive": "Ei aktiivinen",
  "dashboard.namePlaceholder": "Esim. Juhlasali",
  "dashboard.descriptionPlaceholder": "Lyhyt kuvaus...",
  "dashboard.capacityPlaceholder": "esim. 50",
  "dashboard.pricePlaceholder": "esim. 140",
  "dashboard.breakfastPlaceholder": "esim. 15",
  "dashboard.venuePrice": "Tilahinta (€)",
  "dashboard.roomPrice": "Huonehinta (€/yö)",
  "dashboard.breakfastPrice": "Aamupalahinta (€/hlö/aamu)",
  "dashboard.pricingHint": "Oletushinta uusille varauksille. Yksittäisen varauksen hintaa voi muuttaa sisäisissä tiedoissa.",
  "blocking.title": "Estetyt päivät ja ajat",
  "blocking.tooltip": "Estä kokonaisia resurssityyppejä tai yksittäisiä resursseja valituille päiville tai ajanjaksoille. Voit rajata myös tiettyihin tunteihin.",
  "blocking.addBlock": "Lisää esto",
  "blocking.clearRange": "Tyhjennä jakso",
  "blocking.removeByRange": "Poista estot ajanjaksolta",
  "blocking.blockDates": "Estä päivät / ajat",
  "blocking.resourceType": "Resurssityyppi",
  "blocking.blockSpecific": "Estä tietty",
  "blocking.allWillBeBlocked": "Kaikki {count} {type} estetään.",
  "blocking.selectResource": "Valitse {type}...",
  "blocking.dates": "Päivämäärä(t)",
  "blocking.pickDate": "Valitse päivä tai jakso",
  "blocking.dateHint": "Klikkaa kerran yksittäiselle päivälle tai klikkaa kaksi päivää valitaksesi jakso.",
  "blocking.duration": "Kesto",
  "blocking.fullDay": "Koko päivä",
  "blocking.specificHours": "Tietyt tunnit",
  "blocking.startTime": "Alkuaika",
  "blocking.endTime": "Loppuaika",
  "blocking.timeHint": "Vain valitut tunnit estetään. Varaukset muina aikoina ovat mahdollisia.",
  "blocking.reason": "Syy (valinnainen)",
  "blocking.reasonPlaceholder": "esim. Huolto, Yksityistilaisuus...",
  "blocking.creating": "Luodaan...",
  "blocking.createBlock": "Luo esto",
  "blocking.blockDays": "Estä {count} päivää",
  "blocking.daysBlocked": "{count} päivä(ä) estetty",
  "blocking.blockRemoved": "Esto poistettu",
  "blocking.blocksRemoved": "Estot poistettu",
  "blocking.removeBlock": "Poista esto",
  "blocking.removeBlockDesc": "Tämä poistaa eston päivälle {date}. Varaukset ovat jälleen mahdollisia.",
  "blocking.remove": "Poista",
  "blocking.noBlocks": "Ei estettyjä päiviä tai aikoja.",
  "blocking.noMatch": "Ei suodatinta vastaavia estoja.",
  "blocking.allTypes": "Kaikki tyypit",
  "blocking.allResources": "Kaikki resurssit",
  "blocking.clearFilters": "Tyhjennä suodattimet",
  "blocking.filter": "Suodata:",
  "blocking.dateRange": "Ajanjakso",
  "blocking.rangeHint": "Kaikki estot tältä ajanjaksolta poistetaan.",
  "blocking.noBlocksInRange": "Ei estoja tältä ajanjaksolta.",
  "blocking.blocksWillBeRemoved": "{count} esto(a) poistetaan.",
  "blocking.removing": "Poistetaan...",
  "blocking.removeCount": "Poista {count} esto(a)",
  "blocking.allDay": "Koko päivä",
  "blocking.hotelGuesthouse": "Hotelli / Majatalo",
  "blocking.restaurant": "Ravintola",
  "blocking.venueEventSpace": "Juhlatilat",
  "blocking.room": "huone",
  "blocking.tableArea": "pöytä/alue",
  "blocking.eventSpace": "juhlatila",
  "blocking.recurringTitle": "Toistuvat estot",
  "blocking.recurringTooltip": "Estä tietyt viikonpäivät toistuvasti. Esim. estä joka maanantai ravintolalle.",
  "blocking.addRecurring": "Lisää toistuva esto",
  "blocking.addRecurringTitle": "Lisää toistuva esto",
  "blocking.daysOfWeek": "Viikonpäivät",
  "blocking.recurringTimeHint": "Vain valitut tunnit estetään joka viikko. Varaukset muina aikoina ovat mahdollisia.",
  "blocking.recurringReasonPlaceholder": "esim. Suljettu maanantaisin, Vapaapäivä...",
  "blocking.blockWeekly": "Estä {count} päivä(ä) viikoittain",
  "blocking.recurringCreated": "Toistuva esto luotu",
  "blocking.recurringRemoved": "Toistuva esto poistettu",
  "blocking.removeRecurring": "Poista toistuva esto",
  "blocking.removeRecurringDesc": "Tämä poistaa toistuvan eston joka {day}.",
  "blocking.noRecurring": "Ei toistuvia estoja.",
  "blocking.every": "Joka",
  "blocking.dayNames": "Su,Ma,Ti,Ke,To,Pe,La",
  "booking.calculatePrice": "Laske hinta",

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
  "onboarding.hotelDesc": "Hotelli- ja majatalohuoneet.",
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

  "nav.about": "Tietoa meistä",
  "nav.accessibility": "Saavutettavuus",

  "about.heroBadge": "Tarinamme",
  "about.heroTitle": "Huolella rakennettu varausjärjestelmä",
  "about.heroSubtitle": "Autamme ravintola-alan yrityksiä hallitsemaan varauksiaan vaivattomasti — jotta he voivat keskittyä luomaan unohtumattomia vieraskokemuksia.",
  "about.missionBadge": "Missiomme",
  "about.missionTitle": "Varausten hallinta yksinkertaiseksi ja tyylikkääksi",
  "about.missionP1": "Pienet ravintola-alan yritykset ansaitsevat samat tehokkaat työkalut kuin suuret ketjut. Siksi loimme MinnowBookin.",
  "about.missionP2": "Alustamme yhdistää varaukset, brändäyksen, tiimin hallinnan ja raportoinnin yhteen työkaluun.",
  "about.point1Title": "Nopeutta ilman kompromisseja",
  "about.point1Desc": "Saat brändätyn varaussivun käyttöön minuuteissa.",
  "about.point2Title": "Tietoon perustuvat päätökset",
  "about.point2Desc": "Seuraa varaustrendejä, käyttöastetta ja liikevaihtoa.",
  "about.point3Title": "Rakennettu tiimeille",
  "about.point3Desc": "Roolipohjainen pääsy ja monihenkilöstötuki sisäänrakennettuna.",
  "about.valuesTitle": "Perusarvomme",
  "about.valuesSubtitle": "Nämä periaatteet ohjaavat jokaista päätöstämme.",
  "about.valuePrecision": "Tarkkuus",
  "about.valuePrecisionDesc": "Jokainen yksityiskohta on tärkeä — varaussivuista saatavuuskalentereihin.",
  "about.valueInnovation": "Innovaatio",
  "about.valueInnovationDesc": "Kehitämme alustaamme jatkuvasti uusimman teknologian avulla.",
  "about.valueCollaboration": "Yhteistyö",
  "about.valueCollaborationDesc": "Työskentelemme tiiviisti yritysten kanssa ymmärtääksemme todelliset tarpeet.",
  "about.valueTrust": "Luottamus",
  "about.valueTrustDesc": "Tietosi ovat turvassa. Noudatamme GDPR-standardeja.",
  "about.valuePassion": "Intohimo",
  "about.valuePassionDesc": "Meillä on intohimo auttaa pieniä yrityksiä menestymään.",
  "about.valueGlobal": "Saavutettavuus",
  "about.valueGlobalDesc": "Alustamme on monikielinen ja suunniteltu kaikille saavutettavaksi.",
  "about.ctaTitle": "Valmis yksinkertaistamaan varauksiasi?",
  "about.ctaSubtitle": "Liity yrityksiin, jotka jo käyttävät MinnowBookia varausten hallintaan.",

  "privacy.title": "Tietosuojakäytäntö",
  "privacy.lastUpdated": "Päivitetty viimeksi:",
  "privacy.s1Title": "1. Johdanto",
  "privacy.s1P1": "Tämä tietosuojakäytäntö selittää, miten MinnowBook kerää, käyttää ja suojaa henkilötietojasi. Noudatamme EU:n yleistä tietosuoja-asetusta (GDPR).",
  "privacy.s2Title": "2. Rekisterinpitäjä",
  "privacy.s2P1": "MinnowBook on henkilötietojen rekisterinpitäjä. Tietosuojakyselyissä ota yhteyttä tukisivumme kautta.",
  "privacy.s3Title": "3. Kerättävät tiedot",
  "privacy.s3P1": "Keräämme seuraavat henkilötietoluokat:",
  "privacy.s3Item1": "Tilitiedot: nimi, sähköposti, salasana (tiivistetty)",
  "privacy.s3Item2": "Yritystiedot: yrityksen nimi, osoite, puhelinnumero",
  "privacy.s3Item3": "Varaustiedot: vieraiden nimet, sähköpostit, puhelinnumerot, varaustiedot",
  "privacy.s3Item4": "Käyttötiedot: vieraillut sivut, käytetyt ominaisuudet, selaintyyppi",
  "privacy.s4Title": "4. Käsittelyn tarkoitus",
  "privacy.s4P1": "Käsittelemme tietojasi seuraaviin tarkoituksiin:",
  "privacy.s4Item1": "Varausten hallintapalvelun tarjoaminen ja ylläpitäminen",
  "privacy.s4Item2": "Varausvahvistusten, muistutusten ja peruutusilmoitusten lähettäminen",
  "privacy.s4Item3": "Alustan parantaminen ja uusien ominaisuuksien kehittäminen",
  "privacy.s5Title": "5. Tietojen säilytys",
  "privacy.s5P1": "Säilytämme henkilötietojasi niin kauan kuin tilisi on aktiivinen. Varaustiedot säilytetään tilauksen keston ja 12 kuukauden ajan. Voit pyytää tietojesi poistamista milloin tahansa.",
  "privacy.s6Title": "6. Oikeutesi",
  "privacy.s6P1": "GDPR:n mukaisesti sinulla on seuraavat oikeudet:",
  "privacy.s6Item1": "Oikeus saada pääsy tietoihisi",
  "privacy.s6Item2": "Oikeus oikaista virheellisiä tietoja",
  "privacy.s6Item3": "Oikeus tietojen poistamiseen",
  "privacy.s6Item4": "Oikeus rajoittaa käsittelyä",
  "privacy.s6Item5": "Oikeus siirtää tiedot toiseen palveluun",
  "privacy.s7Title": "7. Evästeet",
  "privacy.s7P1": "Käytämme välttämättömiä evästeitä alustan toiminnan turvaamiseksi. Analytiikkaevästeet ladataan vasta antamallasi suostumuksella.",
  "privacy.s8Title": "8. Yhteydenotto",
  "privacy.s8P1": "Tietosuojakysymyksissä ota yhteyttä tukisivumme kautta.",

  "a11y.title": "Saavutettavuusseloste",
  "a11y.lastUpdated": "Päivitetty viimeksi:",
  "a11y.s1Title": "1. Sitoumuksemme",
  "a11y.s1P1": "MinnowBook on sitoutunut varmistamaan digitaalisen saavutettavuuden kaikille. Parannamme jatkuvasti käyttökokemusta ja noudatamme saavutettavuusstandardeja.",
  "a11y.s2Title": "2. Saavutettavuusominaisuudet",
  "a11y.s2P1": "Alustamme sisältää seuraavat saavutettavuusominaisuudet:",
  "a11y.s2Item1": "Säädettävä fonttikoko (80%–150%)",
  "a11y.s2Item2": "Korkean kontrastin tila",
  "a11y.s2Item3": "Lukihäiriöystävällinen fontti",
  "a11y.s2Item4": "Vähennetyn liikkeen tila",
  "a11y.s2Item5": "Korostetut kohdistustilat näppäimistönavigointiin",
  "a11y.s2Item6": "Pikanäppäin (Alt+A) saavutettavuuswidgetin avaamiseen",
  "a11y.s3Title": "3. Standardit",
  "a11y.s3P1": "Pyrimme noudattamaan WCAG 2.1 AA -ohjeita. Keskeisiä alueita:",
  "a11y.s3Item1": "Semanttinen HTML ruudunlukijayhteensopivuuteen",
  "a11y.s3Item2": "Riittävät värikontrastisuhteet",
  "a11y.s3Item3": "Näppäimistöllä navigoitava käyttöliittymä",
  "a11y.s4Title": "4. Tunnetut rajoitukset",
  "a11y.s4P1": "Vaikka pyrimme täyseen saavutettavuuteen, jotkin kolmannen osapuolen komponentit eivät välttämättä täytä kaikkia WCAG 2.1 AA -kriteerejä.",
  "a11y.s5Title": "5. Palaute",
  "a11y.s5P1": "Otamme mielellämme vastaan palautetta saavutettavuudesta. Ota yhteyttä tukisivumme kautta.",
  "a11y.widgetTitle": "Saavutettavuus",
  "a11y.fontSize": "Fonttikoko",
  "a11y.highContrast": "Korkea kontrasti",
  "a11y.dyslexiaFont": "Lukihäiriöfontti",
  "a11y.reducedMotion": "Vähennetty liike",
  "a11y.focusHighlight": "Kohdistus",
  "a11y.resetAll": "Palauta kaikki",
  "a11y.on": "Päällä",
  "a11y.off": "Pois",

  "cookie.message": "Käytämme evästeitä parantaaksemme kokemustasi.",
  "cookie.privacyPolicy": "Tietosuojakäytäntö",
  "cookie.accept": "Hyväksy",
  "cookie.reject": "Hylkää",
  "password.minLength": "Vähintään 12 merkkiä",
  "password.uppercase": "Yksi iso kirjain",
  "password.lowercase": "Yksi pieni kirjain",
  "password.number": "Yksi numero",
  "password.checking": "Tarkistetaan vuotaneita salasanoja…",
  "password.breached": "Tämä salasana on löytynyt tietovuodoista — valitse toinen",
  "password.safe": "Salasanaa ei löytynyt tunnetuista vuodoista",
  "password.strengthWeak": "Heikko",
  "password.strengthFair": "Kohtalainen",
  "password.strengthStrong": "Vahva",
  "password.strengthVeryStrong": "Erittäin vahva",
  "resetPassword.title": "Aseta uusi salasana",
  "resetPassword.subtitle": "Kirjoita uusi salasanasi alle.",
  "resetPassword.newPassword": "Uusi salasana",
  "resetPassword.confirmPassword": "Vahvista uusi salasana",
  "resetPassword.confirmPlaceholder": "Toista salasanasi",
  "resetPassword.mismatch": "Salasanat eivät täsmää",
  "resetPassword.updating": "Päivitetään...",
  "resetPassword.updateButton": "Päivitä salasana",
  "resetPassword.success": "Salasana päivitetty!",
  "resetPassword.updated": "Salasana päivitetty",
  "resetPassword.redirecting": "Ohjataan kirjautumiseen...",
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
  "nav.admin": "Admin",
  "nav.settings": "Inställningar",
  "nav.reports": "Rapporter",
  "nav.support": "Support",

  "reports.total": "Totalt",
  "reports.confirmed": "Bekräftad",
  "reports.pending": "Väntande",
  "reports.guest": "Gäst",
  "reports.invoiced": "Fakturerad",
  "reports.notInvoiced": "Ej fakturerad",
  "reports.notes": "Anteckningar",
  "reports.yes": "Ja",
  "reports.no": "Nej",
  "reports.grandTotal": "Totalsumma",
  "reports.totalPrice": "Totalt",
  "reports.totalRevenue": "Total intäkt",
  "reports.invoicing": "Fakturering",
  "reports.details": "Detaljerad lista",
  "reports.chart.title": "Bokningar per typ",
  "reports.print": "Skriv ut",
  "reports.print.title": "Bokningsrapport",
  "reports.print.period": "Period",
  "reports.print.generated": "Genererad",
  "reports.print.summary": "Sammanfattning",
  "reports.exportCsv": "Exportera CSV",
  "reports.compare": "Jämför",
  "reports.vs": "vs",
  "reports.today": "Idag",
  "reports.filter.all": "Alla",
  "reports.filter.notInvoiced": "Ej fakturerad",
  "reports.period.week": "Vecka",
  "reports.period.month": "Månad",
  "reports.period.quarter": "Kvartal",
  "reports.period.half": "Halvår",
  "reports.period.year": "År",
  "reports.period.custom": "Anpassad",
  "reports.breakfast": "Frukost",
  "reports.breakfastRevenue": "Frukostintäkt",
  "reports.used": "Använd",
  "reports.notUsed": "Ej använd",
  "reports.roomPrice": "Rum",
  "reports.subtitle": "Bokningsöversikt och faktureringsuppföljning",
  "reports.roomRevenue": "Rumsintäkt",
  "reports.breakfastLabel": "Frukost",
  "reports.accommodationTotal": "Boende totalt",
  "reports.roomAndBreakfast": "rum + frukost",
  "reports.uninvoicedAlert": "{count} ej fakturerade av {total} — {amount} ej fakturerat",
  "reports.breakfastAlert": "{count} bokningar, {nights} nätter — beräknad frukostintäkt {amount}",
  "reports.nights": "nätter",
  "reports.reservations": "bokningar",
  "reports.ofTotal": "totalt",
  "reports.invoicedPercent": "fakturerat",

  // Settings
  "settings.businessDetails": "Företagsinformation",
  "settings.brandColors": "Varumärkesfärger",
  "settings.presets": "Förval",
  "settings.primary": "Primär",
  "settings.secondary": "Sekundär",
  "settings.accent": "Accent",
  "settings.preview": "Förhandsvisning",
  "settings.primaryBtn": "Primär knapp",
  "settings.accentBtn": "Accentknapp",
  "settings.saved": "Inställningar sparade",
  "settings.saveError": "Kunde inte spara inställningar",
  "settings.availabilityThresholds": "Tillgänglighetsgränser",
  "settings.availabilityThresholdsDesc": "Antal bokningar innan en dag visas som 'Full' i kalendern.",
  "settings.fullThreshold": "Full vid",
  "settings.logo": "Logotyp",
  "settings.uploadLogo": "Ladda upp logotyp",
  "settings.uploading": "Laddar upp...",
  "settings.logoHint": "PNG, JPG, WebP eller SVG. Max 2 MB.",
  "settings.logoUploaded": "Logotyp uppladdad",
  "settings.logoUploadError": "Kunde inte ladda upp logotyp",
  "settings.logoInvalidType": "Ogiltig filtyp. Använd PNG, JPG, WebP eller SVG.",
  "settings.logoTooLarge": "Filen är för stor. Max 2 MB.",
  "settings.heroImage": "Hero-bild",
  "settings.uploadHeroImage": "Ladda upp hero-bild",
  "settings.heroImageHint": "Rekommenderat: 1600×600 px. PNG, JPG eller WebP. Max 5 MB.",
  "settings.heroImageUploaded": "Hero-bild uppladdad",
  "settings.heroImageUploadError": "Kunde inte ladda upp hero-bild",

  // Booking
  "booking.title": "Gör en bokning",
  "booking.selectType": "Vad vill du boka?",
  "booking.typeDescRestaurant": "Reservera ett bord för middag",
  "booking.typeDescVenue": "Boka en lokal för ditt evenemang",
  "booking.typeDescGuesthouse": "Boka ett rum för din vistelse",
  "booking.selectDateTime": "Välj datum och tid",
  "booking.selectTime": "Välj en tid",
  "booking.selectResource": "Välj ett utrymme",
  "booking.yourDetails": "Dina uppgifter",
  "booking.guestCount": "Antal gäster",
  "booking.specialRequests": "Speciella önskemål",
  "booking.preferredTime": "Önskad tid",
  "booking.closedDay": "Stängt denna dag.",
  "booking.pickDate": "Välj datum",
  "booking.checkOutDate": "Utcheckningsdatum",
  "booking.roomType": "Rumstyp",
  "booking.breakfastIncluded": "Inkludera frukost",
  "booking.eventType": "Evenemangstyp",
  "booking.estimatedGuests": "Uppskattat antal gäster",
  "booking.cateringNeeded": "Catering behövs",
  "booking.roomSingle": "Enkelrum",
  "booking.roomDouble": "Dubbelrum",
  "booking.roomSuite": "Svit",
  "booking.roomDorm": "Sovsal",
  "booking.eventWedding": "Bröllop",
  "booking.eventCorporate": "Företagsevent",
  "booking.eventBirthday": "Födelsedagsfest",
  "booking.eventConference": "Konferens",
  "booking.eventOther": "Övrigt",
  "booking.priceSummary": "Prisuppskattning",
  "booking.night": "natt",
  "booking.nights": "nätter",
  "booking.accommodation": "Boende",
  "booking.estimatedTotal": "Uppskattat totalt",
  "booking.selectRoomForPrice": "Välj ett rum för att se priser",
  "booking.submit": "Skicka bokning",
  "booking.availabilityCalendar": "Tillgänglighet",
  "booking.availabilityDesc": "Se vilka datum som är lediga för bokning.",
  "booking.available": "Ledigt",
  "booking.busy": "Upptaget",
  "booking.full": "Fullt",
  "booking.reservations": "bokningar",
  "booking.submitting": "Skickar...",
  "booking.submitError": "Kunde inte skicka bokningen. Försök igen.",
  "booking.thankYou": "Tack!",
  "booking.confirmationMsg": "Din bokning har mottagits. Vi bekräftar den inom kort via e-post.",
  "booking.makeAnother": "Gör en ny bokning",
  "booking.notFound": "Företag hittades inte",
  "booking.notFoundDesc": "Bokningssidan du letar efter finns inte.",
  "booking.emailPreviewTitle": "Förhandsgranskning av bekräftelsemail",
  "booking.whatGuestReceives": "Detta är vad gästen kommer att få via e-post:",
  "booking.pricingType": "Prissättning",
  "booking.pricingMenu": "Enligt meny",
  "booking.pricingFixed": "Fast pris",
  "booking.fixedPrice": "Fast pris (€)",
  "email.subject": "Ämne",
  "email.confirmationSubject": "Bokningsbekräftelse",
  "email.confirmationTitle": "Bokning bekräftad!",
  "email.greeting": "Kära",
  "email.confirmationBody": "Vi har nöjet att bekräfta din bokning. Här är detaljerna:",
  "email.confirmationFooter": "Om du har några frågor, tveka inte att kontakta oss. Vi ser fram emot att välkomna dig!",
  "email.cancellationSubject": "Bokningsavbokning",
  "email.cancellationTitle": "Bokning avbokad",
  "email.cancellationBody": "Vi beklagar att din bokning har avbokats. Här var detaljerna:",
  "email.cancellationFooter": "Om du tror att detta är ett misstag eller vill boka om, tveka inte att kontakta oss.",
  "email.confirmationTab": "Bekräftelse",
  "email.cancellationTab": "Avbokning",
  "email.at": "kl",
  "email.duration": "Varaktighet",
  "email.preview": "E-postförhandsgranskning",
  "email.customMessage": "Anpassat meddelande",
  "email.customMessagePlaceholder": "Lägg till ett personligt meddelande i e-postmeddelandet...",
  "email.editDetails": "Redigera detaljer",
  "email.previewTab": "E-postförhandsgranskning",

  "admin.addUser": "Lägg till användare",
  "admin.role": "Roll",
  "admin.staff": "Personal",
  "admin.adminRole": "Admin",
  "admin.owner": "Ägare",
  "admin.changePassword": "Ändra lösenord",
  "admin.newPassword": "Nytt lösenord",
  "admin.removeUser": "Ta bort användare",
  "admin.userCreated": "Användare skapad",
  "admin.roleUpdated": "Roll uppdaterad",
  "admin.passwordChanged": "Lösenord ändrat",
  "admin.userRemoved": "Användare borttagen",
  "admin.noUsers": "Inga användare hittades.",
  "admin.loginHistory": "Inloggningshistorik",
  "admin.noLoginHistory": "Ingen inloggningsaktivitet registrerad ännu.",
  "admin.auditLog": "Ändringslogg",
  "admin.noAuditLog": "Inga ändringar registrerade ännu.",
  "admin.permissions": "Rollbehörigheter",
  "admin.addRole": "Lägg till roll",
  "admin.roleName": "Rollnamn",
  "admin.roleKey": "Rollnyckel",
  "admin.roleCreated": "Roll skapad",
  "admin.userManagement": "Användarhantering",
  "admin.userManagementDesc": "Hantera teammedlemmar, tilldela roller och kontrollera åtkomst.",
  "admin.approvedUsers": "Godkända användare",
  "admin.colName": "Namn",
  "admin.colEmail": "E-post",
  "admin.colRole": "Roll",
  "admin.colStatus": "Status",
  "admin.colActions": "Åtgärder",
  "admin.statusApproved": "Godkänd",
  "admin.statusPending": "Väntar",
  "admin.confirmRemove": "Är du säker?",
  "admin.confirmRemoveDesc": "Är du säker på att du vill ta bort denna användare? Denna åtgärd kan inte ångras.",
  "admin.cancel": "Avbryt",
  "admin.remove": "Ta bort",
  "admin.supportRequests": "Supportförfrågningar",
  "admin.noSupportRequests": "Inga supportförfrågningar ännu.",
  "admin.supportRequestsDesc": "Business-användare kan skicka förfrågningar via chattwidgeten.",
  "admin.colTime": "Tid",
  "admin.colUser": "Användare",
  "admin.colDevice": "Enhet",
  "admin.loginCount": "poster",
  "admin.auditLogDesc": "En kronologisk logg över alla ändringar.",
  "admin.colDate": "Datum",
  "admin.colUserAudit": "Användare",
  "admin.colEntity": "Entitet",
  "admin.colAction": "Åtgärd",
  "admin.colSummary": "Sammanfattning",
  "admin.downloadPdf": "Ladda ner PDF",
  "admin.previous": "Föregående",
  "admin.next": "Nästa",
  "admin.page": "Sida",
  "admin.filtered": "filtrerad",
  "admin.allActions": "Alla åtgärder",
  "admin.allEntities": "Alla entiteter",
  "admin.created": "Skapad",
  "admin.updated": "Uppdaterad",
  "admin.deleted": "Borttagen",
  "admin.fieldsChanged": "fält ändrade",
  "admin.revert": "Återställ",
  "admin.revertConfirm": "Återställ denna ändring?",
  "admin.revertUpdate": "Detta återställer posten till dess tidigare värden.",
  "admin.revertInsert": "Detta tar bort den skapade posten.",
  "admin.revertDelete": "Detta återskapar den borttagna posten.",
  "admin.reverting": "Återställer...",
  "admin.reverted": "Ändring återställd",
  "admin.revertedDesc": "Posten har återställts till sitt tidigare tillstånd.",
  "admin.clear": "Rensa",
  "admin.from": "Från",
  "admin.to": "Till",
  "admin.allUsers": "Alla användare",
  "admin.noMatchFilters": "Inga poster matchar valda filter.",
  "admin.respondMarkFixed": "Svara och markera som löst",
  "admin.sending": "Skickar...",
  "admin.open": "Öppen",
  "admin.resolved": "Löst",

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
  "dashboard.checkedIn": "Incheckad",
  "dashboard.notCheckedIn": "Ej incheckad",
  "dashboard.todayFilter": "Idag",
  "dashboard.activeResources": "Aktiva resurser",
  "dashboard.bookingLink": "Bokningslänk",
  "dashboard.bookingLinkDesc": "Dela denna länk med dina kunder så att de kan boka.",
  "dashboard.copyLink": "Kopiera länk",
  "dashboard.linkCopied": "Länken kopierad!",
  "dashboard.noReservations": "Inga bokningar hittades.",
  "dashboard.confirmReservation": "Bekräfta",
  "dashboard.cancelReservation": "Avboka",
  "dashboard.confirmReservationMsg": "Bekräfta denna bokning?",
  "dashboard.cancelReservationMsg": "Avboka denna bokning?",
  "dashboard.statusUpdated": "Status uppdaterad",
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
  "dashboard.uploadImage": "Ladda upp bild",
  "dashboard.imageUploaded": "Bild uppladdad",
  "dashboard.imageUploadError": "Kunde inte ladda upp bild",
  "dashboard.restaurant": "Restaurang",
  "dashboard.venue": "Lokal",
  "dashboard.guesthouse": "Hotell / Gasthaus",
  "dashboard.hotel": "Hotell / Gasthaus",
  "dashboard.editReservation": "Redigera bokning",
  "dashboard.reservationUpdated": "Bokning uppdaterad",
  "dashboard.reservationUpdateError": "Kunde inte uppdatera bokningen",
  "dashboard.checkOutDate": "Utcheckningsdatum",
  "dashboard.priceEur": "Pris (EUR)",
  "dashboard.internalNotes": "Interna anteckningar",
  "dashboard.staffNotes": "Personalanteckningar",
  "dashboard.gallery": "Bildgalleri",
  "dashboard.galleryHint": "Upp till 5 bilder. PNG, JPG eller WebP. Max 5 MB per bild.",
  "dashboard.imageDeleted": "Bild raderad",
  "dashboard.maxImages": "Max 5 bilder",
  "dashboard.roomMultipliers": "Rumstypsprismultiplikatorer",
  "dashboard.roomMultipliersDesc": "Multipliceras med baspris per natt. T.ex. 1,5× vid €100 bas = €150.",
  "dashboard.roomSingle": "Enkelrum",
  "dashboard.roomDouble": "Dubbelrum",
  "dashboard.roomSuite": "Svit",
  "dashboard.roomDorm": "Sovsal",
  "dashboard.newReservation": "Ny bokning",
  "dashboard.createReservation": "Skapa bokning",
  "dashboard.reservationCreated": "Bokningen har skapats",
  "dashboard.guestsToday": "Gäster idag",
  "dashboard.arrived": "Anlänt",
  "dashboard.weekRevenue": "Veckans intäkter",
  "dashboard.weekReservations": "Veckans bokningar",
  "dashboard.weekGuests": "Veckans gäster",
  "dashboard.utilizationToday": "Beläggning idag",
  "dashboard.weekRevenueChart": "Veckans intäktsutveckling",
  "dashboard.todayByType": "Idag per typ",
  "dashboard.quickInfo": "Snabbinfo",
  "dashboard.checkoutsToday": "Utcheckningar idag",
  "dashboard.uninvoiced": "Ej fakturerade",
  "dashboard.calendarHotel": "Hotell / Gästhus",
  "dashboard.calendarVenue": "Festlokaler",
  "dashboard.calendarRestaurant": "Restaurang",
  "dashboard.legendHasReservations": "Har bokningar",
  "dashboard.legendBlocked": "Blockerad",
  "dashboard.legendRecurring": "Återkommande blockering",
  "dashboard.legendBoth": "Båda",
  "dashboard.calendarTooltip": "Klicka på ett datum för att se dess bokningar. Markerade datum har bokningar. Röda datum har engångsblockeringar. Lila streckade datum har återkommande blockeringar.",
  "dashboard.resourceManagement": "Resurshantering",
  "dashboard.resourceManagementDesc": "Hantera lokaler, rum och bord",
  "dashboard.actions": "Åtgärder",
  "dashboard.active": "Aktiv",
  "dashboard.inactive": "Inaktiv",
  "dashboard.namePlaceholder": "T.ex. Festsal",
  "dashboard.descriptionPlaceholder": "Kort beskrivning...",
  "dashboard.capacityPlaceholder": "t.ex. 50",
  "dashboard.pricePlaceholder": "t.ex. 140",
  "dashboard.breakfastPlaceholder": "t.ex. 15",
  "dashboard.venuePrice": "Lokalpris (€)",
  "dashboard.roomPrice": "Rumpris (€/natt)",
  "dashboard.breakfastPrice": "Frukostpris (€/pers/morgon)",
  "dashboard.pricingHint": "Standardpris för nya bokningar. Enskilda bokningspriser kan justeras i bokningsdetaljerna.",
  "blocking.title": "Blockerade dagar & tider",
  "blocking.tooltip": "Blockera hela resurstyper eller specifika resurser på valda datum eller datumintervall. Valfritt begränsa till specifika timmar.",
  "blocking.addBlock": "Lägg till blockering",
  "blocking.clearRange": "Rensa intervall",
  "blocking.removeByRange": "Ta bort blockeringar per datumintervall",
  "blocking.blockDates": "Blockera datum / tider",
  "blocking.resourceType": "Resurstyp",
  "blocking.blockSpecific": "Blockera specifik",
  "blocking.allWillBeBlocked": "Alla {count} {type} kommer att blockeras.",
  "blocking.selectResource": "Välj {type}...",
  "blocking.dates": "Datum",
  "blocking.pickDate": "Välj ett datum eller intervall",
  "blocking.dateHint": "Klicka en gång för en enskild dag eller klicka på två datum för att välja ett intervall.",
  "blocking.duration": "Varaktighet",
  "blocking.fullDay": "Heldag",
  "blocking.specificHours": "Specifika timmar",
  "blocking.startTime": "Starttid",
  "blocking.endTime": "Sluttid",
  "blocking.timeHint": "Bara de valda timmarna blockeras. Bokningar utanför detta fönster är fortfarande tillgängliga.",
  "blocking.reason": "Orsak (valfritt)",
  "blocking.reasonPlaceholder": "t.ex. Underhåll, Privat evenemang...",
  "blocking.creating": "Skapar...",
  "blocking.createBlock": "Skapa blockering",
  "blocking.blockDays": "Blockera {count} dagar",
  "blocking.daysBlocked": "{count} dag(ar) blockerad(e)",
  "blocking.blockRemoved": "Blockering borttagen",
  "blocking.blocksRemoved": "Blockeringar borttagna",
  "blocking.removeBlock": "Ta bort blockering",
  "blocking.removeBlockDesc": "Detta tar bort blockeringen för {date}. Bokningar kommer att tillåtas igen.",
  "blocking.remove": "Ta bort",
  "blocking.noBlocks": "Inga blockerade datum eller tider konfigurerade.",
  "blocking.noMatch": "Inga blockeringar matchar det aktuella filtret.",
  "blocking.allTypes": "Alla typer",
  "blocking.allResources": "Alla resurser",
  "blocking.clearFilters": "Rensa filter",
  "blocking.filter": "Filter:",
  "blocking.dateRange": "Datumintervall",
  "blocking.rangeHint": "Alla blockeringar inom detta intervall kommer att tas bort.",
  "blocking.noBlocksInRange": "Inga blockeringar hittade i detta intervall.",
  "blocking.blocksWillBeRemoved": "{count} blockering(ar) kommer att tas bort.",
  "blocking.removing": "Tar bort...",
  "blocking.removeCount": "Ta bort {count} blockering(ar)",
  "blocking.allDay": "Heldag",
  "blocking.hotelGuesthouse": "Hotell / Gästhus",
  "blocking.restaurant": "Restaurang",
  "blocking.venueEventSpace": "Festlokaler",
  "blocking.room": "rum",
  "blocking.tableArea": "bord/yta",
  "blocking.eventSpace": "festlokal",
  "blocking.recurringTitle": "Återkommande blockeringar",
  "blocking.recurringTooltip": "Blockera specifika veckodagar återkommande. T.ex. blockera varje måndag för restaurangen.",
  "blocking.addRecurring": "Lägg till återkommande blockering",
  "blocking.addRecurringTitle": "Lägg till återkommande blockering",
  "blocking.daysOfWeek": "Veckodagar",
  "blocking.recurringTimeHint": "Bara de valda timmarna blockeras varje vecka. Bokningar utanför detta fönster är fortfarande tillgängliga.",
  "blocking.recurringReasonPlaceholder": "t.ex. Stängt på måndagar, Ledig dag...",
  "blocking.blockWeekly": "Blockera {count} dag(ar) veckovis",
  "blocking.recurringCreated": "Återkommande blockering skapad",
  "blocking.recurringRemoved": "Återkommande blockering borttagen",
  "blocking.removeRecurring": "Ta bort återkommande blockering",
  "blocking.removeRecurringDesc": "Detta tar bort den återkommande blockeringen för varje {day}.",
  "blocking.noRecurring": "Inga återkommande blockeringar konfigurerade.",
  "blocking.every": "Varje",
  "blocking.dayNames": "Sön,Mån,Tis,Ons,Tor,Fre,Lör",
  "booking.calculatePrice": "Beräkna pris",

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
  "onboarding.hotelDesc": "Hotell- och gästhusrump.",
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

  "nav.about": "Om oss",
  "nav.accessibility": "Tillgänglighet",

  "about.heroBadge": "Vår berättelse",
  "about.heroTitle": "Bokningsplattformen byggd med omsorg",
  "about.heroSubtitle": "Vi hjälper hotell- och restaurangföretag att hantera sina bokningar enkelt — så de kan fokusera på att skapa minnesvärda gästupplevelser.",
  "about.missionBadge": "Vårt uppdrag",
  "about.missionTitle": "Göra bokningshantering enkel och elegant",
  "about.missionP1": "Små hotell- och restaurangföretag förtjänar samma kraftfulla verktyg som stora kedjor. Därför skapade vi MinnowBook.",
  "about.missionP2": "Vår plattform samlar bokningar, varumärkeshantering, teamhantering och rapportering på ett ställe.",
  "about.point1Title": "Snabbhet utan kompromisser",
  "about.point1Desc": "Få din varumärkta bokningssida live på minuter.",
  "about.point2Title": "Datadrivna insikter",
  "about.point2Desc": "Följ bokningstrender, beläggning och intäkter.",
  "about.point3Title": "Byggt för team",
  "about.point3Desc": "Rollbaserad åtkomst och stöd för flera medarbetare.",
  "about.valuesTitle": "Våra kärnvärden",
  "about.valuesSubtitle": "Dessa principer vägleder varje beslut vi tar.",
  "about.valuePrecision": "Precision",
  "about.valuePrecisionDesc": "Varje detalj spelar roll — från bokningssidor till tillgänglighetskalendrar.",
  "about.valueInnovation": "Innovation",
  "about.valueInnovationDesc": "Vi förbättrar ständigt vår plattform med den senaste tekniken.",
  "about.valueCollaboration": "Samarbete",
  "about.valueCollaborationDesc": "Vi arbetar nära företag för att förstå deras verkliga behov.",
  "about.valueTrust": "Förtroende",
  "about.valueTrustDesc": "Din data är säker. Vi följer GDPR-standarder.",
  "about.valuePassion": "Passion",
  "about.valuePassionDesc": "Vi brinner för att hjälpa småföretag att lyckas.",
  "about.valueGlobal": "Tillgänglighet",
  "about.valueGlobalDesc": "Vår plattform är flerspråkig och designad för att vara tillgänglig för alla.",
  "about.ctaTitle": "Redo att förenkla dina bokningar?",
  "about.ctaSubtitle": "Gå med bland företag som redan använder MinnowBook.",

  "privacy.title": "Integritetspolicy",
  "privacy.lastUpdated": "Senast uppdaterad:",
  "privacy.s1Title": "1. Introduktion",
  "privacy.s1P1": "Denna integritetspolicy förklarar hur MinnowBook samlar in, använder och skyddar dina personuppgifter. Vi följer EU:s allmänna dataskyddsförordning (GDPR).",
  "privacy.s2Title": "2. Personuppgiftsansvarig",
  "privacy.s2P1": "MinnowBook är personuppgiftsansvarig. Kontakta oss via supportsidan för dataskyddsfrågor.",
  "privacy.s3Title": "3. Data vi samlar in",
  "privacy.s3P1": "Vi samlar in följande kategorier av personuppgifter:",
  "privacy.s3Item1": "Kontoinformation: namn, e-postadress, lösenord (hashad)",
  "privacy.s3Item2": "Företagsinformation: företagsnamn, adress, telefonnummer",
  "privacy.s3Item3": "Bokningsdata: gästnamn, e-post, telefonnummer, bokningsdetaljer",
  "privacy.s3Item4": "Användningsdata: besökta sidor, använda funktioner, webbläsartyp",
  "privacy.s4Title": "4. Syfte med behandling",
  "privacy.s4P1": "Vi behandlar dina uppgifter för följande ändamål:",
  "privacy.s4Item1": "Att tillhandahålla och underhålla vår bokningshanteringstjänst",
  "privacy.s4Item2": "Att skicka bokningsbekräftelser, påminnelser och avbokningsmeddelanden",
  "privacy.s4Item3": "Att förbättra vår plattform och utveckla nya funktioner",
  "privacy.s5Title": "5. Datalagring",
  "privacy.s5P1": "Vi behåller dina personuppgifter så länge ditt konto är aktivt. Bokningsdata behålls under prenumerationsperioden plus 12 månader.",
  "privacy.s6Title": "6. Dina rättigheter",
  "privacy.s6P1": "Enligt GDPR har du följande rättigheter:",
  "privacy.s6Item1": "Rätt till tillgång — begär en kopia av dina personuppgifter",
  "privacy.s6Item2": "Rätt till rättelse — korrigera felaktiga uppgifter",
  "privacy.s6Item3": "Rätt till radering — begär radering av dina uppgifter",
  "privacy.s6Item4": "Rätt att begränsa behandling",
  "privacy.s6Item5": "Rätt till dataportabilitet",
  "privacy.s7Title": "7. Cookies",
  "privacy.s7P1": "Vi använder nödvändiga cookies för att plattformen ska fungera. Analyticscookies laddas först efter ditt uttryckliga samtycke.",
  "privacy.s8Title": "8. Kontakt",
  "privacy.s8P1": "Kontakta oss via supportsidan för frågor om denna integritetspolicy.",

  "a11y.title": "Tillgänglighetsredogörelse",
  "a11y.lastUpdated": "Senast uppdaterad:",
  "a11y.s1Title": "1. Vårt åtagande",
  "a11y.s1P1": "MinnowBook är engagerat i att säkerställa digital tillgänglighet för alla. Vi förbättrar ständigt användarupplevelsen och tillämpar relevanta tillgänglighetsstandarder.",
  "a11y.s2Title": "2. Tillgänglighetsfunktioner",
  "a11y.s2P1": "Vår plattform inkluderar följande tillgänglighetsfunktioner:",
  "a11y.s2Item1": "Justerbar teckenstorlek (80%–150%)",
  "a11y.s2Item2": "Högkontrastläge för förbättrad läsbarhet",
  "a11y.s2Item3": "Dyslexivänligt teckensnitt",
  "a11y.s2Item4": "Reducerat rörelseläge",
  "a11y.s2Item5": "Förstärkta fokusindikatorer för tangentbordsnavigering",
  "a11y.s2Item6": "Kortkommando (Alt+A) för att öppna tillgänglighetswidgeten",
  "a11y.s3Title": "3. Standarder",
  "a11y.s3P1": "Vi strävar efter att uppfylla WCAG 2.1 nivå AA. Viktiga områden:",
  "a11y.s3Item1": "Semantisk HTML för skärmläsarkompatibilitet",
  "a11y.s3Item2": "Tillräckliga färgkontrastförhållanden",
  "a11y.s3Item3": "Tangentbordsnavigerbart gränssnitt",
  "a11y.s4Title": "4. Kända begränsningar",
  "a11y.s4P1": "Vissa tredjepartskomponenter uppfyller kanske inte alla WCAG 2.1 AA-kriterier. Vi arbetar aktivt med att åtgärda dessa.",
  "a11y.s5Title": "5. Feedback",
  "a11y.s5P1": "Vi välkomnar din feedback om tillgängligheten. Kontakta oss via supportsidan.",
  "a11y.widgetTitle": "Tillgänglighet",
  "a11y.fontSize": "Teckenstorlek",
  "a11y.highContrast": "Hög kontrast",
  "a11y.dyslexiaFont": "Dyslexiteckensnitt",
  "a11y.reducedMotion": "Reducerad rörelse",
  "a11y.focusHighlight": "Fokusmarkering",
  "a11y.resetAll": "Återställ alla",
  "a11y.on": "På",
  "a11y.off": "Av",

  "cookie.message": "Vi använder cookies för att förbättra din upplevelse.",
  "cookie.privacyPolicy": "Integritetspolicy",
  "cookie.accept": "Acceptera",
  "cookie.reject": "Avvisa",
  "password.minLength": "Minst 12 tecken",
  "password.uppercase": "En stor bokstav",
  "password.lowercase": "En liten bokstav",
  "password.number": "En siffra",
  "password.checking": "Kontrollerar läckta lösenord…",
  "password.breached": "Detta lösenord har hittats i dataintrång — välj ett annat",
  "password.safe": "Lösenordet hittades inte i kända intrång",
  "password.strengthWeak": "Svagt",
  "password.strengthFair": "Godtagbart",
  "password.strengthStrong": "Starkt",
  "password.strengthVeryStrong": "Mycket starkt",
  "resetPassword.title": "Ange nytt lösenord",
  "resetPassword.subtitle": "Ange ditt nya lösenord nedan.",
  "resetPassword.newPassword": "Nytt lösenord",
  "resetPassword.confirmPassword": "Bekräfta nytt lösenord",
  "resetPassword.confirmPlaceholder": "Upprepa ditt lösenord",
  "resetPassword.mismatch": "Lösenorden matchar inte",
  "resetPassword.updating": "Uppdaterar...",
  "resetPassword.updateButton": "Uppdatera lösenord",
  "resetPassword.success": "Lösenordet har uppdaterats!",
  "resetPassword.updated": "Lösenord uppdaterat",
  "resetPassword.redirecting": "Omdirigerar till inloggning...",
};

export const translations: Record<Language, TranslationKeys> = { en, fi, sv };
