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
  "common.showList": string;
  "common.hideList": string;
  "common.guests": string;
  "common.date": string;
  "common.noResults": string;
  "common.selectAll": string;
  "common.invalidFileName": string;

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
  "nav.sites": string;
  "nav.profile": string;

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
  "reports.offerConversion": string;
  "reports.totalOffers": string;
  "reports.convertedOffers": string;
  "reports.conversionRate": string;
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
  "reports.discountSummary": string;
  "reports.totalDiscounts": string;
  "reports.topCodes": string;
  "reports.discountToRevenue": string;
  "reports.discountedBookings": string;
  "reports.noDiscounts": string;

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
  "settings.noAccessTitle": string;
  "settings.noAccessDesc": string;
  "settings.siteNoAccessTitle": string;
  "settings.siteNoAccessDesc": string;
  "access.requestButton": string;
  "access.requestTitle": string;
  "access.requestDesc": string;
  "access.requestPlaceholder": string;
  "access.requestSubmit": string;
  "access.requestSending": string;
  "access.requestSent": string;
  "access.requestError": string;
  "access.requestSentInline": string;
  "access.requestSubject": string;
  "booking.brandingUnavailable": string;
  "settings.upsellTitle": string;
  "settings.upsellDesc": string;
  "settings.learnMore": string;
  "settings.siteOverride": string;
  "settings.useParentDefault": string;
  "settings.customizeForSite": string;
  "settings.inheritedFromParent": string;
  "settings.siteSettingsSaved": string;
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
  "settings.resourceTypeNames": string;
  "settings.resourceTypeNamesDesc": string;
  "settings.resourceTypeName": string;
  "settings.resourceTypeDescPlaceholder": string;
  "settings.reservationTypes": string;
  "settings.reservationTypesDesc": string;
  "settings.reservationTypesLimit": string;
  "settings.reservationTypesSaved": string;
  "settings.reservationTypesUpgrade": string;

  // Booking (public)
  "booking.title": string;
  "booking.selectType": string;
  "booking.selectLocation": string;
  "booking.allLocations": string;
  "booking.atSite": string;
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
  "booking.linkedReservations": string;
  "booking.addLinked": string;
  "booking.linkedHint": string;
  "booking.closedDay": string;
  "days.monday": string;
  "days.tuesday": string;
  "days.wednesday": string;
  "days.thursday": string;
  "days.friday": string;
  "days.saturday": string;
  "days.sunday": string;
  "openingHours.tooltip": string;
  "openingHours.siteTooltip": string;
  "openingHours.siteOverride": string;
  "openingHours.usingDefaults": string;
  "openingHours.resetToDefaults": string;
  "openingHours.resetConfirm": string;
  "openingHours.resetDone": string;
  "resourceHours.title": string;
  "resourceHours.sameEveryDay": string;
  "resourceHours.perDay": string;
  "resourceHours.openTime": string;
  "resourceHours.closeTime": string;
  "resourceHours.sameEveryDayDesc": string;
  "resourceHours.removeHours": string;
  "resourceHours.saveFirst": string;
  "resourceHours.savedOnCreate": string;
  "resourceHours.openingHoursLabel": string;
  "occasionalSlots.title": string;
  "occasionalSlots.description": string;
  "occasionalSlots.addSlot": string;
  "occasionalSlots.date": string;
  "occasionalSlots.from": string;
  "occasionalSlots.to": string;
  "occasionalSlots.note": string;
  "occasionalSlots.notePlaceholder": string;
  "occasionalSlots.empty": string;
  "occasionalSlots.save": string;
  "occasionalSlots.cancel": string;
  "occasionalSlots.remove": string;
  "occasionalSlots.invalidRange": string;
  "occasionalSlots.pastDate": string;
  "timezone.label": string;
  "timezone.inheritTenant": string;
  "timezone.shownIn": string;
  "timezone.fallback": string;
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
  "booking.serviceMisconfigured": string;
  "booking.serviceMisconfiguredAdmin": string;
  "booking.misconfigBannerTitle": string;
  "booking.misconfigBannerNoReservation": string;
  "booking.misconfigBannerDisabled": string;
  "booking.misconfigBannerTryAgain": string;
  "booking.dateBlocked": string;
  "booking.timeBlocked": string;
  "booking.blocked": string;
  "booking.fixedPricePlaceholder": string;
  "booking.thankYou": string;
  "booking.confirmationMsg": string;
  "booking.checkSpam": string;
  "booking.duplicateTitle": string;
  "booking.duplicateMsg": string;
  "booking.duplicateHint": string;
  "booking.makeAnother": string;
  "booking.addToCalendar": string;
  "booking.notFound": string;
  "booking.notFoundDesc": string;
  "booking.emailPreviewTitle": string;
  "booking.whatGuestReceives": string;
  "booking.pricingType": string;
  "booking.pricingMenu": string;
  "booking.pricingFixed": string;
  "booking.pricingQuote": string;
  "booking.pricingQuoteDesc": string;
  "booking.pricingReserveTable": string;
  "booking.pricingReserveTableDesc": string;
  "booking.pricingSetMenu": string;
  "booking.pricingSetMenuDesc": string;
  "booking.fixedPrice": string;
  "booking.restaurantSubType": string;
  "booking.subTypeDineIn": string;
  "booking.subTypeCatering": string;
  "booking.subTypePopup": string;
  "booking.subTypeDineInDesc": string;
  "booking.subTypeCateringDesc": string;
  "booking.subTypePopupDesc": string;
  "booking.cateringQuoteDesc": string;
  "booking.cateringDetails": string;
  "booking.deliveryAddress": string;
  "booking.dietaryNotes": string;
  "booking.equipmentNeeded": string;
  "booking.staffNeeded": string;
  "booking.popupDetails": string;
  "booking.festivalName": string;
  "booking.stallSize": string;
  "booking.stallSizeSmall": string;
  "booking.stallSizeMedium": string;
  "booking.stallSizeLarge": string;
  "booking.electricityNeeded": string;
  "booking.waterNeeded": string;
  "booking.foodPermits": string;
  "booking.stallFee": string;

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
  "admin.invalidCustomRole": string;

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
  "admin.staffLimitReached": string;
  "admin.approvedUsers": string;
  "admin.colName": string;
  "admin.colEmail": string;
  "admin.colRole": string;
  "admin.colStatus": string;
  "admin.colActions": string;
  "admin.colSites": string;
  "admin.siteAssignments": string;
  "admin.siteAssignmentsUpdated": string;
  "admin.usersAssigned": string;
  "admin.noSitesAvailable": string;
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
  "admin.permissionCol": string;
  "admin.permTooltip": string;
  "admin.deleteRoleTitle": string;
  "admin.deleteRoleDesc": string;
  "admin.roleDeleted": string;
  "admin.roleRenamed": string;
  "admin.roleKeyHint": string;
  "admin.clickToRename": string;
  "admin.catReservations": string;
  "admin.catResources": string;
  "admin.catCalendar": string;
  "admin.catReports": string;
  "admin.catSettings": string;
  "admin.catAdmin": string;
  "admin.catSupport": string;
  "admin.permViewReservations": string;
  "admin.permCreateReservations": string;
  "admin.permEditReservations": string;
  "admin.permDeleteReservations": string;
  "admin.permViewResources": string;
  "admin.permManageResources": string;
  "admin.permViewCalendar": string;
  "admin.permViewReports": string;
  "admin.permViewSettings": string;
  "admin.permManageSettings": string;
  "admin.permViewAdmin": string;
  "admin.permManageAdmin": string;
  "admin.permViewSupport": string;
  "admin.permManageSupport": string;
  "admin.catSites": string;
  "admin.permViewSites": string;
  "admin.permManageSites": string;
  "admin.permApproveSites": string;

  // Hero
  "hero.badge": string;
  "hero.title": string;
  "hero.titleHighlight": string;
  "hero.subtitle": string;
  "hero.viewPricing": string;

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
  "pricing.plansTitle": string;
  "home.videoTitle": string;
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
  "login.orContinueWith": string;
  "login.continueGoogle": string;
  "login.continueApple": string;
  "login.haveCode": string;
  "login.codePlaceholder": string;
  "login.codeHint": string;
  "login.codeRedeemed": string;
  "login.codeRedeemFailed": string;

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
  "signup.orContinueWith": string;
  "signup.continueGoogle": string;
  "signup.continueApple": string;

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
  "dashboard.sendReminder": string;
  "dashboard.reminderSent": string;
  "dashboard.reminderSentAt": string;
  "dashboard.confirmationSentAt": string;
  "dashboard.cancellationSentAt": string;
  "dashboard.reminderError": string;
  "dashboard.sendReminderMsg": string;
  "dashboard.notCheckedIn": string;
  "dashboard.todayFilter": string;
  "dashboard.activeResources": string;
  "dashboard.bookingLink": string;
  "dashboard.bookingLinkDesc": string;
  "dashboard.shareTitle": string;
  "dashboard.shareDesc": string;
  "dashboard.shareTabEmbed": string;
  "dashboard.shareTabButton": string;
  "dashboard.shareTabDomain": string;
  "dashboard.shareEmbedDesc": string;
  "dashboard.shareEmbedHint": string;
  "dashboard.shareButtonDesc": string;
  "dashboard.shareButtonHint": string;
  "dashboard.shareButtonLabel": string;
  "dashboard.shareDomainDesc": string;
  "dashboard.shareDomainStep1": string;
  "dashboard.shareDomainStep2": string;
  "dashboard.shareDomainStep3": string;
  "dashboard.shareDomainHint": string;
  "dashboard.shareCopyCode": string;
  "dashboard.shareCopyAddress": string;
  "dashboard.shareIframeTitle": string;
  "dashboard.allServices": string;
  "dashboard.byServiceType": string;
  "dashboard.byLocation": string;
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
  "dashboard.copyResource": string;
  "dashboard.copyResourceDesc": string;
  "dashboard.copyCount": string;
  "dashboard.resourcesCopied": string;
  "booking.stayDetails": string;
  "dashboard.uploadImage": string;
  "dashboard.imageUploaded": string;
  "dashboard.imageUploadError": string;
  "dashboard.restaurant": string;
  "dashboard.venue": string;
  "dashboard.guesthouse": string;
  "dashboard.hotel": string;
  "dashboard.wellness": string;
  "dashboard.custom": string;
  "dashboard.checkoutToday": string;
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
  "autoReminder.title": string;
  "autoReminder.tooltip": string;
  "autoReminder.hourly": string;
  "autoReminder.nextRun": string;
  "autoReminder.active": string;
  "autoReminder.recentLog": string;
  "autoReminder.sent7d": string;
  "autoReminder.noRecent": string;
  "notifications.title": string;
  "notifications.empty": string;
  "notifications.markAllRead": string;
  "notifications.markRead": string;
  "notifications.used": string;
  "notifications.invoiced": string;
  "dashboard.used": string;
  "dashboard.invoiced": string;
  "invoiceRefusal.NO_PRICE": string;
  "invoiceRefusal.AMOUNT_MISMATCH": string;
  "invoiceRefusal.INVOICED_LOCKED": string;
  "invoiceRefusal.NOT_PERMITTED": string;
  "invoiceRefusal.UNKNOWN": string;
  "invoiceRefusal.serverReasonLabel": string;
  "invoiceRefusal.guestNotice": string;
  "invoiceRefusal.CANCELLED": string;
  "invoiceRefusal.NOT_FOUND": string;
  "invoiceRefusal.SESSION_EXPIRED": string;
  "invoiceRefusal.OFFLINE": string;
  "invoiceRefusal.RATE_LIMITED": string;
  "invoiceRefusal.CONFLICT": string;
  "invoiceRefusal.SERVER_ERROR": string;
  "invoiceRefusalGuest.NO_PRICE": string;
  "invoiceRefusalGuest.AMOUNT_MISMATCH": string;
  "invoiceRefusalGuest.INVOICED_LOCKED": string;
  "invoiceRefusalGuest.NOT_PERMITTED": string;
  "invoiceRefusalGuest.CANCELLED": string;
  "invoiceRefusalGuest.NOT_FOUND": string;
  "invoiceRefusalGuest.SESSION_EXPIRED": string;
  "invoiceRefusalGuest.OFFLINE": string;
  "invoiceRefusalGuest.RATE_LIMITED": string;
  "invoiceRefusalGuest.CONFLICT": string;
  "invoiceRefusalGuest.SERVER_ERROR": string;
  "invoiceRefusalGuest.UNKNOWN": string;
  "dashboard.downloadInvoice": string;
  "dashboard.downloadInvoicePdf": string;
  "reports.downloadReportPdf": string;
  "dashboard.markLinkedUsed": string;
  "dashboard.markLinkedUsedMsg": string;
  "dashboard.markAll": string;
  "dashboard.markLinkedInvoiced": string;
  "dashboard.markLinkedInvoicedMsg": string;
  "dashboard.markAllInvoiced": string;
  "dashboard.total": string;
  "dashboard.dailySnapshot": string;
  "dashboard.overviewSubtitle": string;
  "alerts.pendingAction": string;
  "alerts.uninvoicedAction": string;
  "alerts.checkoutsAction": string;
  "alerts.shortcuts": string;
  "blocking.pendingApproval": string;
  "dashboard.calendarHotel": string;
  "dashboard.calendarVenue": string;
  "dashboard.calendarRestaurant": string;
  "dashboard.legendHasReservations": string;
  "dashboard.legendBlocked": string;
  "dashboard.legendRecurring": string;
  "dashboard.legendBoth": string;
  "dashboard.calendarTooltip": string;
  "dashboard.blockDay": string;
  "dashboard.recurringBlocks": string;
  "dashboard.blocked": string;
  "dashboard.allDay": string;
  "dashboard.reservationsLabel": string;
  "dashboard.every": string;
  "dashboard.blockTitle": string;
  "dashboard.blockedLabel": string;
  "dashboard.blockLabel": string;
  "dashboard.blockReason": string;
  "dashboard.unblockAll": string;
  "dashboard.blockRestaurantDay": string;
  "dashboard.blockAllTitle": string;
  "dashboard.resourceManagement": string;
  "dashboard.resourceManagementDesc": string;
  "dashboard.actions": string;
  "dashboard.active": string;
  "dashboard.serviceOptions": string;
  "dashboard.offersCatering": string;
  "dashboard.offersPopup": string;
  "dashboard.dineInOptions": string;
  "dashboard.offersTableReservation": string;
  "dashboard.offersQuote": string;
  "dashboard.offersSetMenu": string;
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
  "dashboard.roomTypeLabel": string;
  "dashboard.bedConfiguration": string;
  "dashboard.roomDescription": string;
  "dashboard.roomDescPlaceholder": string;
  "dashboard.addMode": string;
  "dashboard.addModeIndividual": string;
  "dashboard.addModeBulk": string;
  "dashboard.bulkRoomType": string;
  "dashboard.bulkQuantity": string;
  "dashboard.bulkAdd": string;
  "dashboard.bulkAdded": string;
  "dashboard.bedType": string;
  "dashboard.bedCount": string;
  "dashboard.addBed": string;
  "dashboard.roomType.single": string;
  "dashboard.roomType.double": string;
  "dashboard.roomType.twin": string;
  "dashboard.roomType.double_double": string;
  "dashboard.roomType.triple": string;
  "dashboard.roomType.quad": string;
  "dashboard.roomType.studio": string;
  "dashboard.roomType.suite": string;
  "dashboard.roomType.connecting": string;
  "dashboard.roomType.entire": string;
  "dashboard.bedType.twin_single": string;
  "dashboard.bedType.bunk": string;
  "dashboard.bedType.queen": string;
  "dashboard.bedType.king": string;
  "dashboard.bedType.california_king": string;
  "dashboard.bedType.murphy": string;
  "dashboard.bedType.sofa": string;
  "dashboard.bedType.trundle": string;
  "booking.selectRoomType": string;
  "booking.roomTypeLabel": string;
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
  "occasions.title": string;
  "occasions.subtitle": string;
  "occasions.add": string;
  "occasions.editTitle": string;
  "occasions.name": string;
  "occasions.namePlaceholder": string;
  "occasions.description": string;
  "occasions.descriptionPlaceholder": string;
  "occasions.date": string;
  "occasions.service": string;
  "occasions.resource": string;
  "occasions.anyResource": string;
  "occasions.bookingType": string;
  "occasions.seatings": string;
  "occasions.openBooking": string;
  "occasions.capacityPerSeating": string;
  "occasions.capacityPerDay": string;
  "occasions.capacityHintSeatings": string;
  "occasions.capacityHintOpen": string;
  "occasions.seatingTimes": string;
  "occasions.addTime": string;
  "occasions.active": string;
  "occasions.inactive": string;
  "occasions.save": string;
  "occasions.cancel": string;
  "occasions.delete": string;
  "occasions.deleteConfirm": string;
  "occasions.saved": string;
  "occasions.deleted": string;
  "occasions.empty": string;
  "occasions.seats": string;
  "occasions.seatsPerSeating": string;
  "occasions.nameRequired": string;
  "occasions.dateRequired": string;
  "occasions.timesRequired": string;
  "booking.occasionSectionTitle": string;
  "booking.occasionHint": string;
  "booking.occasionNormal": string;
  "booking.occasionSeating": string;
  "booking.occasionSeatsLeft": string;
  "booking.occasionFull": string;
  "booking.occasionOpenHint": string;
  "booking.occasionSeatingRequired": string;
  "booking.occasionErrUnavailable": string;
  "booking.occasionErrWrongDate": string;
  "booking.occasionErrWrongType": string;
  "booking.occasionErrSeatingRequired": string;
  "booking.occasionErrSeatingUnavailable": string;
  "booking.occasionErrFull": string;
  "booking.occasionErrFullWithSeats": string;
  "booking.occasionNoneOnDate": string;
  "booking.occasionNextDates": string;
  "monitor.title": string;
  "monitor.subtitle": string;
  "monitor.days": string;
  "monitor.refresh": string;
  "monitor.loading": string;
  "monitor.empty": string;
  "monitor.total": string;
  "monitor.lastSeen": string;
  "monitor.code.OCCASION_FULL": string;
  "monitor.code.OCCASION_SEATING_UNAVAILABLE": string;
  "monitor.code.OCCASION_SEATING_REQUIRED": string;
  "monitor.code.OCCASION_WRONG_DATE": string;
  "monitor.code.OCCASION_WRONG_TYPE": string;
  "monitor.code.OCCASION_UNAVAILABLE": string;
  "monitor.code.DB_INSERT_FAILED": string;
  "monitor.code.UNTAGGED": string;

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
  "onboarding.customDesc": string;
  "onboarding.wellnessDesc": string;
  "booking.subServices": string;
  "booking.subServiceQty": string;
  "dashboard.customTypeLabel": string;
  "dashboard.customTypeLabelHelp": string;
  "dashboard.subServices": string;
  "dashboard.addSubService": string;
  "dashboard.subServiceName": string;
  "dashboard.subServicePrice": string;
  "dashboard.subServiceDuration": string;
  "dashboard.wellnessServicesHint": string;
  "blocking.wellness": string;
  "booking.servicesMenu": string;
  "booking.totalDuration": string;
  "booking.totalPrice": string;
  "booking.noServicesYet": string;
  "booking.servicesMenuHelp": string;

  // Tiers
  "tier.basic": string;
  "tier.basicDesc": string;
  "tier.pro": string;
  "tier.proDesc": string;
  "tier.professional": string;
  "tier.professionalDesc": string;
  "tier.business": string;
  "tier.businessDesc": string;

  // Pricing page
  "pricing.heroTitle": string;
  "pricing.heroSubtitle": string;
  "pricing.basicName": string;
  "pricing.basicDesc": string;
  "pricing.basicTypes": string;
  "pricing.basicStaff": string;
  "pricing.basicResourcesTotal": string;
  "pricing.proResourcesPerType": string;
  "pricing.proName": string;
  "pricing.proDesc": string;
  "pricing.proTypes": string;
  "pricing.proStaff": string;
  "pricing.businessName": string;
  "pricing.businessDesc": string;
  "pricing.businessTypes": string;
  "pricing.businessStaff": string;
  "pricing.enterpriseName": string;
  "pricing.enterpriseDesc": string;
  "pricing.enterpriseTypes": string;
  "pricing.enterpriseStaff": string;
  "pricing.enterpriseF1": string;
  "pricing.enterpriseF2": string;
  "pricing.enterpriseF3": string;
  "pricing.enterpriseF4": string;
  "pricing.enterprisePrice": string;
  "pricing.enterpriseCta": string;
  "pricing.byOffer": string;
  "pricing.basicF1": string;
  "pricing.basicF2": string;
  "pricing.basicF3": string;
  "pricing.basicF4": string;
  "pricing.basicF5": string;
  "pricing.proF1": string;
  "pricing.proF2": string;
  "pricing.proF3": string;
  "pricing.businessF1": string;
  "pricing.businessF2": string;
  "pricing.businessF3": string;
  "pricing.businessF4": string;
  "pricing.sitesLocations": string;
  "pricing.resourcesPerType": string;
  "pricing.operationTypes": string;
  "pricing.onePerResType": string;
  "pricing.responseTime24h": string;
  "pricing.customBranding": string;
  "pricing.brandedBooking": string;
  "pricing.defaultTemplates": string;
  "pricing.customTemplates": string;
  "pricing.advancedRules": string;
  "pricing.multiLanguage": string;
  "pricing.multisiteManagement": string;
  "pricing.analyticsReports": string;
  "pricing.offers": string;
  "pricing.crossReservations": string;
  "pricing.supportLevel": string;
  "pricing.basic": string;
  "pricing.advanced": string;
  "pricing.unlimited": string;
  "pricing.all": string;
  "pricing.multiLocationTitle": string;
  "pricing.multiLocationDesc": string;
  "pricing.tryBusinessFree": string;
  "pricing.faqQ1": string;
  "pricing.faqA1": string;
  "pricing.faqQ2": string;
  "pricing.faqA2": string;
  "pricing.faqQ3": string;
  "pricing.faqA3": string;
  "pricing.faqQ4": string;
  "pricing.faqA4": string;
  "pricing.faqQ5": string;
  "pricing.faqA5": string;

  // Support page
  "support.heroTitle": string;
  "support.heroSubtitle": string;
  "support.articlesHeading": string;
  "support.searchPlaceholder": string;
  "support.noResults": string;
  "support.stillNeedHelp": string;
  "support.stillNeedHelpDesc": string;
  "support.gettingStarted": string;
  "support.gettingStartedDesc": string;
  "support.gettingStartedC1": string;
  "support.gettingStartedC2": string;
  "support.gettingStartedC3": string;
  "support.gettingStartedC4": string;
  "support.managingRes": string;
  "support.managingResDesc": string;
  "support.managingResC1": string;
  "support.managingResC2": string;
  "support.managingResC3": string;
  "support.managingResC4": string;
  "support.emailTemplates": string;
  "support.emailTemplatesDesc": string;
  "support.emailTemplatesC1": string;
  "support.emailTemplatesC2": string;
  "support.emailTemplatesC3": string;
  "support.emailTemplatesC4": string;
  "support.brandingTitle": string;
  "support.brandingDesc": string;
  "support.brandingC1": string;
  "support.brandingC2": string;
  "support.brandingC3": string;
  "support.brandingC4": string;
  "support.openingHoursTitle": string;
  "support.openingHoursDesc": string;
  "support.openingHoursC1": string;
  "support.openingHoursC2": string;
  "support.openingHoursC3": string;
  "support.openingHoursC4": string;
  "support.openingHoursC5": string;
  "support.openingHoursC6": string;
  "support.openingHoursC7": string;
  "support.resourcesTitle": string;
  "support.resourcesDesc": string;
  "support.resourcesC1": string;
  "support.resourcesC2": string;
  "support.resourcesC3": string;
  "support.resourcesC4": string;
  "support.staffTitle": string;
  "support.staffDesc": string;
  "support.staffC1": string;
  "support.staffC2": string;
  "support.staffC3": string;
  "support.staffC4": string;
  "support.billingTitle": string;
  "support.billingDesc": string;
  "support.billingC1": string;
  "support.billingC2": string;
  "support.billingC3": string;
  "support.billingC4": string;
  "support.faqTitle": string;
  "support.faqDesc": string;
  "support.faqC1": string;
  "support.faqC2": string;
  "support.faqC3": string;
  "support.faqC4": string;
  "support.faqC5": string;
  "support.catBasics": string;
  "support.catReservations": string;
  "support.catCommunication": string;
  "support.catCustomization": string;
  "support.catConfiguration": string;
  "support.catTeam": string;
  "support.catBilling": string;
  "support.catFaq": string;

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
  "cookie.acceptAll": string;
  "cookie.rejectAll": string;
  "cookie.customize": string;
  "cookie.savePreferences": string;
  "cookie.title": string;
  "cookie.description": string;
  "cookie.category.necessary": string;
  "cookie.category.necessaryDesc": string;
  "cookie.category.analytics": string;
  "cookie.category.analyticsDesc": string;
  "cookie.category.marketing": string;
  "cookie.category.marketingDesc": string;
  "cookie.alwaysOn": string;

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

  // Help & Support page (DashboardSupportPanel)
  "help.title": string;
  "help.subtitle": string;
  "help.searchPlaceholder": string;
  "help.noResults": string;
  "help.aiTitle": string;
  "help.aiSubtitle": string;
  "help.askOrGuide": string;
  "help.thinking": string;
  "help.cancelRequest": string;
  "help.submitRequest": string;
  "help.subjectPlaceholder": string;
  "help.describePlaceholder": string;
  "help.submitToAdmin": string;
  "help.typePlaceholder": string;
  "help.errorNoTenant": string;
  "help.errorSubmit": string;
  "help.successSubmit": string;
  "help.errorConnect": string;
  "help.requestSubmitted": string;
  "help.requestSubmittedDetail": string;
  "help.art1Title": string;
  "help.art1Desc": string;
  "help.art1C1": string;
  "help.art1C2": string;
  "help.art1C3": string;
  "help.art1C4": string;
  "help.art2Title": string;
  "help.art2Desc": string;
  "help.art2C1": string;
  "help.art2C2": string;
  "help.art2C3": string;
  "help.art2C4": string;
  "help.art3Title": string;
  "help.art3Desc": string;
  "help.art3C1": string;
  "help.art3C2": string;
  "help.art3C3": string;
  "help.art3C4": string;
  "help.art4Title": string;
  "help.art4Desc": string;
  "help.art4C1": string;
  "help.art4C2": string;
  "help.art4C3": string;
  "help.art4C4": string;
  "help.art5Title": string;
  "help.art5Desc": string;
  "help.art5C1": string;
  "help.art5C2": string;
  "help.art5C3": string;
  "help.art5C4": string;
  "help.art6Title": string;
  "help.art6Desc": string;
  "help.art6C1": string;
  "help.art6C2": string;
  "help.art6C3": string;
  "help.art6C4": string;
  "help.art7Title": string;
  "help.art7Desc": string;
  "help.art7C1": string;
  "help.art7C2": string;
  "help.art7C3": string;
  "help.art7C4": string;
  "help.art8Title": string;
  "help.art8Desc": string;
  "help.art8C1": string;
  "help.art8C2": string;
  "help.art8C3": string;
  "help.art8C4": string;
  "help.art9Title": string;
  "help.art9Desc": string;
  "help.art9C1": string;
  "help.art9C2": string;
  "help.art9C3": string;
  "help.art9C4": string;
  "help.art10Title": string;
  "help.art10Desc": string;
  "help.art10C1": string;
  "help.art10C2": string;
  "help.art10C3": string;
  "help.art10C4": string;
  "help.art10C5": string;
  "help.art10C6": string;
  "help.art11Title": string;
  "help.art11Desc": string;
  "help.art11C1": string;
  "help.art11C2": string;
  "help.art11C3": string;
  "help.art11C4": string;
  "help.art12Title": string;
  "help.art12Desc": string;
  "help.art12C1": string;
  "help.art12C2": string;
  "help.art12C3": string;
  "help.art12C4": string;
  "help.guide7Q": string;
  "help.guide7A": string;
  "help.guide8Q": string;
  "help.guide8A": string;
  "help.guide1Q": string;
  "help.guide1A": string;
  "help.guide2Q": string;
  "help.guide2A": string;
  "help.guide3Q": string;
  "help.guide3A": string;
  "help.guide4Q": string;
  "help.guide4A": string;
  "help.guide5Q": string;
  "help.guide5A": string;
  "help.guide6Q": string;
  "help.guide6A": string;

  "aid.title": string;
  "aid.subtitle": string;
  "aid.myRequests": string;
  "aid.yourRequests": string;
  "aid.askOrGuide": string;
  "aid.quickGuides": string;
  "aid.thinking": string;
  "aid.cancelRequest": string;
  "aid.submitRequest": string;
  "aid.subjectPlaceholder": string;
  "aid.messagePlaceholder": string;
  "aid.submitToAdmin": string;
  "aid.typePlaceholder": string;
  "aid.sendMessage": string;
  "aid.chat": string;
  "aid.requests": string;
  "aid.loadingRequests": string;
  "aid.noRequests": string;
  "aid.noRequestsHint": string;
  "aid.yourMessage": string;
  "aid.adminResponse": string;
  "aid.awaitingResponse": string;
  "aid.requestSubmitted": string;
  "aid.requestSubmittedDetail": string;
  "aid.statusOpen": string;
  "aid.statusInProgress": string;
  "aid.statusResolved": string;
  "aid.statusClosed": string;
  "aid.errorNoTenant": string;
  "aid.errorSubmit": string;
  "aid.successSubmit": string;
  "aid.errorConnect": string;
  "aid.guideQ1": string;
  "aid.guideA1": string;
  "aid.guideQ2": string;
  "aid.guideA2": string;
  "aid.guideQ3": string;
  "aid.guideA3": string;
  "aid.guideQ4": string;
  "aid.guideA4": string;
  "aid.guideQ5": string;
  "aid.guideA5": string;
  "aid.guideQ6": string;
  "aid.guideA6": string;
  "aid.guideQ7": string;
  "aid.guideA7": string;
  "aid.guideQ8": string;
  "aid.guideA8": string;
  "aid.guideQ9": string;
  "aid.guideA9": string;
  "aid.guideQ10": string;
  "aid.guideA10": string;
  "aid.guideQ11": string;
  "aid.guideA11": string;
  "aid.guideQ12": string;
  "aid.guideA12": string;
  "aid.guideQ13": string;
  "aid.guideA13": string;
  "aid.guideQ14": string;
  "aid.guideA14": string;

  // Sites
  "sites.title": string;
  "sites.addSite": string;
  "sites.editSite": string;
  "sites.tooltip": string;
  "sites.allSites": string;
  "sites.approvals": string;
  "sites.siteName": string;
  "sites.siteType": string;
  "sites.slug": string;
  "sites.slugHint": string;
  "sites.location": string;
  "sites.description": string;
  "sites.descriptionPlaceholder": string;
  "sites.createSite": string;
  "sites.updateSite": string;
  "sites.siteCreated": string;
  "sites.siteUpdated": string;
  "sites.siteDeleted": string;
  "sites.duplicateSlug": string;
  "sites.deleteSite": string;
  "sites.deleteConfirm": string;
  "sites.noSites": string;
  "sites.resources": string;
  "sites.status": string;
  "sites.actions": string;
  "sites.active": string;
  "sites.draft": string;
  "sites.typeHotel": string;
  "sites.typeRestaurant": string;
  "sites.typeVenue": string;
  "sites.resourceName": string;
  "sites.resourceType": string;
  "sites.capacity": string;
  "sites.noResourcesInSite": string;
  "sites.assignUsers": string;
  "sites.alreadyAssigned": string;
  "sites.usersSelected": string;

  // Sample period
  "sample.warningWeek": string;
  "sample.warningDay": string;
  "sample.warningDayTomorrow": string;
  "sample.readOnly": string;
  "sample.blocked": string;

  // Discount
  "discount.title": string;
  "discount.type": string;
  "discount.value": string;
  "discount.reason": string;
  "discount.reasonPlaceholder": string;
  "discount.percentage": string;
  "discount.fixed": string;
  "discount.freeNights": string;
  "discount.promoCode": string;
  "discount.promoCodePlaceholder": string;

  // Discount Codes Management
  "discountCodes.title": string;
  "discountCodes.description": string;
  "discountCodes.add": string;
  "discountCodes.addTitle": string;
  "discountCodes.editTitle": string;
  "discountCodes.formDesc": string;
  "discountCodes.code": string;
  "discountCodes.discountCol": string;
  "discountCodes.discountType": string;
  "discountCodes.value": string;
  "discountCodes.uses": string;
  "discountCodes.validity": string;
  "discountCodes.actions": string;
  "discountCodes.maxUses": string;
  "discountCodes.unlimited": string;
  "discountCodes.minPrice": string;
  "discountCodes.validFrom": string;
  "discountCodes.validUntil": string;
  "discountCodes.from": string;
  "discountCodes.until": string;
  "discountCodes.active": string;
  "discountCodes.inactive": string;
  "discountCodes.activeLabel": string;
  "discountCodes.empty": string;
  "discountCodes.created": string;
  "discountCodes.updated": string;
  "discountCodes.deleted": string;
  "discountCodes.saveError": string;
  "discountCodes.deleteError": string;
  "discountCodes.deleteTitle": string;
  "discountCodes.deleteConfirm": string;

  // Approval Queue
  "approval.colType": string;
  "approval.colName": string;
  "approval.colDetail": string;
  "approval.colSite": string;
  "approval.colSubmitted": string;
  "approval.colActions": string;
  "approval.approve": string;
  "approval.reject": string;
  "approval.rejecting": string;
  "approval.approved": string;
  "approval.rejected": string;
  "approval.rejectChange": string;
  "approval.rejectingLabel": string;
  "approval.rejectionReason": string;
  "approval.noItems": string;
  "approval.noItemsDesc": string;
  "approval.typeResource": string;
  "approval.typeBlockedSlot": string;
  "approval.typeRecurringBlock": string;
  "approval.typeOpeningHours": string;
  "approval.typeEmailTemplate": string;
  "approval.noReason": string;
  "approval.closed": string;
  "approval.pendingApproval": string;

  // Email Template Editor
  "emailTemplates.title": string;
  "emailTemplates.tooltip": string;
  "emailTemplates.description": string;
  "emailTemplates.proRequired": string;
  "emailTemplates.confirmation": string;
  "emailTemplates.reminder": string;
  "emailTemplates.cancellation": string;
  "emailTemplates.language": string;
  "emailTemplates.subject": string;
  "emailTemplates.body": string;
  "emailTemplates.showPreview": string;
  "emailTemplates.hidePreview": string;
  "emailTemplates.previewLabel": string;
  "emailTemplates.availableVars": string;
  "emailTemplates.activeToggle": string;
  "emailTemplates.activeToggleDesc": string;
  "emailTemplates.resetDefault": string;
  "emailTemplates.saved": string;
  "emailTemplates.saveError": string;
  "emailTemplates.active": string;
  "emailTemplates.inactive": string;
  "emailTemplates.upgradeHint": string;
  "emailTemplates.overrideRemoved": string;
  "emailTemplates.siteOverride": string;
  "emailTemplates.usingTenantDefault": string;
  "emailTemplates.revertToDefault": string;
  "emailTemplates.siteDescription": string;

  // What Is MimmoBook
  "whatIs.badge": string;
  "whatIs.heroTitle": string;
  "whatIs.heroSubtitle": string;
  "whatIs.seeFeatures": string;
  "whatIs.definitionTitle": string;
  "whatIs.definitionP1": string;
  "whatIs.definitionP2": string;
  "whatIs.definitionP3": string;
  "whatIs.whoTitle": string;
  "whatIs.whoSubtitle": string;
  "whatIs.whoRestaurants": string;
  "whatIs.whoRestaurantsDesc": string;
  "whatIs.whoVenues": string;
  "whatIs.whoVenuesDesc": string;
  "whatIs.whoHotels": string;
  "whatIs.whoHotelsDesc": string;
  "whatIs.whoGuesthouses": string;
  "whatIs.whoGuesthousesDesc": string;
  "whatIs.whoWellness": string;
  "whatIs.whoWellnessDesc": string;
  "whatIs.howTitle": string;
  "whatIs.howSubtitle": string;
  "whatIs.howStep1": string;
  "whatIs.howStep1Desc": string;
  "whatIs.howStep2": string;
  "whatIs.howStep2Desc": string;
  "whatIs.howStep3": string;
  "whatIs.howStep3Desc": string;
  "whatIs.howStep4": string;
  "whatIs.howStep4Desc": string;
  "whatIs.keyFeaturesTitle": string;
  "whatIs.feat1": string;
  "whatIs.feat1Desc": string;
  "whatIs.feat2": string;
  "whatIs.feat2Desc": string;
  "whatIs.feat3": string;
  "whatIs.feat3Desc": string;
  "whatIs.feat4": string;
  "whatIs.feat4Desc": string;
  "whatIs.feat5": string;
  "whatIs.feat5Desc": string;
  "whatIs.feat6": string;
  "whatIs.feat6Desc": string;
  "whatIs.allFeatures": string;
  "whatIs.ctaTitle": string;
  "whatIs.ctaSubtitle": string;

  // Features Page
  "featuresPage.badge": string;
  "featuresPage.heroTitle": string;
  "featuresPage.heroSubtitle": string;
  "featuresPage.ctaTitle": string;
  "featuresPage.ctaSubtitle": string;
  "featuresPage.comparePlans": string;
  "features.catReservations": string;
  "features.catBranding": string;
  "features.catManagement": string;
  "features.catComms": string;
  "features.f1Title": string;
  "features.f1Desc": string;
  "features.f2Title": string;
  "features.f2Desc": string;
  "features.f3Title": string;
  "features.f3Desc": string;
  "features.f4Title": string;
  "features.f4Desc": string;
  "features.f5Title": string;
  "features.f5Desc": string;
  "features.f6Title": string;
  "features.f6Desc": string;
  "features.f7Title": string;
  "features.f7Desc": string;
  "features.f8Title": string;
  "features.f8Desc": string;
  "features.f9Title": string;
  "features.f9Desc": string;
  "features.f10Title": string;
  "features.f10Desc": string;
  "features.f11Title": string;
  "features.f11Desc": string;
  "features.f12Title": string;
  "features.f12Desc": string;
  "features.f13Title": string;
  "features.f13Desc": string;
  "features.f14Title": string;
  "features.f14Desc": string;
  "features.f15Title": string;
  "features.f15Desc": string;
  "features.f16Title": string;
  "features.f16Desc": string;
  "features.f17Title": string;
  "features.f17Desc": string;
  "features.f18Title": string;
  "features.f18Desc": string;
  "features.catGuests": string;
  "features.catOperations": string;
  "features.catSecurity": string;
  "features.catPlatform": string;
  "features.f19Title": string;
  "features.f19Desc": string;
  "features.f20Title": string;
  "features.f20Desc": string;
  "features.f21Title": string;
  "features.f21Desc": string;
  "features.f22Title": string;
  "features.f22Desc": string;
  "features.f23Title": string;
  "features.f23Desc": string;
  "features.f24Title": string;
  "features.f24Desc": string;
  "features.f25Title": string;
  "features.f25Desc": string;
  "features.f26Title": string;
  "features.f26Desc": string;
  "features.f27Title": string;
  "features.f27Desc": string;
  "features.f28Title": string;
  "features.f28Desc": string;
  "features.f29Title": string;
  "features.f29Desc": string;
  "features.f30Title": string;
  "features.f30Desc": string;
  "features.f31Title": string;
  "features.f31Desc": string;
  "features.f32Title": string;
  "features.f32Desc": string;
  "features.f33Title": string;
  "features.f33Desc": string;
  "features.f34Title": string;
  "features.f34Desc": string;
  "features.f35Title": string;
  "features.f35Desc": string;
  "features.f36Title": string;
  "features.f36Desc": string;
  "features.f37Title": string;
  "features.f37Desc": string;
  "features.f38Title": string;
  "features.f38Desc": string;
  "features.f39Title": string;
  "features.f39Desc": string;
  "features.offersAndCross": string;
  "features.offersAndCrossDesc": string;

  "useCases.badge": string;
  "useCases.ogTitle": string;
  "useCases.ogDescription": string;
  "useCases.ogImageAlt": string;
  "useCases.seoTitle": string;
  "useCases.seoDescription": string;
  "useCases.seoKeywords": string;
  "useCases.heroTitle": string;
  "useCases.heroSubtitle": string;
  "useCases.challengesLabel": string;
  "useCases.solutionLabel": string;
  "useCases.restaurant": string;
  "useCases.restaurantDesc": string;
  "useCases.restaurantChallenges": string;
  "useCases.restaurantSolution": string;
  "useCases.venue": string;
  "useCases.venueDesc": string;
  "useCases.venueChallenges": string;
  "useCases.venueSolution": string;
  "useCases.hotel": string;
  "useCases.hotelDesc": string;
  "useCases.hotelChallenges": string;
  "useCases.hotelSolution": string;
  "useCases.guesthouse": string;
  "useCases.guesthouseDesc": string;
  "useCases.guesthouseChallenges": string;
  "useCases.guesthouseSolution": string;
  "useCases.catering": string;
  "useCases.cateringDesc": string;
  "useCases.cateringChallenges": string;
  "useCases.cateringSolution": string;
  "useCases.popup": string;
  "useCases.popupDesc": string;
  "useCases.popupChallenges": string;
  "useCases.popupSolution": string;
  "useCases.wellness": string;
  "useCases.wellnessDesc": string;
  "useCases.wellnessChallenges": string;
  "useCases.wellnessSolution": string;
  "useCases.workflowsTitle": string;
  "useCases.workflowsSubtitle": string;
  "useCases.wf1Role": string;
  "useCases.wf1Focus": string;
  "useCases.wf1S1": string;
  "useCases.wf1S2": string;
  "useCases.wf1S3": string;
  "useCases.wf1S4": string;
  "useCases.wf2Role": string;
  "useCases.wf2Focus": string;
  "useCases.wf2S1": string;
  "useCases.wf2S2": string;
  "useCases.wf2S3": string;
  "useCases.wf2S4": string;
  "useCases.wf3Role": string;
  "useCases.wf3Focus": string;
  "useCases.wf3S1": string;
  "useCases.wf3S2": string;
  "useCases.wf3S3": string;
  "useCases.wf3S4": string;
  "useCases.wf4Role": string;
  "useCases.wf4Focus": string;
  "useCases.wf4S1": string;
  "useCases.wf4S2": string;
  "useCases.wf4S3": string;
  "useCases.wf4S4": string;
  "useCases.tradeCtaTitle": string;
  "useCases.tradeCtaSubtitle": string;
  "useCases.tradeCtaBarberName": string;
  "useCases.tradeCtaBarberLine": string;
  "useCases.tradeCtaBarberButton": string;
  "useCases.tradeCtaHairdresserName": string;
  "useCases.tradeCtaHairdresserLine": string;
  "useCases.tradeCtaHairdresserButton": string;
  "useCases.tradeCtaMassageName": string;
  "useCases.tradeCtaMassageLine": string;
  "useCases.tradeCtaMassageButton": string;
  "useCases.tradeCtaBakerName": string;
  "useCases.tradeCtaBakerLine": string;
  "useCases.tradeCtaBakerButton": string;
  "useCases.tradeCtaMakeupName": string;
  "useCases.tradeCtaMakeupLine": string;
  "useCases.tradeCtaMakeupButton": string;
  "useCases.tradeCtaTrainerName": string;
  "useCases.tradeCtaTrainerLine": string;
  "useCases.tradeCtaTrainerButton": string;
  "useCases.ctaTitle": string;
  "useCases.ctaSubtitle": string;

  // Blog
  "blog.badge": string;
  "blog.heroTitle": string;
  "blog.heroSubtitle": string;
  "blog.readMore": string;
  "blog.backToBlog": string;
  "blog.postCta": string;
  "blog.relatedReading": string;
  "blog.ctaTitle": string;
  "blog.ctaSubtitle": string;
  "blog.catInsights": string;
  "blog.catGuides": string;
  "blog.post1Title": string;
  "blog.post1Excerpt": string;
  "blog.post1C1": string;
  "blog.post1C2": string;
  "blog.post1C3": string;
  "blog.post1C4": string;
  "blog.post1C5": string;
  "blog.post2Title": string;
  "blog.post2Excerpt": string;
  "blog.post2C1": string;
  "blog.post2C2": string;
  "blog.post2C3": string;
  "blog.post2C4": string;
  "blog.post3Title": string;
  "blog.post3Excerpt": string;
  "blog.post3C1": string;
  "blog.post3C2": string;
  "blog.post3C3": string;
  "blog.post4Title": string;
  "blog.post4Excerpt": string;
  "blog.post4C1": string;
  "blog.post4C2": string;
  "blog.post4C3": string;
  "blog.post4C4": string;
  "blog.post5Title": string;
  "blog.post5Excerpt": string;
  "blog.post5C1": string;
  "blog.post5C2": string;
  "blog.post5C3": string;
  "blog.post5C4": string;
  "blog.post5C5": string;
  "blog.post6Title": string;
  "blog.post6Excerpt": string;
  "blog.post6C1": string;
  "blog.post6C2": string;
  "blog.post6C3": string;
  "blog.post6C4": string;
  "blog.post6C5": string;
  "blog.post6C6": string;
  "blog.post7Title": string;
  "blog.post7Excerpt": string;
  "blog.post7C1": string;
  "blog.post7C2": string;
  "blog.post7C3": string;
  "blog.post7C4": string;
  "blog.post7C5": string;
  "blog.post7C6": string;
  "blog.post8Title": string;
  "blog.post8Excerpt": string;
  "blog.post8C1": string;
  "blog.post8C2": string;
  "blog.post8C3": string;
  "blog.post8C4": string;
  "blog.post8C5": string;
  "blog.post8C6": string;
  "blog.post9Title": string;
  "blog.post9Excerpt": string;
  "blog.post9C1": string;
  "blog.post9C2": string;
  "blog.post9C3": string;
  "blog.post9C4": string;
  "blog.post9C5": string;
  "blog.post9C6": string;
  "blog.spHeroCaption": string;
  "blog.spSlotsTitle": string;
  "blog.spSlotsCaption": string;
  "blog.spSlotsBooked": string;
  "blog.spSlotsOpen": string;
  "blog.spSlotsLost": string;
  "blog.spFlowTitle": string;
  "blog.spFlowCaption": string;
  "blog.spFlow1Title": string;
  "blog.spFlow1Desc": string;
  "blog.spFlow2Title": string;
  "blog.spFlow2Desc": string;
  "blog.spFlow3Title": string;
  "blog.spFlow3Desc": string;
  "blog.spFlow4Title": string;
  "blog.spFlow4Desc": string;
  "blog.spStat1Label": string;
  "blog.spStat2Label": string;
  "blog.spStat3Label": string;
  "blog.spWhoTitle": string;
  "blog.spWho1": string;
  "blog.spWho2": string;
  "blog.spWho3": string;
  "blog.spWho4": string;
  "blog.spBenefitsTitle": string;
  "blog.spBenefit1": string;
  "blog.spBenefit2": string;
  "blog.spBenefit3": string;
  "blog.spBenefit4": string;
  "blog.spBenefit5": string;
  "blog.spBenefit6": string;

  // Nav new pages
  "nav.features": string;
  "nav.useCases": string;
  "nav.blog": string;
  "nav.whatIs": string;
  "nav.offers": string;
  "nav.kitchen": string;
  "nav.bookingLog": string;

  // Booking validation log
  "bookingLog.title": string;
  "bookingLog.tooltip": string;
  "bookingLog.recentTitle": string;
  "bookingLog.searchPlaceholder": string;
  "bookingLog.allOutcomes": string;
  "bookingLog.empty": string;
  "bookingLog.when": string;
  "bookingLog.guest": string;
  "bookingLog.type": string;
  "bookingLog.date": string;
  "bookingLog.capacity": string;
  "bookingLog.outcome": string;
  "bookingLog.reasonsTitle": string;
  "bookingLog.noReasons": string;
  "bookingLog.softWarningToast": string;

  // Kitchen orders
  "kitchen.title": string;
  "kitchen.tooltip": string;
  "kitchen.date": string;
  "kitchen.prevDay": string;
  "kitchen.nextDay": string;
  "kitchen.pickDate": string;
  "kitchen.ordersFor": string;
  "kitchen.deleteItemNamed": string;
  "kitchen.deleteOrder": string;
  "kitchen.restoreHidden": string;
  "kitchen.deleteOrderNamed": string;
  "kitchen.deleteOrderConfirm": string;
  "kitchen.deleteOrderHint": string;
  "kitchen.orderDeleted": string;
  "kitchen.menu.priceLabel": string;
  "kitchen.today": string;
  "kitchen.noReservations": string;
  "kitchen.noOrders": string;
  "kitchen.addItem": string;
  "kitchen.itemName": string;
  "kitchen.itemNamePlaceholder": string;
  "kitchen.quantity": string;
  "kitchen.category": string;
  "kitchen.status": string;
  "kitchen.notes": string;
  "kitchen.notesPlaceholder": string;
  "kitchen.unitPrice": string;
  "kitchen.total": string;
  "kitchen.guests": string;
  "kitchen.cat.food": string;
  "kitchen.cat.drink": string;
  "kitchen.cat.other": string;
  "kitchen.status.received": string;
  "kitchen.status.preparing": string;
  "kitchen.status.ready": string;
  "kitchen.status.served": string;
  "kitchen.save": string;
  "kitchen.delete": string;
  "kitchen.deleteConfirm": string;
  "kitchen.itemAdded": string;
  "kitchen.itemUpdated": string;
  "kitchen.itemDeleted": string;
  "kitchen.error": string;
  "kitchen.filter.all": string;
  "kitchen.print": string;
  "kitchen.menu.title": string;
  "kitchen.menu.manage": string;
  "kitchen.menu.empty": string;
  "kitchen.menu.addToOrder": string;
  "kitchen.menu.pickFromMenu": string;
  "kitchen.menu.newItem": string;
  "kitchen.menu.namePlaceholder": string;
  "kitchen.menu.saved": string;
  "kitchen.menu.deleted": string;
  "kitchen.menu.saveError": string;
  "kitchen.menu.close": string;
  "kitchen.menu.searchPlaceholder": string;
  "kitchen.bulk.markAll": string;
  "kitchen.bulk.advanceAll": string;
  "kitchen.bulk.allPreparing": string;
  "kitchen.bulk.allReady": string;
  "kitchen.bulk.allServed": string;
  "kitchen.bulk.updated": string;
  "kitchen.bulk.nothingToUpdate": string;

  // Offers
  "offers.title": string;
  "offers.tooltip": string;
  "offers.create": string;
  "offers.edit": string;
  "offers.empty": string;
  "offers.noResults": string;
  "offers.searchPlaceholder": string;
  "offers.showArchived": string;
  "offers.printPdf": string;
  "offers.searchLabel": string;
  "offers.archive": string;
  "offers.unarchive": string;
  "offers.archived": string;
  "offers.archivedSuccess": string;
  "offers.unarchivedSuccess": string;
  "offers.archiveError": string;
  "offers.send": string;
  "offers.confirm": string;
  "offers.saved": string;
  "offers.saveError": string;
  "offers.fillRequired": string;
  "offers.confirmedSuccess": string;
  "offers.confirmedWithoutPrice": string;
  "offers.statusRegionLabel": string;
  "offers.kitchenOrdersFailedAnnounce": string;
  "offers.confirmErrorAnnounce": string;
  "offers.confirmedWithoutPriceAnnounce": string;
  "offers.kitchenOrdersFailed": string;
  "offers.confirmedKitchenSentOne": string;
  "offers.confirmedKitchenSent": string;
  "offers.confirmedNoKitchen": string;
  "offers.priceReviewTitle": string;
  "offers.priceReviewDesc": string;
  "offers.priceReviewWarnTitle": string;
  "offers.priceReviewWarnDesc": string;
  "offers.priceReviewNeedsPrice": string;
  "offers.priceReviewFromResource": string;
  "offers.priceReviewReasonAmbiguous": string;
  "offers.priceReviewReasonNoResource": string;
  "offers.priceReviewReasonUnpriced": string;
  "offers.priceReviewAmount": string;
  "offers.priceReviewSkip": string;
  "offers.priceReviewConfirm": string;
  "offers.confirmError": string;
  "offers.sendEmail": string;
  "offers.emailSent": string;
  "offers.emailError": string;
  "offers.pdfAttached": string;
  "offers.lastSent": string;
  "offers.statusDraft": string;
  "offers.statusSent": string;
  "offers.statusConfirmed": string;
  "offers.statusExpired": string;
  "offers.validity": string;
  "offers.validityPlaceholder": string;
  "offers.startTime": string;
  "offers.endTime": string;
  "offers.eventSpace": string;
  "offers.selectSpace": string;
  "offers.eventType": string;
  "offers.invoicing": string;
  "offers.linkedReservations": string;
  "offers.specialRequests": string;
  "offers.menuPlaceholder": string;
  "offers.menuKitchenLabel": string;
  "offers.menuKitchenHint": string;
  "offers.menuKitchenHintLeg": string;
  "offers.menuFormatHint": string;
  "offers.menuNoKitchenHint": string;
  "offers.menuKitchenLabelMain": string;
  "offers.menuKitchenLabelFor": string;
  "offers.menuKitchenHintLegOwn": string;
  "offers.menuKitchenHintLegMoved": string;
  "offers.menuKitchenSummary": string;
  "offers.kitchenPreviewTitle": string;
  "offers.kitchenMapTitle": string;
  "offers.kitchenMapRule": string;
  "offers.kitchenMapOwn": string;
  "offers.kitchenMapTo": string;
  "offers.kitchenMapNone": string;
  "offers.kitchenPreviewTotal": string;
  "offers.kitchenPreviewEmpty": string;
  "offers.kitchenPreviewNone": string;
  "offers.kitchenPreviewStays": string;
  "offers.kitchenPreviewMoved": string;
  "offers.kitchenPreviewLost": string;
  "offers.language": string;
  "offers.emailTo": string;
  "offers.emailSubject": string;
  "offers.emailBody": string;
  "offers.crossBookingTitle": string;
  "offers.crossBookingAdd": string;
  "offers.crossBookingAdded": string;
  "offers.crossBookingAddError": string;
  "offers.crossBookingRemoved": string;
  "offers.crossBookingRemoveError": string;
  "offers.linkedGroupCurrent": string;
  "offers.linkedGroupTotal": string;
  "offers.linkedBadge": string;
  "offers.linkedRowService": string;
  "offers.linkedRowDate": string;
  "offers.linkedRowGuests": string;
  "offers.linkedRowPrice": string;
  "offers.linkedRowOpen": string;

  // Tier limit errors (raised by backend triggers / RPCs)
  "tierError.STAFF_USER_LIMIT_REACHED": string;
  "tierError.SITE_LIMIT_REACHED": string;
  "tierError.RESERVATION_TYPE_LIMIT_REACHED": string;
  "tierError.RESOURCE_PER_TYPE_LIMIT_REACHED": string;

  // Privacy & account deletion
  "privacy.panel.title": string;
  "privacy.panel.description": string;
  "privacy.export.title": string;
  "privacy.export.description": string;
  "privacy.export.button": string;
  "privacy.export.success": string;
  "privacy.delete.title": string;
  "privacy.delete.description": string;
  "privacy.delete.button": string;
  "privacy.delete.scheduled": string;
  "privacy.delete.cancel": string;
  "privacy.delete.cancelled": string;
  "privacy.delete.confirmTitle": string;
  "privacy.delete.confirmDescription": string;
  "privacy.delete.confirmLabel": string;
  "privacy.delete.confirmAction": string;
  "privacy.delete.requested": string;
  // Guest portal
  "guest.portal.label": string;
  "guest.portal.title": string;
  "guest.portal.linkExpiredTitle": string;
  "guest.portal.linkRevokedTitle": string;
  "guest.portal.notFoundTitle": string;
  "guest.portal.linkExpiredBody": string;
  "guest.portal.linkRevokedBody": string;
  "guest.portal.notFoundBody": string;
  "guest.portal.checkOut": string;
  "guest.portal.specialRequests": string;
  "guest.portal.total": string;
  "guest.portal.guestsSuffix": string;
  "guest.portal.needDifferentDate": string;
  "guest.portal.newDate": string;
  "guest.portal.newTime": string;
  "guest.portal.message": string;
  "guest.portal.messagePlaceholder": string;
  "guest.portal.requestNewDate": string;
  "guest.portal.sending": string;
  "guest.portal.requestSentBanner": string;
  "guest.portal.requestSentToast": string;
  "guest.portal.requestError": string;
  "guest.portal.cancelBooking": string;
  "guest.portal.cancelTitle": string;
  "guest.portal.cancelDescription": string;
  "guest.portal.keepBooking": string;
  "guest.portal.yesCancel": string;
  "guest.portal.cancelling": string;
  "guest.portal.cancelSuccess": string;
  "guest.portal.cancelError": string;
  "guest.portal.pastBooking": string;
  "guest.portal.questionsFooter": string;
  "guest.find.pageTitle": string;
  "guest.find.heading": string;
  "guest.find.intro": string;
  "guest.find.emailLabel": string;
  "guest.find.submit": string;
  "guest.find.sentBody": string;
  "guest.find.useAnother": string;
  "guest.find.invalidEmail": string;
  "guest.find.error": string;
  "guest.find.linkLabel": string;
  "guest.find.linkHint": string;

  // Availability timeline
  "timeline.title": string;
  "timeline.resource": string;
  "timeline.blocked": string;
  "timeline.availableSlot": string;
  "timeline.empty": string;
  "timeline.previousDay": string;
  "timeline.nextDay": string;
  "timeline.legendReservation": string;
  "timeline.legendPending": string;
  "timeline.legendBlocked": string;
  "timeline.legendSlot": string;
  "timeline.dragHint": string;
  "timeline.newBlockTitle": string;
  "timeline.newBlockDescription": string;
  "timeline.reason": string;
  "timeline.reasonPlaceholder": string;
  "timeline.createBlock": string;
  "timeline.blockCreated": string;
  "timeline.blockError": string;
  "timeline.overlapBlocked": string;
  "timeline.undo": string;
  "timeline.blockUndone": string;
  "ops.digest.title": string;
  "ops.digest.description": string;
  "ops.digest.enabled": string;
  "ops.digest.recipients": string;
  "ops.digest.recipientsHelp": string;
  "ops.digest.save": string;
  "ops.digest.saved": string;
  "ops.digest.saveError": string;
  "ops.digest.test": string;
  "ops.weekly.title": string;
  "ops.weekly.description": string;
  "ops.weekly.enabled": string;
  "ops.weekly.day": string;
  "ops.weekly.recipientsHelp": string;
  "ops.weekly.saved": string;
  "ops.weekly.saveError": string;
  "ops.weekly.test": string;
  "ops.weekly.testSent": string;
  "ops.weekly.testError": string;
  "forecast.drilldownTitle": string;
  "forecast.drilldownEmpty": string;
  "forecast.drilldownHint": string;
  "forecast.avgGuests": string;
  "forecast.bookings": string;
  "forecast.yoyTitle": string;
  "forecast.yoySubtitle": string;
  "forecast.thisYear": string;
  "forecast.lastYear": string;
  "forecast.change": string;
  "forecast.occupancyTrend": string;
  "ops.alerts.title": string;
  "ops.alerts.description": string;
  "ops.alerts.enabled": string;
  "ops.alerts.recipientsHelp": string;
  "ops.alerts.saved": string;
  "ops.alerts.saveError": string;
  "timeline.blockButton": string;
  "timeline.startTime": string;
  "timeline.endTime": string;
  "ops.digest.testSent": string;
  "ops.digest.testError": string;
  "nav.pendingRequests": string;

  // Forecast
  "forecast.title": string;
  "forecast.subtitle": string;
  "forecast.booked": string;
  "forecast.expected": string;
  "forecast.next14Booked": string;
  "forecast.next14Guests": string;
  "forecast.gapToPace": string;
  "forecast.peakHours": string;
  "forecast.peakSubtitle": string;
  "forecast.busiest": string;
  "forecast.basedOn": string;
  "forecast.mon": string;
  "forecast.tue": string;
  "forecast.wed": string;
  "forecast.thu": string;
  "forecast.fri": string;
  "forecast.sat": string;
  "forecast.sun": string;
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
  "common.showList": "Show list",
  "common.hideList": "Hide list",
  "common.guests": "Guests",
  "common.date": "Date",
  "common.noResults": "No results found.",
  "common.selectAll": "Select all",
  "common.invalidFileName":
    "This file's name contains characters we can't safely store. Please rename it and try again.",

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
  "nav.sites": "Sites",
  "nav.profile": "Profile",

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
  "reports.offerConversion": "Offers to Reservations",
  "reports.totalOffers": "Total offers",
  "reports.convertedOffers": "Converted to reservations",
  "reports.conversionRate": "Conversion rate",
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
  "reports.uninvoicedAlert":
    "{count} uninvoiced out of {total}, {amount} uninvoiced",
  "reports.breakfastAlert":
    "{count} reservations, {nights} nights. Estimated breakfast revenue {amount}",
  "reports.nights": "nights",
  "reports.reservations": "reservations",
  "reports.ofTotal": "total",
  "reports.invoicedPercent": "invoiced",
  "reports.discountSummary": "Discount Summary",
  "reports.totalDiscounts": "Total Discounts Given",
  "reports.topCodes": "Most Used Codes",
  "reports.discountToRevenue": "Discount-to-Revenue",
  "reports.discountedBookings": "discounted bookings",
  "reports.noDiscounts": "No discounts applied in this period",

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
  "settings.noAccessTitle": "Settings are not available for your role",
  "settings.noAccessDesc":
    "Your account does not have permission to view or edit business settings. Ask an owner or admin of this account to update them, or to give you admin access.",
  "settings.siteNoAccessTitle": "Site settings are not available for your role",
  "settings.siteNoAccessDesc":
    "Only owners and admins can view this site's business details and branding. Ask an owner or admin for access if you need to change them.",
  "access.requestButton": "Request access",
  "access.requestTitle": "Request access from an admin",
  "access.requestDesc":
    "We will send your request to the owners and admins of this account. Tell them briefly what you need access to.",
  "access.requestPlaceholder": "I need access to settings so I can update ...",
  "access.requestSubmit": "Send request",
  "access.requestSending": "Sending ...",
  "access.requestSent": "Your request was sent to the owners and admins",
  "access.requestError": "Could not send your request",
  "access.requestSentInline":
    "Request sent. An owner or admin will get back to you.",
  "access.requestSubject": "Access request",
  "booking.brandingUnavailable":
    "Custom colours and logo could not be loaded, so this page uses the default look. Booking still works normally.",
  "settings.upsellTitle": "Manage multiple locations",
  "settings.upsellDesc":
    "Upgrade to the Business plan to manage hotels, restaurants, and venues from a single dashboard, each with its own resources, hours, and booking page.",
  "settings.learnMore": "Learn more",
  "settings.siteOverride": "Site Override",
  "settings.useParentDefault": "Use company default",
  "settings.customizeForSite": "Customize for this site",
  "settings.inheritedFromParent": "Inherited from company settings",
  "settings.siteSettingsSaved": "Site settings saved",
  "settings.availabilityThresholds": "Availability Thresholds",
  "settings.availabilityThresholdsDesc":
    "Number of reservations before a day shows as 'Full' in the calendar.",
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
  "settings.heroImageHint":
    "Recommended: 1600×600 px. PNG, JPG or WebP. Max 5 MB.",
  "settings.heroImageUploaded": "Hero image uploaded",
  "settings.heroImageUploadError": "Failed to upload hero image",
  "settings.resourceTypeNames": "Resource Type Names",
  "settings.resourceTypeNamesDesc":
    "Give custom display names to your booking types. These names appear on the public booking page.",
  "settings.reservationTypes": "Reservation Types",
  "settings.reservationTypesDesc":
    "Choose which booking types your business offers. These appear as tiles on your public booking page.",
  "settings.reservationTypesLimit": "Your plan allows up to {max} type(s).",
  "settings.reservationTypesSaved": "Reservation types updated.",
  "settings.reservationTypesUpgrade": "Upgrade your plan to enable more types.",
  "settings.resourceTypeName": "Display name for {type}",
  "settings.resourceTypeDescPlaceholder": "Custom description for booking page",

  // Booking
  "booking.title": "Make a Reservation",
  "booking.selectType": "What would you like to book?",
  "booking.selectLocation": "Choose a location",
  "booking.allLocations": "All locations",
  "booking.atSite": "at",
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
  "booking.linkedReservations": "Linked reservations",
  "booking.addLinked": "Add linked",
  "booking.linkedHint":
    "Add additional reservations of a different type for the same guest. They share guest details and are grouped together.",
  "booking.closedDay": "Closed on this day.",
  "days.monday": "Monday",
  "days.tuesday": "Tuesday",
  "days.wednesday": "Wednesday",
  "days.thursday": "Thursday",
  "days.friday": "Friday",
  "days.saturday": "Saturday",
  "days.sunday": "Sunday",
  "openingHours.tooltip":
    "Set default opening hours per reservation type. These are used on the public booking page to determine available time slots. When you create a new site, these defaults are copied automatically.",
  "openingHours.siteTooltip":
    "These opening hours apply only to this site. They override the tenant-level defaults.",
  "openingHours.siteOverride": "Site-specific hours (overrides defaults)",
  "openingHours.usingDefaults":
    "Using tenant defaults. Save to create site-specific overrides.",
  "openingHours.resetToDefaults": "Reset to defaults",
  "openingHours.resetConfirm":
    "This will delete site-specific hours and revert to tenant defaults.",
  "openingHours.resetDone": "Opening hours reset to tenant defaults",
  "resourceHours.title": "Opening hours",
  "resourceHours.sameEveryDay": "Same every day",
  "resourceHours.perDay": "Per day",
  "resourceHours.openTime": "Opens",
  "resourceHours.closeTime": "Closes",
  "resourceHours.sameEveryDayDesc":
    "Same hours apply to all open days. Toggle individual days closed below.",
  "resourceHours.removeHours": "Remove hours",
  "resourceHours.saveFirst":
    "Save the resource first, then edit it to set opening hours.",
  "resourceHours.savedOnCreate":
    "Opening hours will be saved when you create the resource.",
  "resourceHours.openingHoursLabel": "Hours",
  "occasionalSlots.title": "Occasional working slots",
  "occasionalSlots.description":
    "For sporadic availability. Add one-off date and time ranges that make this resource bookable in addition to the weekly schedule.",
  "occasionalSlots.addSlot": "Add slot",
  "occasionalSlots.date": "Date",
  "occasionalSlots.from": "From",
  "occasionalSlots.to": "To",
  "occasionalSlots.note": "Note (optional)",
  "occasionalSlots.notePlaceholder": "e.g. visiting therapist",
  "occasionalSlots.empty": "No occasional slots yet.",
  "occasionalSlots.save": "Save slot",
  "occasionalSlots.cancel": "Cancel",
  "occasionalSlots.remove": "Remove",
  "occasionalSlots.invalidRange": "End time must be after start time.",
  "occasionalSlots.pastDate": "Pick a date that is today or later.",
  "timezone.label": "Timezone",
  "timezone.inheritTenant": "Inherit from organization ({tz})",
  "timezone.shownIn": "Times shown in {tz}",
  "timezone.fallback": "default",
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
  "booking.serviceMisconfigured":
    "Online booking is temporarily unavailable. No reservation was created and you have not been charged. Please contact the venue directly by phone or email, or try again in a few minutes.",
  "booking.serviceMisconfiguredAdmin":
    "Online booking is temporarily unavailable because the server is missing its service role key. No reservation was created. To restore booking: open Lovable Cloud, go to Backend, then API keys, copy the service_role key, then go to Backend, Edge Functions, Secrets, and add it as SUPABASE_SERVICE_ROLE_KEY. Public booking will start working again right after the secret is saved.",
  "booking.misconfigBannerTitle": "Booking is temporarily unavailable",
  "booking.misconfigBannerNoReservation":
    "No reservation was created. Your details have not been saved and you have not been charged.",
  "booking.misconfigBannerDisabled":
    "Submitting again will not work until the venue restores the server configuration.",
  "booking.misconfigBannerTryAgain": "Try again",
  "booking.dateBlocked": "This date is not available for booking.",
  "booking.timeBlocked": "This time slot is not available for booking.",
  "booking.blocked": "Blocked",
  "booking.fixedPricePlaceholder": "e.g. 45.00",
  "booking.thankYou": "Thank you!",
  "booking.confirmationMsg":
    "Your reservation has been received. You will receive a confirmation email from {name}.",
  "booking.checkSpam":
    "If you don't see the email in your inbox, please check your spam or junk folder.",
  "booking.duplicateTitle": "You already sent this booking",
  "booking.duplicateMsg":
    "We found an identical booking you just sent, so we kept the first one and did not create a second reservation.",
  "booking.duplicateHint":
    "If you meant to book something more, for example another room or a second table, please send a new booking with those details.",
  "booking.makeAnother": "Make another reservation",
  "booking.addToCalendar": "Add to calendar",
  "booking.notFound": "Business not found",
  "booking.notFoundDesc": "The booking page you're looking for doesn't exist.",
  "booking.emailPreviewTitle": "Confirmation email preview",
  "booking.whatGuestReceives": "This is what the guest will receive via email:",
  "booking.pricingType": "Pricing",
  "booking.pricingMenu": "According to menu",
  "booking.pricingFixed": "Fixed price",
  "booking.pricingQuote": "Ask for a quote",
  "booking.pricingQuoteDesc": "Get a custom price for your event",
  "booking.pricingReserveTable": "Reserve a table",
  "booking.pricingReserveTableDesc": "Book a table and order from the menu",
  "booking.pricingSetMenu": "Set menu",
  "booking.pricingSetMenuDesc": "Pre-arranged menu with a fixed price",
  "booking.fixedPrice": "Fixed price (€)",
  "booking.restaurantSubType": "Service type",
  "booking.subTypeDineIn": "Dine-in",
  "booking.subTypeCatering": "Catering",
  "booking.subTypePopup": "Pop-up restaurant",
  "booking.subTypeDineInDesc": "Reserve a table at the restaurant",
  "booking.subTypeCateringDesc": "Order catering for your event",
  "booking.subTypePopupDesc": "Have us serve food at your event or festival",
  "booking.cateringQuoteDesc":
    "Tell us about your event and we'll prepare a custom quote for you.",
  "booking.cateringDetails": "Catering details",
  "booking.deliveryAddress": "Event / delivery address",
  "booking.dietaryNotes": "Dietary requirements & allergies",
  "booking.equipmentNeeded": "Serving equipment needed",
  "booking.staffNeeded": "Serving staff needed",
  "booking.popupDetails": "Event details",
  "booking.festivalName": "Event / festival name",
  "booking.stallSize": "Setup size needed",
  "booking.stallSizeSmall": "Small (2×2 m)",
  "booking.stallSizeMedium": "Medium (3×3 m)",
  "booking.stallSizeLarge": "Large (4×4 m)",
  "booking.electricityNeeded": "Electricity connection needed",
  "booking.waterNeeded": "Water connection needed",
  "booking.foodPermits": "Food safety permits / licenses",
  "booking.stallFee": "Setup fee (€)",
  "email.subject": "Subject",
  "email.confirmationSubject": "Booking Confirmation",
  "email.confirmationTitle": "Booking Confirmed!",
  "email.greeting": "Dear",
  "email.confirmationBody":
    "We're pleased to confirm your reservation. Here are the details:",
  "email.confirmationFooter":
    "If you have any questions, don't hesitate to contact us. We look forward to welcoming you!",
  "email.cancellationSubject": "Booking Cancellation",
  "email.cancellationTitle": "Booking Cancelled",
  "email.cancellationBody":
    "We're sorry to inform you that your reservation has been cancelled. Here were the details:",
  "email.cancellationFooter":
    "If you believe this is an error or would like to rebook, please don't hesitate to contact us.",
  "email.confirmationTab": "Confirmation",
  "email.cancellationTab": "Cancellation",
  "email.at": "at",
  "email.duration": "Duration",
  "email.preview": "Email Preview",
  "email.customMessage": "Custom message",
  "email.customMessagePlaceholder":
    "Add a personal message to include in the email...",
  "email.editDetails": "Edit Details",
  "email.previewTab": "Email Preview",

  "admin.addUser": "Add User",
  "admin.role": "Role",
  "admin.staff": "Staff",
  "admin.invalidCustomRole":
    "This custom role cannot be assigned. Choose a role with hierarchy level 10 or lower, and not owner or superadmin.",

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
  "admin.userManagementDesc":
    "Manage team members, assign roles, and control access.",
  "admin.staffLimitReached":
    "Staff user limit reached. Upgrade your plan to add more users.",
  "admin.approvedUsers": "Approved Users",
  "admin.colName": "Name",
  "admin.colEmail": "Email",
  "admin.colRole": "Role",
  "admin.colStatus": "Status",
  "admin.colActions": "Actions",
  "admin.colSites": "Sites",
  "admin.siteAssignments": "Site Assignments",
  "admin.siteAssignmentsUpdated": "Site assignments updated",
  "admin.usersAssigned": "users assigned",
  "admin.noSitesAvailable": "No active sites available",
  "admin.statusApproved": "Approved",
  "admin.statusPending": "Pending",
  "admin.confirmRemove": "Are you sure?",
  "admin.confirmRemoveDesc":
    "Are you sure you want to remove this user? This action cannot be undone.",
  "admin.cancel": "Cancel",
  "admin.remove": "Remove",
  "admin.supportRequests": "Support Requests",
  "admin.noSupportRequests": "No support requests yet.",
  "admin.supportRequestsDesc":
    "Business tier users can submit requests via the chat widget.",
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
  "admin.permissionCol": "Permission",
  "admin.permTooltip":
    "Define what each role can access. Owner always has full access. Toggle individual permissions for Admin, Staff, and custom roles.",
  "admin.deleteRoleTitle": 'Delete role "{name}"?',
  "admin.deleteRoleDesc":
    "This will permanently remove this custom role and all its permissions. Users assigned to this role will lose access.",
  "admin.roleDeleted": "Role deleted",
  "admin.roleRenamed": "Role renamed",
  "admin.roleKeyHint": "Unique identifier used internally",
  "admin.clickToRename": "Click to rename",
  "admin.catReservations": "Reservations",
  "admin.catResources": "Resources",
  "admin.catCalendar": "Calendar",
  "admin.catReports": "Reports",
  "admin.catSettings": "Settings",
  "admin.catAdmin": "Admin",
  "admin.catSupport": "Support",
  "admin.permViewReservations": "View reservations",
  "admin.permCreateReservations": "Create reservations",
  "admin.permEditReservations": "Edit reservations",
  "admin.permDeleteReservations": "Delete reservations",
  "admin.permViewResources": "View resources",
  "admin.permManageResources": "Manage resources",
  "admin.permViewCalendar": "View calendar",
  "admin.permViewReports": "View reports",
  "admin.permViewSettings": "View settings",
  "admin.permManageSettings": "Manage settings",
  "admin.permViewAdmin": "View admin panel",
  "admin.permManageAdmin": "Manage users & roles",
  "admin.permViewSupport": "View support requests",
  "admin.permManageSupport": "Respond to support requests",
  "admin.catSites": "Sites",
  "admin.permViewSites": "View sites",
  "admin.permManageSites": "Create & edit sites",
  "admin.permApproveSites": "Approve site changes",

  // Hero
  "hero.badge": "Now in beta. 30-day free trial",
  "hero.title": "Tool built to handle",
  "hero.titleHighlight": "hospitality and service industry reservations",
  "hero.subtitle":
    "Process and manage service and restaurant bookings, venue inquiries, and hotel or guesthouse reservations from one dashboard. Create your own branded booking pages, send automated confirmation emails. User management included.",
  "hero.viewPricing": "View Pricing",

  // Features
  "features.title": "Everything you need to manage your reservations",
  "features.subtitle":
    "A complete booking site for hospitality businesses with user management.",
  "features.smartReservations": "Reservations",
  "features.smartReservationsDesc":
    "Handle restaurant bookings, venue inquiries, guesthouse stays, and wellness appointments, all from one dashboard.",
  "features.customBranding": "Custom Branding",
  "features.customBrandingDesc":
    "Your logo, your colors, your images. Every booking page matches your brand identity.",
  "features.teamManagement": "User Management",
  "features.teamManagementDesc":
    "Invite staff members, assign roles, and manage permissions with ease.",
  "features.brandedPages": "Reservation Types",
  "features.brandedPagesDesc":
    "Hotel/guesthouse, restaurant, event spaces and service professionals such as massage therapists, barbers, hairdressers, bakers, make-up artists, treatment providers and personal trainers.",
  "features.reportsInsights": "Reports",
  "features.reportsInsightsDesc":
    "Track reservation trends, occupancy rates, and revenue at a glance.",
  "features.automatedEmails": "Automated Emails",
  "features.automatedEmailsDesc":
    "Send confirmation, reminder, and cancellation emails automatically.",

  // How it works
  "howItWorks.title": "Up and running is fast and easy",
  "howItWorks.subtitle":
    "Three simple steps to start accepting online reservations.",
  "howItWorks.step1Title": "Sign up & pick your plan",
  "howItWorks.step1Desc":
    "Create your account and start your 30-day free trial.",
  "howItWorks.step2Title": "Set up your business",
  "howItWorks.step2Desc":
    "Upload your branding, add your site(s) and operations, and configure opening hours, pricing, occupancy capacity and much more.",
  "howItWorks.step3Title": "Share your booking link",
  "howItWorks.step3Desc":
    "Send your custom booking page to customers, add it to your website, and start receiving reservations.",

  // Pricing
  "pricing.title": "Simple and transparent pricing",
  "pricing.subtitle":
    "Start with a 30-day free trial. Upgrade to the next tier or cancel anytime.",
  "pricing.simpleTitle": "Simple and transparent pricing",
  "pricing.simpleSubtitle":
    "Start with a 30-day free trial. Upgrade to the next tier or cancel anytime.",
  "pricing.comparePlans": "Compare plans in detail",
  "pricing.plansTitle": "Choose your plan",
  "home.videoTitle": "See MimmoBook in action",
  "pricing.faq": "Frequently asked questions",
  "pricing.feature": "Feature",
  "pricing.monthlyPrice": "Monthly price",
  "pricing.freeTrial": "Free trial",
  "pricing.days30": "30 days",
  "pricing.reservationTypes": "Reservation types",
  "pricing.staffUsers": "Staff users",
  "pricing.trialIncluded": "30-day free trial",
  "pricing.perMonth": "/month",
  "pricing.mostPopular": "Most Popular",
  "pricing.ctaTitle": "Start your free trial today",
  "pricing.ctaSubtitle": "Set up is fast and easy.",

  // CTA
  "cta.title": "Ready to modernize your reservations?",
  "cta.subtitle":
    "Join hospitality and wellness businesses already using MimmoBook to streamline their bookings.",

  // Login
  "login.title": "Log in to your account",
  "login.subtitle": "Enter your credentials to access your dashboard.",
  "login.welcomeBack": "Welcome back",
  "login.welcomeBackSubtitle": "Log in to manage your reservations and team.",
  "login.forgotPassword": "Forgot password?",
  "login.noAccount": "Don't have an account?",
  "login.loggingIn": "Logging in...",
  "login.orContinueWith": "Or continue with",
  "login.continueGoogle": "Continue with Google",
  "login.continueApple": "Continue with Apple",
  "login.haveCode": "Have a code?",
  "login.codePlaceholder": "Enter access or discount code",
  "login.codeHint":
    "Beta, access, or discount code — it will be applied after you sign in.",
  "login.codeRedeemed": "Code redeemed successfully!",
  "login.codeRedeemFailed":
    "Code could not be redeemed. You can try again from your dashboard.",

  // Signup
  "signup.title": "Create your account",
  "signup.subtitle": "Start your 30-day free trial, no credit card required.",
  "signup.heroTitle": "Start managing reservations today",
  "signup.heroSubtitle":
    "30-day free trial. No credit card required. Set up in minutes.",
  "signup.businessName": "Business name",
  "signup.yourName": "Your name",
  "signup.creatingAccount": "Creating account...",
  "signup.alreadyHaveAccount": "Already have an account?",
  "signup.accountCreated":
    "Account created! Please check your email to verify your account before logging in.",
  "signup.orContinueWith": "Or sign up with",
  "signup.continueGoogle": "Sign up with Google",
  "signup.continueApple": "Sign up with Apple",

  // Forgot password
  "forgot.title": "Reset your password",
  "forgot.subtitle":
    "Enter your email and we'll send you a link to reset your password.",
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
  "dashboard.sendReminder": "Send reminder",
  "dashboard.reminderSent": "Reminder sent",
  "dashboard.reminderSentAt": "Reminder sent",
  "dashboard.confirmationSentAt": "Confirmation sent",
  "dashboard.cancellationSentAt": "Cancellation sent",
  "dashboard.reminderError": "Failed to send reminder",
  "dashboard.sendReminderMsg":
    "Send a reminder email to the guest about this reservation?",
  "dashboard.notCheckedIn": "Not checked in",
  "dashboard.todayFilter": "Today",
  "dashboard.activeResources": "Active Resources",
  "dashboard.bookingLink": "Booking Link",
  "dashboard.bookingLinkDesc":
    "Share this link with your customers so they can make reservations.",
  "dashboard.shareTitle": "Add booking to your own website",
  "dashboard.shareDesc":
    "Put your booking page on your website as a subpage, a button, or your own web address.",
  "dashboard.shareTabEmbed": "Embed on your site",
  "dashboard.shareTabButton": "Link and button",
  "dashboard.shareTabDomain": "Your own address",
  "dashboard.shareEmbedDesc":
    "Paste this into the page where you want booking to appear, for example yoursite.com/booking. The form shows inside your own page, without our header or footer.",
  "dashboard.shareEmbedHint":
    "Adjust height if needed. Your colours, logo and prices follow automatically.",
  "dashboard.shareButtonDesc":
    "Paste this where you want a Book now button, or just link to the address below.",
  "dashboard.shareButtonHint":
    "The booking page opens in a new tab so visitors keep your site open.",
  "dashboard.shareButtonLabel": "Book now",
  "dashboard.shareDomainDesc":
    "You can also use a web address of your own, such as booking.yoursite.com.",
  "dashboard.shareDomainStep1":
    "Sign in where your domain is managed, for example your domain provider or web host.",
  "dashboard.shareDomainStep2":
    "Create a forward, sometimes called redirect, from booking.yoursite.com to the address below.",
  "dashboard.shareDomainStep3":
    "Save and wait a moment, then test the address in your browser.",
  "dashboard.shareDomainHint":
    "After the forward, visitors reach your booking page but see our address in the browser bar. If you want your own address to stay visible, use the embed option instead.",
  "dashboard.shareCopyCode": "Copy code",
  "dashboard.shareCopyAddress": "Copy address",
  "dashboard.shareIframeTitle": "Online booking",
  "dashboard.allServices": "All services",
  "dashboard.byServiceType": "By service type",
  "dashboard.byLocation": "By location",
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
  "dashboard.noResources":
    "No resources yet. Add your first room, table, or venue.",
  "dashboard.capacity": "capacity",
  "dashboard.perNight": "/night",
  "dashboard.resourceCreated": "Resource created",
  "dashboard.resourceUpdated": "Resource updated",
  "dashboard.resourceDeleted": "Resource deleted",
  "dashboard.copyResource": "Copy resource",
  "dashboard.copyResourceDesc":
    "How many copies of this resource do you want to create?",
  "dashboard.copyCount": "Number of copies",
  "dashboard.resourcesCopied": "Resources copied",
  "booking.stayDetails": "Stay details",
  "dashboard.uploadImage": "Upload image",
  "dashboard.imageUploaded": "Image uploaded",
  "dashboard.imageUploadError": "Failed to upload image",
  "dashboard.restaurant": "Restaurant",
  "dashboard.venue": "Venue",
  "dashboard.guesthouse": "Hotel / Guesthouse",
  "dashboard.hotel": "Hotel",
  "dashboard.wellness": "Wellness services",
  "dashboard.custom": "Add your own",
  "dashboard.checkoutToday": "Check-outs today",
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
  "dashboard.roomMultipliersDesc":
    "Multiplied by base price per night. E.g. 1.5× at €100 base = €150.",
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
  "autoReminder.title": "Auto Reminders",
  "autoReminder.tooltip":
    "Reminder emails are automatically sent 24 hours before each confirmed reservation.",
  "autoReminder.hourly": "Hourly",
  "autoReminder.nextRun": "Next batch",
  "autoReminder.active": "Active",
  "autoReminder.recentLog": "Recently sent",
  "autoReminder.sent7d": "in last 7 days",
  "autoReminder.noRecent": "No reminders sent in the last 7 days.",
  "notifications.title": "Notifications",
  "notifications.empty": "No notifications yet.",
  "notifications.markAllRead": "Mark all read",
  "notifications.markRead": "Mark as read",
  "notifications.used": "Reservation marked as used",
  "notifications.invoiced": "Reservation marked as invoiced",
  "dashboard.used": "Used",
  "dashboard.invoiced": "Invoiced",
  "invoiceRefusal.NO_PRICE":
    "This booking has no price yet, so it cannot be marked as invoiced. Add the price first.",
  "invoiceRefusal.AMOUNT_MISMATCH":
    "The amount does not match the recalculated room and breakfast totals. Correct the price, then try again.",
  "invoiceRefusal.INVOICED_LOCKED":
    "This booking is already invoiced, so the change would leave its totals inconsistent.",
  "invoiceRefusal.NOT_PERMITTED":
    "Your account is not allowed to change the invoiced status of this booking.",
  "invoiceRefusal.UNKNOWN": "The invoiced status could not be updated.",
  "invoiceRefusal.serverReasonLabel": "Reason:",
  "invoiceRefusal.guestNotice":
    "This booking has already been invoiced, so it can no longer be changed here. Please contact us directly.",
  "invoiceRefusal.CANCELLED":
    "This booking is cancelled, so its invoiced status cannot be changed.",
  "invoiceRefusal.NOT_FOUND":
    "This booking could no longer be found. Refresh the list and try again.",
  "invoiceRefusal.SESSION_EXPIRED":
    "Your session expired before the change was saved. Sign in again, then retry.",
  "invoiceRefusal.OFFLINE":
    "The change could not reach the server. Check your connection and try again.",
  "invoiceRefusal.RATE_LIMITED":
    "Too many attempts in a short time. Wait a moment, then try again.",
  "invoiceRefusal.CONFLICT":
    "Someone else changed this booking first. Refresh it, then apply your change again.",
  "invoiceRefusal.SERVER_ERROR":
    "The server could not complete the change. Please try again in a moment.",
  "invoiceRefusalGuest.NO_PRICE":
    "This booking cannot be changed here yet. Please contact us directly.",
  "invoiceRefusalGuest.AMOUNT_MISMATCH":
    "This booking cannot be changed here. Please contact us directly.",
  "invoiceRefusalGuest.INVOICED_LOCKED":
    "This booking has already been invoiced, so it can no longer be changed here. Please contact us directly.",
  "invoiceRefusalGuest.NOT_PERMITTED":
    "This booking can no longer be changed with this link. Please contact us directly.",
  "invoiceRefusalGuest.CANCELLED":
    "This booking is already cancelled, so there is nothing left to change.",
  "invoiceRefusalGuest.NOT_FOUND":
    "This booking link is no longer valid. Please contact us directly.",
  "invoiceRefusalGuest.SESSION_EXPIRED":
    "This booking link has expired. Please contact us directly.",
  "invoiceRefusalGuest.OFFLINE":
    "Your request did not go through. Check your connection and try again.",
  "invoiceRefusalGuest.RATE_LIMITED":
    "Too many attempts in a short time. Please wait a moment and try again.",
  "invoiceRefusalGuest.CONFLICT":
    "This booking was just updated. Reload the page and try again.",
  "invoiceRefusalGuest.SERVER_ERROR":
    "Something went wrong on our side. Please try again in a moment.",
  "invoiceRefusalGuest.UNKNOWN":
    "Your request could not be completed. Please try again or contact us directly.",
  "dashboard.downloadInvoice": "Download invoice",
  "dashboard.downloadInvoicePdf": "Download invoice PDF",
  "reports.downloadReportPdf": "Download report PDF",
  "dashboard.markLinkedUsed": "Mark linked reservations used?",
  "dashboard.markLinkedUsedMsg":
    "This reservation is linked to an offer with other reservations. Would you like to mark them all as used?",
  "dashboard.markAll": "Mark all used",
  "dashboard.markLinkedInvoiced": "Mark linked reservations as invoiced?",
  "dashboard.markLinkedInvoicedMsg":
    "This reservation is linked to an offer with other reservations. Would you like to mark them all as invoiced?",
  "dashboard.markAllInvoiced": "Mark all invoiced",
  "dashboard.total": "total",
  "dashboard.dailySnapshot": "Daily snapshot at a glance",
  "dashboard.overviewSubtitle": "Daily snapshot at a glance",
  "alerts.pendingAction": "reservations need confirmation",
  "alerts.uninvoicedAction": "reservations not yet invoiced",
  "alerts.checkoutsAction": "check-outs today",
  "alerts.shortcuts": "Keyboard shortcuts: Alt+1 to 8 for navigation",
  "blocking.pendingApproval": "pending approval",
  "dashboard.calendarHotel": "Hotel / Guesthouse",
  "dashboard.calendarVenue": "Event Spaces",
  "dashboard.calendarRestaurant": "Restaurant",
  "dashboard.legendHasReservations": "Has reservations",
  "dashboard.legendBlocked": "Blocked",
  "dashboard.legendRecurring": "Recurring block",
  "dashboard.legendBoth": "Both",
  "dashboard.calendarTooltip":
    "Click a date to see its reservations. Highlighted dates have bookings. Red dates have one-off blocks. Purple dashed dates have recurring blocks.",
  "dashboard.blockDay": "Block day",
  "dashboard.recurringBlocks": "Recurring Blocks",
  "dashboard.blocked": "Blocked",
  "dashboard.allDay": "All day",
  "dashboard.reservationsLabel": "Reservations",
  "dashboard.every": "Every",
  "dashboard.blockTitle": "Block",
  "dashboard.blockedLabel": "Blocked",
  "dashboard.blockLabel": "Block",
  "dashboard.blockReason": "Reason for blocking (optional)",
  "dashboard.unblockAll": "Unblock all",
  "dashboard.blockRestaurantDay": "Block restaurant for the day",
  "dashboard.blockAllTitle": "Block all",
  "dashboard.resourceManagement": "Resource Management",
  "dashboard.resourceManagementDesc": "Manage spaces, rooms and tables",
  "dashboard.actions": "Actions",
  "dashboard.active": "Active",
  "dashboard.serviceOptions": "Additional services",
  "dashboard.offersCatering": "Offer catering services",
  "dashboard.offersPopup": "Offer pop-up restaurant at events",
  "dashboard.dineInOptions": "Dine-in booking options",
  "dashboard.offersTableReservation": "Reserve a table (order from menu)",
  "dashboard.offersQuote": "Ask for a quote (custom pricing)",
  "dashboard.offersSetMenu": "Set menu (fixed price)",
  "dashboard.inactive": "Inactive",
  "dashboard.namePlaceholder": "e.g. Banquet Hall",
  "dashboard.descriptionPlaceholder": "Short description...",
  "dashboard.capacityPlaceholder": "e.g. 50",
  "dashboard.pricePlaceholder": "e.g. 140",
  "dashboard.breakfastPlaceholder": "e.g. 15",
  "dashboard.venuePrice": "Space price (€)",
  "dashboard.roomPrice": "Room price (€/night)",
  "dashboard.breakfastPrice": "Breakfast price (€/person/morning)",
  "dashboard.pricingHint":
    "Default price for new reservations. Individual reservation prices can be adjusted in the reservation details.",
  "dashboard.roomTypeLabel": "Room type",
  "dashboard.bedConfiguration": "Bed configuration",
  "dashboard.roomDescription": "Room description",
  "dashboard.roomDescPlaceholder":
    "Describe the rooms, number of beds, layout...",
  "dashboard.addMode": "Add mode",
  "dashboard.addModeIndividual": "Add one room",
  "dashboard.addModeBulk": "Add multiple by type",
  "dashboard.bulkRoomType": "Room type",
  "dashboard.bulkQuantity": "Quantity",
  "dashboard.bulkAdd": "Add rooms",
  "dashboard.bulkAdded": "Rooms added",
  "dashboard.bedType": "Bed type",
  "dashboard.bedCount": "Count",
  "dashboard.addBed": "Add bed",
  "dashboard.roomType.single": "Single Room",
  "dashboard.roomType.double": "Double Room",
  "dashboard.roomType.twin": "Twin Room",
  "dashboard.roomType.double_double": "Double Double Room",
  "dashboard.roomType.triple": "Triple Room",
  "dashboard.roomType.quad": "Quad Room",
  "dashboard.roomType.studio": "Studio Room",
  "dashboard.roomType.suite": "Suite",
  "dashboard.roomType.connecting": "Connecting Rooms",
  "dashboard.roomType.entire": "Entire Property",
  "dashboard.bedType.twin_single": "Twin / Single",
  "dashboard.bedType.bunk": "Bunk Bed",
  "dashboard.bedType.queen": "Queen",
  "dashboard.bedType.king": "King",
  "dashboard.bedType.california_king": "California King",
  "dashboard.bedType.murphy": "Murphy Bed",
  "dashboard.bedType.sofa": "Sofa Bed",
  "dashboard.bedType.trundle": "Trundle Bed",
  "booking.selectRoomType": "Select room type",
  "booking.roomTypeLabel": "Room type",
  "blocking.title": "Blocked Dates & Times",
  "blocking.tooltip":
    "Block entire resource types or specific resources on chosen dates or date ranges. Optionally restrict to specific hours.",
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
  "blocking.dateHint":
    "Click once for a single day, or click two dates to select a range.",
  "blocking.duration": "Duration",
  "blocking.fullDay": "Full day",
  "blocking.specificHours": "Specific hours",
  "blocking.startTime": "Start Time",
  "blocking.endTime": "End Time",
  "blocking.timeHint":
    "Only the selected hours will be blocked. Bookings outside this window remain available.",
  "blocking.reason": "Reason (optional)",
  "blocking.reasonPlaceholder": "e.g. Maintenance, Private event...",
  "blocking.creating": "Creating...",
  "blocking.createBlock": "Create Block",
  "blocking.blockDays": "Block {count} days",
  "blocking.daysBlocked": "{count} day(s) blocked",
  "blocking.blockRemoved": "Block removed",
  "occasions.title": "Special occasions",
  "occasions.subtitle":
    "Event days such as a Mother's Day lunch or a Christmas dinner. Guests can book the occasion on your booking page, alongside normal bookings.",
  "occasions.add": "Add occasion",
  "occasions.editTitle": "Edit occasion",
  "occasions.name": "Occasion name",
  "occasions.namePlaceholder": "For example Christmas dinner",
  "occasions.description": "Description for guests",
  "occasions.descriptionPlaceholder":
    "Menu, programme or anything guests should know",
  "occasions.date": "Date",
  "occasions.service": "Service",
  "occasions.resource": "Space or room",
  "occasions.anyResource": "Not tied to one space",
  "occasions.bookingType": "How guests book",
  "occasions.seatings": "Fixed sittings",
  "occasions.openBooking": "Open booking",
  "occasions.capacityPerSeating": "Seats per sitting",
  "occasions.capacityPerDay": "Seats for the whole occasion",
  "occasions.capacityHintSeatings": "Each sitting can take this many guests.",
  "occasions.capacityHintOpen":
    "All bookings for this occasion share these seats.",
  "occasions.seatingTimes": "Sitting times",
  "occasions.addTime": "Add a time",
  "occasions.active": "Visible to guests",
  "occasions.inactive": "Hidden",
  "occasions.save": "Save occasion",
  "occasions.cancel": "Cancel",
  "occasions.delete": "Delete",
  "occasions.deleteConfirm":
    "Delete this occasion? Bookings already made stay in your list.",
  "occasions.saved": "Occasion saved",
  "occasions.deleted": "Occasion deleted",
  "occasions.empty": "No special occasions yet.",
  "occasions.seats": "seats",
  "occasions.seatsPerSeating": "{cap} seats per sitting",
  "occasions.nameRequired": "Please give the occasion a name",
  "occasions.dateRequired": "Please choose a date",
  "occasions.timesRequired": "Please add at least one sitting time",
  "booking.occasionSectionTitle": "Special occasion on this date",
  "booking.occasionHint":
    "Pick the occasion, or continue with a normal booking.",
  "booking.occasionNormal": "Normal booking",
  "booking.occasionSeating": "Sitting time",
  "booking.occasionSeatsLeft": "{count} seats left",
  "booking.occasionFull": "Fully booked",
  "booking.occasionOpenHint": "Choose any time during the day.",
  "booking.occasionSeatingRequired": "Please choose a sitting time",
  "booking.occasionErrUnavailable":
    "That special occasion is no longer open for bookings. Please pick another occasion or book a normal time.",
  "booking.occasionErrWrongDate":
    "That special occasion is held on a different day. Please choose its own date, or book a normal time for this day.",
  "booking.occasionErrWrongType":
    "That special occasion is not offered for this service. Please choose another occasion or book a normal time.",
  "booking.occasionErrSeatingRequired":
    "Please choose one of the sitting times for this occasion before sending your booking.",
  "booking.occasionErrSeatingUnavailable":
    "That sitting time is no longer available. Please choose one of the times shown for this occasion.",
  "booking.occasionErrFull":
    "This occasion is now fully booked. Please choose another sitting time or another date.",
  "booking.occasionErrFullWithSeats":
    "Only {seats} seat(s) are left for this occasion, so we could not fit your party. Please try a smaller party, another sitting time or another date.",
  "booking.occasionNoneOnDate":
    "There is no special occasion on this day, so you can book a normal time below.",
  "booking.occasionNextDates": "Next occasions: {dates}",
  "monitor.title": "Refused bookings",
  "monitor.subtitle": "Why bookings were refused on your booking page",
  "monitor.days": "{days} days",
  "monitor.refresh": "Refresh",
  "monitor.loading": "Loading...",
  "monitor.empty": "No refused bookings in this period.",
  "monitor.total": "{count} refused bookings in total",
  "monitor.lastSeen": "Last seen: {when}",
  "monitor.code.OCCASION_FULL": "Occasion was fully booked",
  "monitor.code.OCCASION_SEATING_UNAVAILABLE":
    "Sitting was no longer available",
  "monitor.code.OCCASION_SEATING_REQUIRED": "No sitting was chosen",
  "monitor.code.OCCASION_WRONG_DATE": "Occasion was on a different date",
  "monitor.code.OCCASION_WRONG_TYPE": "Occasion was for another service",
  "monitor.code.OCCASION_UNAVAILABLE": "Occasion was no longer available",
  "monitor.code.DB_INSERT_FAILED": "Booking could not be saved",
  "monitor.code.UNTAGGED": "Other reason",

  "blocking.blocksRemoved": "Blocks removed",
  "blocking.removeBlock": "Remove Block",
  "blocking.removeBlockDesc":
    "This will remove the block for {date}. Bookings will be allowed again.",
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
  "blocking.wellness": "Wellness services",
  "blocking.restaurant": "Restaurant",
  "blocking.venueEventSpace": "Venue / Event Space",
  "blocking.room": "room",
  "blocking.tableArea": "table/area",
  "blocking.eventSpace": "event space",
  "blocking.recurringTitle": "Recurring Blocks",
  "blocking.recurringTooltip":
    "Block specific days of the week on a recurring basis. E.g. block every Monday for restaurant.",
  "blocking.addRecurring": "Add Recurring Block",
  "blocking.addRecurringTitle": "Add Recurring Block",
  "blocking.daysOfWeek": "Days of Week",
  "blocking.recurringTimeHint":
    "Only the selected hours will be blocked each week. Bookings outside this window remain available.",
  "blocking.recurringReasonPlaceholder":
    "e.g. Closed on Mondays, Staff day off...",
  "blocking.blockWeekly": "Block {count} day(s) weekly",
  "blocking.recurringCreated": "Recurring block created",
  "blocking.recurringRemoved": "Recurring block removed",
  "blocking.removeRecurring": "Remove Recurring Block",
  "blocking.removeRecurringDesc":
    "This will remove the recurring block for every {day}.",
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
  "onboarding.whatDoYouNeedSubtitle":
    "Select the reservation types for your business.",
  "onboarding.brandWorkspace": "Brand your workspace",
  "onboarding.brandWorkspaceSubtitle":
    "Customize colors and add business details.",
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
  "onboarding.customDesc":
    "Define your own type, like Spa or Workshops, with optional sub-services.",
  "onboarding.wellnessDesc":
    "Hairdressers, masseurs, makeup artists. Customers pick services from your menu; bookings adjust to total time.",
  "booking.subServices": "Choose services",
  "booking.subServiceQty": "Quantity",
  "dashboard.customTypeLabel": "Type name",
  "dashboard.customTypeLabelHelp":
    "What guests see, e.g. Spa, Workshops, Tours.",
  "dashboard.subServices": "Sub-services",
  "dashboard.addSubService": "Add sub-service",
  "dashboard.subServiceName": "Name",
  "dashboard.subServicePrice": "Price (€)",
  "dashboard.subServiceDuration": "Duration (min)",
  "dashboard.wellnessServicesHint":
    "Customers can tick one or more of these when booking. Each service needs a duration in 5 minute steps (5 to 480 minutes).",
  "booking.servicesMenu": "Choose your services",
  "booking.servicesMenuHelp":
    "Tick everything you want. The total time and price update automatically.",
  "booking.totalDuration": "Total time",
  "booking.totalPrice": "Total price",
  "booking.noServicesYet":
    "This provider has not published a services menu yet. You can still book a time slot below.",
  // Tiers
  "tier.basic": "Basic",
  "tier.basicDesc": "Perfect for a single hotel, restaurant or event venue.",
  "tier.pro": "Pro",
  "tier.proDesc":
    "For businesses offering hotel, restaurant and event venue services in one place.",
  "tier.professional": "Professional",
  "tier.professionalDesc": "Multiple reservation types, team management.",
  "tier.business": "Business",
  "tier.businessDesc":
    "Feature-rich platform for businesses with multiple sites and operations.",

  // Footer
  "footer.tagline":
    "The modern reservation platform for restaurants, venues, guesthouses and the service industry professionals.",
  "footer.product": "Product",
  "footer.company": "Company",
  "footer.legal": "Legal",
  "footer.featuresComingSoon": "Features",
  "footer.aboutComingSoon": "About",
  "footer.contactComingSoon": "Contact",
  "footer.privacyPolicy": "Privacy Policy",
  "footer.termsOfService": "Terms of Service",
  "footer.allRightsReserved": "All rights reserved.",

  "nav.about": "About",
  "nav.accessibility": "Accessibility",

  "about.heroBadge": "Our Story",
  "about.heroTitle": "The reservation platform built with care",
  "about.heroSubtitle":
    "We help hospitality businesses manage their bookings effortlessly, so they can focus on creating memorable guest experiences.",
  "about.missionBadge": "Our Mission",
  "about.missionTitle": "Making reservation management simple and easy",
  "about.missionP1":
    "Small hospitality businesses deserve practical and informative tools to operate more efficiently. We started MimmoBook to make that happen.",
  "about.missionP2":
    "Our platform brings reservations, branding, and reporting into one unified workspace eliminating the scattered notebooks and missed bookings.",
  "about.point1Title": "Speed without compromise",
  "about.point1Desc":
    "Get your branded booking page live in a day or two, not weeks.",
  "about.point2Title": "Data-driven insights",
  "about.point2Desc": "Track reservations, occupancy, and revenue at a glance.",
  "about.point3Title": "Built for teams",
  "about.point3Desc": "Role-based access and multi-staff support built in.",
  "about.valuesTitle": "Our core values",
  "about.valuesSubtitle":
    "We use these principles to guide every-day decisions we make, from product design to customer support.",
  "about.valuePrecision": "Precision",
  "about.valuePrecisionDesc":
    "Every detail matters from pixel-perfect booking pages to accurate availability calendars.",
  "about.valueInnovation": "Innovation",
  "about.valueInnovationDesc":
    "We continuously improve our platform. We crave for user feedback to make the platform even better.",
  "about.valueCollaboration": "Collaboration",
  "about.valueCollaborationDesc":
    "We work closely with hospitality businesses to understand their real needs.",
  "about.valueTrust": "Trust",
  "about.valueTrustDesc":
    "Your data is secure. We follow GDPR standards and best security practices.",
  "about.valuePassion": "Passion",
  "about.valuePassionDesc":
    "We're passionate about helping small businesses succeed in hospitality.",
  "about.valueGlobal": "Accessibility",
  "about.valueGlobalDesc":
    "Our platform is multilingual and designed to be accessible to everyone.",
  "about.ctaTitle": "Ready to simplify your reservations?",
  "about.ctaSubtitle":
    "Join hospitality businesses already using MimmoBook to streamline your bookings.",

  "privacy.title": "Privacy Policy",
  "privacy.lastUpdated": "Last updated:",
  "privacy.s1Title": "1. Introduction",
  "privacy.s1P1":
    "This privacy policy explains how MimmoBook collects, uses, stores, and protects your personal data when you use our reservation management platform. We are committed to protecting your privacy in accordance with the EU General Data Protection Regulation (GDPR).",
  "privacy.s2Title": "2. Data Controller",
  "privacy.s2P1":
    "MimmoBook is the data controller for the personal data processed through this platform. For data protection inquiries, please contact us through the Support page.",
  "privacy.s3Title": "3. Data We Collect",
  "privacy.s3P1": "We collect the following categories of personal data:",
  "privacy.s3Item1":
    "Account information: name, email address, password (hashed)",
  "privacy.s3Item2":
    "Business information: business name, address, phone number",
  "privacy.s3Item3":
    "Reservation data: guest names, emails, phone numbers, booking details",
  "privacy.s3Item4": "Usage data: pages visited, features used, browser type",
  "privacy.s4Title": "4. Purpose of Processing",
  "privacy.s4P1": "We process your data for the following purposes:",
  "privacy.s4Item1":
    "To provide and maintain our reservation management service",
  "privacy.s4Item2":
    "To send booking confirmations, reminders, and cancellation notices",
  "privacy.s4Item3": "To improve our platform and develop new features",
  "privacy.s5Title": "5. Data Retention",
  "privacy.s5P1":
    "We retain your personal data for as long as your account is active or as needed to provide our services. Reservation data is retained for the duration of your subscription plus 12 months. You can request deletion of your data at any time.",
  "privacy.s6Title": "6. Your Rights",
  "privacy.s6P1":
    "Under GDPR, you have the following rights regarding your personal data:",
  "privacy.s6Item1": "Right of access: request a copy of your personal data",
  "privacy.s6Item2": "Right to rectification: correct inaccurate data",
  "privacy.s6Item3": "Right to erasure: request deletion of your data",
  "privacy.s6Item4": "Right to restrict processing",
  "privacy.s6Item5":
    "Right to data portability: receive your data in a structured format",
  "privacy.s7Title": "7. Cookies",
  "privacy.s7P1":
    "We use essential cookies required for the platform to function. Analytics cookies are only loaded after you give explicit consent via our cookie banner. You can change your cookie preferences at any time.",
  "privacy.s8Title": "8. Contact",
  "privacy.s8P1":
    "For any questions about this privacy policy or to exercise your data protection rights, please contact us through the Support page.",

  "a11y.title": "Accessibility Statement",
  "a11y.lastUpdated": "Last updated:",
  "a11y.s1Title": "1. Our Commitment",
  "a11y.s1P1":
    "MimmoBook is committed to ensuring digital accessibility for people of all abilities. We continually improve the user experience for everyone and apply relevant accessibility standards.",
  "a11y.s2Title": "2. Accessibility Features",
  "a11y.s2P1": "Our platform includes the following accessibility features:",
  "a11y.s2Item1": "Adjustable font size (80% to 150%)",
  "a11y.s2Item2": "High contrast mode for improved readability",
  "a11y.s2Item3": "Dyslexia-friendly font option",
  "a11y.s2Item4": "Reduced motion mode to minimize animations",
  "a11y.s2Item5": "Enhanced focus indicators for keyboard navigation",
  "a11y.s2Item6": "Keyboard shortcut (Alt+A) to open the accessibility widget",
  "a11y.s3Title": "3. Standards",
  "a11y.s3P1":
    "We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. Key areas include:",
  "a11y.s3Item1": "Semantic HTML for screen reader compatibility",
  "a11y.s3Item2": "Sufficient color contrast ratios",
  "a11y.s3Item3": "Keyboard-navigable interface throughout",
  "a11y.s4Title": "4. Known Limitations",
  "a11y.s4P1":
    "While we strive for full accessibility, some third-party components or dynamically loaded content may not yet meet all WCAG 2.1 AA criteria. We are actively working to address these.",
  "a11y.s5Title": "5. Feedback",
  "a11y.s5P1":
    "We welcome your feedback on the accessibility of MimmoBook. Please contact us through the Support page if you encounter any barriers or have suggestions for improvement.",
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
  "cookie.acceptAll": "Accept all",
  "cookie.rejectAll": "Reject all",
  "cookie.customize": "Customize",
  "cookie.savePreferences": "Save preferences",
  "cookie.title": "Cookie preferences",
  "cookie.description":
    "Choose which categories of cookies you allow. Strictly necessary cookies are always active so the site can work.",
  "cookie.category.necessary": "Strictly necessary",
  "cookie.category.necessaryDesc":
    "Required for the site to function, including login, security, and language settings.",
  "cookie.category.analytics": "Analytics",
  "cookie.category.analyticsDesc":
    "Help us understand how visitors use MimmoBook so we can improve the product.",
  "cookie.category.marketing": "Marketing",
  "cookie.category.marketingDesc":
    "Used to measure the effectiveness of our marketing campaigns. Off by default.",
  "cookie.alwaysOn": "Always on",
  "password.minLength": "At least 12 characters",
  "password.uppercase": "One uppercase letter",
  "password.lowercase": "One lowercase letter",
  "password.number": "One number",
  "password.checking": "Checking for leaked passwords…",
  "password.breached":
    "This password has been found in data breaches. Choose a different one",
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

  // Help & Support page
  "help.title": "Help & Support",
  "help.subtitle": "Browse guides, FAQs, and ask the AI assistant.",
  "help.searchPlaceholder": "Search for help...",
  "help.noResults": "No results found. Try a different search term.",
  "help.aiTitle": "MimmoSupporter",
  "help.aiSubtitle": "Ask anything about MimmoBook",
  "help.askOrGuide": "Ask a question or try a quick guide:",
  "help.thinking": "Thinking...",
  "help.cancelRequest": "Cancel request",
  "help.submitRequest": "Submit support request",
  "help.subjectPlaceholder": "Subject (e.g. Feature request)",
  "help.describePlaceholder": "Describe your request...",
  "help.submitToAdmin": "Submit to Admin",
  "help.typePlaceholder": "Type your question...",
  "help.errorNoTenant": "Unable to submit request. No tenant found.",
  "help.errorSubmit": "Failed to submit request",
  "help.successSubmit": "Support request submitted",
  "help.errorConnect": "Sorry, I couldn't connect. Please try again.",
  "help.requestSubmitted": "Support Request",
  "help.requestSubmittedDetail":
    "Your support request has been submitted! Your admin team will review it and respond soon.",
  "help.art1Title": "Getting Started",
  "help.art1Desc":
    "Set up your account and create your first booking page in minutes.",
  "help.art1C1": "Sign up for a free 30-day trial. No credit card needed.",
  "help.art1C2":
    "Complete the onboarding wizard to name your business and choose your reservation types.",
  "help.art1C3": "Customize your branding (logo, colors) in Settings.",
  "help.art1C4": "Share your booking link with customers!",
  "help.art2Title": "Managing Reservations",
  "help.art2Desc":
    "View, edit, confirm, and cancel reservations from your dashboard.",
  "help.art2C1":
    "Use the Calendar view for a visual overview of upcoming bookings.",
  "help.art2C2":
    "Switch to the List view to filter by status, type, or date range.",
  "help.art2C3":
    "Click any reservation to edit details, add notes, or change status.",
  "help.art2C4": "Confirmation and cancellation emails are sent automatically.",
  "help.art3Title": "Email Templates",
  "help.art3Desc":
    "Customize confirmation and cancellation emails sent to guests.",
  "help.art3C1": "Go to Settings → Email Templates to customize your emails.",
  "help.art3C2":
    "Preview how emails look before sending using the built-in preview.",
  "help.art3C3":
    "Add custom messages per reservation when confirming or cancelling.",
  "help.art3C4": "Emails support multi-language content (EN, FI, SV).",
  "help.art4Title": "Branding & Booking Page",
  "help.art4Desc":
    "Customize your public booking page with your brand identity.",
  "help.art4C1": "Upload your logo and set primary/accent colors in Settings.",
  "help.art4C2": "Add a hero image for your booking page header.",
  "help.art4C3": "Your booking page is available at /book/your-slug.",
  "help.art4C4": "Business description appears on the booking page for guests.",
  "help.art5Title": "Opening Hours",
  "help.art5Desc":
    "Configure when your business accepts bookings for each type.",
  "help.art5C1":
    "Set default opening hours per reservation type (restaurant, venue, hotel, wellness, custom) at the organization level. They apply to every matching resource unless overridden.",
  "help.art5C2":
    "Vary open and close times per day of the week, and mark individual days as closed.",
  "help.art5C3":
    "Opening hours determine available time slots on the public booking page.",
  "help.art5C4":
    "Override defaults at site or resource level, and use blocked slots for temporary closures.",
  "help.art6Title": "Resources & Rooms",
  "help.art6Desc": "Manage rooms, tables, and event spaces that can be booked.",
  "help.art6C1": "Add resources in the Resources section of your dashboard.",
  "help.art6C2": "Set capacity, pricing, and descriptions for each resource.",
  "help.art6C3": "Upload photos to showcase your spaces on the booking page.",
  "help.art6C4": "Deactivate resources to temporarily hide them from bookings.",
  "help.art7Title": "Staff & User Management",
  "help.art7Desc": "Invite team members and manage roles and permissions.",
  "help.art7C1": "Owners can invite staff via the Admin panel.",
  "help.art7C2":
    "Roles: Owner (full access), Admin (manage resources), Staff (view reservations).",
  "help.art7C3": "Approve or remove team members at any time.",
  "help.art7C4": "Each plan has a staff user limit. Upgrade to add more.",
  "help.art8Title": "Plans & Billing",
  "help.art8Desc": "Understand pricing tiers and manage your subscription.",
  "help.art8C1": "Basic (€19/mo): 1 type, 1 to 5 staff, AI chatbot support.",
  "help.art8C2":
    "Professional (€59/mo): All types, up to 25 staff, custom templates, AI chatbot support.",
  "help.art8C3":
    "Business (€179/mo): All types, up to 50 staff, priority support with 24h response.",
  "help.art8C4":
    "Enterprise (by offer): unlimited staff users. Upgrade or downgrade anytime, changes take effect next billing cycle.",
  "help.art9Title": "Frequently Asked Questions",
  "help.art9Desc": "Answers to the most common questions about MimmoBook.",
  "help.art9C1": "Q: Do I need a credit card for the trial? A: No!",
  "help.art9C2":
    "Q: Can I use my own domain? A: Custom domains are on our roadmap.",
  "help.art9C3":
    "Q: How do guests receive confirmations? A: Automatically via email when you confirm a booking.",
  "help.art9C4":
    "Q: Can I export my data? A: Yes, reports can be exported from the Reports panel.",
  "help.art10Title": "What's New",
  "help.art10Desc":
    "Recent features: Guest Portal, Waitlist, Calendar Sync, exports and more.",
  "help.art10C1":
    "Guest Portal: guests can view or cancel their booking via a magic link (/my-booking/:token) — no login required.",
  "help.art10C2":
    "Waitlist: when a slot is full, guests can join a waitlist and get notified automatically when it opens.",
  "help.art10C3":
    "Google Calendar sync: subscribe to your reservations via the iCal feed (Settings → Calendar Sync). CSV/PDF export from Reservations and Reports.",
  "help.art10C4":
    "Dashboard upgrades: dark mode, keyboard shortcuts (press ?), Quick Actions FAB on mobile, onboarding checklist, audit log filters, analytics charts, login rate limiting, backup status indicator, public reviews/testimonials, multi-language public booking, Kitchen orders for restaurant and venue reservations, and a Stripe revenue dashboard for superadmins.",
  "help.art10C5":
    "Newest additions: booking invoice PDF, report PDF downloads for period reports, peak hours and busiest weekday, pick sheets for kitchen, lodging and events, booking channel split (guest or staff), email delivery timeline per booking, cross-booking audit view, offer pricing from resources, kitchen menu with prices, permission notices with a Request access button, plus reschedule requests and guest cancellation.",
  "help.art10C6":
    "Newest of all: special occasions with enforced capacity (for example Christmas dinner), a rejected bookings card showing why a guest could not book, a duplicate booking guard, kitchen lines routed automatically from an accepted offer, and the new Enterprise plan with unlimited staff.",
  "help.art11Title": "Building your system step by step",
  "help.art11Desc":
    "The recommended setup order, from business details to your first test booking.",
  "help.art11C1":
    "1) Business details and branding: name, email, address, phone, logo, colours, hero image and booking page text in Settings.",
  "help.art11C2":
    "2) Reservation types, sites (Business and Enterprise), then resources: rooms and room types, tables, event spaces or wellness services with capacity, duration, price and photos.",
  "help.art11C3":
    "3) Opening hours (tenant defaults, site overrides, per-resource weekly hours), prices and discount codes, then email templates and the sender name and reply-to address.",
  "help.art11C4":
    "4) Invite staff and set roles and site assignments, add special occasions and blocked slots, copy or embed your booking link, then make one test booking, check the email, download the invoice and cancel it.",
  "help.art12Title": "Special occasions, kitchen routing and Enterprise",
  "help.art12Desc": "The newest features and how they change daily work.",
  "help.art12C1":
    "Special occasions: create a named date such as Christmas dinner with a total capacity and either fixed sittings or open booking. The price is set on the reservation, not on the occasion, and the database blocks simultaneous bookings from overselling.",
  "help.art12C2":
    "Rejected bookings: a dashboard card lists bookings the system refused with the reason (occasion full, closed day, duplicate submission, invalid details), and repeat submissions within 15 minutes show the guest a You already sent this booking notice.",
  "help.art12C3":
    "Kitchen routing from offers: accepting a cross-booking creates kitchen lines from each function's own food and drinks field. Event lines to the event booking, dining and room lines to the dining booking (or the event booking when there is no dining). Special requests are never sent, empty fields create nothing, and the Kitchen order preview shows exactly what will be sent.",
  "help.art12C4":
    "Plans: Basic 5 staff, Pro 25, Business 50, Enterprise unlimited and priced by offer through Request an offer on the pricing page.",
  "help.guide7Q":
    "How do I set up a special occasion such as Christmas dinner?",
  "help.guide7A":
    "Open the reservation type settings and add a **special occasion**: name, date, total capacity, and either **fixed sittings** (guests choose one of your start times) or **open booking** (any time inside opening hours). Set the price on the reservation or the resource, never on the occasion. Guests then see the occasion on the booking page for that date, and the capacity cannot be oversold even when two guests book at the same moment.",
  "help.guide8Q": "Where do the food and drinks from an accepted offer go?",
  "help.guide8A":
    "Each function's own food and drinks field becomes kitchen lines on the booking that serves it: event lines on the event booking, dining lines on the dining booking, and room lines on the dining booking (or the event booking when there is no dining). **Special requests are never sent to the kitchen**, an empty field creates no order, and the **Kitchen order preview** plus the **Where each food and drinks field goes** panel show the routing and totals before you accept.",
  "help.guide1Q": "How do I manage reservations?",
  "help.guide1A":
    "Go to your **Dashboard → Reservations** to view, filter, edit, and manage all bookings. You can confirm or cancel reservations from the action menu on each card.",
  "help.guide2Q": "How do I customize my booking page?",
  "help.guide2A":
    "Navigate to **Settings** in your dashboard. Upload your logo, set brand colors, and add a hero image. Your public booking page updates automatically.",
  "help.guide3Q": "How do I set up email templates?",
  "help.guide3A":
    "In **Settings → Email Templates**, you can customize both confirmation and cancellation emails. Use the preview tab to see how they'll look to guests.",
  "help.guide4Q": "How do I add staff members?",
  "help.guide4A":
    "Go to **Admin → Users** to invite new staff. You can set roles (Owner, Admin, Staff) and approve or remove team members.",
  "help.guide5Q": "How do I add or edit resources?",
  "help.guide5A":
    "Go to **Dashboard → Resources** to create rooms, tables, or venues. You can set capacity, pricing, upload up to 5 images, and toggle active/inactive status.",
  "help.guide6Q": "What's new in MimmoBook?",
  "help.guide6A":
    "Recent additions: **Guest Portal** (magic-link booking management), **Waitlist** with auto-notify, **Google Calendar sync** via iCal feed, **CSV/PDF export**, **dark mode**, **keyboard shortcuts** (press `?`), **Quick Actions FAB** on mobile, **onboarding checklist**, **audit-log filters**, **analytics charts**, **public reviews/testimonials**, **Kitchen orders** for restaurant and venue reservations, **Offers to Reservations conversion report** with CSV export, and a **Stripe revenue dashboard** for superadmins.",

  // MimmoAid
  "aid.title": "MimmoAid",
  "aid.subtitle": "Ask anything about MimmoBook",
  "aid.myRequests": "My Requests",
  "aid.yourRequests": "Your submitted support requests",
  "aid.askOrGuide": "Ask a question or try a quick guide:",
  "aid.quickGuides": "Quick guides ▸",
  "aid.thinking": "Thinking...",
  "aid.cancelRequest": "Cancel request",
  "aid.submitRequest": "Submit support request",
  "aid.subjectPlaceholder": "Subject (e.g. Feature request)",
  "aid.messagePlaceholder": "Describe your request or suggestion...",
  "aid.submitToAdmin": "Submit to Admin",
  "aid.typePlaceholder": "Type your question...",
  "aid.sendMessage": "Send message",
  "aid.chat": "Chat",
  "aid.requests": "Requests",
  "aid.loadingRequests": "Loading requests...",
  "aid.noRequests": "No support requests yet.",
  "aid.noRequestsHint": "Submit one from the chat view.",
  "aid.yourMessage": "Your message",
  "aid.adminResponse": "Admin response",
  "aid.awaitingResponse": "Awaiting admin response...",
  "aid.requestSubmitted": "Support Request",
  "aid.requestSubmittedDetail":
    "Your support request has been submitted! Your admin team will review it and respond soon. You'll see a notification when it's been addressed.",
  "aid.statusOpen": "Open",
  "aid.statusInProgress": "In Progress",
  "aid.statusResolved": "Resolved",
  "aid.statusClosed": "Closed",
  "aid.errorNoTenant": "Unable to submit request. No tenant found.",
  "aid.errorSubmit": "Failed to submit request",
  "aid.successSubmit": "Support request submitted",
  "aid.errorConnect": "Sorry, I couldn't connect. Please try again.",
  "aid.guideQ1": "How do I manage reservations?",
  "aid.guideA1":
    "Go to your **Dashboard → Reservations** to view, filter, edit, and manage all bookings. You can confirm or cancel reservations from the action menu on each card.",
  "aid.guideQ2": "How do I customize my booking page?",
  "aid.guideA2":
    "Navigate to **Settings** in your dashboard. Upload your logo, set brand colors, and add a hero image. Your public booking page updates automatically.",
  "aid.guideQ3": "How do I set up email templates?",
  "aid.guideA3":
    "In **Settings → Email Templates**, you can customize both confirmation and cancellation emails. Use the preview tab to see how they'll look to guests.",
  "aid.guideQ4": "How do I add staff members?",
  "aid.guideA4":
    "Go to **Admin → Users** to invite new staff. You can set roles (Owner, Admin, Staff) and approve or remove team members.",
  "aid.guideQ5": "How do I add or edit resources?",
  "aid.guideA5":
    "Go to **Dashboard → Resources** to create rooms, tables, or venues. You can set capacity, pricing, upload up to 5 images, and toggle active/inactive status.",
  "aid.guideQ6": "How do I set opening hours?",
  "aid.guideA6":
    "In **Settings → Opening Hours**, set defaults per reservation type with different open and close times for each day of the week. Mark individual days as closed. On Business plan you can override per site, and any resource can have its own weekly schedule from the resource edit dialog.",
  "aid.guideQ7": "How do I view reports?",
  "aid.guideA7":
    "Navigate to **Dashboard → Reports** to see reservation trends, occupancy rates, and revenue summaries. You can filter by date range and export printable reports.",
  "aid.guideQ8": "How does pricing work for rooms?",
  "aid.guideA8":
    "Set a **base price per night** on each resource, then configure **room type multipliers** (Single 1.0×, Double 1.5×, Suite 2.5×, etc.). The booking page calculates totals automatically.",
  "aid.guideQ9": "How do I share my booking link?",
  "aid.guideA9":
    "Your public booking link is shown on the **Dashboard Overview**. Click **Copy link** to copy it, or open it in a new tab to preview. Share it on your website or social media.",
  "aid.guideQ10": "How do I block dates or time slots?",
  "aid.guideA10":
    "In **Dashboard → Calendar**, click on a date and use the **Block Slot** option to prevent bookings for specific dates, times, or resources.",
  "aid.guideQ11": "How do I manage recurring blocked slots?",
  "aid.guideA11":
    "Go to **Dashboard → Calendar** and open the **Recurring Blocks** panel. You can create weekly repeating blocks for specific days, time ranges, and resource types (e.g. close the restaurant every Monday). Toggle blocks on/off or delete them anytime. Changes apply immediately to the public booking page.",
  "aid.guideQ12": "How do special occasions work?",
  "aid.guideA12":
    "Add a **special occasion** in the reservation type settings: name, date, total capacity, and either fixed sittings or open booking. Guests pick it on the booking page for that date. The price goes on the reservation, not on the occasion, and the capacity can never be oversold.",
  "aid.guideQ13": "Where do food and drinks from an offer go?",
  "aid.guideA13":
    "Each function's own food and drinks field becomes kitchen lines on the booking that serves it: event lines on the event booking, dining and room lines on the dining booking (or the event booking when there is no dining). Special requests are never sent to the kitchen, and the **Kitchen order preview** shows every line before you accept.",
  "aid.guideQ14": "In what order should I set my system up?",
  "aid.guideA14":
    "1) Business details and branding, 2) reservation types, sites and resources, 3) opening hours, prices and discount codes, 4) email templates and sender details, 5) staff, roles and site assignments, 6) special occasions and blocked slots, 7) share or embed your booking link, then make one test booking end to end.",
  // Sites
  "sites.title": "Sites",
  "sites.addSite": "Add Site",
  "sites.editSite": "Edit Site",
  "sites.tooltip":
    "Manage multiple locations or properties under your account. Each site can have its own resources, opening hours, and booking page.",
  "sites.allSites": "All Sites",
  "sites.approvals": "Approvals",
  "sites.siteName": "Site Name",
  "sites.siteType": "Site Type",
  "sites.slug": "Slug",
  "sites.slugHint": "Used in booking URL: /book/",
  "sites.location": "Location",
  "sites.description": "Description",
  "sites.descriptionPlaceholder": "Optional description of this site",
  "sites.createSite": "Create Site",
  "sites.updateSite": "Update Site",
  "sites.siteCreated": "Site created",
  "sites.siteUpdated": "Site updated",
  "sites.siteDeleted": "Site deleted",
  "sites.duplicateSlug": "A site with this slug already exists",
  "sites.deleteSite": "Delete",
  "sites.deleteConfirm":
    "This will permanently remove this site. Resources assigned to it will become unassigned.",
  "sites.noSites":
    "No sites yet. Create your first site to manage multiple locations.",
  "sites.resources": "Resources",
  "sites.status": "Status",
  "sites.actions": "Actions",
  "sites.active": "Active",
  "sites.draft": "Draft",
  "sites.typeHotel": "Hotel / Guesthouse",
  "sites.typeRestaurant": "Restaurant",
  "sites.typeVenue": "Event Space",
  "sites.resourceName": "Resource Name",
  "sites.resourceType": "Resource Type",
  "sites.capacity": "Capacity",
  "sites.noResourcesInSite": "No resources in this site yet.",
  "sites.assignUsers": "Assign Users",
  "sites.alreadyAssigned": "Assigned",
  "sites.usersSelected": "selected",
  // Sample period
  "sample.warningWeek":
    "Your free trial ends in {days} days. Contact support to upgrade.",
  "sample.warningDay":
    "Your free trial expires today! Contact support to continue.",
  "sample.warningDayTomorrow":
    "Your free trial expires tomorrow! Contact support to continue.",
  "sample.readOnly":
    "Your free trial has expired. Dashboard is read-only for {days} more days. Contact support to upgrade.",
  "sample.blocked":
    "Your free trial has expired and access is blocked. Contact support to reactivate.",
  // Discount
  "discount.title": "Discount",
  "discount.type": "Type",
  "discount.value": "Value",
  "discount.reason": "Reason",
  "discount.reasonPlaceholder": "e.g. Loyalty customer",
  "discount.percentage": "Percentage (%)",
  "discount.fixed": "Fixed amount (€)",
  "discount.freeNights": "Free nights/meals",
  "discount.promoCode": "Promo Code",
  "discount.promoCodePlaceholder": "Enter code if you have one",
  "discountCodes.title": "Discount Codes",
  "discountCodes.description":
    "Create and manage promotional discount codes for your customers.",
  "discountCodes.add": "Add Code",
  "discountCodes.addTitle": "Create Discount Code",
  "discountCodes.editTitle": "Edit Discount Code",
  "discountCodes.formDesc": "Configure the discount code details and validity.",
  "discountCodes.code": "Code",
  "discountCodes.discountCol": "Discount",
  "discountCodes.discountType": "Discount Type",
  "discountCodes.value": "Value",
  "discountCodes.uses": "Uses",
  "discountCodes.validity": "Validity",
  "discountCodes.actions": "Actions",
  "discountCodes.maxUses": "Max Uses",
  "discountCodes.unlimited": "Unlimited",
  "discountCodes.minPrice": "Min Order (€)",
  "discountCodes.validFrom": "Valid From",
  "discountCodes.validUntil": "Valid Until",
  "discountCodes.from": "From",
  "discountCodes.until": "Until",
  "discountCodes.active": "Active",
  "discountCodes.inactive": "Inactive",
  "discountCodes.activeLabel": "Active on creation",
  "discountCodes.empty": "No discount codes yet. Create your first one!",
  "discountCodes.created": "Discount code created",
  "discountCodes.updated": "Discount code updated",
  "discountCodes.deleted": "Discount code deleted",
  "discountCodes.saveError": "Failed to save discount code",
  "discountCodes.deleteError": "Failed to delete discount code",
  "discountCodes.deleteTitle": "Delete Discount Code",
  "discountCodes.deleteConfirm":
    "Are you sure you want to delete this discount code? This action cannot be undone.",
  "approval.colType": "Type",
  "approval.colName": "Name",
  "approval.colDetail": "Detail",
  "approval.colSite": "Site",
  "approval.colSubmitted": "Submitted",
  "approval.colActions": "Actions",
  "approval.approve": "Approve",
  "approval.reject": "Reject",
  "approval.rejecting": "Rejecting…",
  "approval.approved": "Approved",
  "approval.rejected": "Rejected",
  "approval.rejectChange": "Reject Change",
  "approval.rejectingLabel": "Rejecting:",
  "approval.rejectionReason": "Reason for rejection…",
  "approval.noItems": "No pending approvals",
  "approval.noItemsDesc": "All changes have been reviewed.",
  "approval.typeResource": "Resource",
  "approval.typeBlockedSlot": "Blocked Slot",
  "approval.typeRecurringBlock": "Recurring Block",
  "approval.typeOpeningHours": "Opening Hours",
  "approval.typeEmailTemplate": "Email Template",
  "approval.noReason": "No reason",
  "approval.closed": "Closed",
  "approval.pendingApproval": "Submitted for approval",

  // Email Template Editor
  "emailTemplates.title": "Email Templates",
  "emailTemplates.tooltip":
    "Customize the subject and body of confirmation, reminder, and cancellation emails sent to guests.",
  "emailTemplates.description":
    "Customize the emails sent to guests for confirmations, reminders, and cancellations.",
  "emailTemplates.proRequired": "Pro+ required",
  "emailTemplates.confirmation": "Confirmation",
  "emailTemplates.reminder": "Reminder",
  "emailTemplates.cancellation": "Cancellation",
  "emailTemplates.language": "Language",
  "emailTemplates.subject": "Subject line",
  "emailTemplates.body": "Email body (HTML)",
  "emailTemplates.showPreview": "Show preview",
  "emailTemplates.hidePreview": "Hide preview",
  "emailTemplates.previewLabel": "Preview with sample data",
  "emailTemplates.availableVars": "Available variables",
  "emailTemplates.activeToggle": "Enable this template",
  "emailTemplates.activeToggleDesc":
    "When disabled, the system default will be used instead.",
  "emailTemplates.resetDefault": "Reset to default",
  "emailTemplates.saved": "Email template saved",
  "emailTemplates.saveError": "Failed to save template",
  "emailTemplates.active": "Active",
  "emailTemplates.inactive": "Inactive",
  "emailTemplates.upgradeHint":
    "Upgrade to Professional or Business to customize email templates.",
  "emailTemplates.overrideRemoved":
    "Site override removed, using tenant defaults",
  "emailTemplates.siteOverride": "Site override",
  "emailTemplates.usingTenantDefault": "Using tenant default",
  "emailTemplates.revertToDefault": "Remove site override",
  "emailTemplates.siteDescription":
    "Customize email templates for this site. Changes here override the tenant-level defaults.",

  // Pricing page
  "pricing.heroTitle": "Simple and transparent pricing",
  "pricing.heroSubtitle":
    "Start with a 30-day free trial. Upgrade to the next tier or cancel anytime.",
  "pricing.basicName": "Basic",
  "pricing.basicDesc": "Perfect for a single hotel, restaurant or event venue.",
  "pricing.basicTypes": "2 types",
  "pricing.basicStaff": "1 to 5",
  "pricing.basicResourcesTotal": "2 total",
  "pricing.proResourcesPerType": "Up to 5",
  "pricing.proName": "Pro",
  "pricing.proDesc":
    "For businesses offering hotel, restaurant and event venue services in one place.",
  "pricing.proTypes":
    "Up to 5 reservation types in any combination (e.g. two restaurants and one hotel)",
  "pricing.proStaff": "Up to 25",
  "pricing.businessName": "Business",
  "pricing.businessDesc":
    "Feature-rich platform for businesses with multiple sites and operations.",
  "pricing.businessTypes": "All types, unlimited number",
  "pricing.businessStaff": "Up to 50",
  "pricing.enterpriseName": "Enterprise",
  "pricing.enterpriseDesc":
    "Tailored plan for large operations that need more than 50 staff users.",
  "pricing.enterpriseTypes": "All types, unlimited number",
  "pricing.enterpriseStaff": "Unlimited",
  "pricing.enterpriseF1": "Everything in Business",
  "pricing.enterpriseF2": "Unlimited staff users",
  "pricing.enterpriseF3": "Priority support and onboarding help",
  "pricing.enterpriseF4": "Pricing agreed per offer",
  "pricing.enterprisePrice": "By offer",
  "pricing.enterpriseCta": "Request an offer",
  "pricing.byOffer": "By offer",
  "pricing.basicF1": "Custom branding (logo, colors, images)",
  "pricing.basicF2": "Default email templates",
  "pricing.basicF3": "Opening hours configuration",
  "pricing.basicF4": "Branded booking page",
  "pricing.basicF5": "AI chatbot support",
  "pricing.proF1": "Everything in Basic",
  "pricing.proF2": "Custom email templates",
  "pricing.proF3": "AI chatbot support",
  "pricing.businessF1": "Everything in Pro",
  "pricing.businessF2": "Unlimited sites and operations, up to 50 staff users",
  "pricing.businessF3": "Advanced reporting",
  "pricing.businessF4": "Support (24h response)",
  "pricing.sitesLocations": "Sites / locations",
  "pricing.resourcesPerType": "Resources per type",
  "pricing.operationTypes": "Operation types",
  "pricing.onePerResType": "1 per res.type",
  "pricing.responseTime24h": "Response time 24h",
  "pricing.customBranding": "Custom branding",
  "pricing.brandedBooking": "Branded booking page",
  "pricing.defaultTemplates": "Default email templates",
  "pricing.customTemplates": "Custom email templates",
  "pricing.advancedRules": "Advanced booking rules",
  "pricing.multiLanguage": "Multi-language support",
  "pricing.multisiteManagement": "Multi-site management",
  "pricing.analyticsReports": "Analytics & reports",
  "pricing.offers": "Offers (event proposals & PDF)",
  "pricing.crossReservations": "Cross-reservations",
  "pricing.supportLevel": "Support",
  "pricing.basic": "Basic",
  "pricing.advanced": "Advanced",
  "pricing.unlimited": "Unlimited",
  "pricing.all": "All",
  "pricing.multiLocationTitle": "Managing multiple locations?",
  "pricing.multiLocationDesc":
    "The Business plan supports unlimited sites with multi-site management. Run your hotels, restaurants, and venues from a single dashboard.",
  "pricing.tryBusinessFree": "Try Business Free for 30 Days",
  "pricing.faqQ1": "What happens after the 30-day trial?",
  "pricing.faqA1":
    "You get a message notifying you about your trial converting to a paid subscription. You can cancel anytime before the trial ends, no charge. If you do not cancel, the subscription starts. If you cancel after subscription has started, you will be invoiced for the first billing cycle, which is 30 days.",
  "pricing.faqQ2": "Can I change my plan later?",
  "pricing.faqA2":
    "Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
  "pricing.faqQ3": "What reservation types can I choose?",
  "pricing.faqA3":
    "Restaurant (table bookings), Venue (event space inquiries), Gasthaus/Guesthouse (room reservations), and Wellness Services (appointment bookings for hairdressers, masseurs, makeup artists, and similar providers). Basic lets you pick one. Pro unlocks all types, one per type, on a single site. Business adds unlimited sites.",
  "pricing.faqQ4": "Can I use my own domain?",
  "pricing.faqA4":
    'Each business gets a branded subdomain (e.g., yourbusiness.mimmobook.com), and you can already use your own web address with it. In the dashboard, the "Share booking page" card has an "Your own address" tab: it shows how to point something like booking.yoursite.com at your booking page with a forward at your domain provider, and it gives you copy-paste code to embed the booking page or add a "Book now" button to your site, so your own address stays visible. Fully hosted custom domains are on our roadmap and will then be offered with enterprise pricing.',
  "pricing.faqQ5":
    "What's the difference between AI chatbot support and 24-hour response support?",
  "pricing.faqA5":
    "All plans include MimmoAid, our AI chatbot that can answer questions, help troubleshoot issues, and guide you through features instantly. The chatbot is available 24/7 in your dashboard. The Business plan adds 24-hour response support: you can escalate any conversation to our team on the platform via the chatbot and receive a guaranteed response within 24 hours.",

  // Support page
  "support.heroTitle": "How can we help?",
  "support.heroSubtitle":
    "Browse guides, FAQs, and tips to get the most out of MimmoBook.",
  "support.articlesHeading": "Guides and answers",
  "support.searchPlaceholder": "Search for help...",
  "support.noResults": "No results found. Try a different search term.",
  "support.stillNeedHelp": "Still need help?",
  "support.stillNeedHelpDesc":
    "All plans include AI chatbot support in the dashboard. Business plan customers get support with guaranteed 24-hour response from our team. There is also a user downloadable user guide in the backend view to help with use.",
  "support.gettingStarted": "Getting Started",
  "support.gettingStartedDesc":
    "Set up your account and create your first booking page.",
  "support.gettingStartedC1": "Sign up for a free 30-day trial.",
  "support.gettingStartedC2":
    "Complete the onboarding wizard to name your business and choose your reservation types.",
  "support.gettingStartedC3":
    "Customize your branding (logo, colors) in Settings.",
  "support.gettingStartedC4": "Share your booking link with customers!",
  "support.managingRes": "Managing Reservations",
  "support.managingResDesc":
    "View, edit, confirm, and cancel reservations from your dashboard.",
  "support.managingResC1":
    "Use the Calendar view for a visual overview of upcoming bookings.",
  "support.managingResC2":
    "Switch to the List view to filter by status, type, or date range.",
  "support.managingResC3":
    "Click any reservation to edit details, add notes, or change status.",
  "support.managingResC4":
    "Confirmation and cancellation emails are sent automatically.",
  "support.emailTemplates": "Email Templates",
  "support.emailTemplatesDesc":
    "Business tier customer can customize confirmation and cancellation emails sent to guests.",
  "support.emailTemplatesC1":
    "Go to Settings → Email Templates to customize your emails.",
  "support.emailTemplatesC2":
    "Preview how emails look before sending using the built-in preview.",
  "support.emailTemplatesC3":
    "Add custom messages per reservation when confirming or cancelling.",
  "support.emailTemplatesC4":
    "Emails support multi-language content (EN, FI, SV).",
  "support.brandingTitle": "Settings & Resource Pages",
  "support.brandingDesc":
    "Customize your public booking page with your brand identity.",
  "support.brandingC1":
    "Upload your logo and set primary/accent colors in Settings.",
  "support.brandingC2": "Add a hero image for your booking page header.",
  "support.brandingC3":
    "Business description appears on the booking page for guests.",
  "support.brandingC4": "",
  "support.openingHoursTitle": "Opening Hours",
  "support.openingHoursDesc":
    "Configure when your business accepts bookings for each type.",
  "support.openingHoursC1":
    "Set default opening hours per reservation type (restaurant, venue, hotel, wellness, custom) at the organization level. They apply to every matching resource unless overridden.",
  "support.openingHoursC2":
    "Pick the same hours for every open day, or set different hours per day, and mark individual days as closed.",
  "support.openingHoursC3":
    "Opening hours drive which time slots appear on the public booking page.",
  "support.openingHoursC4":
    "Use blocked slots to temporarily close a specific date or time range without changing your weekly schedule.",
  "support.openingHoursC5":
    "Three layers, finest wins: tenant defaults, then per-site overrides (Business plan), then per-resource hours. Any resource type can have its own weekly schedule, not just restaurants.",
  "support.openingHoursC6":
    "Occasional working slots: open a specific date and time window for sporadic workers (e.g. a wellness practitioner who only works some Saturdays). The booking calendar enables that day even when the weekly schedule marks it closed; blocked slots still apply.",
  "support.openingHoursC7":
    "Each resource can override its timezone (IANA name like Europe/Helsinki). When unset, it inherits the organization timezone. All wall-clock checks (today, weekday, slot generation) use the resource's effective timezone.",
  "support.resourcesTitle": "Resources & Rooms",
  "support.resourcesDesc":
    "Manage rooms, tables, and event spaces that can be booked.",
  "support.resourcesC1":
    "Add resources in the Resources section of your dashboard.",
  "support.resourcesC2":
    "Set capacity, pricing, and descriptions for each resource.",
  "support.resourcesC3":
    "Upload photos to showcase your spaces on the booking page.",
  "support.resourcesC4":
    "Deactivate resources to temporarily hide them from bookings.",
  "support.staffTitle": "User Management",
  "support.staffDesc": "Invite team members and manage roles and permissions.",
  "support.staffC1": "Owners can invite staff via the Admin panel.",
  "support.staffC2":
    "Roles: Owner (full access), Admin (manage resources), Staff (view reservations).",
  "support.staffC3": "Approve or remove team members at any time.",
  "support.staffC4":
    "The plans have a staff user and a reservation type limits, upgrade to add more.",
  "support.billingTitle": "Plans & Billing",
  "support.billingDesc":
    "Understand pricing tiers and manage your subscription.",
  "support.billingC1":
    "Basic (€19/mo): 1 type, 1 to 5 staff users, AI chatbot support.",
  "support.billingC2":
    "Professional (€59/mo): All types (one per type), up to 25 staff users, AI chatbot support.",
  "support.billingC3":
    "Business (€179/mo): All types and unlimited number, unlimited number staff users, priority support with 24h response.",
  "support.billingC4":
    "Upgrade or downgrade anytime. Changes take effect next billing cycle.",
  "support.faqTitle": "Frequently Asked Questions",
  "support.faqDesc": "Answers to the most common questions about MimmoBook.",
  "support.faqC1":
    "Q: Can I use my own domain? A: Custom domains are on our roadmap.",
  "support.faqC2":
    "Q: How do guests receive confirmations? A: Automatically via email when you confirm a booking.",
  "support.faqC3":
    "Q: Can I export my data? A: Yes, reports can be exported from the Reports panel.",
  "support.faqC4":
    "Q: What's the difference between AI chatbot and priority support? A: All plans include MimmoAid, our 24/7 AI chatbot. Business plan adds support requests asked on the platform with a guaranteed 24-hour response.",
  "support.faqC5": "",
  "support.catBasics": "Basics",
  "support.catReservations": "Reservations",
  "support.catCommunication": "Communication",
  "support.catCustomization": "Customization",
  "support.catConfiguration": "Configuration",
  "support.catTeam": "Team",
  "support.catBilling": "Billing",
  "support.catFaq": "FAQ",

  // What Is MimmoBook
  "whatIs.badge": "About the Platform",
  "whatIs.heroTitle": "What Is MimmoBook?",
  "whatIs.heroSubtitle":
    "MimmoBook is a cloud-based reservation management platform built for restaurants, venues, hotels and guesthouses. One tool to manage all your bookings.",
  "whatIs.seeFeatures": "See all features",
  "whatIs.definitionTitle": "MimmoBook: Reservation Management for Hospitality",
  "whatIs.definitionP1":
    "MimmoBook is a software-as-a-service (SaaS) platform that helps hospitality businesses manage reservations online. Whether you run a restaurant, event venue, hotel, or guesthouse, MimmoBook gives you a centralized dashboard to handle bookings, communicate with guests, and track your business performance.",
  "whatIs.definitionP2":
    "Unlike generic booking tools, MimmoBook is designed specifically for hospitality. It supports multiple reservation types, including table bookings, room reservations, venue hire, catering orders, and popup events, all from a single account. Each business gets a branded booking page that matches their identity.",
  "whatIs.definitionP3":
    "MimmoBook is available in English, Finnish, and Swedish, making it ideal for businesses operating in the Nordics and internationally. The platform scales from single-location restaurants to multi-site hospitality groups.",
  "whatIs.whoTitle": "Who Is MimmoBook For?",
  "whatIs.whoSubtitle":
    "MimmoBook serves hospitality businesses of all sizes across four main categories.",
  "whatIs.whoRestaurants": "Restaurants",
  "whatIs.whoRestaurantsDesc":
    "Manage table reservations, set menus, and guest preferences. Handle walk-ins and online bookings from one dashboard.",
  "whatIs.whoVenues": "Event Venues",
  "whatIs.whoVenuesDesc":
    "Coordinate space bookings, equipment needs, catering requests, and event scheduling with automated confirmations.",
  "whatIs.whoHotels": "Hotels",
  "whatIs.whoHotelsDesc":
    "Manage room reservations, check-in/check-out, breakfast options, and room-type pricing across your property.",
  "whatIs.whoGuesthouses": "Guesthouses",
  "whatIs.whoGuesthousesDesc":
    "Streamline guest stays with simple room booking, availability management, and personalized communication.",
  "whatIs.whoWellness": "Wellness Services",
  "whatIs.whoWellnessDesc":
    "Hairdressers, masseurs, makeup artists, and similar providers can publish a tickable services menu so customers book the right amount of time.",
  "whatIs.howTitle": "How Does MimmoBook Work?",
  "whatIs.howSubtitle": "Get started in four simple steps.",
  "whatIs.howStep1": "Sign Up",
  "whatIs.howStep1Desc":
    "Create your account and start a 30-day free trial. No credit card required.",
  "whatIs.howStep2": "Configure",
  "whatIs.howStep2Desc":
    "Set up your business profile, reservation types, opening hours, and branding.",
  "whatIs.howStep3": "Share",
  "whatIs.howStep3Desc":
    "Share your branded booking page with guests via your website, social media, or email.",
  "whatIs.howStep4": "Manage",
  "whatIs.howStep4Desc":
    "Handle all reservations from your dashboard with automated emails, reports, and team tools.",
  "whatIs.keyFeaturesTitle": "Key Features",
  "whatIs.feat1": "Smart Reservations",
  "whatIs.feat1Desc":
    "Accept and manage bookings for restaurants, venues, hotels, and guesthouses from one platform.",
  "whatIs.feat2": "Custom Branding",
  "whatIs.feat2Desc":
    "Your booking page reflects your brand with custom colors, logo, and hero images.",
  "whatIs.feat3": "Team Management",
  "whatIs.feat3Desc":
    "Invite staff, assign roles, and control permissions for your entire team.",
  "whatIs.feat4": "Multilingual Support",
  "whatIs.feat4Desc":
    "Dashboard and booking pages available in English, Finnish, and Swedish.",
  "whatIs.feat5": "Reports & Analytics",
  "whatIs.feat5Desc":
    "Track revenue, occupancy, and booking trends with exportable reports.",
  "whatIs.feat6": "Automated Emails",
  "whatIs.feat6Desc":
    "Confirmation, reminder, and cancellation emails sent automatically to guests.",
  "whatIs.allFeatures": "View all features",
  "whatIs.ctaTitle": "Ready to Simplify Your Reservations?",
  "whatIs.ctaSubtitle":
    "Start your 30-day free trial today. No credit card required.",

  // Features Page
  "featuresPage.badge": "Platform Features",
  "featuresPage.heroTitle": "Everything You Need to Manage Reservations",
  "featuresPage.heroSubtitle":
    "From booking pages to reports, MimmoBook provides a complete toolkit for hospitality reservation management.",
  "featuresPage.ctaTitle": "Start Managing Reservations Today",
  "featuresPage.ctaSubtitle":
    "Try all features free for 30 days. No credit card required.",
  "featuresPage.comparePlans": "Compare plans",
  "features.catReservations": "Reservation Management",
  "features.catBranding": "Branding & Booking Pages",
  "features.catManagement": "Team & Business Management",
  "features.catComms": "Communication & Reporting",
  "features.f1Title": "Multi-Type Reservations",
  "features.f1Desc":
    "Support table bookings, room reservations, venue hire, catering orders, and popup events from one account.",
  "features.f2Title": "Opening Hours & Availability",
  "features.f2Desc":
    "Configure opening hours per reservation type with blocked slots and recurring closures.",
  "features.f3Title": "Automated Reminders",
  "features.f3Desc":
    "Guests receive automatic reminder emails before their reservation to reduce no-shows.",
  "features.f4Title": "Discount Codes",
  "features.f4Desc":
    "Create percentage or fixed-amount discount codes with usage limits and date restrictions.",
  "features.f5Title": "Branded Booking Pages",
  "features.f5Desc":
    "Your public booking page displays your logo, colors, hero image, and business description.",
  "features.f6Title": "Custom Domain Ready",
  "features.f6Desc":
    "Each business gets a unique booking URL. Share it on your website, social media, or print materials.",
  "features.f7Title": "Multilingual (EN/FI/SV)",
  "features.f7Desc":
    "Dashboard and booking pages are fully translated in English, Finnish, and Swedish.",
  "features.f8Title": "Mobile Responsive",
  "features.f8Desc":
    "The booking page and dashboard work perfectly on phones, tablets, and desktops.",
  "features.f9Title": "Team Roles & Permissions",
  "features.f9Desc":
    "Invite staff as owners, admins, or team members with granular permission control.",
  "features.f10Title": "Resource Management",
  "features.f10Desc":
    "Create and manage rooms, tables, event spaces, and other bookable resources with photos and descriptions.",
  "features.f11Title": "Multi-Site Support",
  "features.f11Desc":
    "Manage multiple locations from one account with per-site branding, staff, and reporting.",
  "features.f12Title": "Approval Workflows",
  "features.f12Desc":
    "Review and approve reservations, resource changes, and blocked slots before they go live.",
  "features.f13Title": "Email Templates",
  "features.f13Desc":
    "Customize confirmation, reminder, and cancellation emails per reservation type and language.",
  "features.f14Title": "Custom Email Templates",
  "features.f14Desc":
    "Business plan users can fully customize email HTML with their branding and messaging.",
  "features.f15Title": "Reports & Analytics",
  "features.f15Desc":
    "Revenue reports, booking trends, occupancy rates, and CSV exports for accounting.",
  "features.f16Title": "Invoicing Tracking",
  "features.f16Desc":
    "Mark reservations as invoiced and track uninvoiced revenue across all reservation types.",
  "features.f17Title": "Offers & Proposals",
  "features.f17Desc":
    "Create professional offers with PDF generation and send them directly to guests via email.",
  "features.f18Title": "Cross-Reservations",
  "features.f18Desc":
    "Link reservations across spaces and services. Mark linked bookings as used or invoiced together.",
  "features.catGuests": "Guest Experience & Self Service",
  "features.catOperations": "Daily Operations",
  "features.catSecurity": "Security & Trust",
  "features.catPlatform": "Platform & Productivity",
  "features.f19Title": "Guest Portal",
  "features.f19Desc":
    "Guests open their own booking page from a secure link to view or cancel, with no account needed.",
  "features.f20Title": "Waitlist",
  "features.f20Desc":
    "When a time is full, guests join the waitlist and get an email automatically as soon as a place opens.",
  "features.f21Title": "Reschedule Requests",
  "features.f21Desc":
    "Guests propose a new time from their booking page and your team approves or declines it.",
  "features.f22Title": "Guest Reviews",
  "features.f22Desc":
    "Post-visit emails invite a review, and the reviews you publish appear on your booking page.",
  "features.f23Title": "Kitchen Orders",
  "features.f23Desc":
    "Track food, drinks and notes per reservation with received, preparing, ready and served statuses.",
  "features.f24Title": "Reusable Kitchen Menu",
  "features.f24Desc":
    "Save your menu items once, then fill in name, category and price on an order line in one click.",
  "features.f25Title": "Printable Pick Sheets",
  "features.f25Desc":
    "Print kitchen, lodging and event sheets for any chosen day so the team can work off paper.",
  "features.f26Title": "Calendar Sync",
  "features.f26Desc":
    "Subscribe to your reservation feed from Google Calendar, Apple Calendar or Outlook.",
  "features.f27Title": "Special Occasions",
  "features.f27Desc":
    "Name a date, set its capacity and choose fixed sittings or open booking, replacing normal hours.",
  "features.f28Title": "Booking Invoices",
  "features.f28Desc":
    "Download an invoice PDF showing the original amount, promo code used, discount and final total.",
  "features.f29Title": "Peak Hours & Busiest Day",
  "features.f29Desc":
    "See which hours and weekdays fill up first so you can staff and price accordingly.",
  "features.f30Title": "Booking Channel Split",
  "features.f30Desc":
    "Compare how many bookings arrive from your public page versus bookings your team adds by hand.",
  "features.f31Title": "Email Delivery Timeline",
  "features.f31Desc":
    "Every reservation shows which emails were queued, sent or failed, and exactly when.",
  "features.f32Title": "Two-Step Sign In",
  "features.f32Desc":
    "Protect accounts with an authenticator app code and one-time recovery codes.",
  "features.f33Title": "Audit Log",
  "features.f33Desc":
    "See who changed what and when, filtered by action, date range or person.",
  "features.f34Title": "Login Protection",
  "features.f34Desc":
    "Long passwords, a check against known leaked passwords, and a limit on repeated login attempts.",
  "features.f35Title": "Data Isolation & Retention",
  "features.f35Desc":
    "Your data stays separate from every other business, with automatic archiving and deletion schedules.",
  "features.f36Title": "Share & Embed",
  "features.f36Desc":
    "Ready-made booking links, per-service and per-site links, plus an embed for your own website.",
  "features.f37Title": "Dark Mode & Shortcuts",
  "features.f37Desc":
    "Work in light or dark, and jump between panels with keyboard shortcuts on every screen.",
  "features.f38Title": "Onboarding Checklist",
  "features.f38Desc":
    "A setup progress card guides you through resources, opening hours and emails on day one.",
  "features.f39Title": "Guide & Support Assistant",
  "features.f39Desc":
    "A built-in guidebook, printable staff guide and a support assistant that answers questions in the app.",
  "features.offersAndCross": "Offers & Cross-Reservations",
  "features.offersAndCrossDesc":
    "Create offers, generate branded PDFs, and link reservations across spaces and manage everything together.",

  // Use Cases
  "useCases.badge": "Use Cases",
  "useCases.ogTitle":
    "Booking software for barbers, salons, massage, bakeries and trainers",
  "useCases.ogDescription":
    "Service professionals: take bookings around the clock, run a waiting list, price your services, send reminders and collect reviews. Restaurants, venues and hotels too.",
  "useCases.ogImageAlt":
    "MimmoBook use cases for service professionals and hospitality",
  "useCases.seoTitle":
    "Use Cases, Barbers, Salons, Massage, Bakeries and Venues",
  "useCases.seoDescription":
    "See how MimmoBook works for barbers, hairdressers, massage therapists, bakers, personal trainers, make-up artists, restaurants, venues, hotels, guesthouses, catering and pop-ups.",
  "useCases.seoKeywords":
    "barber appointment software, hairdresser booking system, salon booking software, massage therapist booking, bakery order booking, personal trainer booking app, make-up artist booking, service business booking software, restaurant reservations, venue booking",
  "useCases.heroTitle":
    "Built for Every Type of Hospitality and Service Business",
  "useCases.heroSubtitle":
    "See how MimmoBook solves booking challenges for restaurants, venues, hotels, guesthouses, caterers, popup events, and service industry professionals: barbers, hairdressers, massage therapists, bakers, make-up artists and personal trainers.",
  "useCases.challengesLabel": "Common Challenges",
  "useCases.solutionLabel": "How MimmoBook Helps",
  "useCases.restaurant": "Restaurant Reservations",
  "useCases.restaurantDesc":
    "Restaurants need to manage table bookings, walk-ins, set menus, and special dietary requirements while keeping track of guest preferences and no-show rates.",
  "useCases.restaurantChallenges":
    "Phone-based booking is time-consuming and error-prone. Peak hours create bottlenecks. No-shows waste capacity. Manual tracking misses guest preferences and special requests.",
  "useCases.restaurantSolution":
    "MimmoBook provides a branded online booking page where guests self-serve. Automated confirmations and reminders reduce no-shows. All guest data, dietary notes, and preferences are stored in one place.",
  "useCases.venue": "Venue & Event Bookings",
  "useCases.venueDesc":
    "Event venues need to coordinate space availability, equipment, catering, and staffing while managing multiple bookings and client communications.",
  "useCases.venueChallenges":
    "Double-bookings when using email or phone. Complex logistics across multiple spaces. Scattered communication with clients. Difficulty tracking revenue per event type.",
  "useCases.venueSolution":
    "MimmoBook's resource management prevents double-bookings. Each venue space has its own availability calendar. Automated emails keep clients informed. Reports show revenue by event type.",
  "useCases.hotel": "Hotel Room Reservations",
  "useCases.hotelDesc":
    "Hotels need to manage room availability, check-in/check-out, room types, pricing tiers, and breakfast options while providing a professional booking experience.",
  "useCases.hotelChallenges":
    "Managing room inventory across room types. Tracking check-in/check-out manually. Coordinating breakfast options and pricing. Providing a professional booking experience without expensive systems.",
  "useCases.hotelSolution":
    "MimmoBook supports room-type pricing, bed configurations, breakfast options, and check-in/check-out tracking. The branded booking page gives guests a professional reservation experience.",
  "useCases.guesthouse": "Guesthouse Bookings",
  "useCases.guesthouseDesc":
    "Guesthouses and B&Bs need a simple system to manage guest stays, availability, and communication without the complexity of enterprise hotel software.",
  "useCases.guesthouseChallenges":
    "Enterprise hotel systems are too complex and expensive. Spreadsheets and phone bookings miss reservations. No automated guest communication. Difficult to show availability online.",
  "useCases.guesthouseSolution":
    "MimmoBook offers a simple, affordable booking system sized for guesthouses. Guests book directly through your branded page. Automated emails handle confirmations and reminders.",
  "useCases.catering": "Catering Orders",
  "useCases.cateringDesc":
    "Catering businesses need to manage delivery details, menu selections, dietary requirements, and event-specific logistics for every order.",
  "useCases.cateringChallenges":
    "Order details get lost in email chains. Dietary requirements are missed. No centralized view of upcoming orders. Manual coordination wastes time.",
  "useCases.cateringSolution":
    "MimmoBook captures all catering details in structured booking forms. Delivery addresses, dietary notes, and guest counts are stored per order. The dashboard shows all upcoming catering events.",
  "useCases.popup": "Popup Events & Markets",
  "useCases.popupDesc":
    "Popup event organizers need to manage vendor applications, stall assignments, and event logistics across temporary locations.",
  "useCases.popupChallenges":
    "Vendor management is chaotic via email. Stall assignments are tracked manually. No centralized view of vendor details and requirements. Fee tracking is inconsistent.",
  "useCases.popupSolution":
    "MimmoBook's popup reservation type captures stall size, fees, equipment needs, and vendor details. Organizers see all applications in one dashboard with approval workflows.",
  "useCases.wellness": "Wellness and Service Industry Bookings",
  "useCases.wellnessDesc":
    "Hairdressers, masseurs, makeup artists, and similar providers need customers to book the right amount of time, which varies by which services they pick.",
  "useCases.wellnessChallenges":
    "Customers do not always know how long their visit will take. Mixing different services in one appointment is hard to communicate by phone. Manually adding service durations together is error-prone.",
  "useCases.wellnessSolution":
    "MimmoBook lets you publish a tickable services menu with a price and duration per item (in 5 minute steps, up to 8 hours). The customer ticks what they want and the booking length adjusts automatically. No payments, only the time slot.",
  "useCases.workflowsTitle": "How service professionals run their week",
  "useCases.workflowsSubtitle":
    "Four everyday examples of bookings, waiting lists, prices and invoicing, and customer reviews in MimmoBook. Customers pay you in person or by invoice, MimmoBook keeps the times, prices and paperwork in order.",
  "useCases.wf1Role": "Hairdresser or barber",
  "useCases.wf1Focus": "Bookings",
  "useCases.wf1S1":
    "You publish your services with a price and a duration each, and set your opening hours per day.",
  "useCases.wf1S2":
    "A customer picks a service on your own booking page, and the length of the slot adjusts to what they ticked.",
  "useCases.wf1S3":
    "They get an instant acknowledgement, you get the booking on your calendar and a notification in the app.",
  "useCases.wf1S4":
    "A reminder email goes out before the visit, and you mark the customer as arrived at the chair.",
  "useCases.wf2Role": "Massage therapist",
  "useCases.wf2Focus": "Waiting list",
  "useCases.wf2S1":
    "When your preferred hours are full, the customer joins the waiting list for the day they want.",
  "useCases.wf2S2":
    "You see every waiting customer with their name, phone and preferred date in one list.",
  "useCases.wf2S3":
    "A cancellation frees an hour, so you contact the first person on the list and mark them as notified.",
  "useCases.wf2S4":
    "You add the booking yourself in a few clicks, or let the customer book the slot that is now open.",
  "useCases.wf3Role": "Bakery or cake maker",
  "useCases.wf3Focus": "Prices and invoicing",
  "useCases.wf3S1":
    "Orders arrive with the pickup date, the quantity and any dietary notes the customer wrote.",
  "useCases.wf3S2":
    "You set the price, or let your published service prices add up the total automatically.",
  "useCases.wf3S3":
    "For business customers you send a branded offer as a PDF, and link several orders to one event.",
  "useCases.wf3S4":
    "You tick the order as invoiced once you have billed it, and the reports show what is still unbilled.",
  "useCases.wf4Role": "Personal trainer",
  "useCases.wf4Focus": "Customer reviews",
  "useCases.wf4S1":
    "After a session the customer gets a private link to leave a rating and a comment.",
  "useCases.wf4S2":
    "Every review lands in your dashboard, and only the ones you publish become visible.",
  "useCases.wf4S3":
    "Published reviews appear on your booking page, so new customers see real feedback before they book.",
  "useCases.wf4S4":
    "Ratings over time show up in your reports next to bookings, busy hours and cancellations.",
  "useCases.tradeCtaTitle": "Start with a booking page made for your trade",
  "useCases.tradeCtaSubtitle":
    "Pick the work you do and set up in an afternoon. Every plan starts with a 30 day free trial, no card needed.",
  "useCases.tradeCtaBarberName": "Barbers",
  "useCases.tradeCtaBarberLine":
    "Fixed cut and beard times, back to back, with reminders that cut no-shows.",
  "useCases.tradeCtaBarberButton": "Set up barber bookings",
  "useCases.tradeCtaHairdresserName": "Hairdressers",
  "useCases.tradeCtaHairdresserLine":
    "Colour and treatment times that add up on their own when the customer picks services.",
  "useCases.tradeCtaHairdresserButton": "Set up salon bookings",
  "useCases.tradeCtaMassageName": "Massage therapists",
  "useCases.tradeCtaMassageLine":
    "30, 60 and 90 minute treatments, plus a waiting list for your busiest hours.",
  "useCases.tradeCtaMassageButton": "Set up treatment bookings",
  "useCases.tradeCtaBakerName": "Bakers",
  "useCases.tradeCtaBakerLine":
    "Cake and catering orders with pickup dates, dietary notes, prices and invoicing.",
  "useCases.tradeCtaBakerButton": "Set up order bookings",
  "useCases.tradeCtaMakeupName": "Make-up artists",
  "useCases.tradeCtaMakeupLine":
    "Wedding and event bookings with the address, the number of faces and your own offer as a PDF.",
  "useCases.tradeCtaMakeupButton": "Set up make-up bookings",
  "useCases.tradeCtaTrainerName": "Personal trainers",
  "useCases.tradeCtaTrainerLine":
    "Repeat sessions, check-ins at the door and published client reviews on your page.",
  "useCases.tradeCtaTrainerButton": "Set up training bookings",
  "useCases.ctaTitle": "Find Your Use Case?",
  "useCases.ctaSubtitle":
    "Start your free 30-day trial and set up your first booking page in minutes.",

  // Blog
  "blog.badge": "Blog",
  "blog.heroTitle": "Hospitality Insights & Guides",
  "blog.heroSubtitle":
    "Tips, best practices, and insights for hospitality businesses managing reservations.",
  "blog.readMore": "Read more",
  "blog.backToBlog": "Back to Blog",
  "blog.postCta": "Ready to streamline your reservations?",
  "blog.relatedReading": "Related reading",
  "blog.ctaTitle": "Stay Up to Date",
  "blog.ctaSubtitle":
    "Try MimmoBook free for 30 days and see how it transforms your booking management.",
  "blog.catInsights": "Insights",
  "blog.catGuides": "Guides",
  "blog.post1Title":
    "5 Reservation Challenges Small Hospitality Businesses Face",
  "blog.post1Excerpt":
    "From no-shows to double bookings, small restaurants, venues and guesthouses face unique challenges. Here's what they are and how to solve them.",
  "blog.post1C1":
    "Small hospitality businesses, such as restaurants with a handful of tables, boutique venues and family-run guesthouses, face reservation challenges that larger operations solve with dedicated staff and enterprise software. But for a business with 5 to 30 covers or a few rooms, those solutions are overkill.",
  "blog.post1C2":
    "The first challenge is no-shows. When a four-top doesn't show up at a 20-seat restaurant, that's 20% of capacity gone. Unlike large hotels that absorb no-shows in volume, small businesses feel every empty seat. Automated reminder emails sent 24 hours before a reservation can cut no-show rates by 30 to 50%.",
  "blog.post1C3":
    "The second challenge is double bookings. When reservations come in via phone, email, Instagram DMs, and walk-ins, it's easy to book the same table or room twice. A centralized booking system with real-time availability eliminates this entirely.",
  "blog.post1C4":
    "Third, guest communication is inconsistent. Some guests get a confirmation email, others don't. Some get reminders, some are forgotten. Automated email flows ensure every guest receives the same professional experience regardless of how busy the staff is.",
  "blog.post1C5":
    "Fourth, tracking revenue is manual and error-prone. Small businesses often use spreadsheets or paper to track bookings and payments, making it hard to know actual occupancy rates, average booking values, or seasonal trends. A booking system with built-in reporting solves this. Fifth, online visibility suffers. Without a professional booking page, potential guests can't easily find availability or make reservations, and they move on to competitors who offer online booking.",
  "blog.post2Title": "Why Spreadsheets Fail for Booking Management",
  "blog.post2Excerpt":
    "Spreadsheets are flexible but they create problems when used for reservation management. Here's why dedicated software is worth the switch.",
  "blog.post2C1":
    "Spreadsheets are the default tool for many small businesses. They're free, flexible, and familiar. But when used for reservation management, they create problems that grow worse over time.",
  "blog.post2C2":
    "The biggest issue is that spreadsheets are not real-time. When two staff members update the same sheet, conflicts happen. When a guest books by phone while someone else is editing the document, data gets lost. There's no live availability view, so staff must manually check before confirming each booking.",
  "blog.post2C3":
    "Spreadsheets also can't send emails. Every confirmation, reminder, and cancellation must be handled manually. This takes time, introduces errors, and creates an inconsistent guest experience. A dedicated booking system automates all guest communication.",
  "blog.post2C4":
    "Finally, spreadsheets don't provide analytics. You can't easily see occupancy rates, booking trends, or revenue by reservation type without building complex formulas. Booking software generates these reports automatically, helping you make data-driven decisions about staffing, pricing, and marketing.",
  "blog.post3Title": "Why Branded Booking Pages Matter for Your Business",
  "blog.post3Excerpt":
    "A generic booking form tells guests nothing about your brand. A branded booking page builds trust and increases conversions.",
  "blog.post3C1":
    "When a guest visits your booking page, it's often their first interaction with your business online. If that page is a generic form with no branding, it sends the wrong message. It looks unprofessional and doesn't build confidence.",
  "blog.post3C2":
    "A branded booking page with your logo, colors, hero image, and business description creates a professional first impression. Guests immediately know they're in the right place. It builds trust before they even make a reservation. Studies show that branded booking experiences have 20 to 40% higher conversion rates than generic forms.",
  "blog.post3C3":
    "MimmoBook lets every business customize their booking page with their own branding. Upload your logo, set your brand colors, add a hero image, and write a description. The result is a booking experience that feels like an extension of your website, not a third-party tool.",
  "blog.post4Title": "Managing Reservations Across Multiple Locations",
  "blog.post4Excerpt":
    "Multi-site hospitality businesses need centralized tools. Here's how to manage bookings across locations without losing control.",
  "blog.post4C1":
    "Running multiple hospitality locations, whether it's a restaurant group, a chain of guesthouses, or venues in different cities, multiplies the complexity of reservation management. Each location has its own availability, staff, branding, and guest base.",
  "blog.post4C2":
    "The challenge is maintaining consistency while respecting each location's unique needs. A centralized system lets you manage all locations from one dashboard while keeping separate booking pages, staff permissions, and reports per site.",
  "blog.post4C3":
    "MimmoBook's multi-site feature is designed for this. Each site gets its own branded booking page, its own staff assignments, and its own reporting. But owners and admins can switch between sites from a single account, compare performance, and manage settings centrally.",
  "blog.post4C4":
    "The key benefit is visibility. Instead of logging into separate systems or checking multiple spreadsheets, you see all your locations in one place. Reservation trends, revenue comparisons, and staffing needs become clear at a glance.",
  "blog.post5Title":
    "Wellness Industry Bookings: How Ease of Use Drives Business Growth",
  "blog.post5Excerpt":
    "Spas, salons, yoga studios and wellness clinics rely on smooth bookings to grow. Here's how a simple reservation system fuels repeat visits and revenue.",
  "blog.post5C1":
    "The wellness industry is built on trust and atmosphere. From massage therapists and spas to yoga studios, beauty salons, physiotherapy clinics and meditation retreats, every guest interaction shapes how clients feel about returning. That experience does not start at the front desk. It starts the moment someone tries to book.",
  "blog.post5C2":
    "Ease of use is the single biggest factor in turning a curious visitor into a paying client. Wellness clients often book on mobile, late in the evening, after a stressful day. If your booking page is slow, confusing or hidden behind a phone number and opening hours, they move on to a competitor whose page works in under a minute. A clean, branded booking flow with clear service descriptions, prices and real-time availability removes that friction and dramatically increases conversion.",
  "blog.post5C3":
    "Repeat visits are where wellness businesses actually grow. A first-time client who books a 60 minute massage is only profitable if they come back. Automated confirmation and reminder emails reduce no-shows, while a saved profile, easy rebooking and a recognizable brand keep clients loyal. Studies across the wellness sector show that businesses with online self-service booking grow client retention by 20 to 35 percent compared to phone only bookings.",
  "blog.post5C4":
    "Operationally, a modern reservation system frees wellness owners from the front desk. Instead of answering calls between treatments, staff focus on the client in the room. Multi-resource scheduling handles therapists, rooms and equipment in one view, so double bookings disappear. Reports show which services, time slots and staff drive the most revenue, so you can price, promote and staff with confidence.",
  "blog.post5C5":
    "MimmoBook gives wellness businesses a branded booking page, automated client communication, multi-resource scheduling and clear reporting in one place. It is built for small and growing wellness brands that want to look professional online, reduce admin work and create the calm, effortless experience their clients expect, from the first click to the next visit.",
  "blog.post6Title":
    "Best Restaurant Reservation Apps in 2026: Free and Paid Systems Compared",
  "blog.post6Excerpt":
    "Looking for the best restaurant reservation app? Compare free and paid online booking systems for restaurants, cafés and venues, and see where MimmoBook fits.",
  "blog.post6C1":
    "Choosing a reservation app for your restaurant is one of the highest leverage decisions you can make. The right online booking system fills empty tables, reduces no-shows and frees your staff from the phone. The wrong one locks you into per-cover fees, hides your guests behind a marketplace, or forces you to run a spreadsheet on the side. This guide compares the main categories of restaurant reservation apps in 2026, from free online booking systems to paid platforms, and shows where MimmoBook fits for independent restaurants, cafés, wine bars and small groups.",
  "blog.post6C2":
    "Free online booking systems are a common starting point. Tools like Google Reserve integrations, basic form builders and free tiers of larger platforms let you accept a reservation without paying a monthly fee. The trade-off is real: most free systems limit the number of monthly bookings, hide reporting behind a paid plan, show competitor ads on your booking page, or require a per-cover fee once you grow. For a very small restaurant with a handful of tables and low volume, a free tier can work for a few months. Beyond that, the hidden costs usually exceed a modest paid subscription.",
  "blog.post6C3":
    "Marketplace reservation apps such as global directory-style platforms bring in extra diners but take control of the guest relationship. Your restaurant appears next to competitors, guests see the marketplace brand instead of yours, and you typically pay per seated cover on top of a monthly fee. For high-turnover city-center restaurants that need incremental cover volume, marketplaces still make sense. For neighbourhood restaurants, wine bars, brunch spots and destination venues that already have a loyal audience, the per-cover cost eats the margin and dilutes the brand.",
  "blog.post6C4":
    "Dedicated reservation software built for the restaurant, not the marketplace, is the third category. These tools give you a branded booking page on your own domain, real-time table availability, automated confirmations and reminders in the guest's language, deposits and pre-payments when you need them, and reporting on covers, revenue, no-shows and repeat guests. Because the guest books directly with you, there is no per-cover fee and the customer relationship stays yours. This is where MimmoBook sits.",
  "blog.post6C5":
    "MimmoBook is a cloud reservation platform for restaurants, cafés, wine bars, event venues, hotels and wellness businesses. Restaurants get a branded booking page in Finnish, Swedish and English, real-time availability across dining rooms and terraces, automated confirmation and reminder emails, discount and pre-payment options, multi-site management for restaurant groups, and clear reporting on covers, no-shows and revenue. Pricing is a flat monthly fee, not per cover, so growth does not punish you. A free sample plan lets you evaluate the full product before committing.",
  "blog.post6C6":
    "How to choose in practice: if you take fewer than 20 covers per week, start with a free tier and revisit after three months. If your restaurant depends on walk-in tourist traffic, a marketplace can be a useful extra channel on top of your own booking page. If you have a returning audience, a strong brand, or more than one location, dedicated software like MimmoBook usually pays for itself within the first month through recovered no-shows, faster staff workflow and higher direct-booking conversion. The best restaurant reservation app is the one that keeps the guest relationship, and the margin, with you.",
  "blog.post7Title":
    "MimmoBook vs Resy vs Tock: Restaurant Reservation Software Compared",
  "blog.post7Excerpt":
    "A practical comparison of MimmoBook, Resy and Tock for restaurant reservations. See how flat pricing, multi-site management and branded booking pages stack up against per-cover fees.",
  "blog.post7C1":
    "If you run an independent restaurant, wine bar, brunch spot or small restaurant group, picking the right reservation platform in 2026 comes down to three real choices: MimmoBook, Resy and Tock. Each one takes bookings and sends confirmations, but the pricing model, brand control and multi-site support are very different. This guide compares them head to head so you can pick the restaurant reservation software that keeps your margins and your guest relationship intact.",
  "blog.post7C2":
    "Pricing is where the three platforms separate the fastest. Resy and Tock both mix a monthly subscription with per-cover or per-transaction fees, so a busy service quietly costs more than a quiet one. MimmoBook charges a flat monthly fee with no per-cover surcharge, so a full house on a Saturday costs exactly the same as a slow Tuesday. For a restaurant taking 800 to 1,500 covers per month, the difference over a year is often larger than the entire subscription price of MimmoBook.",
  "blog.post7C3":
    "Brand control is the second axis. Resy and Tock are marketplaces first: guests can discover your restaurant on their apps, but the confirmation email, the profile and the loyalty relationship live on the marketplace side. MimmoBook is the opposite: your booking page runs on your own domain, in your brand colors and language, and every guest email goes out from your identity. If direct bookings and repeat guests matter more than marketplace discovery, MimmoBook is the model that keeps the guest yours.",
  "blog.post7C4":
    "Multi-site management matters the moment you open a second location. Resy and Tock handle multi-location, but per-site pricing and per-cover fees scale linearly with growth. MimmoBook is built around a tenant with multiple sites: one login, one dashboard, per-site overrides for opening hours, branding and email sender, and a single flat plan that covers the whole group. For a 2 to 6 site restaurant business, the operational overhead drops sharply and the invoice stays predictable.",
  "blog.post7C5":
    "Ease of use for small teams is the third practical factor. Resy and Tock are powerful, but they assume a floor manager who lives inside the tool. MimmoBook is designed for owner-operators and small staff: booking creation in under 30 seconds, mobile-first dashboard, automatic confirmations and reminders in Finnish, Swedish and English, kitchen order tracking for dine-in resources, and a staff quick guide you can print as a PDF. Onboarding a new server is measured in minutes, not shifts.",
  "blog.post7C6":
    "How to choose: if your restaurant depends on tourist discovery in a large city and you can absorb per-cover fees, Resy or Tock as an extra channel still make sense. If you have a loyal neighbourhood audience, a strong brand or more than one location, MimmoBook is the reservation platform that fits, with flat pricing, a branded booking page and multi-site management built in. Try MimmoBook on the free sample plan and compare a full month against your current per-cover invoice; the numbers usually decide for you.",
  "blog.post8Title":
    "MimmoBook vs Mindbody, Vagaro, Fresha, Acuity: Wellness Booking Compared",
  "blog.post8Excerpt":
    "How MimmoBook stacks up against Mindbody, Vagaro, Fresha and Acuity for spas, salons, yoga studios and wellness clinics: pricing, brand control, multi-site and ease of use.",
  "blog.post8C1":
    "If you run a spa, salon, yoga studio, massage practice or a small wellness group, the shortlist of booking platforms in 2026 usually looks the same: Mindbody, Vagaro, Fresha, Acuity Scheduling and MimmoBook. All five can take an online booking, but the business model behind each one is very different, and that model quietly decides how much you pay, who owns the client relationship and how painful growth will feel. This guide compares them from a MimmoBook point of view so you can pick the wellness booking software that keeps your margin and your clients on your side.",
  "blog.post8C2":
    "Pricing is the fastest way to separate them. Mindbody sits at the enterprise end with tiered monthly plans that climb quickly once you add branded apps, marketing automation or extra staff. Vagaro looks affordable at entry level but charges per staff seat, plus add-ons for forms, memberships and text reminders. Fresha is free to accept bookings, and instead takes a commission on new-client sales and card processing, so the platform is only free when your marketplace clients are not converting. Acuity is a flat scheduler subscription, cheap on paper but limited once you need multi-site, memberships or hospitality-grade guest handling. MimmoBook charges one flat monthly fee per tenant, no per-staff seat cost, no commission on bookings, no per-transaction skim. For a studio with 3 to 8 staff or a spa taking 500 plus appointments a month, the yearly gap is usually larger than the entire MimmoBook subscription.",
  "blog.post8C3":
    "Brand control is the second axis, and this is where marketplace platforms quietly change the game. Mindbody and Fresha both push clients into their consumer apps: your studio appears next to competitors, the confirmation email is branded by the marketplace, and the client relationship formally sits with the platform. Vagaro is lighter on marketplace but still funnels discovery through vagaro.com. Acuity is white-label but generic, with limited visual customisation. MimmoBook is the opposite pattern: a branded booking page on your own domain in your own colors, guest emails sent from your identity, no third-party discovery layer between you and the client. If repeat visits, memberships or gift cards are core to your revenue, you want the client relationship on your side, not the marketplace's.",
  "blog.post8C4":
    "Multi-site and multi-service management is where wellness businesses trip up. Mindbody supports multi-location but you often move to a higher tier for it, and each site adds cost. Vagaro and Fresha treat each location as a separate business with its own settings and, in Fresha's case, its own marketplace listing. Acuity's multi-location story is limited and manual. MimmoBook is built around a tenant with multiple sites from day one: one login, one dashboard, per-site overrides for opening hours, branding, staff, email sender and pricing, plus a single flat plan that covers the whole group. For a 2 to 6 site wellness business, the operational overhead drops sharply and the invoice stays predictable as you open location 3, 4 and 5.",
  "blog.post8C5":
    "Ease of use for small teams is the third practical factor. Mindbody is powerful but assumes a dedicated front-desk manager who lives inside the tool. Vagaro is friendlier but the interface widens quickly once you turn on memberships, forms and payroll. Fresha is smooth on the consumer side but the pro dashboard leans on marketplace behaviours. Acuity is clean but stops short of the hospitality workflows a spa or wellness clinic actually needs, like table or room layouts, deposits per resource or multi-service block bookings. MimmoBook is designed for owner-operators and small staff: booking creation in under 30 seconds, mobile-first dashboard, automatic confirmations and reminders in Finnish, Swedish and English, resource-level availability for rooms and treatment beds, and a staff quick guide you can print as a PDF. Onboarding a new therapist or receptionist is measured in minutes, not shifts.",
  "blog.post8C6":
    "How to choose in practice: if you are a single-location salon with heavy reliance on new-client discovery, Fresha's marketplace can be a useful acquisition channel. If you are a US enterprise chain with a dedicated ops team, Mindbody's depth still makes sense. If you only need a simple scheduler and never plan to add multi-site or hospitality features, Acuity is fine. For most European spas, salons, yoga studios, wellness clinics and small multi-site wellness groups, MimmoBook is the platform that fits: flat pricing, a branded booking page on your own domain, real multi-site management, GDPR-friendly EU hosting and support in Finnish, Swedish and English. Try MimmoBook on the free sample plan and compare a full month against your current invoice, the numbers usually decide for you.",
  "blog.post9Title":
    "Booking Software for Service Professionals: Barbers, Hairdressers, Massage Therapists, Bakers and Personal Trainers",
  "blog.post9Excerpt":
    "A practical guide for one person and small team service businesses: how online booking fills your calendar, cuts no-shows and gives you back the hours you now spend on the phone.",
  "blog.post9C1":
    "Service professionals sell time, not products. A barber has roughly 40 chair hours in a week, a massage therapist maybe 25 treatment hours, a personal trainer a handful of prime evening slots, a baker a fixed number of pickup windows before the ovens are full. Every hour that goes unbooked, or that a no-show empties, is income you cannot get back. That is why the booking process matters more in a service business than almost anywhere else.",
  "blog.post9C2":
    "Most small service businesses still take bookings the same way: a phone call between clients, a direct message in the evening, a paper diary on the counter. It works until it does not. You miss calls while your hands are busy, you double book a Saturday, you forget who asked for the 17:00 slot, and you spend your evenings answering messages instead of resting. Clients notice too. Many people now prefer to book at 22:00 from their phone rather than call during the day, and if they cannot, they book with somebody who lets them.",
  "blog.post9C3":
    "An online booking page fixes this without changing how you work. Your services are listed with their real duration and price, so a cut and beard trim reserves 45 minutes and a 90 minute massage reserves 90, and the calendar never offers a slot you cannot deliver. Confirmation emails go out instantly, reminders go out before the appointment, and cancellations free the slot automatically so somebody else can take it. Your opening hours, breaks and days off are yours to set, including the odd Saturday you decide to work.",
  "blog.post9C4":
    "The numbers behind this are simple. No-shows in personal service businesses typically run between 10 and 20 percent of appointments, and automated reminders cut that roughly by a third. If you run 60 appointments a week at 50 euros, recovering even five percent of lost slots is about 150 euros a week, far more than a booking subscription costs. Add the admin time: most owners spend three to five hours a week on booking messages, and self-service booking removes most of it.",
  "blog.post9C5":
    "Different trades need slightly different things. Barbers and hairdressers need services that stack, so a colour and cut books as one longer visit, plus per chair or per stylist availability. Massage therapists and treatment providers need buffer time between clients, room and bed level scheduling and a calm, branded page that matches the experience they sell. Bakers need pickup windows and order details rather than seats, with a limited number of orders per slot. Personal trainers need recurring sessions, small group slots and evening peaks. MimmoBook handles all of these from the same dashboard, and a multi site business can run several locations under one account.",
  "blog.post9C6":
    "If you are a service professional working alone or with a small team, start simple: put your real services and durations online, turn on confirmations and reminders, and publish the page on your own domain so clients book with you and not on a marketplace that owns your client list. MimmoBook has flat monthly pricing with no commission per booking, works in Finnish, Swedish and English, and is hosted in the EU with GDPR in mind. The free sample plan lets you test a full month with real clients before you decide.",
  "blog.spHeroCaption":
    "Barbers, hairdressers, massage therapists, bakers and personal trainers all sell time in fixed slots, which is exactly what online booking protects.",
  "blog.spSlotsTitle": "Your week is a grid of slots",
  "blog.spSlotsCaption":
    "Six working slots per day for one person. Every open slot and every no-show is income that cannot be recovered later.",
  "blog.spSlotsBooked": "Booked and paid",
  "blog.spSlotsOpen": "Open, nobody could book it outside your phone hours",
  "blog.spSlotsLost": "Lost to a no-show or a late cancellation",
  "blog.spFlowTitle": "How a booking works, from client to repeat visit",
  "blog.spFlowCaption":
    "Four steps that run by themselves once your services and hours are set.",
  "blog.spFlow1Title": "1. Client picks a service",
  "blog.spFlow1Desc":
    "They see your services with real duration and price, and only the slots you can actually deliver.",
  "blog.spFlow2Title": "2. Confirmation is automatic",
  "blog.spFlow2Desc":
    "The booking lands in your calendar and the client gets a confirmation email in their own language.",
  "blog.spFlow3Title": "3. Reminder before the visit",
  "blog.spFlow3Desc":
    "A timed reminder reduces no-shows, and a cancellation reopens the slot for somebody else.",
  "blog.spFlow4Title": "4. Easy rebooking",
  "blog.spFlow4Desc":
    "Client details are saved, so the next appointment takes seconds and reports show who returns.",
  "blog.spStat1Label": "Bookings taken while you work or sleep",
  "blog.spStat2Label": "Typical drop in no-shows with automatic reminders",
  "blog.spStat3Label": "Time to add a booking by hand when a client calls",
  "blog.spWhoTitle": "Built for these trades",
  "blog.spWho1":
    "Barbers and hairdressers: services that stack into one visit, per chair or per stylist availability, and colour treatments with the right longer duration.",
  "blog.spWho2":
    "Massage therapists, treatment providers and other wellness professionals: buffer time between clients, room and bed level scheduling, and a calm branded page.",
  "blog.spWho3":
    "Bakers and food makers: pickup windows instead of seats, a limited number of orders per slot, and order notes for fillings, allergies and sizes.",
  "blog.spWho4":
    "Personal trainers and coaches: recurring sessions, small group slots, evening peaks and clear reports on which times sell.",
  "blog.spBenefitsTitle": "What you get in practice",
  "blog.spBenefit1":
    "Your own branded booking page on your own domain, so clients book with you and your client list stays yours.",
  "blog.spBenefit2":
    "Services with real durations and prices, so the calendar never offers a slot you cannot deliver.",
  "blog.spBenefit3":
    "Automatic confirmations and reminders in Finnish, Swedish and English, which cut no-shows without a single phone call.",
  "blog.spBenefit4":
    "Opening hours, breaks, days off and one off working days you control yourself, per person and per room.",
  "blog.spBenefit5":
    "Flat monthly pricing with no commission per booking, so a busy month costs the same as a quiet one.",
  "blog.spBenefit6":
    "Reports on bookings, repeat clients and the times that sell best, plus several locations under one account when you grow.",

  // Nav new pages
  "nav.features": "Features",
  "nav.useCases": "Use Cases",
  "nav.blog": "Blog",
  "nav.whatIs": "What Is MimmoBook?",
  "nav.offers": "Offers",
  "nav.kitchen": "Kitchen",
  "nav.bookingLog": "Booking log",
  "bookingLog.title": "Booking validation log",
  "bookingLog.tooltip":
    "Every booking attempt is recorded here with capacity context, so you can see exactly why a request was accepted, warned about, or rejected.",
  "bookingLog.recentTitle": "Recent attempts (last 200)",
  "bookingLog.searchPlaceholder": "Search by name, email, or type",
  "bookingLog.allOutcomes": "All outcomes",
  "bookingLog.empty": "No booking attempts logged yet.",
  "bookingLog.when": "When",
  "bookingLog.guest": "Guest",
  "bookingLog.type": "Type / source",
  "bookingLog.date": "For date",
  "bookingLog.capacity": "Capacity",
  "bookingLog.outcome": "Outcome",
  "bookingLog.reasonsTitle": "Validation reasons:",
  "bookingLog.noReasons": "No detail recorded.",
  "bookingLog.softWarningToast":
    "Booking saved, but this date is near or above capacity.",

  "kitchen.title": "Kitchen Orders",
  "kitchen.tooltip":
    "Track food, drink, and other orders for restaurant and venue reservations",
  "kitchen.date": "Date",
  "kitchen.prevDay": "Previous day",
  "kitchen.nextDay": "Next day",
  "kitchen.pickDate": "Choose a date",
  "kitchen.ordersFor": "Kitchen orders for {name}",
  "kitchen.deleteItemNamed": "Delete {name}",
  "kitchen.deleteOrder": "Delete order",
  "kitchen.restoreHidden": "Show removed cards ({count})",
  "kitchen.deleteOrderNamed": "Delete the whole kitchen order for {name}",
  "kitchen.deleteOrderConfirm": "Delete the whole kitchen order?",
  "kitchen.deleteOrderHint":
    "The food and drink lines are deleted and the card is removed from the Kitchen tab. The booking itself stays.",
  "kitchen.orderDeleted": "Kitchen order deleted",
  "kitchen.menu.priceLabel": "Unit price in euros",
  "kitchen.today": "Today",
  "kitchen.noReservations": "No restaurant or venue reservations on this date.",
  "kitchen.noOrders": "No orders yet. Add the first item below.",
  "kitchen.addItem": "Add item",
  "kitchen.itemName": "Item",
  "kitchen.itemNamePlaceholder": "e.g. Caesar salad",
  "kitchen.quantity": "Qty",
  "kitchen.category": "Category",
  "kitchen.status": "Status",
  "kitchen.notes": "Notes",
  "kitchen.notesPlaceholder": "Optional notes (allergies, modifiers...)",
  "kitchen.unitPrice": "Unit price (€)",
  "kitchen.total": "Total",
  "kitchen.guests": "guests",
  "kitchen.cat.food": "Food",
  "kitchen.cat.drink": "Drink",
  "kitchen.cat.other": "Other",
  "kitchen.status.received": "Received",
  "kitchen.status.preparing": "Preparing",
  "kitchen.status.ready": "Ready",
  "kitchen.status.served": "Served",
  "kitchen.save": "Save",
  "kitchen.delete": "Delete",
  "kitchen.deleteConfirm": "Delete this item?",
  "kitchen.itemAdded": "Item added",
  "kitchen.itemUpdated": "Item updated",
  "kitchen.itemDeleted": "Item deleted",
  "kitchen.error": "Could not save item",
  "kitchen.filter.all": "All",
  "kitchen.print": "Print",
  "kitchen.menu.title": "Menu Templates",
  "kitchen.menu.manage": "Manage menu",
  "kitchen.menu.empty":
    "No menu items yet. Add common items to insert them quickly into orders.",
  "kitchen.menu.addToOrder": "Add to order",
  "kitchen.menu.pickFromMenu": "From menu",
  "kitchen.menu.newItem": "Add menu item",
  "kitchen.menu.namePlaceholder": "Item name (e.g. Margherita pizza)",
  "kitchen.menu.saved": "Menu item saved",
  "kitchen.menu.deleted": "Menu item removed",
  "kitchen.menu.saveError": "Could not save menu item",
  "kitchen.menu.close": "Close",
  "kitchen.menu.searchPlaceholder": "Search menu...",
  "kitchen.bulk.markAll": "Mark all",
  "kitchen.bulk.advanceAll": "Advance all",
  "kitchen.bulk.allPreparing": "All to Preparing",
  "kitchen.bulk.allReady": "All to Ready",
  "kitchen.bulk.allServed": "All to Served",
  "kitchen.bulk.updated": "{count} item(s) updated",
  "kitchen.bulk.nothingToUpdate": "Nothing to update",

  // Offers
  "offers.title": "Offers",
  "offers.tooltip": "Create and manage offers for events and group bookings",
  "offers.create": "New Offer",
  "offers.edit": "Edit Offer",
  "offers.empty": "No offers yet",
  "offers.noResults": "No offers match your search",
  "offers.searchPlaceholder": "Search offers...",
  "offers.showArchived": "Show archived",
  "offers.printPdf": "Print offer as PDF",
  "offers.searchLabel": "Search offers",
  "offers.archive": "Archive",
  "offers.unarchive": "Unarchive",
  "offers.archived": "Archived",
  "offers.archivedSuccess": "Offer archived",
  "offers.unarchivedSuccess": "Offer unarchived",
  "offers.archiveError": "Error archiving offer",
  "offers.send": "Send",
  "offers.confirm": "Confirm",
  "offers.saved": "Offer saved",
  "offers.saveError": "Error saving offer",
  "offers.fillRequired": "Please fill in all required fields",
  "offers.confirmedSuccess": "Offer confirmed",
  "offers.confirmedWithoutPrice":
    "Some bookings were saved without a price. Add the price before invoicing them.",
  "offers.statusRegionLabel": "Latest offer result",
  "offers.kitchenOrdersFailedAnnounce":
    "The bookings were saved, but the food and drink lines could not be sent to the Kitchen tab. Open the Kitchen tab and add them by hand.",
  "offers.confirmErrorAnnounce":
    "The offer could not be confirmed and no bookings were created. Please check the offer details and try again.",
  "offers.confirmedWithoutPriceAnnounce":
    "Some bookings were saved without a price. Open each booking and add the price before invoicing.",
  "offers.kitchenOrdersFailed":
    "The bookings were saved, but the menu could not be sent to the kitchen. Please add it in the Kitchen tab.",
  "offers.confirmedKitchenSentOne":
    "1 food and drink line from the offer was sent to the Kitchen tab.",
  "offers.confirmedKitchenSent":
    "{count} food and drink lines from the offer were sent to the Kitchen tab.",
  "offers.confirmedNoKitchen":
    "This offer had no food or drinks, so a regular reservation was created and nothing was sent to the Kitchen tab.",
  "offers.priceReviewTitle": "Check the prices",
  "offers.priceReviewDesc":
    "These bookings will be created from the offer. Prices come from your resource settings.",
  "offers.priceReviewWarnTitle": "A price is missing",
  "offers.priceReviewWarnDesc":
    "For some bookings the resource has several prices and none matches the chosen space, so no price can be picked automatically. Choose a price, type an amount, or decide to leave it empty for now.",
  "offers.priceReviewNeedsPrice": "Price needed",
  "offers.priceReviewFromResource": "From resource settings",
  "offers.priceReviewReasonAmbiguous":
    "This resource has several prices and none matches the chosen space.",
  "offers.priceReviewReasonNoResource":
    "No matching resource was found for this booking.",
  "offers.priceReviewReasonUnpriced":
    "No price has been saved for this resource.",
  "offers.priceReviewAmount": "Price (EUR)",
  "offers.priceReviewSkip":
    "Leave empty for now, staff will add the price later",
  "offers.priceReviewConfirm": "Confirm offer",
  "offers.confirmError": "Error confirming offer",
  "offers.sendEmail": "Send email",
  "offers.emailSent": "Email sent",
  "offers.emailError": "Error sending email",
  "offers.pdfAttached": "PDF download link included",
  "offers.lastSent": "Last sent",
  "offers.statusDraft": "Draft",
  "offers.statusSent": "Sent",
  "offers.statusConfirmed": "Confirmed",
  "offers.statusExpired": "Expired",
  "offers.validity": "Validity",
  "offers.validityPlaceholder": "e.g. Valid until 31.12.2026",
  "offers.startTime": "Start time",
  "offers.endTime": "End time",
  "offers.eventSpace": "Event space",
  "offers.selectSpace": "Select space",
  "offers.eventType": "Event type",
  "offers.invoicing": "Invoicing details",
  "offers.linkedReservations": "Linked reservations",
  "offers.specialRequests": "Special requests",
  "offers.menuPlaceholder": "Enter menu details...",
  "offers.menuKitchenLabel": "Food and drinks (becomes the kitchen order)",
  "offers.menuKitchenHint":
    "Every line here becomes one kitchen order line on the dining or event booking when the offer is accepted. Leave it empty for a regular booking with nothing sent to the Kitchen tab.",
  "offers.menuKitchenHintLeg":
    "Food and drinks written here also go to the kitchen order of the dining or event booking, since rooms and other bookings never appear in the Kitchen tab.",
  "offers.menuFormatHint":
    "One item per line, for example: 2 x Salmon (no dill), 10 Coffee, Cake x 3.",
  "offers.menuNoKitchenHint":
    "Not sent to the kitchen. Use the food and drinks field for that.",
  "offers.menuKitchenLabelMain":
    "Food and drinks for the main booking (becomes the kitchen order)",
  "offers.menuKitchenLabelFor":
    "Food and drinks for {name} (becomes the kitchen order)",
  "offers.menuKitchenHintLegOwn":
    "These lines become the kitchen order of the {name} booking in the Kitchen tab.",
  "offers.menuKitchenHintLegMoved":
    "{name} never appears in the Kitchen tab, so these lines are added to the kitchen order of the dining or event booking in this offer.",
  "offers.menuKitchenSummary":
    "Each part of this offer has its own food and drinks field. Every field creates its own kitchen order lines when the offer is accepted, and fields on parts that never appear in the Kitchen tab, such as rooms, are added to the dining or event booking instead.",
  "offers.kitchenPreviewTitle": "Kitchen order preview",
  "offers.kitchenMapTitle": "Where each food and drinks field goes",
  "offers.kitchenMapRule":
    "A dining or event booking keeps its own kitchen order. Other functions, such as rooms, have no place on the Kitchen tab, so their lines are added to the dining booking, or to the event booking if there is no dining one.",
  "offers.kitchenMapOwn": "keeps its own kitchen order.",
  "offers.kitchenMapTo": "goes to the kitchen order of {name}.",
  "offers.kitchenMapNone":
    "has nowhere to go, since this offer has no dining or event booking.",
  "offers.kitchenPreviewTotal": "Kitchen order lines: {count}",
  "offers.kitchenPreviewEmpty":
    "No food or drinks yet, so accepting this offer creates the bookings only and nothing goes to the Kitchen tab.",
  "offers.kitchenPreviewNone": "No food or drinks in this field.",
  "offers.kitchenPreviewStays":
    "These lines go to this booking's own kitchen order.",
  "offers.kitchenPreviewMoved":
    "These lines go to the kitchen order of {name}.",
  "offers.kitchenPreviewLost":
    "No dining or event booking in this offer, so these lines would not reach the Kitchen tab. Add one, or move the food and drinks there.",
  "offers.language": "Language",
  "offers.emailTo": "To",
  "offers.emailSubject": "Subject",
  "offers.emailBody": "Email body",
  "offers.crossBookingTitle": "Cross-booking",
  "offers.crossBookingAdd": "Add reservation",
  "offers.crossBookingAdded": "Reservation linked",
  "offers.crossBookingAddError": "Error linking reservation",
  "offers.crossBookingRemoved": "Reservation unlinked",
  "offers.crossBookingRemoveError": "Error unlinking reservation",
  "offers.linkedGroupCurrent": "Current",
  "offers.linkedGroupTotal": "Total",
  "offers.linkedBadge": "Cross-booking",
  "offers.linkedRowService": "Service",
  "offers.linkedRowDate": "Date",
  "offers.linkedRowGuests": "Guests",
  "offers.linkedRowPrice": "Price",
  "offers.linkedRowOpen": "Open this linked reservation",

  // Tier limit errors
  "tierError.STAFF_USER_LIMIT_REACHED":
    "Your plan allows up to {limit} staff users. Upgrade to add more team members.",
  "tierError.SITE_LIMIT_REACHED":
    "Your plan allows up to {limit} site. Upgrade to Business to manage multiple locations.",
  "tierError.RESERVATION_TYPE_LIMIT_REACHED":
    "Your plan allows up to {limit} reservation type. Upgrade to unlock additional booking categories.",
  "tierError.RESOURCE_PER_TYPE_LIMIT_REACHED":
    "Your plan allows only {limit} resource(s) per type. Upgrade to Business for unlimited resources.",

  // Privacy & account deletion
  "privacy.panel.title": "Privacy and your data",
  "privacy.panel.description":
    "Export everything we hold about you, or close your account. These are your rights under GDPR (Art. 15, 17, 20).",
  "privacy.export.title": "Export my data",
  "privacy.export.description":
    "Download a JSON file containing your profile, reservations, audit log, and other data we hold about you. Limit: one export every 24 hours.",
  "privacy.export.button": "Download my data",
  "privacy.export.success": "Your data export has been downloaded.",
  "privacy.delete.title": "Delete my account",
  "privacy.delete.description":
    "Schedules your account for permanent deletion after a 30 day cancellation window. If you are the only owner of an organisation with other members, transfer ownership first.",
  "privacy.delete.button": "Delete my account",
  "privacy.delete.scheduled": "Deletion scheduled. Final purge: {date}",
  "privacy.delete.cancel": "Cancel deletion",
  "privacy.delete.cancelled": "Account deletion cancelled.",
  "privacy.delete.confirmTitle": "Delete your account?",
  "privacy.delete.confirmDescription":
    "Your data will be permanently removed after 30 days. To confirm, type DELETE below.",
  "privacy.delete.confirmLabel": "Confirmation",
  "privacy.delete.confirmAction": "Schedule deletion",
  "privacy.delete.requested":
    "Account deletion scheduled. You have 30 days to cancel.",

  // Guest portal
  "guest.portal.label": "Guest portal",
  "guest.portal.title": "Your booking",
  "guest.portal.linkExpiredTitle": "Link expired",
  "guest.portal.linkRevokedTitle": "Link revoked",
  "guest.portal.notFoundTitle": "Booking not found",
  "guest.portal.linkExpiredBody":
    "This booking link has expired. Please contact the venue for assistance.",
  "guest.portal.linkRevokedBody":
    "This link has been revoked. Please contact the venue.",
  "guest.portal.notFoundBody":
    "We could not find a booking with this link. It may have been removed.",
  "guest.portal.checkOut": "Check-out",
  "guest.portal.specialRequests": "Special requests",
  "guest.portal.total": "Total",
  "guest.portal.guestsSuffix": "guest(s)",
  "guest.portal.needDifferentDate": "Need a different date?",
  "guest.portal.newDate": "New date",
  "guest.portal.newTime": "New time (optional)",
  "guest.portal.message": "Message (optional)",
  "guest.portal.messagePlaceholder": "Anything the venue should know?",
  "guest.portal.requestNewDate": "Request new date",
  "guest.portal.sending": "Sending...",
  "guest.portal.requestSentBanner":
    "Your change request has been sent to the venue. They will contact you to confirm.",
  "guest.portal.requestSentToast": "Change request sent to the venue.",
  "guest.portal.requestError": "Could not send your request. Please try again.",
  "guest.portal.cancelBooking": "Cancel booking",
  "guest.portal.cancelTitle": "Cancel your booking?",
  "guest.portal.cancelDescription":
    "This will cancel your booking. This action cannot be undone.",
  "guest.portal.keepBooking": "Keep booking",
  "guest.portal.yesCancel": "Yes, cancel",
  "guest.portal.cancelling": "Cancelling...",
  "guest.portal.cancelSuccess": "Your booking has been cancelled.",
  "guest.portal.cancelError": "Failed to cancel. Please try again.",
  "guest.portal.pastBooking":
    "This booking date has passed. We hope you enjoyed your visit!",
  "guest.portal.questionsFooter":
    "Questions? Contact the venue directly using the details in your confirmation email.",
  "guest.find.pageTitle": "Find your booking",
  "guest.find.heading": "Find your booking",
  "guest.find.intro":
    "Enter the email address you used when booking and we will send you a secure link to view, change, or cancel your reservation.",
  "guest.find.emailLabel": "Email address",
  "guest.find.submit": "Send me my booking link",
  "guest.find.sentBody":
    "If we found upcoming bookings for that email address, we have sent secure links to it. The links are valid for 7 days.",
  "guest.find.useAnother": "Use another email",
  "guest.find.invalidEmail": "Please enter a valid email address.",
  "guest.find.error": "Something went wrong. Please try again in a moment.",
  "guest.find.linkLabel": "Find my booking",
  "guest.find.linkHint": "Already booked? Manage your reservation.",

  // Availability timeline
  "timeline.title": "Availability timeline",
  "timeline.resource": "Resource",
  "timeline.blocked": "Blocked",
  "timeline.availableSlot": "Extra availability",
  "timeline.empty": "No active resources for this day.",
  "timeline.previousDay": "Previous day",
  "timeline.nextDay": "Next day",
  "timeline.legendReservation": "Reservation",
  "timeline.legendPending": "Pending",
  "timeline.legendBlocked": "Blocked",
  "timeline.legendSlot": "Extra availability",
  "timeline.dragHint": "Tip: drag across a resource lane to block that time.",
  "timeline.newBlockTitle": "Block this time",
  "timeline.newBlockDescription":
    "Nothing can be booked on this resource during the selected time.",
  "timeline.reason": "Reason",
  "timeline.reasonPlaceholder": "For example: maintenance, private event",
  "timeline.createBlock": "Block time",
  "timeline.blockCreated": "Time blocked.",
  "timeline.blockError": "Could not block that time.",
  "timeline.overlapBlocked":
    "That time overlaps an existing booking, pick a free slot.",
  "timeline.undo": "Undo",
  "timeline.blockUndone": "Block removed.",
  "ops.digest.title": "Daily digest email",
  "ops.digest.description":
    "Send tomorrow's run sheet automatically every morning at 06:00 Helsinki time.",
  "ops.digest.enabled": "Email the daily run sheet",
  "ops.digest.recipients": "Recipients",
  "ops.digest.recipientsHelp":
    "Comma separated. Leave empty to use your business email.",
  "ops.digest.save": "Save digest settings",
  "ops.digest.saved": "Digest settings saved.",
  "ops.digest.saveError": "Could not save digest settings.",
  "ops.digest.test": "Send test digest now",
  "ops.weekly.title": "Weekly report email",
  "ops.weekly.description":
    "Email a seven day summary with a copy ready CSV block, sent at 06:00 local time on the chosen weekday.",
  "ops.weekly.enabled": "Weekly report on",
  "ops.weekly.day": "Send on",
  "ops.weekly.recipientsHelp":
    "Comma separated. Leave empty to use the business email.",
  "ops.weekly.saved": "Weekly report settings saved.",
  "ops.weekly.saveError": "Could not save the weekly report settings.",
  "ops.weekly.test": "Send test report now",
  "ops.weekly.testSent": "Test report queued.",
  "ops.weekly.testError": "Could not send the test report.",
  "forecast.drilldownTitle": "Peak hour detail",
  "forecast.drilldownEmpty":
    "No bookings started in this hour over the period.",
  "forecast.drilldownHint":
    "Select a cell to see the services and guest volume behind it.",
  "forecast.avgGuests": "Average guests",
  "forecast.bookings": "Bookings",
  "forecast.yoyTitle": "Occupancy trend versus last year",
  "forecast.yoySubtitle":
    "Monthly bookings and guests compared with the same month a year ago.",
  "forecast.thisYear": "This year",
  "forecast.lastYear": "Last year",
  "forecast.change": "Change",
  "forecast.occupancyTrend": "Trend",
  "ops.alerts.title": "Guest change alerts",
  "ops.alerts.description":
    "Email staff when a guest requests a new date or cancels a booking.",
  "ops.alerts.enabled": "Email alerts on",
  "ops.alerts.recipientsHelp":
    "Comma separated. Leave empty to use the business email.",
  "ops.alerts.saved": "Alert settings saved.",
  "ops.alerts.saveError": "Could not save alert settings.",
  "timeline.blockButton": "Block time",
  "timeline.startTime": "Start time",
  "timeline.endTime": "End time",
  "ops.digest.testSent": "Test digest sent to the listed recipients.",
  "ops.digest.testError": "Could not send the test digest.",
  "nav.pendingRequests": "pending guest requests",

  // Forecast
  "forecast.title": "Demand forecast",
  "forecast.subtitle":
    "Bookings already on the books for the next 14 days versus your typical pace for that weekday.",
  "forecast.booked": "Booked",
  "forecast.expected": "Typical pace",
  "forecast.next14Booked": "Reservations next 14 days",
  "forecast.next14Guests": "Guests next 14 days",
  "forecast.gapToPace": "Gap to typical pace",
  "forecast.peakHours": "Peak hours",
  "forecast.peakSubtitle":
    "Reservation start times by weekday over the last 90 days.",
  "forecast.busiest": "Busiest",
  "forecast.basedOn": "Based on the last days:",
  "forecast.mon": "Mon",
  "forecast.tue": "Tue",
  "forecast.wed": "Wed",
  "forecast.thu": "Thu",
  "forecast.fri": "Fri",
  "forecast.sat": "Sat",
  "forecast.sun": "Sun",
};

const fi: TranslationKeys = {
  // Common
  "common.logIn": "Kirjaudu",
  "common.logOut": "Kirjaudu ulos",
  "common.signUp": "Rekisteröidy",
  "common.startFreeTrial": "Aloita ilmainen kokeilujaksosi",
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
  "common.showList": "Näytä lista",
  "common.hideList": "Piilota lista",
  "common.guests": "vierasta",
  "common.date": "Päivämäärä",
  "common.noResults": "Ei tuloksia.",
  "common.selectAll": "Valitse kaikki",
  "common.invalidFileName":
    "Tiedoston nimi sisältää merkkejä, joita emme voi turvallisesti tallentaa. Nimeä tiedosto uudelleen ja yritä uudelleen.",

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
  "nav.sites": "Toimipisteet",
  "nav.profile": "Profiili",

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
  "reports.offerConversion": "Tarjouksista varauksiksi",
  "reports.totalOffers": "Tarjouksia yhteensä",
  "reports.convertedOffers": "Muunnettu varauksiksi",
  "reports.conversionRate": "Muunnosprosentti",
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
  "reports.uninvoicedAlert":
    "{count} ei laskutettu kaikista {total}, {amount} ei laskutettu",
  "reports.breakfastAlert":
    "{count} varausta, {nights} yötä, arvioitu aamupalatulo {amount}",
  "reports.nights": "yötä",
  "reports.reservations": "varausta",
  "reports.ofTotal": "yhteensä",
  "reports.invoicedPercent": "laskutettu",
  "reports.discountSummary": "Alennusyhteenveto",
  "reports.totalDiscounts": "Annetut alennukset yhteensä",
  "reports.topCodes": "Käytetyimmät koodit",
  "reports.discountToRevenue": "Alennus/liikevaihto",
  "reports.discountedBookings": "alennettua varausta",
  "reports.noDiscounts": "Ei alennuksia tällä jaksolla",

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
  "settings.noAccessTitle": "Asetukset eivät ole käytettävissä roolillasi",
  "settings.noAccessDesc":
    "Tunnuksellasi ei ole oikeutta tarkastella tai muokata yrityksen asetuksia. Pyydä omistajaa tai ylläpitäjää päivittämään ne tai antamaan sinulle ylläpitäjän oikeudet.",
  "settings.siteNoAccessTitle":
    "Toimipisteen asetukset eivät ole käytettävissä roolillasi",
  "settings.siteNoAccessDesc":
    "Vain omistajat ja ylläpitäjät näkevät tämän toimipisteen yritystiedot ja ilmeen. Pyydä tarvittaessa oikeuksia omistajalta tai ylläpitäjältä.",
  "access.requestButton": "Pyydä käyttöoikeutta",
  "access.requestTitle": "Pyydä käyttöoikeutta ylläpitäjältä",
  "access.requestDesc":
    "Lähetämme pyyntösi tämän tilin omistajille ja ylläpitäjille. Kerro lyhyesti, mihin tarvitset oikeudet.",
  "access.requestPlaceholder":
    "Tarvitsen pääsyn asetuksiin, jotta voin päivittää ...",
  "access.requestSubmit": "Lähetä pyyntö",
  "access.requestSending": "Lähetetään ...",
  "access.requestSent": "Pyyntösi lähetettiin omistajille ja ylläpitäjille",
  "access.requestError": "Pyynnön lähetys ei onnistunut",
  "access.requestSentInline":
    "Pyyntö lähetetty. Omistaja tai ylläpitäjä vastaa sinulle.",
  "access.requestSubject": "Käyttöoikeuspyyntö",
  "booking.brandingUnavailable":
    "Omia värejä ja logoa ei voitu ladata, joten sivu käyttää oletusilmettä. Varaaminen toimii normaalisti.",
  "settings.upsellTitle": "Hallinnoi useita toimipisteitä",
  "settings.upsellDesc":
    "Päivitä Business-suunnitelmaan hallinnoidaksesi hotelleja, ravintoloita ja juhlatiloja yhdestä hallintapaneelista. Jokaisella on omat resurssit, aukioloajat ja varaussivu.",
  "settings.learnMore": "Lue lisää",
  "settings.siteOverride": "Toimipisteen mukautus",
  "settings.useParentDefault": "Käytä yrityksen oletusarvoja",
  "settings.customizeForSite": "Mukauta tälle toimipisteelle",
  "settings.inheritedFromParent": "Peritty yrityksen asetuksista",
  "settings.siteSettingsSaved": "Toimipisteen asetukset tallennettu",
  "settings.availabilityThresholds": "Saatavuusrajat",
  "settings.availabilityThresholdsDesc":
    "Varausten määrä, jolloin päivä näytetään kalenterissa 'Täynnä'-tilassa.",
  "settings.fullThreshold": "Täynnä kun",
  "settings.logo": "Logo",
  "settings.uploadLogo": "Lataa logo",
  "settings.uploading": "Ladataan...",
  "settings.logoHint": "PNG, JPG, WebP tai SVG. Maks. 2 Mt.",
  "settings.logoUploaded": "Logo ladattu",
  "settings.logoUploadError": "Logon lataus epäonnistui",
  "settings.logoInvalidType":
    "Virheellinen tiedostotyyppi. Käytä PNG, JPG, WebP tai SVG.",
  "settings.logoTooLarge": "Tiedosto liian suuri. Maks. 2 Mt.",
  "settings.heroImage": "Hero-kuva",
  "settings.uploadHeroImage": "Lataa hero-kuva",
  "settings.heroImageHint":
    "Suositus: 1600×600 px. PNG, JPG tai WebP. Maks. 5 Mt.",
  "settings.heroImageUploaded": "Hero-kuva ladattu",
  "settings.heroImageUploadError": "Hero-kuvan lataus epäonnistui",
  "settings.resourceTypeNames": "Varauskohteiden nimet",
  "settings.resourceTypeNamesDesc":
    "Anna omat näyttönimet varauskohteillesi. Nämä nimet näkyvät julkisella varaussivulla.",
  "settings.reservationTypes": "Varaustyypit",
  "settings.reservationTypesDesc":
    "Valitse, mitä varaustyyppejä yrityksesi tarjoaa. Nämä näkyvät ruutuina julkisella varaussivulla.",
  "settings.reservationTypesLimit": "Tilauksesi sallii enintään {max} tyyppiä.",
  "settings.reservationTypesSaved": "Varaustyypit päivitetty.",
  "settings.reservationTypesUpgrade":
    "Päivitä tilauksesi ottaaksesi käyttöön lisää tyyppejä.",
  "settings.resourceTypeName": "Näyttönimi: {type}",
  "settings.resourceTypeDescPlaceholder": "Oma kuvaus varaussivulle",

  // Booking
  "booking.title": "Tee varaus",
  "booking.selectType": "Mitä haluat varata?",
  "booking.selectLocation": "Valitse toimipiste",
  "booking.allLocations": "Kaikki toimipisteet",
  "booking.atSite": "",
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
  "booking.linkedReservations": "Liitetyt varaukset",
  "booking.addLinked": "Lisää liitetty",
  "booking.linkedHint":
    "Lisää saman vieraan toiseen tyyppiin liittyviä varauksia. Ne jakavat vieraan tiedot ja ryhmitellään yhteen.",
  "booking.closedDay": "Suljettu tänä päivänä.",
  "days.monday": "Maanantai",
  "days.tuesday": "Tiistai",
  "days.wednesday": "Keskiviikko",
  "days.thursday": "Torstai",
  "days.friday": "Perjantai",
  "days.saturday": "Lauantai",
  "days.sunday": "Sunnuntai",
  "openingHours.tooltip":
    "Aseta oletusaukioloajat varaustyypeittäin. Nämä näkyvät julkisella varaussivulla käytettävissä olevina aikoina. Kun luot uuden toimipisteen, nämä oletukset kopioidaan automaattisesti.",
  "openingHours.siteTooltip":
    "Nämä aukioloajat koskevat vain tätä toimipistettä. Ne ohittavat organisaation oletusasetukset.",
  "openingHours.siteOverride":
    "Toimipistekohtaiset aukioloajat (ohittaa oletukset)",
  "openingHours.usingDefaults":
    "Käytetään organisaation oletusarvoja. Tallenna luodaksesi toimipistekohtaiset aukioloajat.",
  "openingHours.resetToDefaults": "Palauta oletukset",
  "openingHours.resetConfirm":
    "Tämä poistaa toimipistekohtaiset aukioloajat ja palauttaa organisaation oletukset.",
  "openingHours.resetDone": "Aukioloajat palautettu organisaation oletuksiin",
  "resourceHours.title": "Aukioloajat",
  "resourceHours.sameEveryDay": "Sama joka päivä",
  "resourceHours.perDay": "Päiväkohtainen",
  "resourceHours.openTime": "Avautuu",
  "resourceHours.closeTime": "Sulkeutuu",
  "resourceHours.sameEveryDayDesc":
    "Samat ajat kaikille avoimille päiville. Voit sulkea yksittäisiä päiviä alla.",
  "resourceHours.removeHours": "Poista aukioloajat",
  "resourceHours.saveFirst":
    "Tallenna resurssi ensin, sitten voit muokata aukioloaikoja.",
  "resourceHours.savedOnCreate":
    "Aukioloajat tallennetaan, kun luot resurssin.",
  "resourceHours.openingHoursLabel": "Aukioloajat",
  "occasionalSlots.title": "Satunnaiset työvuorot",
  "occasionalSlots.description":
    "Satunnaisille työntekijöille. Lisää yksittäisiä päivämääriä ja kellonaikoja, jolloin resurssi on varattavissa viikkoaikataulun lisäksi.",
  "occasionalSlots.addSlot": "Lisää vuoro",
  "occasionalSlots.date": "Päivämäärä",
  "occasionalSlots.from": "Alkaa",
  "occasionalSlots.to": "Päättyy",
  "occasionalSlots.note": "Muistiinpano (valinnainen)",
  "occasionalSlots.notePlaceholder": "esim. vieraileva terapeutti",
  "occasionalSlots.empty": "Ei satunnaisia vuoroja vielä.",
  "occasionalSlots.save": "Tallenna vuoro",
  "occasionalSlots.cancel": "Peruuta",
  "occasionalSlots.remove": "Poista",
  "occasionalSlots.invalidRange":
    "Päättymisajan on oltava alkamisajan jälkeen.",
  "occasionalSlots.pastDate": "Valitse tämä päivä tai myöhempi.",
  "timezone.label": "Aikavyöhyke",
  "timezone.inheritTenant": "Peri organisaatiolta ({tz})",
  "timezone.shownIn": "Ajat näytetään aikavyöhykkeellä {tz}",
  "timezone.fallback": "oletus",
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
  "booking.serviceMisconfigured":
    "Verkkovaraus ei ole tilapäisesti käytettävissä. Varausta ei luotu eikä sinua ole veloitettu. Ota yhteyttä toimipaikkaan suoraan puhelimitse tai sähköpostilla, tai yritä uudelleen muutaman minuutin kuluttua.",
  "booking.serviceMisconfiguredAdmin":
    "Verkkovaraus ei ole tilapäisesti käytettävissä, koska palvelimelta puuttuu service role -avain. Varausta ei luotu. Korjaaminen: avaa Lovable Cloud, mene kohtaan Backend, sitten API keys, kopioi service_role-avain, mene sen jälkeen Backend, Edge Functions, Secrets, ja lisää avain nimellä SUPABASE_SERVICE_ROLE_KEY. Verkkovaraus alkaa toimia heti, kun salaisuus on tallennettu.",
  "booking.misconfigBannerTitle": "Varaus ei ole tilapäisesti käytettävissä",
  "booking.misconfigBannerNoReservation":
    "Varausta ei luotu. Tietojasi ei ole tallennettu eikä sinua ole veloitettu.",
  "booking.misconfigBannerDisabled":
    "Uusi lähetys ei toimi ennen kuin toimipaikka on korjannut palvelimen asetukset.",
  "booking.misconfigBannerTryAgain": "Yritä uudelleen",
  "booking.dateBlocked": "Tämä päivä ei ole varattavissa.",
  "booking.timeBlocked": "Tämä aikaväli ei ole varattavissa.",
  "booking.blocked": "Estetty",
  "booking.fixedPricePlaceholder": "esim. 45,00",
  "booking.thankYou": "Kiitos!",
  "booking.confirmationMsg":
    "Varauksesi on vastaanotettu. Saat vahvistusviestin lähettäjältä {name}.",
  "booking.checkSpam":
    "Jos et näe sähköpostia saapuneissa, tarkista roskaposti- tai roskapostikansio.",
  "booking.duplicateTitle": "Lähetit tämän varauksen jo",
  "booking.duplicateMsg":
    "Löysimme juuri lähettämäsi täysin samanlaisen varauksen, joten säilytimme ensimmäisen emmekä luoneet toista varausta.",
  "booking.duplicateHint":
    "Jos halusit varata lisää, esimerkiksi toisen huoneen tai toisen pöydän, lähetä uusi varaus näillä tiedoilla.",
  "booking.makeAnother": "Tee uusi varaus",
  "booking.addToCalendar": "Lisää kalenteriin",
  "booking.notFound": "Yritystä ei löytynyt",
  "booking.notFoundDesc": "Etsimääsi varaussivua ei ole olemassa.",
  "booking.emailPreviewTitle": "Vahvistussähköpostin esikatselu",
  "booking.whatGuestReceives": "Tämän vierailija saa sähköpostitse:",
  "booking.pricingType": "Hinnoittelu",
  "booking.pricingMenu": "Listan mukaan",
  "booking.pricingFixed": "Kiinteä hinta",
  "booking.pricingQuote": "Pyydä tarjous",
  "booking.pricingQuoteDesc": "Pyydä räätälöity hinta tapahtumaasi",
  "booking.pricingReserveTable": "Varaa pöytä",
  "booking.pricingReserveTableDesc": "Varaa pöytä ja tilaa listalta",
  "booking.pricingSetMenu": "Valmis menu",
  "booking.pricingSetMenuDesc": "Ennalta sovittu menu kiinteään hintaan",
  "booking.fixedPrice": "Kiinteä hinta (€)",
  "booking.restaurantSubType": "Palvelutyyppi",
  "booking.subTypeDineIn": "Ravintolassa",
  "booking.subTypeCatering": "Catering",
  "booking.subTypePopup": "Pop-up ravintola",
  "booking.subTypeDineInDesc": "Varaa pöytä ravintolasta",
  "booking.subTypeCateringDesc": "Tilaa catering tapahtumaasi",
  "booking.subTypePopupDesc":
    "Tarvitsetko ruokatarjoilua tapahtumaasi? Tulemme mielellämme!",
  "booking.cateringQuoteDesc":
    "Kerro tapahtumastasi, niin laadimme sinulle räätälöidyn tarjouksen.",
  "booking.cateringDetails": "Catering-tiedot",
  "booking.deliveryAddress": "Tapahtuman / toimituksen osoite",
  "booking.dietaryNotes": "Ruokavaliot ja allergiat",
  "booking.equipmentNeeded": "Tarjoiluvälineet tarvitaan",
  "booking.staffNeeded": "Tarjoiluhenkilökunta tarvitaan",
  "booking.popupDetails": "Tapahtuman tiedot",
  "booking.festivalName": "Tapahtuman / festivaalin nimi",
  "booking.stallSize": "Tarvittava tilan koko",
  "booking.stallSizeSmall": "Pieni (2×2 m)",
  "booking.stallSizeMedium": "Keskikokoinen (3×3 m)",
  "booking.stallSizeLarge": "Suuri (4×4 m)",
  "booking.electricityNeeded": "Sähköliitäntä tarvitaan",
  "booking.waterNeeded": "Vesiliitäntä tarvitaan",
  "booking.foodPermits": "Elintarvikeluvat / todistukset",
  "booking.stallFee": "Pystytysmaksu (€)",
  "email.subject": "Aihe",
  "email.confirmationSubject": "Varausvahvistus",
  "email.confirmationTitle": "Varaus vahvistettu!",
  "email.greeting": "Hyvä",
  "email.confirmationBody":
    "Meillä on ilo vahvistaa varauksenne. Tässä ovat tiedot:",
  "email.confirmationFooter":
    "Jos sinulla on kysyttävää, ota rohkeasti yhteyttä. Odotamme innolla vierailuasi!",
  "email.cancellationSubject": "Varauksen peruutus",
  "email.cancellationTitle": "Varaus peruutettu",
  "email.cancellationBody":
    "Valitettavasti varauksesi on peruutettu. Tässä olivat varauksen tiedot:",
  "email.cancellationFooter":
    "Jos uskot tämän olevan virhe tai haluat tehdä uuden varauksen, ota meihin yhteyttä.",
  "email.confirmationTab": "Vahvistus",
  "email.cancellationTab": "Peruutus",
  "email.at": "klo",
  "email.duration": "Kesto",
  "email.preview": "Sähköpostin esikatselu",
  "email.customMessage": "Mukautettu viesti",
  "email.customMessagePlaceholder":
    "Lisää henkilökohtainen viesti sähköpostiin...",
  "email.editDetails": "Muokkaa tietoja",
  "email.previewTab": "Sähköpostin esikatselu",

  "admin.addUser": "Lisää käyttäjä",
  "admin.role": "Rooli",
  "admin.staff": "Henkilökunta",
  "admin.invalidCustomRole":
    "Tätä mukautettua roolia ei voi määrittää. Valitse rooli, jonka hierarkiataso on 10 tai alempi, eikä se ole owner tai superadmin.",

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
  "admin.userManagementDesc":
    "Hallitse tiimin jäseniä, rooleja ja käyttöoikeuksia.",
  "admin.staffLimitReached":
    "Henkilökunnan käyttäjäraja saavutettu. Päivitä sopimustasi lisätäksesi käyttäjiä.",
  "admin.approvedUsers": "Hyväksytyt käyttäjät",
  "admin.colName": "Nimi",
  "admin.colEmail": "Sähköposti",
  "admin.colRole": "Rooli",
  "admin.colStatus": "Tila",
  "admin.colActions": "Toiminnot",
  "admin.colSites": "Toimipisteet",
  "admin.siteAssignments": "Toimipisteiden käyttöoikeudet",
  "admin.siteAssignmentsUpdated": "Toimipisteiden käyttöoikeudet päivitetty",
  "admin.usersAssigned": "käyttäjää osoitettu",
  "admin.noSitesAvailable": "Ei aktiivisia toimipisteitä",
  "admin.statusApproved": "Hyväksytty",
  "admin.statusPending": "Odottaa",
  "admin.confirmRemove": "Oletko varma?",
  "admin.confirmRemoveDesc":
    "Haluatko varmasti poistaa tämän käyttäjän? Toimintoa ei voi perua.",
  "admin.cancel": "Peruuta",
  "admin.remove": "Poista",
  "admin.supportRequests": "Avustajapyynnöt",
  "admin.noSupportRequests": "Ei avustajapyyntöjä vielä.",
  "admin.supportRequestsDesc":
    "Business-tason käyttäjät voivat lähettää pyyntöjä chat-widgetin kautta.",
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
  "admin.permissionCol": "Oikeus",
  "admin.permTooltip":
    "Määritä mitä kukin rooli voi käyttää. Omistajalla on aina täydet oikeudet. Vaihda yksittäisiä oikeuksia Admin-, Staff- ja mukautetuille rooleille.",
  "admin.deleteRoleTitle": 'Poistetaanko rooli "{name}"?',
  "admin.deleteRoleDesc":
    "Tämä poistaa pysyvästi tämän mukautetun roolin ja kaikki sen oikeudet. Tähän rooliin määritetyt käyttäjät menettävät pääsynsä.",
  "admin.roleDeleted": "Rooli poistettu",
  "admin.roleRenamed": "Rooli nimetty uudelleen",
  "admin.roleKeyHint": "Sisäisesti käytettävä yksilöllinen tunniste",
  "admin.clickToRename": "Napsauta nimetäksesi uudelleen",
  "admin.catReservations": "Varaukset",
  "admin.catResources": "Resurssit",
  "admin.catCalendar": "Kalenteri",
  "admin.catReports": "Raportit",
  "admin.catSettings": "Asetukset",
  "admin.catAdmin": "Ylläpito",
  "admin.catSupport": "Tuki",
  "admin.permViewReservations": "Näytä varaukset",
  "admin.permCreateReservations": "Luo varauksia",
  "admin.permEditReservations": "Muokkaa varauksia",
  "admin.permDeleteReservations": "Poista varauksia",
  "admin.permViewResources": "Näytä resurssit",
  "admin.permManageResources": "Hallitse resursseja",
  "admin.permViewCalendar": "Näytä kalenteri",
  "admin.permViewReports": "Näytä raportit",
  "admin.permViewSettings": "Näytä asetukset",
  "admin.permManageSettings": "Hallitse asetuksia",
  "admin.permViewAdmin": "Näytä ylläpitopaneeli",
  "admin.permManageAdmin": "Hallitse käyttäjiä ja rooleja",
  "admin.permViewSupport": "Näytä tukipyynnöt",
  "admin.permManageSupport": "Vastaa tukipyyntöihin",
  "admin.catSites": "Toimipisteet",
  "admin.permViewSites": "Näytä toimipisteet",
  "admin.permManageSites": "Luo ja muokkaa toimipisteitä",
  "admin.permApproveSites": "Hyväksy toimipistemuutokset",

  "hero.badge": "Nyt betassa. 30 päivän ilmainen kokeilu",
  "hero.title": "Majoitus- ja ravitsemus- ja palvelualan",
  "hero.titleHighlight": "varausten hallintatyökalu",
  "hero.subtitle":
    "Käsittele ja hoida palvelusi varauksia, ravintolavarauksia, tapahtumapaikkojen tiedusteluja sekä hotelli- tai majatalovarauksia yhden hallintapaneelin avulla. Voit luoda omat brändätyt varaussivut, lähettää automaattisia sähköposteja vahvistuksiin. Hintaan sisältyy myös käyttäjähallinta.",
  "hero.viewPricing": "Näytä hinnat",

  // Features
  "features.title": "Kaikki mitä tarvitset varaustesi hallintaan",
  "features.subtitle":
    "Täydellinen varaussivusto majoitus- ja ravitsemusalan yrityksille.",
  "features.smartReservations": "Varaukset",
  "features.smartReservationsDesc":
    "Hoida ravintolavaraukset, tilojen tiedustelut, majatalomajoituksia ja hyvinvointipalveluiden ajanvarauksia samasta hallintapaneelista.",
  "features.customBranding": "Räätälöi oman brändisi mukaiseksi",
  "features.customBrandingDesc":
    "Oma logosi, värisi, kuvasi. Jokainen varaussivu yrityksesi brändin mukaisena.",
  "features.teamManagement": "Käyttäjähallinta",
  "features.teamManagementDesc":
    "Lisää henkilökuntaa, määritä rooleja ja hallinnoi käyttöoikeuksia helposti.",
  "features.brandedPages": "Varaustyypit",
  "features.brandedPagesDesc":
    "Hotelli/majatalo, ravintola, tilat tapahtumiin sekä palvelualan ammattilaiset, kuten hierojat, parturit, kampaajat, leipurit, meikkaajat, hoitojen tarjoajat ja personal trainerit.",
  "features.reportsInsights": "Raportointi",
  "features.reportsInsightsDesc":
    "Seuraa varauksia, käyttöasteita ja tuloja yhdellä silmäyksellä.",
  "features.automatedEmails": "Automaattiset sähköpostit",
  "features.automatedEmailsDesc":
    "Lähetä vahvistus-, muistutus- ja peruutussähköpostit automaattisesti.",

  // How it works
  "howItWorks.title": "Käyttöönotto on helppoa ja nopeaa",
  "howItWorks.subtitle":
    "Kolme helppoa askelta ja voit alkaa vastaanottamaan verkkovarauksia.",
  "howItWorks.step1Title":
    "Rekisteröidy ja valitse yrityksellesi sopiva palvelupaketti",
  "howItWorks.step1Desc": "Luo tili ja aloita 30 päivän ilmainen kokeilujakso.",
  "howItWorks.step2Title": "Luo yrityksesi alustalle",
  "howItWorks.step2Desc":
    "Lataa brändisi, lisää toimipisteesi ja toimintasi sekä määritä aukioloajat, hinnoittelu, käyttöaste ja paljon muuta.",
  "howItWorks.step3Title": "Jaa varauslinkkisi",
  "howItWorks.step3Desc":
    "Jaa yrityksesi räätälöity varaussivu asiakkaille suoraan sekä lisää se kotisivuillesi ja aloita varausten vastaanottaminen.",

  // Pricing
  "pricing.title": "Yksinkertainen ja läpinäkyvä hinnoittelu",
  "pricing.subtitle":
    "Aloita 30 päivän ilmaisella kokeilujaksolla. Korota seuraavaan tasoon tai peruuta milloin tahansa.",
  "pricing.simpleTitle": "Yksinkertainen ja läpinäkyvä hinnoittelu",
  "pricing.simpleSubtitle":
    "Aloita 30 päivän ilmaisella kokeilujaksolla. Korota seuraavaan tasoon tai peruuta milloin tahansa.",
  "pricing.comparePlans": "Vertaile eri tasoja",
  "pricing.plansTitle": "Valitse sopiva taso",
  "home.videoTitle": "Katso MimmoBook toiminnassa",
  "pricing.faq": "Usein kysytyt kysymykset",
  "pricing.feature": "Ominaisuus",
  "pricing.monthlyPrice": "Kuukausihinta",
  "pricing.freeTrial": "Ilmainen kokeilujakso",
  "pricing.days30": "30 päivää",
  "pricing.reservationTypes": "Varaustyypit",
  "pricing.staffUsers": "Henkilökunnan määrä",
  "pricing.trialIncluded": "30 päivän ilmainen kokeilu",
  "pricing.perMonth": "/kk",
  "pricing.mostPopular": "Suosituin",
  "pricing.ctaTitle": "Aloita ilmainen kokeilusi tänään",
  "pricing.ctaSubtitle": "Käyttövalmis nopeasti ja helposti.",

  // CTA
  "cta.title": "Valmis modernisoimaan varauksesi?",
  "cta.subtitle":
    "Liity hyvinvointi- ja majoitusalan yrityksiin, jotka jo käyttävät MimmoBookia varausten sujuvoittamiseen.",

  // Login
  "login.title": "Kirjaudu tilillesi",
  "login.subtitle": "Syötä tunnuksesi päästäksesi hallintapaneeliin.",
  "login.welcomeBack": "Tervetuloa takaisin",
  "login.welcomeBackSubtitle": "Kirjaudu hallitsemaan varauksiasi ja tiimiäsi.",
  "login.forgotPassword": "Unohditko salasanan?",
  "login.noAccount": "Eikö sinulla ole tiliä?",
  "login.loggingIn": "Kirjaudutaan...",
  "login.orContinueWith": "Tai jatka palvelulla",
  "login.continueGoogle": "Jatka Googlella",
  "login.continueApple": "Jatka Applella",
  "login.haveCode": "Onko sinulla koodi?",
  "login.codePlaceholder": "Syötä pääsy- tai alennuskoodi",
  "login.codeHint":
    "Beta-, pääsy- tai alennuskoodi — se käytetään kirjautumisen jälkeen.",
  "login.codeRedeemed": "Koodi lunastettu onnistuneesti!",
  "login.codeRedeemFailed":
    "Koodia ei voitu lunastaa. Voit yrittää uudelleen hallintapaneelista.",

  // Signup
  "signup.title": "Luo tilisi",
  "signup.subtitle":
    "Aloita 30 päivän ilmainen kokeilu, luottokorttia ei tarvita.",
  "signup.heroTitle": "Aloita varausten hallinta tänään",
  "signup.heroSubtitle":
    "30 päivän ilmainen kokeilu. Ei luottokorttia tarvita. Käyttövalmis minuuteissa.",
  "signup.businessName": "Yrityksen nimi",
  "signup.yourName": "Nimesi",
  "signup.creatingAccount": "Luodaan tiliä...",
  "signup.alreadyHaveAccount": "Onko sinulla jo tili?",
  "signup.accountCreated":
    "Tili luotu! Tarkista sähköpostisi ja vahvista tilisi ennen kirjautumista.",
  "signup.orContinueWith": "Tai rekisteröidy palvelulla",
  "signup.continueGoogle": "Rekisteröidy Googlella",
  "signup.continueApple": "Rekisteröidy Applella",

  // Forgot password
  "forgot.title": "Nollaa salasanasi",
  "forgot.subtitle":
    "Syötä sähköpostisi ja lähetämme sinulle linkin salasanan nollaamiseen.",
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
  "dashboard.sendReminder": "Lähetä muistutus",
  "dashboard.reminderSent": "Muistutus lähetetty",
  "dashboard.reminderSentAt": "Muistutus lähetetty",
  "dashboard.confirmationSentAt": "Vahvistus lähetetty",
  "dashboard.cancellationSentAt": "Peruutus lähetetty",
  "dashboard.reminderError": "Muistutuksen lähetys epäonnistui",
  "dashboard.sendReminderMsg":
    "Lähetä muistutussähköposti vieraalle tästä varauksesta?",
  "dashboard.notCheckedIn": "Ei kirjautunut",
  "dashboard.todayFilter": "Tänään",
  "dashboard.activeResources": "Aktiiviset resurssit",
  "dashboard.bookingLink": "Varauslinkki",
  "dashboard.bookingLinkDesc":
    "Jaa tämä linkki asiakkaillesi, jotta he voivat tehdä varauksia.",
  "dashboard.shareTitle": "Lisää varaus omille verkkosivuillesi",
  "dashboard.shareDesc":
    "Voit lisätä varaussivun omille sivuillesi alasivuna, painikkeena tai omalla verkko-osoitteella.",
  "dashboard.shareTabEmbed": "Liitä sivuillesi",
  "dashboard.shareTabButton": "Linkki ja painike",
  "dashboard.shareTabDomain": "Oma osoite",
  "dashboard.shareEmbedDesc":
    "Liitä tämä sille sivulle, jolla haluat varauksen näkyvän, esimerkiksi sivustosi.fi/varaa. Lomake näkyy omalla sivullasi ilman meidän ylä- ja alapalkkia.",
  "dashboard.shareEmbedHint":
    "Säädä korkeutta tarvittaessa. Värit, logo ja hinnat tulevat automaattisesti mukaan.",
  "dashboard.shareButtonDesc":
    "Liitä tämä kohtaan, jossa haluat Varaa nyt -painikkeen, tai käytä pelkkää alla olevaa osoitetta.",
  "dashboard.shareButtonHint":
    "Varaussivu avautuu uuteen välilehteen, joten omat sivusi jäävät auki.",
  "dashboard.shareButtonLabel": "Varaa nyt",
  "dashboard.shareDomainDesc":
    "Voit käyttää myös omaa verkko-osoitetta, esimerkiksi varaa.sivustosi.fi.",
  "dashboard.shareDomainStep1":
    "Kirjaudu sinne, missä verkkotunnustasi hallitaan, esimerkiksi verkkotunnuksen tarjoajalle tai sivustosi ylläpitoon.",
  "dashboard.shareDomainStep2":
    "Tee ohjaus osoitteesta varaa.sivustosi.fi alla olevaan osoitteeseen.",
  "dashboard.shareDomainStep3":
    "Tallenna ja odota hetki, kokeile sitten osoitetta selaimessa.",
  "dashboard.shareDomainHint":
    "Ohjauksen jälkeen asiakas päätyy varaussivullesi, mutta selaimen osoitepalkissa näkyy meidän osoite. Jos haluat oman osoitteen pysyvän näkyvissä, käytä liittämistä sivuillesi.",
  "dashboard.shareCopyCode": "Kopioi koodi",
  "dashboard.shareCopyAddress": "Kopioi osoite",
  "dashboard.shareIframeTitle": "Verkkovaraus",
  "dashboard.allServices": "Kaikki palvelut",
  "dashboard.byServiceType": "Palvelutyypin mukaan",
  "dashboard.byLocation": "Sijainnin mukaan",
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
  "dashboard.noResources":
    "Ei resursseja vielä. Lisää ensimmäinen huone, pöytä tai tila.",
  "dashboard.capacity": "kapasiteetti",
  "dashboard.perNight": "/yö",
  "dashboard.resourceCreated": "Resurssi luotu",
  "dashboard.resourceUpdated": "Resurssi päivitetty",
  "dashboard.resourceDeleted": "Resurssi poistettu",
  "dashboard.copyResource": "Kopioi resurssi",
  "dashboard.copyResourceDesc":
    "Kuinka monta kopiota haluat luoda resurssista?",
  "dashboard.copyCount": "Kopioiden määrä",
  "dashboard.resourcesCopied": "Resurssit kopioitu",
  "booking.stayDetails": "Majoitustiedot",
  "dashboard.uploadImage": "Lataa kuva",
  "dashboard.imageUploaded": "Kuva ladattu",
  "dashboard.imageUploadError": "Kuvan lataus epäonnistui",
  "dashboard.restaurant": "Ravintola",
  "dashboard.venue": "Tila",
  "dashboard.guesthouse": "Hotelli / Majatalo",
  "dashboard.hotel": "Hotelli",
  "dashboard.wellness": "Hyvinvointipalvelut",
  "dashboard.custom": "Lisää oma",
  "dashboard.checkoutToday": "Uloskirjaukset tänään",
  "dashboard.editReservation": "Muokkaa varausta",
  "dashboard.reservationUpdated": "Varaus päivitetty",
  "dashboard.reservationUpdateError": "Varauksen päivitys epäonnistui",
  "dashboard.checkOutDate": "Lähtöpäivä",
  "dashboard.priceEur": "Hinta (EUR)",
  "dashboard.internalNotes": "Sisäiset muistiinpanot",
  "dashboard.staffNotes": "Henkilökunnan muistiinpanot",
  "dashboard.gallery": "Kuvagalleria",
  "dashboard.galleryHint":
    "Enintään 5 kuvaa. PNG, JPG tai WebP. Max 5 MB/kuva.",
  "dashboard.imageDeleted": "Kuva poistettu",
  "dashboard.maxImages": "Enintään 5 kuvaa",
  "dashboard.roomMultipliers": "Huonetyyppien hintakertoimet",
  "dashboard.roomMultipliersDesc":
    "Kerrotaan yöhinnalla. Esim. 1,5× ja €100 pohja = €150.",
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
  "autoReminder.title": "Automaattimuistutukset",
  "autoReminder.tooltip":
    "Muistutussähköpostit lähetetään automaattisesti 24 tuntia ennen vahvistettua varausta.",
  "autoReminder.hourly": "Tunneittain",
  "autoReminder.nextRun": "Seuraava erä",
  "autoReminder.active": "Aktiivinen",
  "autoReminder.recentLog": "Viimeksi lähetetyt",
  "autoReminder.sent7d": "viim. 7 päivänä",
  "autoReminder.noRecent": "Ei muistutuksia viimeisen 7 päivän aikana.",
  "notifications.title": "Ilmoitukset",
  "notifications.empty": "Ei ilmoituksia vielä.",
  "notifications.markAllRead": "Merkitse kaikki luetuksi",
  "notifications.markRead": "Merkitse luetuksi",
  "notifications.used": "Varaus merkitty käytetyksi",
  "notifications.invoiced": "Varaus merkitty laskutetuksi",
  "dashboard.used": "Käytetty",
  "dashboard.invoiced": "Laskutettu",
  "invoiceRefusal.NO_PRICE":
    "Varauksella ei ole vielä hintaa, joten sitä ei voi merkitä laskutetuksi. Lisää hinta ensin.",
  "invoiceRefusal.AMOUNT_MISMATCH":
    "Summa ei vastaa uudelleen laskettuja huone- ja aamiaissummia. Korjaa hinta ja yritä uudelleen.",
  "invoiceRefusal.INVOICED_LOCKED":
    "Varaus on jo laskutettu, joten muutos jättäisi summat ristiriitaisiksi.",
  "invoiceRefusal.NOT_PERMITTED":
    "Tunnuksellasi ei ole oikeutta muuttaa tämän varauksen laskutustilaa.",
  "invoiceRefusal.UNKNOWN": "Laskutustilaa ei voitu päivittää.",
  "invoiceRefusal.serverReasonLabel": "Syy:",
  "invoiceRefusal.guestNotice":
    "Varaus on jo laskutettu, joten sitä ei voi enää muuttaa täällä. Ota yhteyttä meihin suoraan.",
  "invoiceRefusal.CANCELLED":
    "Varaus on peruttu, joten sen laskutustilaa ei voi muuttaa.",
  "invoiceRefusal.NOT_FOUND":
    "Varausta ei enää löytynyt. Päivitä lista ja yritä uudelleen.",
  "invoiceRefusal.SESSION_EXPIRED":
    "Istuntosi vanheni ennen tallennusta. Kirjaudu uudelleen ja yritä sitten uudestaan.",
  "invoiceRefusal.OFFLINE":
    "Muutos ei tavoittanut palvelinta. Tarkista yhteys ja yritä uudelleen.",
  "invoiceRefusal.RATE_LIMITED":
    "Liian monta yritystä lyhyessä ajassa. Odota hetki ja yritä uudelleen.",
  "invoiceRefusal.CONFLICT":
    "Joku muu muutti varausta ensin. Päivitä varaus ja tee muutos uudelleen.",
  "invoiceRefusal.SERVER_ERROR":
    "Palvelin ei saanut muutosta valmiiksi. Yritä hetken kuluttua uudelleen.",
  "invoiceRefusalGuest.NO_PRICE":
    "Varausta ei voi vielä muuttaa täällä. Ota yhteyttä meihin suoraan.",
  "invoiceRefusalGuest.AMOUNT_MISMATCH":
    "Varausta ei voi muuttaa täällä. Ota yhteyttä meihin suoraan.",
  "invoiceRefusalGuest.INVOICED_LOCKED":
    "Varaus on jo laskutettu, joten sitä ei voi enää muuttaa täällä. Ota yhteyttä meihin suoraan.",
  "invoiceRefusalGuest.NOT_PERMITTED":
    "Varausta ei voi enää muuttaa tällä linkillä. Ota yhteyttä meihin suoraan.",
  "invoiceRefusalGuest.CANCELLED":
    "Varaus on jo peruttu, joten muutettavaa ei ole.",
  "invoiceRefusalGuest.NOT_FOUND":
    "Varauslinkki ei ole enää voimassa. Ota yhteyttä meihin suoraan.",
  "invoiceRefusalGuest.SESSION_EXPIRED":
    "Varauslinkki on vanhentunut. Ota yhteyttä meihin suoraan.",
  "invoiceRefusalGuest.OFFLINE":
    "Pyyntösi ei mennyt läpi. Tarkista yhteys ja yritä uudelleen.",
  "invoiceRefusalGuest.RATE_LIMITED":
    "Liian monta yritystä lyhyessä ajassa. Odota hetki ja yritä uudelleen.",
  "invoiceRefusalGuest.CONFLICT":
    "Varausta päivitettiin juuri. Lataa sivu uudelleen ja yritä uudestaan.",
  "invoiceRefusalGuest.SERVER_ERROR":
    "Jokin meni vikaan meidän päässä. Yritä hetken kuluttua uudelleen.",
  "invoiceRefusalGuest.UNKNOWN":
    "Pyyntöä ei voitu suorittaa. Yritä uudelleen tai ota yhteyttä meihin.",
  "dashboard.downloadInvoice": "Lataa lasku",
  "dashboard.downloadInvoicePdf": "Lataa lasku PDF-muodossa",
  "reports.downloadReportPdf": "Lataa raportti PDF-muodossa",
  "dashboard.markLinkedUsed": "Merkitäänkö linkitetyt varaukset käytetyiksi?",
  "dashboard.markLinkedUsedMsg":
    "Tämä varaus on linkitetty tarjoukseen, jossa on muita varauksia. Haluatko merkitä ne kaikki käytetyiksi?",
  "dashboard.markAll": "Merkitse kaikki käytetyiksi",
  "dashboard.markLinkedInvoiced":
    "Merkitäänkö linkitetyt varaukset laskutetuiksi?",
  "dashboard.markLinkedInvoicedMsg":
    "Tämä varaus on linkitetty tarjoukseen, jossa on muita varauksia. Haluatko merkitä ne kaikki laskutetuiksi?",
  "dashboard.markAllInvoiced": "Merkitse kaikki laskutetuiksi",
  "dashboard.total": "yhteensä",
  "dashboard.dailySnapshot": "Päivittäinen tilannekatsaus",
  "dashboard.overviewSubtitle": "Päivittäinen tilannekatsaus",
  "alerts.pendingAction": "varausta odottaa vahvistusta",
  "alerts.uninvoicedAction": "varausta laskuttamatta",
  "alerts.checkoutsAction": "uloskirjausta tänään",
  "alerts.shortcuts": "Pikanäppäimet: Alt+1 to 8 navigointiin",
  "blocking.pendingApproval": "odottaa hyväksyntää",
  "dashboard.calendarHotel": "Hotelli / Majatalo",
  "dashboard.calendarVenue": "Juhlatilat",
  "dashboard.calendarRestaurant": "Ravintola",
  "dashboard.legendHasReservations": "Varauksia",
  "dashboard.legendBlocked": "Estetty",
  "dashboard.legendRecurring": "Toistuva esto",
  "dashboard.legendBoth": "Molemmat",
  "dashboard.calendarTooltip":
    "Klikkaa päivää nähdäksesi sen varaukset. Korostetut päivät sisältävät varauksia. Punaiset päivät sisältävät yksittäisiä estoja. Violetit katkoviivapäivät sisältävät toistuvia estoja.",
  "dashboard.blockDay": "Estä päivä",
  "dashboard.recurringBlocks": "Toistuvat estot",
  "dashboard.blocked": "Estetty",
  "dashboard.allDay": "Koko päivä",
  "dashboard.reservationsLabel": "Varaukset",
  "dashboard.every": "Joka",
  "dashboard.blockTitle": "Estä",
  "dashboard.blockedLabel": "Estetty",
  "dashboard.blockLabel": "Estä",
  "dashboard.blockReason": "Eston syy (valinnainen)",
  "dashboard.unblockAll": "Poista kaikki estot",
  "dashboard.blockRestaurantDay": "Estä ravintola koko päiväksi",
  "dashboard.blockAllTitle": "Estä kaikki",
  "dashboard.resourceManagement": "Resurssien hallinta",
  "dashboard.resourceManagementDesc": "Hallitse tiloja, huoneita ja pöytiä",
  "dashboard.actions": "Toiminnot",
  "dashboard.active": "Aktiivinen",
  "dashboard.serviceOptions": "Lisäpalvelut",
  "dashboard.offersCatering": "Tarjoa catering-palveluita",
  "dashboard.offersPopup": "Tarjoa pop-up ravintolaa tapahtumiin",
  "dashboard.dineInOptions": "Ravintolassa syömisen varausvaihtoehdot",
  "dashboard.offersTableReservation": "Varaa pöytä (tilaus listalta)",
  "dashboard.offersQuote": "Pyydä tarjous (räätälöity hinta)",
  "dashboard.offersSetMenu": "Valmis menu (kiinteä hinta)",
  "dashboard.inactive": "Ei aktiivinen",
  "dashboard.namePlaceholder": "Esim. Juhlasali",
  "dashboard.descriptionPlaceholder": "Lyhyt kuvaus...",
  "dashboard.capacityPlaceholder": "esim. 50",
  "dashboard.pricePlaceholder": "esim. 140",
  "dashboard.breakfastPlaceholder": "esim. 15",
  "dashboard.venuePrice": "Tilahinta (€)",
  "dashboard.roomPrice": "Huonehinta (€/yö)",
  "dashboard.breakfastPrice": "Aamupalahinta (€/hlö/aamu)",
  "dashboard.pricingHint":
    "Oletushinta uusille varauksille. Yksittäisen varauksen hintaa voi muuttaa sisäisissä tiedoissa.",
  "dashboard.roomTypeLabel": "Huonetyyppi",
  "dashboard.bedConfiguration": "Sänkyjen kokoonpano",
  "dashboard.roomDescription": "Huoneen kuvaus",
  "dashboard.roomDescPlaceholder":
    "Kuvaile huoneita, sänkyjen määrä, pohjaratkaisu...",
  "dashboard.addMode": "Lisäystapa",
  "dashboard.addModeIndividual": "Lisää yksi huone",
  "dashboard.addModeBulk": "Lisää useita tyypeittäin",
  "dashboard.bulkRoomType": "Huonetyyppi",
  "dashboard.bulkQuantity": "Määrä",
  "dashboard.bulkAdd": "Lisää huoneet",
  "dashboard.bulkAdded": "Huoneet lisätty",
  "dashboard.bedType": "Sänkytyyppi",
  "dashboard.bedCount": "Määrä",
  "dashboard.addBed": "Lisää sänky",
  "dashboard.roomType.single": "Yhden hengen huone",
  "dashboard.roomType.double": "Kahden hengen huone",
  "dashboard.roomType.twin": "Twin-huone",
  "dashboard.roomType.double_double": "Double Double -huone",
  "dashboard.roomType.triple": "Kolmen hengen huone",
  "dashboard.roomType.quad": "Neljän hengen huone",
  "dashboard.roomType.studio": "Studio-huone",
  "dashboard.roomType.suite": "Sviitti",
  "dashboard.roomType.connecting": "Yhdistettävät huoneet",
  "dashboard.roomType.entire": "Koko kohde",
  "dashboard.bedType.twin_single": "Kapea / yhden hengen sänky",
  "dashboard.bedType.bunk": "Kerrossänky",
  "dashboard.bedType.queen": "Queen-sänky",
  "dashboard.bedType.king": "King-sänky",
  "dashboard.bedType.california_king": "California King",
  "dashboard.bedType.murphy": "Seinäsänky",
  "dashboard.bedType.sofa": "Vuodesohva",
  "dashboard.bedType.trundle": "Alasänky",
  "booking.selectRoomType": "Valitse huonetyyppi",
  "booking.roomTypeLabel": "Huonetyyppi",
  "blocking.title": "Estetyt päivät ja ajat",
  "blocking.tooltip":
    "Estä kokonaisia resurssityyppejä tai yksittäisiä resursseja valituille päiville tai ajanjaksoille. Voit rajata myös tiettyihin tunteihin.",
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
  "blocking.dateHint":
    "Klikkaa kerran yksittäiselle päivälle tai klikkaa kaksi päivää valitaksesi jakso.",
  "blocking.duration": "Kesto",
  "blocking.fullDay": "Koko päivä",
  "blocking.specificHours": "Tietyt tunnit",
  "blocking.startTime": "Alkuaika",
  "blocking.endTime": "Loppuaika",
  "blocking.timeHint":
    "Vain valitut tunnit estetään. Varaukset muina aikoina ovat mahdollisia.",
  "blocking.reason": "Syy (valinnainen)",
  "blocking.reasonPlaceholder": "esim. Huolto, Yksityistilaisuus...",
  "blocking.creating": "Luodaan...",
  "blocking.createBlock": "Luo esto",
  "blocking.blockDays": "Estä {count} päivää",
  "blocking.daysBlocked": "{count} päivä(ä) estetty",
  "blocking.blockRemoved": "Esto poistettu",
  "occasions.title": "Erikoistilaisuudet",
  "occasions.subtitle":
    "Tapahtumapäivät, kuten äitienpäivälounas tai joulullinen illallinen. Vieraat voivat varata tilaisuuden varaussivullasi tavallisten varausten rinnalla.",
  "occasions.add": "Lisää tilaisuus",
  "occasions.editTitle": "Muokkaa tilaisuutta",
  "occasions.name": "Tilaisuuden nimi",
  "occasions.namePlaceholder": "Esimerkiksi joulullinen illallinen",
  "occasions.description": "Kuvaus vieraille",
  "occasions.descriptionPlaceholder":
    "Menu, ohjelma tai muu vieraiden hyvä tietää",
  "occasions.date": "Päivä",
  "occasions.service": "Palvelu",
  "occasions.resource": "Tila tai huone",
  "occasions.anyResource": "Ei sidottu yhteen tilaan",
  "occasions.bookingType": "Miten vieraat varaavat",
  "occasions.seatings": "Kiinteät kattaukset",
  "occasions.openBooking": "Vapaa varaus",
  "occasions.capacityPerSeating": "Paikkoja kattausta kohden",
  "occasions.capacityPerDay": "Paikkoja koko tilaisuuteen",
  "occasions.capacityHintSeatings":
    "Jokaiseen kattaukseen mahtuu näin monta vierasta.",
  "occasions.capacityHintOpen":
    "Kaikki tilaisuuden varaukset jakavat nämä paikat.",
  "occasions.seatingTimes": "Kattausajat",
  "occasions.addTime": "Lisää aika",
  "occasions.active": "Näkyy vieraille",
  "occasions.inactive": "Piilotettu",
  "occasions.save": "Tallenna tilaisuus",
  "occasions.cancel": "Peruuta",
  "occasions.delete": "Poista",
  "occasions.deleteConfirm":
    "Poistetaanko tämä tilaisuus? Jo tehdyt varaukset jäävät listallesi.",
  "occasions.saved": "Tilaisuus tallennettu",
  "occasions.deleted": "Tilaisuus poistettu",
  "occasions.empty": "Ei vielä erikoistilaisuuksia.",
  "occasions.seats": "paikkaa",
  "occasions.seatsPerSeating": "{cap} paikkaa kattausta kohden",
  "occasions.nameRequired": "Anna tilaisuudelle nimi",
  "occasions.dateRequired": "Valitse päivä",
  "occasions.timesRequired": "Lisää vähintään yksi kattausaika",
  "booking.occasionSectionTitle": "Erikoistilaisuus tänä päivänä",
  "booking.occasionHint":
    "Valitse tilaisuus tai jatka tavallisella varauksella.",
  "booking.occasionNormal": "Tavallinen varaus",
  "booking.occasionSeating": "Kattausaika",
  "booking.occasionSeatsLeft": "{count} paikkaa vapaana",
  "booking.occasionFull": "Täyteen varattu",
  "booking.occasionOpenHint": "Valitse mikä tahansa aika päivän aikana.",
  "booking.occasionSeatingRequired": "Valitse kattausaika",
  "booking.occasionErrUnavailable":
    "Tätä tilaisuutta ei voi enää varata. Valitse toinen tilaisuus tai varaa tavallinen aika.",
  "booking.occasionErrWrongDate":
    "Tilaisuus järjestetään toisena päivänä. Valitse sen oma päivä tai varaa tälle päivälle tavallinen aika.",
  "booking.occasionErrWrongType":
    "Tätä tilaisuutta ei tarjota tälle palvelulle. Valitse toinen tilaisuus tai varaa tavallinen aika.",
  "booking.occasionErrSeatingRequired":
    "Valitse tilaisuuden kattausaika ennen varauksen lähettämistä.",
  "booking.occasionErrSeatingUnavailable":
    "Tämä kattausaika ei ole enää saatavilla. Valitse jokin tilaisuudelle näytetyistä ajoista.",
  "booking.occasionErrFull":
    "Tilaisuus on nyt täynnä. Valitse toinen kattausaika tai toinen päivä.",
  "booking.occasionErrFullWithSeats":
    "Tilaisuuteen on jäljellä vain {seats} paikkaa, joten seurueesi ei mahdu. Kokeile pienempää seuruetta, toista kattausaikaa tai toista päivää.",
  "booking.occasionNoneOnDate":
    "Tälle päivälle ei ole erityistilaisuutta, joten voit varata tavallisen ajan alta.",
  "booking.occasionNextDates": "Seuraavat tilaisuudet: {dates}",
  "monitor.title": "Hylätyt varaukset",
  "monitor.subtitle": "Miksi varauksia hylättiin varaussivullasi",
  "monitor.days": "{days} päivää",
  "monitor.refresh": "Päivitä",
  "monitor.loading": "Haetaan...",
  "monitor.empty": "Ei hylättyjä varauksia tällä ajanjaksolla.",
  "monitor.total": "{count} hylättyä varausta yhteensä",
  "monitor.lastSeen": "Viimeksi: {when}",
  "monitor.code.OCCASION_FULL": "Tilaisuus oli täynnä",
  "monitor.code.OCCASION_SEATING_UNAVAILABLE":
    "Kattaus ei ollut enää saatavilla",
  "monitor.code.OCCASION_SEATING_REQUIRED": "Kattausta ei valittu",
  "monitor.code.OCCASION_WRONG_DATE": "Tilaisuus oli eri päivänä",
  "monitor.code.OCCASION_WRONG_TYPE": "Tilaisuus koski toista palvelua",
  "monitor.code.OCCASION_UNAVAILABLE": "Tilaisuus ei ollut enää saatavilla",
  "monitor.code.DB_INSERT_FAILED": "Varausta ei voitu tallentaa",
  "monitor.code.UNTAGGED": "Muu syy",

  "blocking.blocksRemoved": "Estot poistettu",
  "blocking.removeBlock": "Poista esto",
  "blocking.removeBlockDesc":
    "Tämä poistaa eston päivälle {date}. Varaukset ovat jälleen mahdollisia.",
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
  "blocking.wellness": "Hyvinvointipalvelut",
  "blocking.restaurant": "Ravintola",
  "blocking.venueEventSpace": "Juhlatilat",
  "blocking.room": "huone",
  "blocking.tableArea": "pöytä/alue",
  "blocking.eventSpace": "juhlatila",
  "blocking.recurringTitle": "Toistuvat estot",
  "blocking.recurringTooltip":
    "Estä tietyt viikonpäivät toistuvasti. Esim. estä joka maanantai ravintolalle.",
  "blocking.addRecurring": "Lisää toistuva esto",
  "blocking.addRecurringTitle": "Lisää toistuva esto",
  "blocking.daysOfWeek": "Viikonpäivät",
  "blocking.recurringTimeHint":
    "Vain valitut tunnit estetään joka viikko. Varaukset muina aikoina ovat mahdollisia.",
  "blocking.recurringReasonPlaceholder":
    "esim. Suljettu maanantaisin, Vapaapäivä...",
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
  "onboarding.choosePlanSubtitle":
    "Kaikki suunnitelmat sisältävät 30 päivän ilmaisen kokeilun.",
  "onboarding.whatDoYouNeed": "Mitä tarvitset?",
  "onboarding.whatDoYouNeedSubtitle":
    "Valitse yrityksellesi sopivat varaustyypit.",
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
  "onboarding.customDesc":
    "Määritä oma tyyppi, kuten Spa tai Työpajat, ja valinnaiset alipalvelut.",
  "onboarding.wellnessDesc":
    "Kampaajat, hierojat, meikkitaiteilijat. Asiakkaat valitsevat palvelut valikoimasta, varauksen kesto mukautuu.",
  "booking.subServices": "Valitse palvelut",
  "booking.subServiceQty": "Määrä",
  "dashboard.customTypeLabel": "Tyypin nimi",
  "dashboard.customTypeLabelHelp":
    "Mitä asiakkaat näkevät, esim. Spa, Työpajat, Kierrokset.",
  "dashboard.subServices": "Alipalvelut",
  "dashboard.addSubService": "Lisää alipalvelu",
  "dashboard.subServiceName": "Nimi",
  "dashboard.subServicePrice": "Hinta (€)",
  "dashboard.subServiceDuration": "Kesto (min)",
  "dashboard.wellnessServicesHint":
    "Asiakkaat voivat valita yhden tai useamman palvelun varatessaan. Jokaisella palvelulla on kesto 5 minuutin välein (5 to 480 minuuttia).",
  "booking.servicesMenu": "Valitse palvelut",
  "booking.servicesMenuHelp":
    "Rastita haluamasi palvelut. Kokonaiskesto ja hinta päivittyvät automaattisesti.",
  "booking.totalDuration": "Kokonaiskesto",
  "booking.totalPrice": "Yhteensä",
  "booking.noServicesYet":
    "Palveluntarjoaja ei ole vielä lisännyt palveluvalikoimaa. Voit silti varata ajan alta.",
  // Tiers
  "tier.basic": "Basic",
  "tier.basicDesc":
    "Täydellinen yhdelle hotellille, ravintolalle tai tapahtumapaikalle.",
  "tier.pro": "Protaso",
  "tier.proDesc":
    "Yrityksille, jotka tarjoavat hotelli-, ravintola- ja tapahtumatilapalvelun yhdessä paikassa.",
  "tier.professional": "Professional",
  "tier.professionalDesc": "Useita varaustyyppejä, tiiminhallinta.",
  "tier.business": "Business taso",
  "tier.businessDesc":
    "Monin ominaisuuksin varusteltu alusta yrityksille, joilla on useampia toimipisteitä ja toimintoja.",

  // Footer
  "footer.tagline":
    "Moderni varausalusta ravintoloille, tiloille ja majataloille sekä palvelualan ammattilaisille.",
  "footer.product": "Tuote",
  "footer.company": "Yritys",
  "footer.legal": "Juridiikka",
  "footer.featuresComingSoon": "Ominaisuudet",
  "footer.aboutComingSoon": "Tietoa meistä",
  "footer.contactComingSoon": "Yhteystiedot",
  "footer.privacyPolicy": "Tietosuojakäytäntö",
  "footer.termsOfService": "Käyttöehdot",
  "footer.allRightsReserved": "Kaikki oikeudet pidätetään.",

  "nav.about": "Tietoa meistä",
  "nav.accessibility": "Saavutettavuus",

  "about.heroBadge": "Tarinamme",
  "about.heroTitle": "Huolella rakennettu varausjärjestelmä",
  "about.heroSubtitle":
    "Autamme majoitusalan yrityksiä hallitsemaan varauksiaan vaivattomasti, jotta he voivat keskittyä luomaan unohtumattomia vieraskokemuksia.",
  "about.missionBadge": "Missiomme",
  "about.missionTitle": "Varausten hallinta yksinkertaiseksi ja helpoksi",
  "about.missionP1":
    "Pienet majoitusalan yritykset ansaitsevat käytännöllisiä ja informatiivisia työkaluja toimiakseen tehokkaammin. Siksi loimme MimmoBookin.",
  "about.missionP2":
    "Alustamme yhdistää varaukset, brändäyksen ja raportoinnin yhteen työkaluun, poistaen hajallaan olevat muistivihot ja unohtuneet varaukset.",
  "about.point1Title": "Nopeutta ilman kompromisseja",
  "about.point1Desc":
    "Saat brändätyn varaussivun käyttöön päivässä tai kahdessa, ei viikoissa.",
  "about.point2Title": "Tietoon perustuvat päätökset",
  "about.point2Desc":
    "Seuraa varauksia, käyttöastetta ja liikevaihtoa yhdellä silmäyksellä.",
  "about.point3Title": "Rakennettu tiimeille",
  "about.point3Desc":
    "Roolipohjainen pääsy ja monihenkilöstötuki sisäänrakennettuna.",
  "about.valuesTitle": "Ydinarvomme",
  "about.valuesSubtitle":
    "Ohjaamme päivittäistä toimintaamme ja teemme päätöksiä näiden periaatteiden mukaisesti tuotesuunnittelusta asiakastukeen.",
  "about.valuePrecision": "Tarkkuus",
  "about.valuePrecisionDesc":
    "Jokainen yksityiskohta on tärkeä pikselin tarkoista varaussivuista ajantasaisiin saatavuuskalentereihin.",
  "about.valueInnovation": "Innovaatio",
  "about.valueInnovationDesc":
    "Parannamme alustaamme jatkuvasti. Kaipaamme käyttäjien palautetta, jotta voimme tehdä alustasta entistä paremman.",
  "about.valueCollaboration": "Yhteistyö",
  "about.valueCollaborationDesc":
    "Teemme tiivistä yhteistyötä hotelli- ja ravintola-alan yritysten kanssa ymmärtääksemme heidän todellisia tarpeita.",
  "about.valueTrust": "Luottamus",
  "about.valueTrustDesc":
    "Tietosi ovat turvassa. Noudatamme GDPR-standardeja ja parhaita turvallisuuskäytäntöjä.",
  "about.valuePassion": "Intohimo",
  "about.valuePassionDesc":
    "Olemme intohimoisia auttamaan pieniä yrityksiä menestymään hotelli- ja ravintola-alalla.",
  "about.valueGlobal": "Saavutettavuus",
  "about.valueGlobalDesc":
    "Alustamme on monikielinen ja suunniteltu kaikkien saavutettavaksi.",
  "about.ctaTitle": "Oletko valmis yksinkertaistamaan varauksiasi?",
  "about.ctaSubtitle":
    "Liity hotelli- ja ravintola-alan yritysten joukkoon, jotka jo käyttävät MimmoBookia, virtaviivaistaksesi varauksiasi.",

  "privacy.title": "Tietosuojakäytäntö",
  "privacy.lastUpdated": "Päivitetty viimeksi:",
  "privacy.s1Title": "1. Johdanto",
  "privacy.s1P1":
    "Tämä tietosuojakäytäntö selittää, miten MimmoBook kerää, käyttää ja suojaa henkilötietojasi. Noudatamme EU:n yleistä tietosuoja-asetusta (GDPR).",
  "privacy.s2Title": "2. Rekisterinpitäjä",
  "privacy.s2P1":
    "MimmoBook on henkilötietojen rekisterinpitäjä. Tietosuojakyselyissä ota yhteyttä tukisivumme kautta.",
  "privacy.s3Title": "3. Kerättävät tiedot",
  "privacy.s3P1": "Keräämme seuraavat henkilötietoluokat:",
  "privacy.s3Item1": "Tilitiedot: nimi, sähköposti, salasana (tiivistetty)",
  "privacy.s3Item2": "Yritystiedot: yrityksen nimi, osoite, puhelinnumero",
  "privacy.s3Item3":
    "Varaustiedot: vieraiden nimet, sähköpostit, puhelinnumerot, varaustiedot",
  "privacy.s3Item4":
    "Käyttötiedot: vieraillut sivut, käytetyt ominaisuudet, selaintyyppi",
  "privacy.s4Title": "4. Käsittelyn tarkoitus",
  "privacy.s4P1": "Käsittelemme tietojasi seuraaviin tarkoituksiin:",
  "privacy.s4Item1": "Varausten hallintapalvelun tarjoaminen ja ylläpitäminen",
  "privacy.s4Item2":
    "Varausvahvistusten, muistutusten ja peruutusilmoitusten lähettäminen",
  "privacy.s4Item3":
    "Alustan parantaminen ja uusien ominaisuuksien kehittäminen",
  "privacy.s5Title": "5. Tietojen säilytys",
  "privacy.s5P1":
    "Säilytämme henkilötietojasi niin kauan kuin tilisi on aktiivinen. Varaustiedot säilytetään tilauksen keston ja 12 kuukauden ajan. Voit pyytää tietojesi poistamista milloin tahansa.",
  "privacy.s6Title": "6. Oikeutesi",
  "privacy.s6P1": "GDPR:n mukaisesti sinulla on seuraavat oikeudet:",
  "privacy.s6Item1": "Oikeus saada pääsy tietoihisi",
  "privacy.s6Item2": "Oikeus oikaista virheellisiä tietoja",
  "privacy.s6Item3": "Oikeus tietojen poistamiseen",
  "privacy.s6Item4": "Oikeus rajoittaa käsittelyä",
  "privacy.s6Item5": "Oikeus siirtää tiedot toiseen palveluun",
  "privacy.s7Title": "7. Evästeet",
  "privacy.s7P1":
    "Käytämme välttämättömiä evästeitä alustan toiminnan turvaamiseksi. Analytiikkaevästeet ladataan vasta antamallasi suostumuksella.",
  "privacy.s8Title": "8. Yhteydenotto",
  "privacy.s8P1": "Tietosuojakysymyksissä ota yhteyttä tukisivumme kautta.",

  "a11y.title": "Saavutettavuusseloste",
  "a11y.lastUpdated": "Päivitetty viimeksi:",
  "a11y.s1Title": "1. Sitoumuksemme",
  "a11y.s1P1":
    "MimmoBook on sitoutunut varmistamaan digitaalisen saavutettavuuden kaikille. Parannamme jatkuvasti käyttökokemusta ja noudatamme saavutettavuusstandardeja.",
  "a11y.s2Title": "2. Saavutettavuusominaisuudet",
  "a11y.s2P1": "Alustamme sisältää seuraavat saavutettavuusominaisuudet:",
  "a11y.s2Item1": "Säädettävä fonttikoko (80% to 150%)",
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
  "a11y.s4P1":
    "Vaikka pyrimme täyseen saavutettavuuteen, jotkin kolmannen osapuolen komponentit eivät välttämättä täytä kaikkia WCAG 2.1 AA -kriteerejä.",
  "a11y.s5Title": "5. Palaute",
  "a11y.s5P1":
    "Otamme mielellämme vastaan palautetta saavutettavuudesta. Ota yhteyttä tukisivumme kautta.",
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
  "cookie.acceptAll": "Hyväksy kaikki",
  "cookie.rejectAll": "Hylkää kaikki",
  "cookie.customize": "Mukauta",
  "cookie.savePreferences": "Tallenna asetukset",
  "cookie.title": "Evästeasetukset",
  "cookie.description":
    "Valitse, mitä evästeluokkia sallit. Välttämättömät evästeet ovat aina käytössä, jotta sivusto toimii.",
  "cookie.category.necessary": "Välttämättömät",
  "cookie.category.necessaryDesc":
    "Tarvitaan sivuston toimintaan, kuten kirjautumiseen, turvallisuuteen ja kieliasetuksiin.",
  "cookie.category.analytics": "Analytiikka",
  "cookie.category.analyticsDesc":
    "Auttaa ymmärtämään, miten kävijät käyttävät MimmoBookia, jotta voimme parantaa palvelua.",
  "cookie.category.marketing": "Markkinointi",
  "cookie.category.marketingDesc":
    "Käytetään markkinointikampanjoiden tehokkuuden mittaamiseen. Pois päältä oletuksena.",
  "cookie.alwaysOn": "Aina käytössä",
  "password.minLength": "Vähintään 12 merkkiä",
  "password.uppercase": "Yksi iso kirjain",
  "password.lowercase": "Yksi pieni kirjain",
  "password.number": "Yksi numero",
  "password.checking": "Tarkistetaan vuotaneita salasanoja…",
  "password.breached":
    "Tämä salasana on löytynyt tietovuodoista. Valitse toinen.",
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

  // Help & Support page
  "help.title": "Ohjeet ja tuki",
  "help.subtitle": "Selaa ohjeita, UKK:ta ja kysy tekoälyavustajalta.",
  "help.searchPlaceholder": "Hae ohjeista...",
  "help.noResults": "Ei tuloksia. Kokeile toista hakusanaa.",
  "help.aiTitle": "MimmoSupporter",
  "help.aiSubtitle": "Kysy mitä tahansa MimmoBookista",
  "help.askOrGuide": "Kysy kysymys tai kokeile pikaopasta:",
  "help.thinking": "Miettii...",
  "help.cancelRequest": "Peruuta pyyntö",
  "help.submitRequest": "Lähetä tukipyyntö",
  "help.subjectPlaceholder": "Aihe (esim. Ominaisuustoive)",
  "help.describePlaceholder": "Kuvaile pyyntösi...",
  "help.submitToAdmin": "Lähetä ylläpidolle",
  "help.typePlaceholder": "Kirjoita kysymyksesi...",
  "help.errorNoTenant": "Pyyntöä ei voi lähettää. Vuokralaista ei löydy.",
  "help.errorSubmit": "Pyynnön lähettäminen epäonnistui",
  "help.successSubmit": "Tukipyyntö lähetetty",
  "help.errorConnect": "Yhteys ei onnistunut. Yritä uudelleen.",
  "help.requestSubmitted": "Tukipyyntö",
  "help.requestSubmittedDetail":
    "Tukipyyntösi on lähetetty! Ylläpitotiimi tarkistaa sen ja vastaa pian.",
  "help.art1Title": "Aloittaminen",
  "help.art1Desc": "Luo tili ja ensimmäinen varaussivu muutamassa minuutissa.",
  "help.art1C1":
    "Rekisteröidy 30 päivän ilmaiseen kokeiluun. Luottokorttia ei tarvita.",
  "help.art1C2":
    "Täytä ohjattu asennus nimetäksesi yrityksesi ja valitaksesi varaustyypit.",
  "help.art1C3": "Mukauta brändi (logo, värit) Asetuksissa.",
  "help.art1C4": "Jaa varauslinkki asiakkaillesi!",
  "help.art2Title": "Varausten hallinta",
  "help.art2Desc":
    "Selaa, muokkaa, vahvista ja peruuta varauksia hallintapaneelista.",
  "help.art2C1": "Käytä kalenterinäkymää visuaaliseen yleiskatsaukseen.",
  "help.art2C2":
    "Vaihda listanäkymään suodattaaksesi tilan, tyypin tai päivämäärän mukaan.",
  "help.art2C3":
    "Napsauta varausta muokataksesi tietoja, lisätäksesi huomioita tai muuttaaksesi tilaa.",
  "help.art2C4":
    "Vahvistus- ja peruutussähköpostit lähetetään automaattisesti.",
  "help.art3Title": "Sähköpostimallit",
  "help.art3Desc":
    "Mukauta vieraille lähetettävät vahvistus- ja peruutussähköpostit.",
  "help.art3C1":
    "Siirry kohtaan Asetukset → Sähköpostimallit muokataksesi sähköpostejasi.",
  "help.art3C2": "Esikatsele sähköpostien ulkoasua ennen lähettämistä.",
  "help.art3C3": "Lisää mukautettuja viestejä vahvistaessa tai peruuttaessa.",
  "help.art3C4": "Sähköpostit tukevat monikielistä sisältöä (EN, FI, SV).",
  "help.art4Title": "Brändi ja varaussivu",
  "help.art4Desc":
    "Mukauta julkinen varaussivu brändi-identiteettisi mukaiseksi.",
  "help.art4C1": "Lataa logo ja aseta pää-/korostusvärit Asetuksissa.",
  "help.art4C2": "Lisää hero-kuva varaussivun yläosaan.",
  "help.art4C3": "Varaussivusi on osoitteessa /book/oma-slug.",
  "help.art4C4": "Yrityskuvaus näkyy vieraille varaussivulla.",
  "help.art5Title": "Aukioloajat",
  "help.art5Desc":
    "Määritä milloin yrityksesi vastaanottaa varauksia kullekin tyypille.",
  "help.art5C1":
    "Aseta oletusaukioloajat varaustyypeittäin (ravintola, juhlatila, hotelli, hyvinvointi, mukautettu) organisaatiotasolla. Ne koskevat kaikkia kyseisen tyypin resursseja, ellei niitä ohiteta.",
  "help.art5C2":
    "Aseta avaamis- ja sulkemisajat erikseen jokaiselle viikonpäivälle ja merkitse yksittäiset päivät suljetuiksi.",
  "help.art5C3":
    "Aukioloajat määrittävät, mitkä aikavälit näkyvät julkisella varaussivulla.",
  "help.art5C4":
    "Ohita oletukset toimipiste- tai resurssitasolla ja käytä estettyjä aikoja tilapäisiin sulkemisiin.",
  "help.art6Title": "Resurssit ja huoneet",
  "help.art6Desc":
    "Hallinnoi huoneita, pöytiä ja juhlatiloja, jotka ovat varattavissa.",
  "help.art6C1": "Lisää resursseja Resurssit-osiossa.",
  "help.art6C2":
    "Aseta kapasiteetti, hinnoittelu ja kuvaukset kullekin resurssille.",
  "help.art6C3": "Lataa kuvia tilojen esittelyyn varaussivulla.",
  "help.art6C4": "Poista resursseja käytöstä piilottaaksesi ne väliaikaisesti.",
  "help.art7Title": "Henkilöstö ja käyttäjähallinta",
  "help.art7Desc":
    "Kutsu tiimin jäseniä ja hallinnoi rooleja ja käyttöoikeuksia.",
  "help.art7C1": "Omistajat voivat kutsua henkilöstöä Hallinta-paneelista.",
  "help.art7C2":
    "Roolit: Omistaja (täysi pääsy), Admin (resurssien hallinta), Henkilöstö (varausten tarkastelu).",
  "help.art7C3": "Hyväksy tai poista tiimin jäseniä milloin tahansa.",
  "help.art7C4":
    "Jokaisella tilauksella on henkilöstöraja. Päivitä lisätäksesi.",
  "help.art8Title": "Tilaukset ja laskutus",
  "help.art8Desc": "Tutustu hinnoittelutasoihin ja hallinnoi tilaustasi.",
  "help.art8C1": "Basic (19 €/kk): 1 tyyppi, 1-5 henkilöä, AI-chatbot-tuki.",
  "help.art8C2":
    "Professional (59 €/kk): Kaikki tyypit, jopa 25 henkilöä, mukautetut mallit, AI-chatbot-tuki.",
  "help.art8C3":
    "Business (179 €/kk): Kaikki tyypit, jopa 50 henkilöä, prioriteettituki 24h vasteajalla.",
  "help.art8C4":
    "Enterprise (tarjouksen mukaan): rajaton määrä käyttäjiä. Päivitä tai alenna milloin tahansa, muutokset astuvat voimaan seuraavalla laskutuskaudella.",
  "help.art9Title": "Usein kysytyt kysymykset",
  "help.art9Desc": "Vastauksia yleisimpiin kysymyksiin MimmoBookista.",
  "help.art9C1": "K: Tarvitsenko luottokortin kokeiluun? V: Ei!",
  "help.art9C2":
    "K: Voinko käyttää omaa verkkotunnusta? V: Omat verkkotunnukset ovat suunnitelmissa.",
  "help.art9C3":
    "K: Miten vieraat saavat vahvistuksen? V: Automaattisesti sähköpostitse vahvistuksen yhteydessä.",
  "help.art9C4":
    "K: Voinko viedä tietoni? V: Kyllä, raportit voidaan viedä Raportit-paneelista.",
  "help.art10Title": "Mitä uutta",
  "help.art10Desc":
    "Uusimmat ominaisuudet: vierasportaali, jonotuslista, kalenterisynkronointi, vienti ja muuta.",
  "help.art10C1":
    "Vierasportaali: vieraat voivat katsoa tai peruuttaa varauksensa maagisella linkillä (/my-booking/:token) — kirjautumista ei tarvita.",
  "help.art10C2":
    "Jonotuslista: kun vuoro on täynnä, vieraat voivat liittyä jonoon ja saavat automaattisen ilmoituksen, kun paikka vapautuu.",
  "help.art10C3":
    "Google-kalenterisynkronointi: tilaa varauksesi iCal-syötteellä (Asetukset → Kalenterisynkronointi). CSV/PDF-vienti Varauksista ja Raporteista.",
  "help.art10C4":
    "Hallintapaneelin parannukset: tumma teema, pikanäppäimet (paina ?), pikatoimintojen FAB mobiilissa, käyttöönoton tarkistuslista, audit-lokin suodattimet, analytiikkakaaviot, kirjautumisen rate-rajoitus, varmuuskopion tilailmaisin, julkiset arvostelut/suosittelut, monikielinen julkinen varaussivu, keittiötilaukset ravintola- ja tilavarauksille, ja Stripe-tulospaneeli pääkäyttäjille.",
  "help.art10C5":
    "Uusimmat lisäykset: varauksen lasku-PDF, jaksoraporttien PDF-lataus, vilkkaimmat tunnit ja viikonpäivä, poimintalistat keittiölle, majoitukselle ja tapahtumille, varauskanavien jakauma (vieras vai henkilökunta), sähköpostien toimitusaikajana varauskohtaisesti, ristiinvarausten tarkastusnäkymä, tarjousten hinnat resursseista, keittiön menu hinnoilla, käyttöoikeusilmoitukset Pyydä käyttöoikeutta -painikkeella sekä siirtopyynnöt ja vieraan peruutus.",
  "help.art10C6":
    "Aivan uusimmat: erikoistilaisuudet kapasiteettirajalla (esimerkiksi joulupäivällinen), hylätyt varaukset -kortti joka kertoo miksi vieras ei saanut varausta läpi, kaksoisvarausten esto, keittiörivien automaattinen ohjaus hyväksytystä tarjouksesta sekä uusi Enterprise-taso rajattomalla henkilökunnalla.",
  "help.art11Title": "Järjestelmän rakentaminen vaihe vaiheelta",
  "help.art11Desc":
    "Suositeltu järjestys yrityksen tiedoista ensimmäiseen testivaraukseen.",
  "help.art11C1":
    "1) Yrityksen tiedot ja brändäys: nimi, sähköposti, osoite, puhelin, logo, värit, kuva ja varaussivun tekstit Asetuksissa.",
  "help.art11C2":
    "2) Varaustyypit, toimipisteet (Business ja Enterprise) ja sitten resurssit: huoneet ja huonetyypit, pöydät, tilat tai hyvinvointipalvelut kapasiteetilla, kestolla, hinnalla ja kuvilla.",
  "help.art11C3":
    "3) Aukioloajat (oletukset, toimipistekohtaiset poikkeukset, resurssin oma viikkoaikataulu), hinnat ja alennuskoodit, sitten sähköpostimallit sekä lähettäjän nimi ja vastausosoite.",
  "help.art11C4":
    "4) Kutsu henkilökunta ja aseta roolit ja toimipisteet, lisää erikoistilaisuudet ja estot, kopioi tai upota varauslinkki ja tee lopuksi yksi testivaraus: tarkista sähköposti, lataa lasku ja peru varaus.",
  "help.art12Title": "Erikoistilaisuudet, keittiöohjaus ja Enterprise",
  "help.art12Desc":
    "Uusimmat ominaisuudet ja niiden vaikutus päivittäiseen työhön.",
  "help.art12C1":
    "Erikoistilaisuudet: luo nimetty päivä, esimerkiksi joulupäivällinen, kokonaiskapasiteetilla ja joko kiinteillä kattauksilla tai vapaalla varauksella. Hinta asetetaan varaukselle, ei tilaisuudelle, ja tietokanta estää samanaikaisten varausten ylimyynnin.",
  "help.art12C2":
    "Hylätyt varaukset: hallintapaneelin kortti listaa järjestelmän hylkäämät varaukset syineen (tilaisuus täynnä, suljettu päivä, kaksoislähetys, virheelliset tiedot), ja 15 minuutin sisällä toistettu lähetys näyttää vieraalle ilmoituksen Lähetit tämän varauksen jo.",
  "help.art12C3":
    "Keittiöohjaus tarjouksista: ristiinvarauksen hyväksyminen luo keittiörivit kunkin osion omasta ruoka ja juoma -kentästä. Tapahtuman rivit tapahtumavaraukselle, ruokailun ja huoneiden rivit ruokailuvaraukselle (tai tapahtumavaraukselle jos ruokailua ei ole). Erikoistoiveita ei lähetetä koskaan, tyhjä kenttä ei luo mitään, ja Keittiötilauksen esikatselu näyttää tarkalleen mitä lähetetään.",
  "help.art12C4":
    "Tasot: Basic 5 käyttäjää, Pro 25, Business 50, Enterprise rajaton ja hinnoiteltu tarjouksella Pyydä tarjous -painikkeesta hinnoittelusivulla.",
  "help.guide7Q":
    "Miten luon erikoistilaisuuden, esimerkiksi joulupäivällisen?",
  "help.guide7A":
    "Avaa varaustyypin asetukset ja lisää **erikoistilaisuus**: nimi, päivä, kokonaiskapasiteetti ja joko **kiinteät kattaukset** (vieras valitsee yhden aloitusajoistasi) tai **vapaa varaus** (mikä tahansa aika aukioloaikojen sisällä). Aseta hinta varaukselle tai resurssille, ei tilaisuudelle. Vieraat näkevät tilaisuuden varaussivulla kyseiselle päivälle, eikä kapasiteettia voi ylittää vaikka kaksi vierasta varaisi samalla hetkellä.",
  "help.guide8Q": "Minne hyväksytyn tarjouksen ruoat ja juomat menevät?",
  "help.guide8A":
    "Kunkin osion oma ruoka ja juoma -kenttä muuttuu keittiöriveiksi sille varaukselle joka sen toteuttaa: tapahtuman rivit tapahtumavaraukselle, ruokailun rivit ruokailuvaraukselle ja huoneiden rivit ruokailuvaraukselle (tai tapahtumavaraukselle jos ruokailua ei ole). **Erikoistoiveita ei lähetetä keittiöön**, tyhjä kenttä ei luo tilausta, ja **Keittiötilauksen esikatselu** sekä **Minne mikä kenttä menee** -paneeli näyttävät ohjauksen ja summat ennen hyväksymistä.",
  "help.guide1Q": "Miten hallitsen varauksia?",
  "help.guide1A":
    "Siirry kohtaan **Hallintapaneeli → Varaukset** selataksesi, suodattaaksesi, muokataksesi ja hallinnoitsesi kaikkia varauksia.",
  "help.guide2Q": "Miten mukautan varaussivua?",
  "help.guide2A":
    "Siirry **Asetuksiin** hallintapaneelissa. Lataa logo, aseta brändivärit ja lisää hero-kuva.",
  "help.guide3Q": "Miten asetan sähköpostimallit?",
  "help.guide3A":
    "Kohdassa **Asetukset → Sähköpostimallit** voit mukauttaa vahvistus- ja peruutussähköpostit.",
  "help.guide4Q": "Miten lisään henkilöstöä?",
  "help.guide4A":
    "Siirry kohtaan **Hallinta → Käyttäjät** kutsuaksesi uutta henkilöstöä. Voit asettaa rooleja ja hyväksyä tai poistaa jäseniä.",
  "help.guide5Q": "Miten lisään tai muokkaan resursseja?",
  "help.guide5A":
    "Siirry kohtaan **Hallintapaneeli → Resurssit** luodaksesi huoneita, pöytiä tai tiloja.",
  "help.guide6Q": "Mitä uutta MimmoBookissa?",
  "help.guide6A":
    "Viimeisimmät lisäykset: **Vierasportaali** (varauksen hallinta maagisella linkillä), **jonotuslista** automaattisilla ilmoituksilla, **Google-kalenterisynkronointi** iCal-syötteellä, **CSV/PDF-vienti**, **tumma teema**, **pikanäppäimet** (paina `?`), **pikatoimintojen FAB** mobiilissa, **käyttöönoton tarkistuslista**, **audit-lokin suodattimet**, **analytiikkakaaviot**, **julkiset arvostelut/suosittelut**, **keittiötilaukset** ravintola- ja tilavarauksille, **Tarjouksista varauksiin -konversioraportti** CSV-vientillä, ja **Stripe-tulospaneeli** pääkäyttäjille.",

  // MimmoAid
  "aid.title": "MimmoAid",
  "aid.subtitle": "Kysy mitä tahansa MimmoBookista",
  "aid.myRequests": "Omat pyynnöt",
  "aid.yourRequests": "Lähettämäsi tukipyynnöt",
  "aid.askOrGuide": "Esitä kysymys tai kokeile pikaopasta:",
  "aid.quickGuides": "Pikaoppaat ▸",
  "aid.thinking": "Mietitään...",
  "aid.cancelRequest": "Peruuta pyyntö",
  "aid.submitRequest": "Lähetä tukipyyntö",
  "aid.subjectPlaceholder": "Aihe (esim. Ominaisuuspyyntö)",
  "aid.messagePlaceholder": "Kuvaile pyyntösi tai ehdotuksesi...",
  "aid.submitToAdmin": "Lähetä ylläpidolle",
  "aid.typePlaceholder": "Kirjoita kysymyksesi...",
  "aid.sendMessage": "Lähetä viesti",
  "aid.chat": "Chat",
  "aid.requests": "Pyynnöt",
  "aid.loadingRequests": "Ladataan pyyntöjä...",
  "aid.noRequests": "Ei tukipyyntöjä vielä.",
  "aid.noRequestsHint": "Lähetä pyyntö chat-näkymästä.",
  "aid.yourMessage": "Viestisi",
  "aid.adminResponse": "Ylläpidon vastaus",
  "aid.awaitingResponse": "Odotetaan ylläpidon vastausta...",
  "aid.requestSubmitted": "Tukipyyntö",
  "aid.requestSubmittedDetail":
    "Tukipyyntösi on lähetetty! Ylläpitotiimisi käsittelee sen pian. Saat ilmoituksen kun siihen vastataan.",
  "aid.statusOpen": "Avoin",
  "aid.statusInProgress": "Käsittelyssä",
  "aid.statusResolved": "Ratkaistu",
  "aid.statusClosed": "Suljettu",
  "aid.errorNoTenant": "Pyyntöä ei voitu lähettää — vuokralaista ei löytynyt.",
  "aid.errorSubmit": "Pyynnön lähettäminen epäonnistui",
  "aid.successSubmit": "Tukipyyntö lähetetty",
  "aid.errorConnect": "Yhteyttä ei saatu. Yritä uudelleen.",
  "aid.guideQ1": "Miten hallinnoin varauksia?",
  "aid.guideA1":
    "Siirry **Hallintapaneeli → Varaukset** -näkymään tarkistaaksesi, suodattaaksesi, muokataksesi ja hallinnoidaksesi kaikkia varauksia. Voit vahvistaa tai peruuttaa varauksia toimintovalikosta.",
  "aid.guideQ2": "Miten mukautan varaussivuani?",
  "aid.guideA2":
    "Siirry hallintapaneelin **Asetukset**-osioon. Lataa logosi, aseta brändivärit ja lisää hero-kuva. Julkinen varaussivusi päivittyy automaattisesti.",
  "aid.guideQ3": "Miten määritän sähköpostimallit?",
  "aid.guideA3":
    "**Asetukset → Sähköpostimallit** -osiossa voit muokata sekä vahvistus- että peruutussähköposteja. Esikatselu-välilehdeltä näet miltä ne näyttävät vieraille.",
  "aid.guideQ4": "Miten lisään henkilökuntaa?",
  "aid.guideA4":
    "Siirry **Ylläpito → Käyttäjät** kutsuaksesi uusia henkilökunnan jäseniä. Voit asettaa roolit (Omistaja, Ylläpitäjä, Henkilökunta) ja hyväksyä tai poistaa tiimin jäseniä.",
  "aid.guideQ5": "Miten lisään tai muokkaan resursseja?",
  "aid.guideA5":
    "Siirry **Hallintapaneeli → Resurssit** luodaksesi huoneita, pöytiä tai tiloja. Voit asettaa kapasiteetin, hinnoittelun, ladata enintään 5 kuvaa ja vaihtaa aktiivi/ei-aktiivi-tilaa.",
  "aid.guideQ6": "Miten asetan aukioloajat?",
  "aid.guideA6":
    "**Asetukset → Aukioloajat** -osiossa asetat oletukset varaustyypeittäin ja voit määrittää eri avaamis- ja sulkemisajat jokaiselle viikonpäivälle. Merkitse yksittäiset päivät suljetuiksi tarvittaessa. Business-tilauksella voit ohittaa toimipistekohtaisesti, ja mikä tahansa resurssi voi saada oman viikko-ohjelmansa resurssin muokkausnäkymästä.",
  "aid.guideQ7": "Miten tarkastelen raportteja?",
  "aid.guideA7":
    "Siirry **Hallintapaneeli → Raportit** nähdäksesi varaustrendejä, käyttöasteita ja tuloyhteenvetoja. Voit suodattaa ajanjakson mukaan ja tulostaa raportteja.",
  "aid.guideQ8": "Miten huoneiden hinnoittelu toimii?",
  "aid.guideA8":
    "Aseta **perushinta per yö** jokaiselle resurssille ja määritä **huonetyyppikertoimet** (Yhden hengen 1.0×, Kahden hengen 1.5×, Sviitti 2.5× jne.). Varaussivu laskee summat automaattisesti.",
  "aid.guideQ9": "Miten jaan varauslinkkini?",
  "aid.guideA9":
    "Julkinen varauslinkkisi näkyy **Hallintapaneelin yleiskatsauksessa**. Klikkaa **Kopioi linkki** kopioidaksesi sen tai avaa se uudessa välilehdessä. Jaa se verkkosivullasi tai sosiaalisessa mediassa.",
  "aid.guideQ10": "Miten estän päivämääriä tai aikavälejä?",
  "aid.guideA10":
    "**Hallintapaneeli → Kalenteri** -näkymässä klikkaa päivämäärää ja käytä **Estä aika** -toimintoa estääksesi varaukset tietyille päiville, ajoille tai resursseille.",
  "aid.guideQ11": "Miten hallitsen toistuvia estoja?",
  "aid.guideA11":
    "Siirry **Hallintapaneeli → Kalenteri** ja avaa **Toistuvat estot** -paneeli. Voit luoda viikoittain toistuvia estoja tietyille päiville, aikaväleille ja resurssityypeille (esim. sulkea ravintolan joka maanantai). Vaihda estoja päälle/pois tai poista ne milloin tahansa. Muutokset näkyvät heti julkisella varaussivulla.",
  "aid.guideQ12": "Miten erikoistilaisuudet toimivat?",
  "aid.guideA12":
    "Lisää **erikoistilaisuus** varaustyypin asetuksissa: nimi, päivä, kokonaiskapasiteetti ja joko kiinteät kattaukset tai vapaa varaus. Vieraat valitsevat sen varaussivulla kyseiselle päivälle. Hinta asetetaan varaukselle, ei tilaisuudelle, eikä kapasiteettia voi ylittää.",
  "aid.guideQ13": "Minne tarjouksen ruoat ja juomat menevät?",
  "aid.guideA13":
    "Kunkin osion oma ruoka ja juoma -kenttä muuttuu keittiöriveiksi sille varaukselle joka sen toteuttaa: tapahtuman rivit tapahtumavaraukselle, ruokailun ja huoneiden rivit ruokailuvaraukselle (tai tapahtumavaraukselle jos ruokailua ei ole). Erikoistoiveita ei lähetetä keittiöön, ja **Keittiötilauksen esikatselu** näyttää kaikki rivit ennen hyväksymistä.",
  "aid.guideQ14": "Missä järjestyksessä rakennan järjestelmän?",
  "aid.guideA14":
    "1) Yrityksen tiedot ja brändäys, 2) varaustyypit, toimipisteet ja resurssit, 3) aukioloajat, hinnat ja alennuskoodit, 4) sähköpostimallit ja lähettäjän tiedot, 5) henkilökunta, roolit ja toimipisteet, 6) erikoistilaisuudet ja estot, 7) jaa tai upota varauslinkki ja tee lopuksi yksi testivaraus alusta loppuun.",
  // Sites
  "sites.title": "Toimipisteet",
  "sites.addSite": "Lisää toimipiste",
  "sites.editSite": "Muokkaa toimipistettä",
  "sites.tooltip":
    "Hallitse useita toimipisteitä tai kiinteistöjä tilisi alla. Jokaisella toimipisteellä voi olla omat resurssit, aukioloajat ja varaussivu.",
  "sites.allSites": "Kaikki toimipisteet",
  "sites.approvals": "Hyväksynnät",
  "sites.siteName": "Toimipisteen nimi",
  "sites.siteType": "Tyyppi",
  "sites.slug": "Tunniste",
  "sites.slugHint": "Käytetään varaus-URL:ssa: /book/",
  "sites.location": "Sijainti",
  "sites.description": "Kuvaus",
  "sites.descriptionPlaceholder": "Valinnainen kuvaus toimipisteestä",
  "sites.createSite": "Luo toimipiste",
  "sites.updateSite": "Päivitä toimipiste",
  "sites.siteCreated": "Toimipiste luotu",
  "sites.siteUpdated": "Toimipiste päivitetty",
  "sites.siteDeleted": "Toimipiste poistettu",
  "sites.duplicateSlug": "Tällä tunnisteella on jo toimipiste",
  "sites.deleteSite": "Poista",
  "sites.deleteConfirm":
    "Tämä poistaa toimipisteen pysyvästi. Siihen liitetyt resurssit jäävät ilman toimipistettä.",
  "sites.noSites":
    "Ei toimipisteitä vielä. Luo ensimmäinen toimipiste hallitaksesi useita sijainteja.",
  "sites.resources": "Resurssit",
  "sites.status": "Tila",
  "sites.actions": "Toiminnot",
  "sites.active": "Aktiivinen",
  "sites.draft": "Luonnos",
  "sites.typeHotel": "Hotelli / Majatalo",
  "sites.typeRestaurant": "Ravintola",
  "sites.typeVenue": "Tapahtumatila",
  "sites.resourceName": "Resurssin nimi",
  "sites.resourceType": "Resurssityyppi",
  "sites.capacity": "Kapasiteetti",
  "sites.noResourcesInSite": "Tässä toimipisteessä ei ole vielä resursseja.",
  "sites.assignUsers": "Osoita käyttäjiä",
  "sites.alreadyAssigned": "Osoitettu",
  "sites.usersSelected": "valittu",
  // Sample period
  "sample.warningWeek":
    "Ilmainen kokeilujaksosi päättyy {days} päivän kuluttua. Ota yhteyttä tukeen päivittääksesi.",
  "sample.warningDay":
    "Ilmainen kokeilujaksosi päättyy tänään! Ota yhteyttä tukeen jatkaaksesi.",
  "sample.warningDayTomorrow":
    "Ilmainen kokeilujaksosi päättyy huomenna! Ota yhteyttä tukeen jatkaaksesi.",
  "sample.readOnly":
    "Ilmainen kokeilujaksosi on päättynyt. Hallintapaneeli on vain luku -tilassa vielä {days} päivää. Ota yhteyttä tukeen.",
  "sample.blocked":
    "Ilmainen kokeilujaksosi on päättynyt ja pääsy on estetty. Ota yhteyttä tukeen aktivoidaksesi tilisi.",
  "discount.title": "Alennus",
  "discount.type": "Tyyppi",
  "discount.value": "Arvo",
  "discount.reason": "Syy",
  "discount.reasonPlaceholder": "esim. Kanta-asiakas",
  "discount.percentage": "Prosentti (%)",
  "discount.fixed": "Kiinteä summa (€)",
  "discount.freeNights": "Ilmaiset yöt/ateriat",
  "discount.promoCode": "Tarjouskoodi",
  "discount.promoCodePlaceholder": "Syötä koodi, jos sinulla on sellainen",
  "discountCodes.title": "Alennuskoodit",
  "discountCodes.description":
    "Luo ja hallinnoi kampanja-alennuskoodeja asiakkaillesi.",
  "discountCodes.add": "Lisää koodi",
  "discountCodes.addTitle": "Luo alennuskoodi",
  "discountCodes.editTitle": "Muokkaa alennuskoodia",
  "discountCodes.formDesc": "Määritä alennuskoodin tiedot ja voimassaolo.",
  "discountCodes.code": "Koodi",
  "discountCodes.discountCol": "Alennus",
  "discountCodes.discountType": "Alennustyyppi",
  "discountCodes.value": "Arvo",
  "discountCodes.uses": "Käyttökerrat",
  "discountCodes.validity": "Voimassaolo",
  "discountCodes.actions": "Toiminnot",
  "discountCodes.maxUses": "Enimmäiskäyttö",
  "discountCodes.unlimited": "Rajoittamaton",
  "discountCodes.minPrice": "Vähimmäistilaus (€)",
  "discountCodes.validFrom": "Voimassa alkaen",
  "discountCodes.validUntil": "Voimassa asti",
  "discountCodes.from": "Alkaen",
  "discountCodes.until": "Asti",
  "discountCodes.active": "Aktiivinen",
  "discountCodes.inactive": "Ei käytössä",
  "discountCodes.activeLabel": "Aktiivinen luotaessa",
  "discountCodes.empty": "Ei alennuskoodeja vielä. Luo ensimmäinen!",
  "discountCodes.created": "Alennuskoodi luotu",
  "discountCodes.updated": "Alennuskoodi päivitetty",
  "discountCodes.deleted": "Alennuskoodi poistettu",
  "discountCodes.saveError": "Alennuskoodin tallennus epäonnistui",
  "discountCodes.deleteError": "Alennuskoodin poisto epäonnistui",
  "discountCodes.deleteTitle": "Poista alennuskoodi",
  "discountCodes.deleteConfirm":
    "Haluatko varmasti poistaa tämän alennuskoodin? Toimintoa ei voi peruuttaa.",
  "approval.colType": "Tyyppi",
  "approval.colName": "Nimi",
  "approval.colDetail": "Lisätieto",
  "approval.colSite": "Toimipiste",
  "approval.colSubmitted": "Lähetetty",
  "approval.colActions": "Toiminnot",
  "approval.approve": "Hyväksy",
  "approval.reject": "Hylkää",
  "approval.rejecting": "Hylätään…",
  "approval.approved": "Hyväksytty",
  "approval.rejected": "Hylätty",
  "approval.rejectChange": "Hylkää muutos",
  "approval.rejectingLabel": "Hylätään:",
  "approval.rejectionReason": "Hylkäyksen syy…",
  "approval.noItems": "Ei odottavia hyväksyntöjä",
  "approval.noItemsDesc": "Kaikki muutokset on käsitelty.",
  "approval.typeResource": "Resurssi",
  "approval.typeBlockedSlot": "Estetty aika",
  "approval.typeRecurringBlock": "Toistuva esto",
  "approval.typeOpeningHours": "Aukioloajat",
  "approval.typeEmailTemplate": "Sähköpostipohja",
  "approval.noReason": "Ei syytä",
  "approval.closed": "Suljettu",
  "approval.pendingApproval": "Lähetetty hyväksyttäväksi",

  // Email Template Editor
  "emailTemplates.title": "Sähköpostimallit",
  "emailTemplates.tooltip":
    "Mukauta vieraille lähetettävien vahvistus-, muistutus- ja peruutussähköpostien aihetta ja sisältöä.",
  "emailTemplates.description":
    "Mukauta vieraille lähetettäviä vahvistus-, muistutus- ja peruutussähköposteja.",
  "emailTemplates.proRequired": "Pro+ vaaditaan",
  "emailTemplates.confirmation": "Vahvistus",
  "emailTemplates.reminder": "Muistutus",
  "emailTemplates.cancellation": "Peruutus",
  "emailTemplates.language": "Kieli",
  "emailTemplates.subject": "Aiherivi",
  "emailTemplates.body": "Sähköpostin sisältö (HTML)",
  "emailTemplates.showPreview": "Näytä esikatselu",
  "emailTemplates.hidePreview": "Piilota esikatselu",
  "emailTemplates.previewLabel": "Esikatselu esimerkkitiedoilla",
  "emailTemplates.availableVars": "Käytettävissä olevat muuttujat",
  "emailTemplates.activeToggle": "Ota tämä malli käyttöön",
  "emailTemplates.activeToggleDesc":
    "Kun poistettu käytöstä, käytetään järjestelmän oletusmallia.",
  "emailTemplates.resetDefault": "Palauta oletukseksi",
  "emailTemplates.saved": "Sähköpostimalli tallennettu",
  "emailTemplates.saveError": "Mallin tallennus epäonnistui",
  "emailTemplates.active": "Aktiivinen",
  "emailTemplates.inactive": "Ei aktiivinen",
  "emailTemplates.upgradeHint":
    "Päivitä Professional- tai Business-tasolle mukauttaaksesi sähköpostimalleja.",
  "emailTemplates.overrideRemoved":
    "Sivustokohtainen muokkaus poistettu, käytetään oletusmallia",
  "emailTemplates.siteOverride": "Sivustokohtainen",
  "emailTemplates.usingTenantDefault": "Käytetään oletusmallia",
  "emailTemplates.revertToDefault": "Poista sivustokohtainen muokkaus",
  "emailTemplates.siteDescription":
    "Mukauta sähköpostimalleja tälle sivustolle. Muutokset ohittavat oletusmallit.",

  // Pricing page
  "pricing.heroTitle": "Yksinkertainen ja läpinäkyvä hinnoittelu",
  "pricing.heroSubtitle":
    "Aloita 30 päivän ilmaisella kokeilujaksolla. Korota seuraavaan tasoon tai peruuta milloin tahansa.",
  "pricing.basicName": "Perustaso",
  "pricing.basicDesc":
    "Täydellinen yhdelle hotellille, ravintolalle tai tapahtumapaikalle.",
  "pricing.basicTypes": "2 tyyppiä",
  "pricing.basicStaff": "1 to 5",
  "pricing.basicResourcesTotal": "2 yhteensä",
  "pricing.proResourcesPerType": "Enintään 5",
  "pricing.proName": "Protaso",
  "pricing.proDesc":
    "Yrityksille, jotka tarjoavat hotelli-, ravintola- ja tapahtumatilapalvelun yhdessä paikassa.",
  "pricing.proTypes":
    "Jopa 5 varaustyyppiä missä tahansa yhdistelmässä (esim. kaksi ravintolaa ja yksi hotelli)",
  "pricing.proStaff": "Jopa 25",
  "pricing.businessName": "Business taso",
  "pricing.businessDesc":
    "Monin ominaisuuksin varusteltu alusta yrityksille, joilla on useampia toimipisteitä ja toimintoja.",
  "pricing.businessTypes": "Kaikki tyypit, rajoittamaton määrä",
  "pricing.businessStaff": "Enintään 50",
  "pricing.enterpriseName": "Enterprise taso",
  "pricing.enterpriseDesc":
    "Räätälöity taso suurille toimijoille, jotka tarvitsevat yli 50 käyttäjää.",
  "pricing.enterpriseTypes": "Kaikki tyypit, rajoittamaton määrä",
  "pricing.enterpriseStaff": "Rajoittamaton",
  "pricing.enterpriseF1": "Kaikki Business tason toiminnot",
  "pricing.enterpriseF2": "Rajoittamaton määrä henkilökunnan käyttäjiä",
  "pricing.enterpriseF3": "Ensisijainen tuki ja käyttöönoton apu",
  "pricing.enterpriseF4": "Hinta sovitaan tarjouksella",
  "pricing.enterprisePrice": "Tarjouksen mukaan",
  "pricing.enterpriseCta": "Pyydä tarjous",
  "pricing.byOffer": "Tarjouksen mukaan",
  "pricing.basicF1": "Mukautettu brändäys (logo, värit, kuvat)",
  "pricing.basicF2": "Oletussähköpostipohjat",
  "pricing.basicF3": "Aukioloaikojen määritys",
  "pricing.basicF4": "Brändätty varaussivu",
  "pricing.basicF5": "Tekoälyllä toimiva chatbot tuki",
  "pricing.proF1": "Kaikki perustason toiminnot",
  "pricing.proF2": "Mukautetut sähköpostipohjat",
  "pricing.proF3": "Tekoälyllä toimiva chatbot tuki",
  "pricing.businessF1": "Kaikki Protason toiminnot",
  "pricing.businessF2":
    "Rajoittamaton määrä toimipisteitä ja toimintoja, enintään 50 käyttäjää",
  "pricing.businessF3": "Edistyneet raportit",
  "pricing.businessF4": "Tuki (24 tunnin vasteaika)",
  "pricing.sitesLocations": "Toimipaikat / sijainnit",
  "pricing.resourcesPerType": "Resurssit per tyyppi",
  "pricing.operationTypes": "Toimintotyypit",
  "pricing.onePerResType": "1 per varaustyyppi",
  "pricing.responseTime24h": "Tuki (24 tunnin vasteaika)",
  "pricing.customBranding": "Oma brändäys",
  "pricing.brandedBooking": "Brändätty varaussivu",
  "pricing.defaultTemplates": "Oletussähköpostipohjat",
  "pricing.customTemplates": "Räätälöidyt sähköpostipohjat",
  "pricing.advancedRules": "Edistyneet varaussäännöt",
  "pricing.multiLanguage": "Monikieliset sivut",
  "pricing.multisiteManagement": "Usean toimipaikan hallinta",
  "pricing.analyticsReports": "Aalytiikka ja raportit",
  "pricing.offers": "Tarjoukset (tapahtumaehdotukset ja PDF)",
  "pricing.crossReservations": "Ristiinvaraukset",
  "pricing.supportLevel": "Tuki",
  "pricing.basic": "Perus",
  "pricing.advanced": "Edistyneet",
  "pricing.unlimited": "Rajaton",
  "pricing.all": "Kaikki",
  "pricing.multiLocationTitle": "Onko yrityksellä useita toimipisteitä?",
  "pricing.multiLocationDesc":
    "Business-paketti tukee rajatonta määrää toimipisteitä ja usean toimipisteen hallintaa. Hallitse hotellejasi, ravintoloitasi ja muita tapahtumapaikkojasi yhdessä näkymässä.",
  "pricing.tryBusinessFree": "Kokeile Businessia ilmaiseksi 30 päivää",
  "pricing.faqQ1": "Mitä tapahtuu 30 päivän kokeilun jälkeen?",
  "pricing.faqA1":
    "Saat viestin, jossa kerrotaan kokeilusi muuttuvan maksulliseksi tilaukseksi. Voit peruuttaa milloin tahansa ennen kokeilun päättymistä ilman veloitusta. Jos et peruuta, tilaus alkaa. Jos peruutat tilauksen alkamisen jälkeen, sinulta laskutetaan ensimmäinen laskutusjakso, joka on 30 päivää.",
  "pricing.faqQ2": "Voinko vaihtaa suunnitelmaa myöhemmin?",
  "pricing.faqA2":
    "Kyllä! Voit päivittää tai alentaa suunnitelmasi milloin tahansa. Muutokset tulevat voimaan seuraavan laskutusjakson alussa.",
  "pricing.faqQ3": "Mitä varaustyyppejä voin valita?",
  "pricing.faqA3":
    "Ravintola (pöytävaraukset), Tila (tilakatsaukset), Majatalo (huonevaraukset) ja Hyvinvointipalvelut (ajanvaraukset kampaajille, hierojille, meikkitaiteilijoille ja vastaaville). Basic antaa valita yhden. Pro avaa kaikki tyypit, yhden kutakin, yhdellä toimipisteellä. Business lisää rajattomat toimipisteet.",
  "pricing.faqQ4": "Voinko käyttää omaa domainia?",
  "pricing.faqA4":
    'Jokaiselle yritykselle tulee brändätty alidomain (esim. yrityksesi.mimmobook.com), ja voit käyttää sen kanssa jo nyt omaa verkko-osoitettasi. Hallintapaneelin "Jaa varaussivu" -kortissa on "Oma osoite" -välilehti: se neuvoo, miten ohjaat esimerkiksi varaus.sivustosi.fi varaussivullesi verkkotunnuspalvelusi uudelleenohjauksella, ja antaa valmiin koodin, jolla upotat varaussivun tai lisäät "Varaa nyt" -painikkeen sivustollesi, jolloin oma osoitteesi pysyy näkyvissä. Täysin isännöityjen omien verkkotunnusten tuki on tiekartalla ja tarjotaan silloin enterprise-hinnoittelulla.',
  "pricing.faqQ5": "Mikä ero on AI-chatbot-tuella ja 24 tunnin vasteajatuella?",
  "pricing.faqA5":
    "Kaikki suunnitelmat sisältävät MimmoAid-tekoälychatbotin, joka vastaa kysymyksiin, auttaa vianmäärityksessä ja opastaa ominaisuuksissa. Chatbot on käytettävissä 24/7 hallintapaneelissa. Business-suunnitelma lisää 24 tunnin vasteajatuen: voit eskaloida keskustelun tiimiimme alustan kautta chatbotin avulla ja saada taatun vastauksen 24 tunnin sisällä.",

  // Support page
  "support.heroTitle": "Kuinka voimme auttaa?",
  "support.heroSubtitle":
    "Selaa oppaita, usein kysyttyjä kysymyksiä ja vinkkejä saadaksesi kaiken irti MimmoBookista.",
  "support.articlesHeading": "Oppaat ja vastaukset",
  "support.searchPlaceholder": "Hae apua...",
  "support.noResults": "Ei tuloksia. Kokeile toista hakusanaa.",
  "support.stillNeedHelp": "Tarvitsetko vielä apua?",
  "support.stillNeedHelpDesc":
    "Kaikki suunnitelmat sisältävät AI-chatbot-tuen hallintapaneelissa. Business-asiakkaat saavat tukea taatulla 24 tunnin vasteajalla tiimiimme. Taustanäkymästä on myös ladattavissa käyttöopas käytön tueksi.",
  "support.gettingStarted": "Aloitusopas",
  "support.gettingStartedDesc": "Luo tili ja luo ensimmäinen varaussivusi.",
  "support.gettingStartedC1":
    "Rekisteröidy ilmaiseen 30 päivän kokeilujaksoon.",
  "support.gettingStartedC2":
    "Suorita käyttöönottotoiminto nimetäksesi yrityksesi ja valitaksesi varaustyypit.",
  "support.gettingStartedC3": "Mukauta brändäystäsi (logo, värit) asetuksissa.",
  "support.gettingStartedC4": "Jaa varauslinkkisi asiakkaiden kanssa!",
  "support.managingRes": "Varausten hallinta",
  "support.managingResDesc":
    "Katsele, muokkaa, vahvista ja peruuta varauksia kojelaudassasi.",
  "support.managingResC1":
    "Käytä kalenterinäkymää saadaksesi visuaalisen yleiskatsauksen tulevista varauksista.",
  "support.managingResC2":
    "Vaihda luettelonäkymään suodattaaksesi tilan, tyypin tai päivämääräalueen mukaan.",
  "support.managingResC3":
    "Napsauta mitä tahansa varausta muokataksesi tietoja, lisätäksesi muistiinpanoja tai muuttaaksesi tilaa.",
  "support.managingResC4":
    "Vahvistus- ja peruutussähköpostit lähetetään automaattisesti.",
  "support.emailTemplates": "Sähköpostimallit",
  "support.emailTemplatesDesc":
    "Yritystason asiakkaat voivat muokata vieraille lähetettäviä vahvistus- ja peruutussähköposteja.",
  "support.emailTemplatesC1":
    "Siirry kohtaan Asetukset → Sähköpostimallit mukauttaaksesi sähköpostejasi.",
  "support.emailTemplatesC2":
    "Esikatsele sähköpostien ulkoasua ennen lähettämistä sisäänrakennetun esikatselun avulla.",
  "support.emailTemplatesC3":
    "Lisää mukautettuja viestejä varausta kohden vahvistaessasi tai peruuttaessasi.",
  "support.emailTemplatesC4":
    "Sähköpostit tukevat monikielistä sisältöä (EN, FI, SV).",
  "support.brandingTitle": "Asetukset ja toimipaikkojen asetussivut",
  "support.brandingDesc":
    "Mukauta julkinen varaussivusi brändi-identiteetilläsi.",
  "support.brandingC1": "Lataa logosi ja aseta pää-/tehostevärit asetuksissa.",
  "support.brandingC2": "Lisää pääkuva varaussivusi otsikkoon.",
  "support.brandingC3": "Yrityksen kuvaus näkyy varaussivulla vieraille.",
  "support.brandingC4": "",
  "support.openingHoursTitle": "Aukioloajat",
  "support.openingHoursDesc":
    "Määritä, milloin yrityksesi hyväksyy varauksia kullekin varaustyypille.",
  "support.openingHoursC1":
    "Aseta varaustyypeille (ravintola, tapahtumapaikka, hotelli, hyvinvointi, mukautettu) oletusaukioloajat organisaatiotasolla. Ne koskevat kaikkia kyseisen tyypin resursseja, ellei niitä ohiteta.",
  "support.openingHoursC2":
    "Valitse samat ajat kaikille avoimille päiville tai aseta eri ajat per päivä, ja merkitse yksittäisiä päiviä suljetuiksi.",
  "support.openingHoursC3":
    "Aukioloajat määrittävät, mitkä aikavälit näkyvät julkisella varaussivulla.",
  "support.openingHoursC4":
    "Käytä estettyjä aikoja sulkeaksesi tilapäisesti tietyn päivän tai aikavälin muuttamatta viikko-ohjelmaa.",
  "support.openingHoursC5":
    "Kolme tasoa, tarkin voittaa: organisaation oletukset, toimipistekohtaiset ohitukset (Business-tilaus) ja resurssikohtaiset aukioloajat. Mikä tahansa resurssityyppi voi saada oman viikko-ohjelmansa, ei vain ravintolat.",
  "support.openingHoursC6":
    "Tilapäiset työajat: avaa tietty päivä ja kellonaika satunnaisille työntekijöille (esim. hyvinvointialan ammattilainen, joka työskentelee vain joinakin lauantaisin). Varauskalenteri avaa kyseisen päivän, vaikka viikko-ohjelma merkitsisi sen suljetuksi; estetyt ajat pätevät edelleen.",
  "support.openingHoursC7":
    "Jokainen resurssi voi ohittaa aikavyöhykkeensä (IANA-nimi, esim. Europe/Helsinki). Jos jätetään tyhjäksi, käytetään organisaation aikavyöhykettä. Kaikki kellonaikatarkistukset (tämä päivä, viikonpäivä, aikavälit) käyttävät resurssin tehokasta aikavyöhykettä.",
  "support.resourcesTitle": "Resurssit ja huoneet",
  "support.resourcesDesc":
    "Hallinnoi varattavissa olevia huoneita, pöytiä ja tapahtumatiloja.",
  "support.resourcesC1": "Lisää resursseja kojelaudan Resurssit-osioon.",
  "support.resourcesC2":
    "Aseta kapasiteetti, hinnoittelu ja kuvaukset kullekin resurssille.",
  "support.resourcesC3":
    "Lataa valokuvia esitelläksesi tilojasi varaussivulla.",
  "support.resourcesC4":
    "Poista resurssit käytöstä piilottaaksesi ne väliaikaisesti varauksista.",
  "support.staffTitle": "Käyttäjähallinta",
  "support.staffDesc":
    "Kutsu tiimin jäseniä ja hallinnoi rooleja ja käyttöoikeuksia.",
  "support.staffC1":
    "Omistajat voivat kutsua henkilökuntaa hallintapaneelin kautta.",
  "support.staffC2":
    "Roolit: Omistaja (täydet oikeudet), Ylläpitäjä (resurssien hallinta), Henkilökunta (varausten tarkastelu).",
  "support.staffC3": "Hyväksy tai poista tiimin jäseniä milloin tahansa.",
  "support.staffC4":
    "Paketeissa on henkilöstökäyttäjän ja varaustyypin rajoitukset, päivitä lisätäksesi lisää.",
  "support.billingTitle": "Tilaukset ja laskutus",
  "support.billingDesc": "Hinnoitteluportaat ja tilausten hallinnointi.",
  "support.billingC1":
    "Basic (19 €/kk): 1 varaustyyppi, 1-5 työntekijäkäyttäjää, tekoälychatbot-tuki.",
  "support.billingC2":
    "Professional (59 €/kk): Kaikki varaustyypit (yksi per tyyppi), jopa 25 työntekijäkäyttäjää, tekoälychatbot-tuki.",
  "support.billingC3":
    "Business (179 €/kk): Kaikki varaustyypit ja rajoittamaton määrä, rajoittamaton määrä työntekijäkäyttäjiä, prioriteettituki 24 tunnin vasteajalla.",
  "support.billingC4":
    "Voit päivittää tai alentaa tilausta milloin tahansa. Muutokset tulevat voimaan seuraavalla laskutuskaudella.",
  "support.faqTitle": "Usein kysytyt kysymykset",
  "support.faqDesc":
    "Vastauksia yleisimpiin MimmoBookia koskeviin kysymyksiin.",
  "support.faqC1":
    "K: Voinko käyttää omaa verkkotunnustani? V: Mukautetut verkkotunnukset ovat jatkokehityssuunnitelmassamme.",
  "support.faqC2":
    "K: Miten vieraat saavat vahvistukset? V: Automaattisesti sähköpostitse, kun vahvistat varauksen.",
  "support.faqC3":
    "K: Voinko tulostaa tietoni? V: Kyllä, raportit voi tulostaa Raportit-paneelista.",
  "support.faqC4":
    "K: Mitä eroa on tekoälychatbotilla ja prioriteettituella? A: Kaikkiin paketteihin sisältyy MimmoAid, 24/7 toimiva tekoälychatbottimme. Liiketoimintapakettiin lisätään alustalla esitettyihin tukipyyntöihin vuorokauden vastaustakuu.",
  "support.faqC5": "",
  "support.catBasics": "Perusteet",
  "support.catReservations": "Varaukset",
  "support.catCommunication": "Viestintä",
  "support.catCustomization": "Mukauttaminen",
  "support.catConfiguration": "Asetukset",
  "support.catTeam": "Tiimi",
  "support.catBilling": "Laskutus",
  "support.catFaq": "UKK",

  // What Is MimmoBook
  "whatIs.badge": "Tietoa alustasta",
  "whatIs.heroTitle": "Mikä on MimmoBook?",
  "whatIs.heroSubtitle":
    "MimmoBook on pilvipohjainen varausten hallintajärjestelmä ravintoloille, tapahtumapaikoille, hotelleille ja majataloille. Yksi työkalu kaikkien varaustesi hallintaan.",
  "whatIs.seeFeatures": "Katso kaikki ominaisuudet",
  "whatIs.definitionTitle": "MimmoBook: Varausten hallinta ravintola-alalle",
  "whatIs.definitionP1":
    "MimmoBook on SaaS-alusta, joka auttaa majoitus- ja ravintola-alan yrityksiä hallitsemaan varauksia verkossa. Riippumatta siitä, pyöritätkö ravintolaa, tapahtuma­paikkaa, hotellia tai majataloa, MimmoBook tarjoaa keskitetyn hallintapaneelin varausten, vierasviestinnän ja liiketoiminnan seurantaan.",
  "whatIs.definitionP2":
    "Toisin kuin yleiset varaustyökalut, MimmoBook on suunniteltu nimenomaan ravintola-alalle. Se tukee useita varaustyyppejä, kuten pöytävarauksia, huonevarauksia, tilavuokrausta, catering-tilauksia ja popup-tapahtumia, kaikki yhdellä tilillä. Jokainen yritys saa brändätyn varaussivun.",
  "whatIs.definitionP3":
    "MimmoBook on saatavilla englanniksi, suomeksi ja ruotsiksi, mikä tekee siitä ihanteellisen Pohjoismaissa ja kansainvälisesti toimiville yrityksille. Alusta skaalautuu yksittäisestä ravintolasta usean toimipisteen ravintola-alan konserniin.",
  "whatIs.whoTitle": "Kenelle MimmoBook on tarkoitettu?",
  "whatIs.whoSubtitle":
    "MimmoBook palvelee kaikenkokoisia ravintola-alan yrityksiä neljässä pääkategoriassa.",
  "whatIs.whoRestaurants": "Ravintolat",
  "whatIs.whoRestaurantsDesc":
    "Hallitse pöytävarauksia, set-menuja ja vierastoiveita. Käsittele walk-in- ja verkkovaraukset yhdestä hallintapaneelista.",
  "whatIs.whoVenues": "Tapahtumapaikat",
  "whatIs.whoVenuesDesc":
    "Koordinoi tilavarauksia, laitetarpeita, catering-pyyntöjä ja tapahtuma-aikatauluja automaattisilla vahvistuksilla.",
  "whatIs.whoHotels": "Hotellit",
  "whatIs.whoHotelsDesc":
    "Hallitse huonevarauksia, sisään-/uloskirjautumista, aamiaisvaihtoehtoja ja huonetyyppihinnoittelua.",
  "whatIs.whoGuesthouses": "Majatalot",
  "whatIs.whoGuesthousesDesc":
    "Yksinkertaista vierasmajoitusta helppokäyttöisellä huonevarauksella, saatavuuden hallinnalla ja henkilökohtaisella viestinnällä.",
  "whatIs.whoWellness": "Hyvinvointipalvelut",
  "whatIs.whoWellnessDesc":
    "Kampaajat, hierojat, meikkitaiteilijat ja vastaavat palveluntarjoajat voivat julkaista palveluvalikon, josta asiakas valitsee haluamansa, ja varauksen kesto mukautuu automaattisesti.",
  "whatIs.howTitle": "Miten MimmoBook toimii?",
  "whatIs.howSubtitle": "Aloita neljässä yksinkertaisessa vaiheessa.",
  "whatIs.howStep1": "Rekisteröidy",
  "whatIs.howStep1Desc":
    "Luo tili ja aloita 30 päivän ilmainen kokeilu. Luottokorttia ei tarvita.",
  "whatIs.howStep2": "Määritä asetukset",
  "whatIs.howStep2Desc":
    "Aseta yritysprofiilisi, varaustyypit, aukioloajat ja brändäys.",
  "whatIs.howStep3": "Jaa",
  "whatIs.howStep3Desc":
    "Jaa brändätty varaussivusi vieraille verkkosivusi, sosiaalisen median tai sähköpostin kautta.",
  "whatIs.howStep4": "Hallitse",
  "whatIs.howStep4Desc":
    "Käsittele kaikki varaukset hallintapaneelista automaattisilla sähköposteilla, raporteilla ja tiimivälineillä.",
  "whatIs.keyFeaturesTitle": "Keskeiset ominaisuudet",
  "whatIs.feat1": "Älykkäät varaukset",
  "whatIs.feat1Desc":
    "Vastaanota ja hallitse varauksia ravintoloille, tiloille, hotelleille ja majataloille yhdellä alustalla.",
  "whatIs.feat2": "Oma brändäys",
  "whatIs.feat2Desc":
    "Varaussivusi heijastaa brändiäsi mukautetuilla väreillä, logolla ja kuvilla.",
  "whatIs.feat3": "Tiiminhallinta",
  "whatIs.feat3Desc":
    "Kutsu henkilökuntaa, määritä rooleja ja hallitse käyttöoikeuksia koko tiimillesi.",
  "whatIs.feat4": "Monikielinen tuki",
  "whatIs.feat4Desc":
    "Hallintapaneeli ja varaussivut saatavilla englanniksi, suomeksi ja ruotsiksi.",
  "whatIs.feat5": "Raportit ja analytiikka",
  "whatIs.feat5Desc":
    "Seuraa liikevaihtoa, käyttöastetta ja varaustrendejä vietävillä raporteilla.",
  "whatIs.feat6": "Automaattiset sähköpostit",
  "whatIs.feat6Desc":
    "Vahvistus-, muistutus- ja peruutussähköpostit lähetetään automaattisesti vieraille.",
  "whatIs.allFeatures": "Katso kaikki ominaisuudet",
  "whatIs.ctaTitle": "Valmiina yksinkertaistamaan varauksesi?",
  "whatIs.ctaSubtitle":
    "Aloita 30 päivän ilmainen kokeilu tänään. Luottokorttia ei tarvita.",

  // Features Page
  "featuresPage.badge": "Alustan ominaisuudet",
  "featuresPage.heroTitle": "Kaikki mitä tarvitset varausten hallintaan",
  "featuresPage.heroSubtitle":
    "Varaussivuista raportteihin, MimmoBook tarjoaa täydellisen työkalupakin ravintola-alan varausten hallintaan.",
  "featuresPage.ctaTitle": "Aloita varausten hallinta tänään",
  "featuresPage.ctaSubtitle":
    "Kokeile kaikkia ominaisuuksia ilmaiseksi 30 päivää. Luottokorttia ei tarvita.",
  "featuresPage.comparePlans": "Vertaa paketteja",
  "features.catReservations": "Varausten hallinta",
  "features.catBranding": "Brändäys ja varaussivut",
  "features.catManagement": "Tiimi- ja liiketoiminnan hallinta",
  "features.catComms": "Viestintä ja raportointi",
  "features.f1Title": "Monityyppiset varaukset",
  "features.f1Desc":
    "Tuki pöytävarauksille, huonevarauksille, tilavuokraukselle, catering-tilauksille ja popup-tapahtumille yhdellä tilillä.",
  "features.f2Title": "Aukioloajat ja saatavuus",
  "features.f2Desc":
    "Määritä aukioloajat varaustyyppien mukaan estettävillä aikaväleillä ja toistuvilla sulkemisilla.",
  "features.f3Title": "Automaattiset muistutukset",
  "features.f3Desc":
    "Vieraat saavat automaattisen muistutussähköpostin ennen varaustaan no-show-tapausten vähentämiseksi.",
  "features.f4Title": "Alennuskoodit",
  "features.f4Desc":
    "Luo prosentti- tai euromääräisiä alennuskoodeja käyttörajoilla ja päivämäärärajoituksilla.",
  "features.f5Title": "Brändätyt varaussivut",
  "features.f5Desc":
    "Julkinen varaussivusi näyttää logosi, värisi, pääkuvasi ja yrityskuvauksen.",
  "features.f6Title": "Oma verkkotunnus -valmis",
  "features.f6Desc":
    "Jokainen yritys saa yksilöllisen varaus-URL:n. Jaa se verkkosivullasi, sosiaalisessa mediassa tai painomateriaaleissa.",
  "features.f7Title": "Monikielinen (EN/FI/SV)",
  "features.f7Desc":
    "Hallintapaneeli ja varaussivut ovat täysin käännetty englanniksi, suomeksi ja ruotsiksi.",
  "features.f8Title": "Mobiiliresponsiivinen",
  "features.f8Desc":
    "Varaussivu ja hallintapaneeli toimivat täydellisesti puhelimilla, tableteilla ja pöytäkoneilla.",
  "features.f9Title": "Tiimiroolit ja oikeudet",
  "features.f9Desc":
    "Kutsu henkilökuntaa omistajiksi, ylläpitäjiksi tai tiimin jäseniksi tarkalla oikeuksien hallinnalla.",
  "features.f10Title": "Resurssien hallinta",
  "features.f10Desc":
    "Luo ja hallitse huoneita, pöytiä, tapahtumatiloja ja muita varattavia resursseja kuvilla ja kuvauksilla.",
  "features.f11Title": "Usean toimipisteen tuki",
  "features.f11Desc":
    "Hallitse useita toimipisteitä yhdellä tilillä omalla brändäyksellä, henkilökunnalla ja raportoinnilla per toimipiste.",
  "features.f12Title": "Hyväksyntätyönkulut",
  "features.f12Desc":
    "Tarkista ja hyväksy varaukset, resurssimuutokset ja estetyt aikavälit ennen niiden julkaisemista.",
  "features.f13Title": "Sähköpostimallit",
  "features.f13Desc":
    "Mukauta vahvistus-, muistutus- ja peruutussähköpostit varaustyypin ja kielen mukaan.",
  "features.f14Title": "Mukautetut sähköpostimallit",
  "features.f14Desc":
    "Business-paketin käyttäjät voivat täysin mukauttaa sähköpostien HTML:n omalla brändäyksellään.",
  "features.f15Title": "Raportit ja analytiikka",
  "features.f15Desc":
    "Liikevaihtoraportit, varaustrendit, käyttöasteet ja CSV-viennit kirjanpitoon.",
  "features.f16Title": "Laskutuksen seuranta",
  "features.f16Desc":
    "Merkitse varaukset laskutetuiksi ja seuraa laskuttamatonta liikevaihtoa kaikissa varaustyypeissä.",
  "features.f17Title": "Tarjoukset ja ehdotukset",
  "features.f17Desc":
    "Luo ammattimaisia tarjouksia PDF-muodossa ja lähetä ne suoraan vieraille sähköpostilla.",
  "features.f18Title": "Ristiinvaraukset",
  "features.f18Desc":
    "Yhdistä varauksia eri tilojen ja palvelujen välillä. Merkitse yhdistetyt varaukset käytetyiksi tai laskutetuiksi yhdessä.",
  "features.catGuests": "Vieraskokemus ja itsepalvelu",
  "features.catOperations": "Päivittäinen toiminta",
  "features.catSecurity": "Turvallisuus ja luottamus",
  "features.catPlatform": "Alusta ja tehokkuus",
  "features.f19Title": "Vieraan oma varaussivu",
  "features.f19Desc":
    "Vieras avaa oman varauksensa turvallisesta linkistä, katsoo tai peruu sen ilman tiliä.",
  "features.f20Title": "Jonotuslista",
  "features.f20Desc":
    "Kun aika on täynnä, vieras liittyy jonoon ja saa sähköpostin heti kun paikka vapautuu.",
  "features.f21Title": "Siirtopyynnöt",
  "features.f21Desc":
    "Vieras ehdottaa uutta aikaa omalta varaussivultaan ja henkilökunta hyväksyy tai hylkää sen.",
  "features.f22Title": "Vieraiden arviot",
  "features.f22Desc":
    "Käynnin jälkeen lähtee arviopyyntö, ja julkaisemasi arviot näkyvät varaussivullasi.",
  "features.f23Title": "Keittiötilaukset",
  "features.f23Desc":
    "Seuraa ruokia, juomia ja huomioita varauskohtaisesti tiloissa vastaanotettu, valmistuksessa, valmis ja tarjoiltu.",
  "features.f24Title": "Valmis keittiön menu",
  "features.f24Desc":
    "Tallenna tuotteet kertaalleen, niin nimi, kategoria ja hinta täyttyvät tilausriville yhdellä klikkauksella.",
  "features.f25Title": "Tulostettavat keräyslistat",
  "features.f25Desc":
    "Tulosta keittiön, majoituksen ja tapahtumien listat valitulle päivälle, jotta tiimi voi työskennellä paperilta.",
  "features.f26Title": "Kalenterisynkronointi",
  "features.f26Desc":
    "Tilaa varaussyötteesi Google-, Apple- tai Outlook-kalenteriin.",
  "features.f27Title": "Erikoistilaisuudet",
  "features.f27Desc":
    "Nimeä päivä, aseta sen kapasiteetti ja valitse kiinteät kattaukset tai vapaa varaus normaalien aukioloaikojen sijaan.",
  "features.f28Title": "Varauslaskut",
  "features.f28Desc":
    "Lataa PDF-lasku, jossa näkyy alkuperäinen summa, käytetty alennuskoodi, alennus ja loppusumma.",
  "features.f29Title": "Ruuhkatunnit ja vilkkain päivä",
  "features.f29Desc":
    "Näe mitkä tunnit ja viikonpäivät täyttyvät ensin, ja mitoita työvuorot ja hinnat sen mukaan.",
  "features.f30Title": "Varauskanavien jakauma",
  "features.f30Desc":
    "Vertaa kuinka moni varaus tulee julkiselta sivulta ja kuinka moni henkilökunnan lisäämänä.",
  "features.f31Title": "Sähköpostien aikajana",
  "features.f31Desc":
    "Jokainen varaus näyttää mitkä sähköpostit jonotettiin, lähetettiin tai epäonnistuivat ja milloin.",
  "features.f32Title": "Kaksivaiheinen kirjautuminen",
  "features.f32Desc":
    "Suojaa tilit tunnistussovelluksen koodilla ja kertakäyttöisillä palautuskoodeilla.",
  "features.f33Title": "Tapahtumaloki",
  "features.f33Desc":
    "Näe kuka muutti mitä ja milloin, suodatettuna toiminnon, ajanjakson tai henkilön mukaan.",
  "features.f34Title": "Kirjautumisen suojaus",
  "features.f34Desc":
    "Pitkät salasanat, tarkistus tunnetuista vuotaneista salasanoista ja raja toistuville kirjautumisyrityksille.",
  "features.f35Title": "Tietojen eriyttäminen ja säilytys",
  "features.f35Desc":
    "Tietosi pysyvät erillään muista yrityksistä, ja arkistointi sekä poisto tapahtuvat automaattisesti aikataulun mukaan.",
  "features.f36Title": "Jakaminen ja upotus",
  "features.f36Desc":
    "Valmiit varauslinkit, palvelu- ja toimipistekohtaiset linkit sekä upotus omalle verkkosivullesi.",
  "features.f37Title": "Tumma tila ja pikanäppäimet",
  "features.f37Desc":
    "Työskentele vaalealla tai tummalla teemalla ja siirry näkymien välillä pikanäppäimillä.",
  "features.f38Title": "Käyttöönoton muistilista",
  "features.f38Desc":
    "Edistymiskortti ohjaa sinut resurssien, aukioloaikojen ja sähköpostien läpi heti ensimmäisenä päivänä.",
  "features.f39Title": "Opas ja tukiavustaja",
  "features.f39Desc":
    "Sisäänrakennettu opas, tulostettava henkilökunnan ohje ja tukiavustaja, joka vastaa kysymyksiin sovelluksessa.",
  "features.offersAndCross": "Tarjoukset ja ristiinvaraukset",
  "features.offersAndCrossDesc":
    "Luo tarjouksia, generoi brändätyt PDF:t ja yhdistä varauksia tilojen välillä ja hallitse kaikkea yhdessä.",

  // Use Cases
  "useCases.badge": "Käyttökohteet",
  "useCases.ogTitle":
    "Ajanvaraus partureille, kampaajille, hierojille, leipomoille ja valmentajille",
  "useCases.ogDescription":
    "Palvelualan ammattilaiselle: varaukset vuorokauden ympäri, jonotuslista, palveluiden hinnat, muistutukset ja asiakaspalautteet. Myös ravintoloille, tiloille ja hotelleille.",
  "useCases.ogImageAlt":
    "MimmoBookin käyttökohteet palvelualalle ja majoitus- ja ravintola-alalle",
  "useCases.seoTitle": "Käyttökohteet: parturit, kampaajat, hierojat, leipomot",
  "useCases.seoDescription":
    "Katso miten MimmoBook toimii partureille, kampaajille, hierojille, leipureille, personal trainereille, meikkitaiteilijoille, ravintoloille, tiloille, hotelleille ja cateringille.",
  "useCases.seoKeywords":
    "parturi ajanvaraus, kampaamo ajanvarausjärjestelmä, hieroja ajanvaraus, leipomo tilausjärjestelmä, personal trainer ajanvaraus, meikkitaiteilija ajanvaraus, palvelualan ajanvaraus, ravintolan pöytävaraus, tilavaraus",
  "useCases.heroTitle":
    "Rakennettu kaikenlaisille ravintola- ja palvelualan yrityksille",
  "useCases.heroSubtitle":
    "Katso miten MimmoBook ratkaisee varaushaasteet ravintoloille, tiloille, hotelleille, majataloille, cateringille, popup-tapahtumille ja palvelualan ammattilaisille: parturit, kampaajat, hierojat, leipurit, meikkitaiteilijat ja personal trainerit.",
  "useCases.challengesLabel": "Yleiset haasteet",
  "useCases.solutionLabel": "Miten MimmoBook auttaa",
  "useCases.restaurant": "Ravintolavaraukset",
  "useCases.restaurantDesc":
    "Ravintoloiden on hallittava pöytävarauksia, walk-in-asiakkaita, set-menuja ja erityisruokavaliovaatimuksia samalla kun ne seuraavat asiakastoiveita ja no-show-lukuja.",
  "useCases.restaurantChallenges":
    "Puhelinvaraus on aikaa vievää ja virhealtista. Ruuhka-ajat luovat pullonkauloja. No-showt hukkaavat kapasiteettia. Manuaalinen seuranta menettää asiakastoiveet.",
  "useCases.restaurantSolution":
    "MimmoBook tarjoaa brändätyn verkkovaraussivun, jossa vieraat palvelevat itseään. Automaattiset vahvistukset ja muistutukset vähentävät no-show-tapauksia. Kaikki asiakastiedot ja toiveet ovat yhdessä paikassa.",
  "useCases.venue": "Tila- ja tapahtumavaraukset",
  "useCases.venueDesc":
    "Tapahtumapaikkojen on koordinoitava tilojen saatavuutta, laitteita, cateringia ja henkilökuntaa samalla kun ne hallitsevat useita varauksia.",
  "useCases.venueChallenges":
    "Tuplavaraukset sähköposti- tai puhelinvarausten yhteydessä. Monimutkaiset logistiikkaketjut useiden tilojen välillä. Hajanainen asiakasviestintä. Vaikeus seurata liikevaihtoa tapahtumatyypeittäin.",
  "useCases.venueSolution":
    "MimmoBookin resurssien hallinta estää tuplavaraukset. Jokaisella tilalla on oma saatavuuskalenteri. Automaattiset sähköpostit pitävät asiakkaat ajan tasalla.",
  "useCases.hotel": "Hotellihuonevaraukset",
  "useCases.hotelDesc":
    "Hotellien on hallittava huoneiden saatavuutta, sisään-/uloskirjautumista, huonetyyppejä, hinnoittelutasoja ja aamiaisvaihtoehtoja.",
  "useCases.hotelChallenges":
    "Huoneinventaarion hallinta huonetyypeittäin. Manuaalinen sisään-/uloskirjautumisen seuranta. Aamiaisvaihtoehtojen ja hinnoittelun koordinointi. Ammattimaisen varauskokemus ilman kalliita järjestelmiä.",
  "useCases.hotelSolution":
    "MimmoBook tukee huonetyyppihinnoittelua, vuodekokoonpanoja, aamiaisvaihtoehtoja ja sisään-/uloskirjautumisen seurantaa. Brändätty varaussivu tarjoaa vieraille ammattimaisen varauskokemuksen.",
  "useCases.guesthouse": "Majatalovaraukset",
  "useCases.guesthouseDesc":
    "Majatalot ja B&B:t tarvitsevat yksinkertaisen järjestelmän vierasmajoituksen, saatavuuden ja viestinnän hallintaan ilman yritysohjelmistojen monimutkaisuutta.",
  "useCases.guesthouseChallenges":
    "Yrityshotellijärjestelmät ovat liian monimutkaisia ja kalliita. Taulukot ja puhelinvaraukset menettävät varauksia. Ei automatisoitua vierasviestintää. Saatavuuden näyttäminen verkossa on vaikeaa.",
  "useCases.guesthouseSolution":
    "MimmoBook tarjoaa yksinkertaisen, edullisen varausjärjestelmän majataloille sopivana. Vieraat varaavat suoraan brändätyn sivun kautta. Automaattiset sähköpostit hoitavat vahvistukset ja muistutukset.",
  "useCases.catering": "Catering-tilaukset",
  "useCases.cateringDesc":
    "Catering-yritysten on hallittava toimitustietoja, menuvalintoja, erityisruokavaliovaatimuksia ja tapahtumakohtaista logistiikkaa jokaisessa tilauksessa.",
  "useCases.cateringChallenges":
    "Tilaustiedot hukkuvat sähköpostiketjuihin. Erityisruokavaliovaatimukset jäävät huomaamatta. Ei keskitettyä näkymää tuleviin tilauksiin. Manuaalinen koordinointi hukkaa aikaa.",
  "useCases.cateringSolution":
    "MimmoBook tallentaa kaikki catering-tiedot rakenteellisiin varauslomakkeisiin. Toimitusosoitteet, ruokavaliotiedot ja vierasmäärät tallennetaan tilauskohtaisesti.",
  "useCases.popup": "Popup-tapahtumat ja markkinat",
  "useCases.popupDesc":
    "Popup-tapahtumien järjestäjien on hallittava myyjähakemuksia, kojujen jakoa ja tapahtumien logistiikkaa tilapäisissä paikoissa.",
  "useCases.popupChallenges":
    "Myyjähallinta sähköpostilla on kaoottista. Kojujen jako tehdään manuaalisesti. Ei keskitettyä näkymää myyjätietoihin. Maksuseuranta on epäjohdonmukaista.",
  "useCases.popupSolution":
    "MimmoBookin popup-varaustyyppi tallentaa kojun koon, maksut, laitetarpeet ja myyjätiedot. Järjestäjät näkevät kaikki hakemukset yhdessä hallintapaneelissa hyväksyntätyönkulujen kanssa.",
  "useCases.wellness": "Hyvinvointi- ja palvelualan varaukset",
  "useCases.wellnessDesc":
    "Kampaajat, hierojat, meikkitaiteilijat ja vastaavat palveluntarjoajat tarvitsevat asiakkailtaan oikean mittaisen ajanvarauksen, ja se vaihtelee valittujen palveluiden mukaan.",
  "useCases.wellnessChallenges":
    "Asiakkaat eivät aina tiedä, kuinka kauan käynti kestää. Useiden palveluiden yhdistäminen samaan käyntiin on vaikea kertoa puhelimessa. Palveluiden kestojen laskeminen käsin on virhealtista.",
  "useCases.wellnessSolution":
    "MimmoBookilla julkaiset valittavan palveluvalikon, jossa jokaisella palvelulla on hinta ja kesto (5 minuutin välein, korkeintaan 8 tuntia). Asiakas rastittaa haluamansa ja varauksen kesto mukautuu automaattisesti. Ei maksuja, vain ajanvaraus.",
  "useCases.workflowsTitle": "Näin palvelualan ammattilainen hoitaa viikkonsa",
  "useCases.workflowsSubtitle":
    "Neljä arkista esimerkkiä varauksista, jonotuslistasta, hinnoista ja laskutuksesta sekä asiakaspalautteista MimmoBookissa. Asiakas maksaa sinulle paikan päällä tai laskulla, MimmoBook pitää ajat, hinnat ja paperit järjestyksessä.",
  "useCases.wf1Role": "Kampaaja tai parturi",
  "useCases.wf1Focus": "Varaukset",
  "useCases.wf1S1":
    "Julkaiset palvelusi, joilla on kullakin hinta ja kesto, ja asetat aukioloajat päivittäin.",
  "useCases.wf1S2":
    "Asiakas valitsee palvelun omalla varaussivullasi, ja varauksen pituus mukautuu valittuun palveluun.",
  "useCases.wf1S3":
    "Asiakas saa heti vahvistusviestin, sinä saat varauksen kalenteriin ja ilmoituksen sovellukseen.",
  "useCases.wf1S4":
    "Muistutusviesti lähtee ennen käyntiä, ja merkitset asiakkaan saapuneeksi tuoliin.",
  "useCases.wf2Role": "Hieroja",
  "useCases.wf2Focus": "Jonotuslista",
  "useCases.wf2S1":
    "Kun toivotut ajat ovat täynnä, asiakas liittyy haluamansa päivän jonotuslistalle.",
  "useCases.wf2S2":
    "Näet kaikki jonottajat nimineen, puhelinnumeroineen ja toivepäivineen yhdessä listassa.",
  "useCases.wf2S3":
    "Peruutus vapauttaa tunnin, joten otat yhteyttä listan ensimmäiseen ja merkitset hänet ilmoitetuksi.",
  "useCases.wf2S4":
    "Lisäät varauksen itse parilla klikkauksella tai annat asiakkaan varata vapautuneen ajan.",
  "useCases.wf3Role": "Leipomo tai kakkujen tekijä",
  "useCases.wf3Focus": "Hinnat ja laskutus",
  "useCases.wf3S1":
    "Tilaukset saapuvat noutopäivän, määrän ja asiakkaan kirjaamien ruokavaliotietojen kanssa.",
  "useCases.wf3S2":
    "Asetat hinnan itse tai annat julkaistujen palveluhintojen laskea summan automaattisesti.",
  "useCases.wf3S3":
    "Yritysasiakkaalle lähetät ilmeesi mukaisen tarjouksen PDF:nä ja liität useita tilauksia samaan tapahtumaan.",
  "useCases.wf3S4":
    "Merkitset tilauksen laskutetuksi, ja raportit näyttävät mikä on vielä laskuttamatta.",
  "useCases.wf4Role": "Personal trainer",
  "useCases.wf4Focus": "Asiakaspalautteet",
  "useCases.wf4S1":
    "Käynnin jälkeen asiakas saa henkilökohtaisen linkin, jolla hän antaa arvosanan ja kommentin.",
  "useCases.wf4S2":
    "Kaikki palautteet tulevat hallintanäkymään, ja vain julkaisemasi näkyvät ulospäin.",
  "useCases.wf4S3":
    "Julkaistut palautteet näkyvät varaussivullasi, joten uudet asiakkaat näkevät aitoa palautetta ennen varausta.",
  "useCases.wf4S4":
    "Arvosanojen kehitys näkyy raporteissa varausten, ruuhkatuntien ja peruutusten rinnalla.",
  "useCases.tradeCtaTitle":
    "Aloita varaussivulla, joka on tehty juuri sinun alallesi",
  "useCases.tradeCtaSubtitle":
    "Valitse työsi ja ota käyttöön saman iltapäivän aikana. Jokainen taso alkaa 30 päivän ilmaisella kokeilulla, korttia ei tarvita.",
  "useCases.tradeCtaBarberName": "Parturit",
  "useCases.tradeCtaBarberLine":
    "Kiinteät hius ja partaajat peräkkäin, ja muistutukset vähentävät turhia peruuntumisia.",
  "useCases.tradeCtaBarberButton": "Ota parturivaraukset käyttöön",
  "useCases.tradeCtaHairdresserName": "Kampaajat",
  "useCases.tradeCtaHairdresserLine":
    "Väri ja hoitoajat lasketaan automaattisesti, kun asiakas valitsee palvelut.",
  "useCases.tradeCtaHairdresserButton": "Ota kampaamovaraukset käyttöön",
  "useCases.tradeCtaMassageName": "Hierojat",
  "useCases.tradeCtaMassageLine":
    "30, 60 ja 90 minuutin hoidot sekä jonotuslista kiireisimmille tunneille.",
  "useCases.tradeCtaMassageButton": "Ota hoitovaraukset käyttöön",
  "useCases.tradeCtaBakerName": "Leipomot",
  "useCases.tradeCtaBakerLine":
    "Kakku ja tilaustuotteet noutopäivän, ruokavaliotietojen, hintojen ja laskutuksen kanssa.",
  "useCases.tradeCtaBakerButton": "Ota tilausvaraukset käyttöön",
  "useCases.tradeCtaMakeupName": "Meikkitaiteilijat",
  "useCases.tradeCtaMakeupLine":
    "Hää ja tapahtumavaraukset osoitteen, meikattavien määrän ja oman PDF-tarjouksen kanssa.",
  "useCases.tradeCtaMakeupButton": "Ota meikkivaraukset käyttöön",
  "useCases.tradeCtaTrainerName": "Personal trainerit",
  "useCases.tradeCtaTrainerLine":
    "Toistuvat treenit, saapumisen kirjaus ja julkaistut asiakaspalautteet sivullasi.",
  "useCases.tradeCtaTrainerButton": "Ota treenivaraukset käyttöön",
  "useCases.ctaTitle": "Löysitkö käyttökohteesi?",
  "useCases.ctaSubtitle":
    "Aloita ilmainen 30 päivän kokeilu ja luo ensimmäinen varaussivusi minuuteissa.",

  // Blog
  "blog.badge": "Blogi",
  "blog.heroTitle": "Ravintola-alan oivalluksia ja oppaita",
  "blog.heroSubtitle":
    "Vinkkejä, parhaita käytäntöjä ja oivalluksia ravintola-alan yrityksille varausten hallinnasta.",
  "blog.readMore": "Lue lisää",
  "blog.backToBlog": "Takaisin blogiin",
  "blog.postCta": "Valmiina tehostamaan varaustenhallintaa?",
  "blog.relatedReading": "Lue myös",
  "blog.ctaTitle": "Pysy ajan tasalla",
  "blog.ctaSubtitle":
    "Kokeile MimmoBookia ilmaiseksi 30 päivää ja katso miten se muuttaa varaustenhallintasi.",
  "blog.catInsights": "Oivallukset",
  "blog.catGuides": "Oppaat",
  "blog.post1Title":
    "5 varaushaastetta, joita pienet ravintola-alan yritykset kohtaavat",
  "blog.post1Excerpt":
    "No-show-tapauksista tuplavarauksiin, pienet ravintolat, tilat ja majatalot kohtaavat ainutlaatuisia haasteita. Tässä niistä ja niiden ratkaisuista.",
  "blog.post1C1":
    "Pienet ravintola-alan yritykset, kuten ravintolat muutamalla pöydällä, boutique-tilat ja perhemajatalot, kohtaavat varaushaast­eita, jotka suuremmat toimijat ratkaisevat omistautuneella henkilökunnalla ja yritysohjelmistoilla. Mutta yritykselle, jossa on 5 to 30 asiakaspaikkaa tai muutama huone, nämä ratkaisut ovat ylimitoitettuja.",
  "blog.post1C2":
    "Ensimmäinen haaste on no-showt. Kun neljän hengen pöytä ei saavu 20-paikkaisessa ravintolassa, se on 20 % kapasiteetista hukassa. Automaattiset muistutussähköpostit 24 tuntia ennen varausta voivat vähentää no-show-lukuja 30 to 50 %.",
  "blog.post1C3":
    "Toinen haaste on tuplavaraukset. Kun varauksia tulee puhelimitse, sähköpostitse, Instagram-viesteillä ja walk-ineina, on helppoa varata sama pöytä tai huone kahdesti. Keskitetty varausjärjestelmä reaaliaikaisella saatavuudella poistaa tämän ongelman kokonaan.",
  "blog.post1C4":
    "Kolmanneksi asiakasviestintä on epäjohdonmukaista. Jotkut vieraat saavat vahvistussähköpostin, toiset eivät. Automaattiset sähköpostivirrat varmistavat, että jokainen vieras saa saman ammattimaisen kokemuksen.",
  "blog.post1C5":
    "Neljänneksi liikevaihdon seuranta on manuaalista ja virhealtista. Pienet yritykset käyttävät usein taulukoita tai paperia varausten seuraamiseen. Varausjärjestelmä sisäänrakennetuilla raporteilla ratkaisee tämän. Viidenneksi verkkonäkyvyys kärsii. Ilman ammattimaista varaussivua potentiaaliset vieraat eivät löydä saatavuutta helposti.",
  "blog.post2Title": "Miksi taulukot eivät toimi varaustenhallinnassa",
  "blog.post2Excerpt":
    "Taulukot ovat joustavia, mutta ne luovat ongelmia varaustenhallinnassa. Lue tästä miksi räätälöity ohjelmisto kannattaa.",
  "blog.post2C1":
    "Taulukot ovat monien pienyritysten oletustyökalu. Ne ovat ilmaisia, joustavia ja tuttuja. Mutta varaustenhallinnassa ne luovat ongelmia, jotka pahenevat ajan myötä.",
  "blog.post2C2":
    "Suurin ongelma on, etteivät taulukot ole reaaliaikaisia. Kun kaksi henkilökunnan jäsentä päivittää samaa taulukkoa, syntyy ristiriitoja. Ei ole live-saatavuusnäkymää, joten henkilökunnan on tarkistettava manuaalisesti ennen jokaista vahvistusta.",
  "blog.post2C3":
    "Taulukot eivät myöskään voi lähettää sähköposteja. Jokainen vahvistus, muistutus ja peruutus on hoidettava manuaalisesti. Omistettu varausjärjestelmä automatisoi kaiken vierasviestinnän.",
  "blog.post2C4":
    "Lopuksi taulukot eivät tarjoa analytiikkaa. Et voi helposti nähdä käyttöasteita, varaustrendejä tai liikevaihtoa varaustyypeittäin ilman monimutkaisia kaavoja. Varausohjelmisto tuottaa nämä raportit automaattisesti.",
  "blog.post3Title": "Miksi brändätyt varaussivut ovat tärkeitä yrityksellesi",
  "blog.post3Excerpt":
    "Geneerinen varauslomake ei kerro vieraille mitään brändistäsi. Brändätty varaussivu rakentaa luottamusta ja lisää konversioita.",
  "blog.post3C1":
    "Kun vieras vierailee varaussivullasi, se on usein heidän ensimmäinen vuorovaikutuksensa yrityksesi kanssa verkossa. Jos sivu on geneerinen lomake ilman brändäystä, se lähettää väärän viestin.",
  "blog.post3C2":
    "Brändätty varaussivu, logollasi, väreillä, pääkuvalla ja yrityskuvauksella, luo ammattimaisen ensivaikutelman. Tutkimukset osoittavat, että brändätyt varauskokemukset tuottavat 20 to 40 % korkeampia konversioasteita.",
  "blog.post3C3":
    "MimmoBook antaa jokaisen yrityksen mukauttaa varaussivunsa omalla brändäyksellään. Lataa logosi, aseta brändivärisi, lisää pääkuva ja kirjoita kuvaus. Tulos on varauskokemus, joka tuntuu verkkosivusi jatkeelta.",
  "blog.post4Title": "Varausten hallinta useissa toimipisteissä",
  "blog.post4Excerpt":
    "Usean toimipisteen ravintola-alan yritykset tarvitsevat keskitettyjä työkaluja. Näin hallitset varauksia eri paikoissa menettämättä hallintaa.",
  "blog.post4C1":
    "Useiden ravintola-alan toimipisteiden pyörittäminen, olipa kyseessä ravintolaketju, majataloryhmä tai tilat eri kaupungeissa, moninkertaistaa varaushallinnon monimutkaisuuden.",
  "blog.post4C2":
    "Haasteena on johdonmukaisuuden ylläpitäminen samalla kun kunnioitetaan jokaisen toimipisteen ainutlaatuisia tarpeita. Keskitetty järjestelmä mahdollistaa kaikkien toimipisteiden hallinnan yhdestä hallintapaneelista.",
  "blog.post4C3":
    "MimmoBookin usean toimipisteen ominaisuus on suunniteltu juuri tähän. Jokainen toimipiste saa oman brändätyn varaussivun, henkilökuntamäärityksensä ja raportointinsa.",
  "blog.post4C4":
    "Tärkein hyöty on näkyvyys. Sen sijaan, että kirjautuisit erillisiin järjestelmiin tai tarkistaisit useita taulukoita, näet kaikki toimipisteesi yhdessä paikassa.",
  "blog.post5Title":
    "Hyvinvointialan varaukset: helppokäyttöisyys kasvattaa liiketoimintaa",
  "blog.post5Excerpt":
    "Kylpylät, kauneushoitolat, joogastudiot ja hyvinvointiklinikat kasvavat sujuvilla varauksilla. Näin yksinkertainen varausjärjestelmä lisää asiakaskäyntejä ja liikevaihtoa.",
  "blog.post5C1":
    "Hyvinvointiala rakentuu luottamukselle ja tunnelmalle. Hierojista ja kylpylöistä joogastudioihin, kauneushoitoloihin, fysioterapiaklinikoihin ja meditaatioretriitteihin saakka jokainen kohtaaminen vaikuttaa siihen, palaako asiakas. Kokemus ei ala vastaanottotiskillä vaan siitä hetkestä, kun asiakas yrittää tehdä varauksen.",
  "blog.post5C2":
    "Helppokäyttöisyys on tärkein tekijä, kun kiinnostunut kävijä muutetaan maksavaksi asiakkaaksi. Hyvinvointiasiakkaat varaavat usein mobiililla myöhään illalla, stressaavan päivän jälkeen. Jos varaussivu on hidas, sekava tai piilossa puhelinnumeron ja aukioloaikojen takana, asiakas siirtyy kilpailijalle, jonka sivu toimii alle minuutissa. Selkeä, brändätty varauspolku, jossa on kuvaukset, hinnat ja reaaliaikainen saatavuus, poistaa kitkan ja nostaa konversiota merkittävästi.",
  "blog.post5C3":
    "Toistuvat käynnit ovat hyvinvointialan todellinen kasvun lähde. Ensikertalainen, joka varaa 60 minuutin hieronnan, on kannattava vasta palatessaan. Automaattiset vahvistus- ja muistutusviestit vähentävät no-show-tapauksia, kun taas tallennettu profiili, helppo uudelleenvaraus ja tunnistettava brändi pitävät asiakkaat uskollisina. Tutkimukset osoittavat, että itsepalveluvarauksia käyttävien hyvinvointiyritysten asiakaspysyvyys kasvaa 20 to 35 prosenttia verrattuna pelkkään puhelinvaraukseen.",
  "blog.post5C4":
    "Toiminnallisesti moderni varausjärjestelmä vapauttaa hyvinvointiyrittäjän vastaanotosta. Sen sijaan, että henkilökunta vastaa puheluihin hoitojen välissä, he keskittyvät asiakkaaseen. Moniresurssinen aikataulu hallitsee hoitajia, huoneita ja laitteita yhdessä näkymässä, jolloin tuplavaraukset jäävät pois. Raportit näyttävät, mitkä palvelut, ajat ja työntekijät tuottavat eniten, joten hinnoittelu, markkinointi ja vuorot voidaan suunnitella varmasti.",
  "blog.post5C5":
    "MimmoBook tarjoaa hyvinvointiyrityksille brändätyn varaussivun, automaattisen asiakasviestinnän, moniresurssisen aikataulun ja selkeän raportoinnin yhdessä paikassa. Se on rakennettu pienille ja kasvaville hyvinvointibrändeille, jotka haluavat näyttää ammattimaisilta verkossa, vähentää hallinnollista työtä ja luoda rauhallisen, vaivattoman kokemuksen, jonka asiakas odottaa ensimmäisestä klikkauksesta seuraavaan käyntiin.",
  "blog.post6Title":
    "Parhaat ravintoloiden varaussovellukset 2026: ilmaiset ja maksulliset järjestelmät vertailussa",
  "blog.post6Excerpt":
    "Etsitkö ravintolallesi parasta varaussovellusta? Vertailemme ilmaisia ja maksullisia online-varausjärjestelmiä ravintoloille, kahviloille ja tapahtumapaikoille, ja katsomme, mihin MimmoBook sijoittuu.",
  "blog.post6C1":
    "Varaussovelluksen valinta on yksi tärkeimmistä päätöksistä ravintolalle. Oikea online-varausjärjestelmä täyttää tyhjät pöydät, vähentää no-show-tapauksia ja vapauttaa henkilökunnan puhelimen ääreltä. Väärä lukitsee sinut kansikohtaisiin maksuihin, piilottaa asiakkaasi markkinapaikan taakse tai pakottaa pitämään taulukkolaskentaa rinnalla. Tämä opas vertailee ravintoloiden varaussovellusten päätyyppejä vuonna 2026, ilmaisista online-varausjärjestelmistä maksullisiin alustoihin, ja näyttää, mihin MimmoBook sopii itsenäisille ravintoloille, kahviloille, viinibaareille ja pienille ravintolaketjuille.",
  "blog.post6C2":
    "Ilmaiset online-varausjärjestelmät ovat yleinen aloituspiste. Google Reserve -integraatiot, yksinkertaiset lomaketyökalut ja isompien alustojen ilmaiset tasot antavat ottaa varauksen vastaan ilman kuukausimaksua. Kompromissi on todellinen: useimmat ilmaiset järjestelmät rajoittavat kuukausittaisten varausten määrää, piilottavat raportoinnin maksullisen tason taakse, näyttävät kilpailijoiden mainoksia varaussivullasi tai vaativat kansikohtaisen maksun kasvun myötä. Hyvin pienelle ravintolalle, jolla on muutama pöytä ja pieni volyymi, ilmainen taso voi toimia muutaman kuukauden. Sen jälkeen piilokustannukset ylittävät usein maltillisen kuukausitilauksen.",
  "blog.post6C3":
    "Markkinapaikkatyyppiset varaussovellukset, kuten globaalit hakemistoalustat, tuovat lisäasiakkaita mutta ottavat asiakassuhteen hallintaansa. Ravintolasi näkyy kilpailijoiden vieressä, asiakkaat näkevät markkinapaikan brändin sinun sijaan, ja maksat tyypillisesti kansikohtaisesti kuukausimaksun päälle. Vilkkaille keskustan ravintoloille, jotka tarvitsevat lisäkatteita, markkinapaikat ovat edelleen järkeviä. Kaupunginosien ravintoloille, viinibaareille, brunssipaikoille ja kohderavintoloille, joilla on jo uskollinen yleisö, kansikohtainen maksu syö katteen ja laimentaa brändiä.",
  "blog.post6C4":
    "Kolmas kategoria on ravintolalle, ei markkinapaikalle, rakennettu varausohjelmisto. Nämä työkalut tarjoavat brändätyn varaussivun omalla verkkotunnuksellasi, reaaliaikaisen pöytäsaatavuuden, automaattiset vahvistukset ja muistutukset asiakkaan omalla kielellä, ennakkomaksut tarvittaessa sekä raportoinnin kansista, liikevaihdosta, no-showsta ja palaavista asiakkaista. Koska asiakas varaa suoraan sinulta, kansikohtaista maksua ei ole ja asiakassuhde pysyy sinulla. Tähän MimmoBook sijoittuu.",
  "blog.post6C5":
    "MimmoBook on pilvipohjainen varausalusta ravintoloille, kahviloille, viinibaareille, tapahtumapaikoille, hotelleille ja hyvinvointiyrityksille. Ravintolat saavat brändätyn varaussivun suomeksi, ruotsiksi ja englanniksi, reaaliaikaisen saatavuuden salien ja terassien osalta, automaattiset vahvistus- ja muistutusviestit, alennus- ja ennakkomaksuvaihtoehdot, moniyksikköhallinnan ravintolaketjuille sekä selkeän raportoinnin kansista, no-showsta ja liikevaihdosta. Hinnoittelu on kiinteä kuukausimaksu, ei kansikohtainen, joten kasvu ei rankaise. Ilmainen näytekausi antaa arvioida koko tuotteen ennen sitoutumista.",
  "blog.post6C6":
    "Käytännön valinta: jos otat alle 20 kantta viikossa, aloita ilmaiselta tasolta ja arvioi tilanne kolmen kuukauden kuluttua. Jos ravintolasi elää läpikulkevasta matkailijaliikenteestä, markkinapaikka voi olla hyödyllinen lisäkanava oman varaussivun rinnalla. Jos sinulla on palaavaa asiakaskuntaa, vahva brändi tai useampi toimipiste, MimmoBookin kaltainen erikoistunut ohjelmisto maksaa itsensä yleensä takaisin ensimmäisen kuukauden aikana palautuneiden no-show-varausten, nopeamman työnkulun ja korkeamman suoravarauskonversion kautta. Paras ravintolan varaussovellus on se, joka pitää asiakassuhteen ja katteen sinulla.",
  "blog.post7Title":
    "MimmoBook vs Resy vs Tock: ravintoloiden varausohjelmistot vertailussa",
  "blog.post7Excerpt":
    "Käytännön vertailu MimmoBookista, Resystä ja Tockista ravintoloiden varauksiin. Katso, miten kiinteä hinnoittelu, monitoimipisteiden hallinta ja brändätty varaussivu pärjäävät kansikohtaisille maksuille.",
  "blog.post7C1":
    "Jos pyörität itsenäistä ravintolaa, viinibaaria, brunssipaikkaa tai pientä ravintolaketjua, oikean varausalustan valinta vuonna 2026 tiivistyy kolmeen vaihtoehtoon: MimmoBook, Resy ja Tock. Kaikki ottavat varauksia vastaan ja lähettävät vahvistukset, mutta hinnoittelumalli, brändinhallinta ja monitoimipistetuki eroavat merkittävästi. Tämä opas vertailee ne rinnakkain, jotta voit valita varausohjelmiston, joka pitää katteesi ja asiakassuhteesi omissa käsissäsi.",
  "blog.post7C2":
    "Hinnoittelu erottaa alustat nopeimmin. Resy ja Tock yhdistävät kuukausimaksun ja kansikohtaisen tai tapahtumakohtaisen maksun, joten kiireinen palvelu maksaa hiljaa enemmän kuin hiljainen. MimmoBook laskuttaa kiinteän kuukausimaksun ilman kansikohtaista lisää, joten täysi lauantai maksaa saman kuin hiljainen tiistai. Ravintolalle, joka ottaa 800 to 1 500 kantta kuukaudessa, ero vuositasolla on usein suurempi kuin MimmoBookin koko tilaushinta.",
  "blog.post7C3":
    "Brändinhallinta on toinen akseli. Resy ja Tock ovat ensisijaisesti markkinapaikkoja: asiakkaat löytävät ravintolasi niiden sovelluksesta, mutta vahvistussähköposti, profiili ja lojaliteettisuhde pysyvät markkinapaikan puolella. MimmoBook on päinvastainen: varaussivusi toimii omalla verkkotunnuksellasi, omissa brändivärissäsi ja kielelläsi, ja jokainen viesti lähtee omalla identiteetilläsi. Jos suoravaraukset ja palaavat asiakkaat ovat tärkeämpiä kuin markkinapaikan näkyvyys, MimmoBook on malli, joka pitää asiakkaan sinun.",
  "blog.post7C4":
    "Monitoimipisteiden hallinta merkitsee heti, kun avaat toisen paikan. Resy ja Tock tukevat useita toimipisteitä, mutta hinta ja kansikohtaiset maksut kasvavat lineaarisesti kasvun mukana. MimmoBook on rakennettu tenantin ympärille, jossa on useita toimipisteitä: yksi kirjautuminen, yksi hallintapaneeli, toimipistekohtaiset ylläpidot aukioloille, brändille ja sähköpostin lähettäjälle sekä yksi kiinteä paketti koko ryhmälle. 2 to 6 toimipisteen ravintolatoiminnalle operatiivinen kuorma putoaa selvästi ja lasku pysyy ennustettavana.",
  "blog.post7C5":
    "Käytön helppous pienelle tiimille on kolmas käytännön tekijä. Resy ja Tock ovat tehokkaita, mutta ne olettavat salivastaavan, joka elää työkalun sisällä. MimmoBook on suunniteltu yrittäjä-operaattoreille ja pienelle henkilökunnalle: varaus alle 30 sekunnissa, mobiilioptimoitu hallintapaneeli, automaattiset vahvistukset ja muistutukset suomeksi, ruotsiksi ja englanniksi, keittiötilaukset lähiruokailun resursseille sekä tulostettava henkilökunnan pikaohje PDF-muodossa. Uuden tarjoilijan perehdytys kestää minuutteja, ei vuoroja.",
  "blog.post7C6":
    "Näin valitset: jos ravintolasi elää suurkaupungin matkailijoista ja voit sulattaa kansikohtaiset maksut, Resy tai Tock lisäkanavana voivat silti olla järkeviä. Jos sinulla on lojaali kaupunginosayleisö, vahva brändi tai useampi kuin yksi toimipiste, MimmoBook on varausalusta, joka sopii: kiinteä hinnoittelu, brändätty varaussivu ja monitoimipisteiden hallinta valmiina. Kokeile MimmoBookia ilmaisella näyteversiolla ja vertaa kokonaista kuukautta nykyiseen kansikohtaiseen laskuun, luvut yleensä ratkaisevat puolestasi.",
  "blog.post8Title":
    "MimmoBook vs Mindbody, Vagaro, Fresha, Acuity: hyvinvointialan varausalustat vertailussa",
  "blog.post8Excerpt":
    "Miten MimmoBook pärjää Mindbodylle, Vagarolle, Freshalle ja Acuitylle kylpylöissä, kauneushoitoloissa, joogastudioissa ja hyvinvointiklinikoilla: hinnoittelu, brändinhallinta, monitoimipisteet ja käytön helppous.",
  "blog.post8C1":
    "Jos pyörität kylpylää, kauneushoitolaa, joogastudiota, hierontavastaanottoa tai pientä hyvinvointiketjua, varausalustojen lyhyt lista vuonna 2026 näyttää yleensä samalta: Mindbody, Vagaro, Fresha, Acuity Scheduling ja MimmoBook. Kaikki viisi ottavat verkkovarauksia vastaan, mutta niiden takana oleva liiketoimintamalli on hyvin erilainen, ja juuri se malli ratkaisee hiljaa kuinka paljon maksat, kuka omistaa asiakassuhteen ja kuinka tuskallista kasvu tulee olemaan. Tämä opas vertailee ne MimmoBookin näkökulmasta, jotta voit valita hyvinvointialan varausohjelmiston, joka pitää katteesi ja asiakkaasi omissa käsissäsi.",
  "blog.post8C2":
    "Hinnoittelu erottaa ne nopeimmin. Mindbody on yritystason päässä porrastetuilla kuukausipaketeilla, jotka nousevat nopeasti brändättyjen sovellusten, markkinointiautomaation tai lisähenkilöstön myötä. Vagaro näyttää edulliselta sisääntulotasolla, mutta veloittaa työntekijäpaikoista ja lisää maksuja lomakkeista, jäsenyyksistä ja tekstiviestimuistutuksista. Fresha on ilmainen varausten vastaanottoon, mutta veloittaa provision uusien asiakkaiden myynneistä ja korttimaksuista, joten alusta on ilmainen vain kun markkinapaikan asiakkaat eivät konvertoi. Acuity on kiinteä ajanvarausohjelmiston tilaus, halpa paperilla mutta rajallinen heti kun tarvitset monitoimipistettä, jäsenyyksiä tai hospitality-tason asiakaskäsittelyä. MimmoBook veloittaa yhden kiinteän kuukausimaksun tenanttia kohti, ei työntekijäpaikkakustannuksia, ei provisiota varauksista, ei transaktiomaksuja. 3 to 8 työntekijän studiolle tai kylpylälle, joka ottaa yli 500 aikaa kuukaudessa, vuosiero on yleensä suurempi kuin koko MimmoBookin tilaus.",
  "blog.post8C3":
    "Brändinhallinta on toinen akseli, ja juuri tässä markkinapaikka-alustat muuttavat hiljaa peliä. Mindbody ja Fresha molemmat ohjaavat asiakkaat omiin kuluttajasovelluksiinsa: studiosi näkyy kilpailijoiden vieressä, vahvistussähköposti tulee markkinapaikan brändillä ja asiakassuhde on muodollisesti alustalla. Vagaro on kevyempi markkinapaikkana mutta ohjaa löydettävyyden silti vagaro.comin kautta. Acuity on white label mutta yleinen, rajoitetulla visuaalisella räätälöinnillä. MimmoBook on päinvastainen: brändätty varaussivu omalla verkkotunnuksellasi omilla väreilläsi, asiakassähköpostit sinun tunnuksellasi, ei kolmannen osapuolen löydettävyyskerrosta sinun ja asiakkaan välissä. Jos toistuvat käynnit, jäsenyydet tai lahjakortit ovat liikevaihdolle keskeisiä, haluat asiakassuhteen omalla puolellasi, et markkinapaikan.",
  "blog.post8C4":
    "Monitoimipisteiden ja monipalvelujen hallinta on paikka, jossa hyvinvointiyritykset kompastuvat. Mindbody tukee useita toimipisteitä, mutta siirryt yleensä ylempään tasoon sitä varten ja jokainen toimipiste lisää kustannusta. Vagaro ja Fresha käsittelevät jokaista toimipistettä erillisenä yrityksenä omilla asetuksillaan ja Freshan tapauksessa omalla markkinapaikkalistauksella. Acuityn monitoimipistetarina on rajallinen ja manuaalinen. MimmoBook on rakennettu alusta asti tenantin ympärille, jossa on useita toimipisteitä: yksi kirjautuminen, yksi hallintapaneeli, toimipistekohtaiset asetukset aukioloille, brändille, henkilöstölle, sähköpostin lähettäjälle ja hinnoittelulle sekä yksi kiinteä paketti koko ryhmälle. 2 to 6 toimipisteen hyvinvointiyritykselle operatiivinen kuorma putoaa selvästi ja lasku pysyy ennustettavana kun avaat toimipisteen 3, 4 ja 5.",
  "blog.post8C5":
    "Käytön helppous pienelle tiimille on kolmas käytännön tekijä. Mindbody on tehokas mutta olettaa oman vastaanottopäällikön, joka elää työkalun sisällä. Vagaro on ystävällisempi, mutta käyttöliittymä levenee nopeasti kun otat käyttöön jäsenyydet, lomakkeet ja palkanlaskennan. Fresha on sujuva kuluttajapuolella, mutta ammattilaisten hallintapaneeli nojaa markkinapaikkakäyttäytymiseen. Acuity on siisti, mutta jää hospitality-työnkulkujen ulkopuolelle, joita kylpylä tai hyvinvointiklinikka oikeasti tarvitsee, kuten huone- tai tilapohjakartat, resurssikohtaiset ennakkomaksut tai monipalvelujen lohkovaraukset. MimmoBook on suunniteltu yrittäjä-operaattoreille ja pienelle henkilökunnalle: varaus alle 30 sekunnissa, mobiilioptimoitu hallintapaneeli, automaattiset vahvistukset ja muistutukset suomeksi, ruotsiksi ja englanniksi, resurssitason saatavuus hoitohuoneille ja hoitopedeille sekä tulostettava henkilökunnan pikaohje PDF-muodossa. Uuden hoitajan tai vastaanottovirkailijan perehdytys kestää minuutteja, ei vuoroja.",
  "blog.post8C6":
    "Käytännön valinta: jos olet yhden toimipisteen kauneushoitola, joka nojaa vahvasti uusien asiakkaiden löydettävyyteen, Freshan markkinapaikka voi olla hyödyllinen hankintakanava. Jos olet yhdysvaltalainen suurketju oman operatiivisen tiimin kanssa, Mindbodyn syvyys on edelleen järkevä. Jos tarvitset vain yksinkertaisen ajanvarauksen etkä koskaan aio lisätä monitoimipistettä tai hospitality-ominaisuuksia, Acuity riittää. Useimmille eurooppalaisille kylpylöille, kauneushoitoloille, joogastudioille, hyvinvointiklinikoille ja pienille monitoimipisteisille hyvinvointiryhmille MimmoBook on alusta, joka sopii: kiinteä hinnoittelu, brändätty varaussivu omalla verkkotunnuksellasi, aito monitoimipistehallinta, GDPR-ystävällinen EU-hostaus sekä tuki suomeksi, ruotsiksi ja englanniksi. Kokeile MimmoBookia ilmaisella näytekaudella ja vertaa kokonaista kuukautta nykyiseen laskuun, luvut yleensä ratkaisevat puolestasi.",
  "blog.post9Title":
    "Ajanvarausohjelmisto palvelualan ammattilaisille: parturit, kampaajat, hierojat, leipurit ja personal trainerit",
  "blog.post9Excerpt":
    "Käytännön opas yksinyrittäjille ja pienille tiimeille: miten verkkoajanvaraus täyttää kalenterin, vähentää peruuttamatta jääneitä aikoja ja palauttaa tunnit, jotka nyt menevät puhelimessa.",
  "blog.post9C1":
    "Palvelualan ammattilainen myy aikaa, ei tuotteita. Parturilla on viikossa noin 40 tuolituntia, hierojalla ehkä 25 hoitotuntia, personal trainerilla kourallinen parhaita ilta-aikoja ja leipurilla rajattu määrä noutoaikoja ennen kuin uunit ovat täynnä. Jokainen tunti, joka jää varaamatta tai jonka saapumatta jäänyt asiakas tyhjentää, on tuloa jota ei saa takaisin. Siksi varausprosessi on palveluyrityksessä tärkeämpi kuin melkein missään muualla.",
  "blog.post9C2":
    "Useimmat pienet palveluyritykset ottavat varauksia edelleen samalla tavalla: puhelu asiakkaiden välissä, viesti illalla ja paperikalenteri tiskillä. Se toimii, kunnes ei enää toimi. Puhelut jäävät vastaamatta kun kädet ovat kiinni, lauantai tulee tuplavarattua, kello 17 pyytänyt asiakas unohtuu ja illat menevät viesteihin lepäämisen sijaan. Asiakkaat huomaavat tämän myös. Moni varaa mieluiten kello 22 puhelimella kuin soittaa päivällä, ja jos se ei onnistu, hän varaa jonkun muun luota.",
  "blog.post9C3":
    "Verkkoajanvaraus korjaa tämän muuttamatta työtapaasi. Palvelut näkyvät oikeilla kestoilla ja hinnoilla, joten hiustenleikkaus ja partatrimmaus varaa 45 minuuttia ja 90 minuutin hieronta varaa 90 minuuttia, eikä kalenteri tarjoa aikaa jota et voi toteuttaa. Vahvistusviestit lähtevät heti, muistutukset ennen käyntiä ja peruutus vapauttaa ajan automaattisesti seuraavalle. Aukioloajat, tauot ja vapaapäivät asetat itse, myös yksittäisen lauantain jonka päätät tehdä.",
  "blog.post9C4":
    "Luvut ovat yksinkertaisia. Saapumatta jääneitä aikoja on henkilökohtaisissa palveluissa tyypillisesti 10 ja 20 prosentin välillä varauksista, ja automaattiset muistutukset leikkaavat siitä noin kolmanneksen. Jos teet 60 varausta viikossa 50 euron hintaan, jo viiden prosentin palautuminen on noin 150 euroa viikossa, selvästi enemmän kuin varausjärjestelmän kuukausimaksu. Lisää tähän hallinnollinen aika: moni yrittäjä käyttää 3 ja 5 tunnin välillä viikossa varausviesteihin, ja itsepalveluvaraus poistaa siitä suurimman osan.",
  "blog.post9C5":
    "Eri alat tarvitsevat hieman eri asioita. Parturit ja kampaajat tarvitsevat palveluita jotka lasketaan yhteen, niin että väri ja leikkaus varautuu yhtenä pidempänä käyntinä, sekä tuoli- tai tekijäkohtaisen saatavuuden. Hierojat ja hoitojen tarjoajat tarvitsevat puskuriaikaa asiakkaiden väliin, huone- ja pöytätason kalenterin sekä rauhallisen, brändätyn sivun joka vastaa myytyä kokemusta. Leipurit tarvitsevat noutoaikoja ja tilaustietoja istumapaikkojen sijaan, rajatulla määrällä tilauksia aikaa kohti. Personal trainerit tarvitsevat toistuvia kertoja, pienryhmäaikoja ja iltahuippuja. MimmoBook hoitaa nämä kaikki samasta hallintapaneelista, ja monitoimipisteinen yritys voi pyörittää useaa toimipistettä yhdellä tilillä.",
  "blog.post9C6":
    "Jos olet palvelualan ammattilainen yksin tai pienessä tiimissä, aloita yksinkertaisesti: vie oikeat palvelut ja kestot verkkoon, ota vahvistukset ja muistutukset käyttöön ja julkaise sivu omalla verkkotunnuksellasi, jotta asiakkaat varaavat sinulta eivätkä markkinapaikasta joka omistaa asiakaslistasi. MimmoBookilla on kiinteä kuukausihinta ilman varauskohtaista provisiota, se toimii suomeksi, ruotsiksi ja englanniksi ja se on hostattu EU:ssa GDPR huomioiden. Ilmainen näytekausi antaa testata kokonaisen kuukauden oikeilla asiakkailla ennen päätöstä.",
  "blog.spHeroCaption":
    "Parturit, kampaajat, hierojat, leipurit ja personal trainerit myyvät kaikki aikaa kiinteissä paloissa, ja juuri sitä verkkoajanvaraus suojaa.",
  "blog.spSlotsTitle": "Viikkosi on ruudukko varattavia aikoja",
  "blog.spSlotsCaption":
    "Kuusi työaikaa päivässä yhdelle tekijälle. Jokainen vapaaksi jäänyt aika ja jokainen saapumatta jäänyt asiakas on tuloa, jota ei saa jälkikäteen takaisin.",
  "blog.spSlotsBooked": "Varattu ja maksettu",
  "blog.spSlotsOpen":
    "Vapaa, kukaan ei voinut varata puhelinaikojesi ulkopuolella",
  "blog.spSlotsLost":
    "Menetetty saapumatta jääneeseen asiakkaaseen tai myöhäiseen peruutukseen",
  "blog.spFlowTitle": "Näin varaus kulkee, asiakkaasta seuraavaan käyntiin",
  "blog.spFlowCaption":
    "Neljä vaihetta, jotka toimivat itsestään kun palvelut ja ajat on asetettu.",
  "blog.spFlow1Title": "1. Asiakas valitsee palvelun",
  "blog.spFlow1Desc":
    "Hän näkee palvelut oikeilla kestoilla ja hinnoilla sekä vain ne ajat jotka pystyt toteuttamaan.",
  "blog.spFlow2Title": "2. Vahvistus lähtee itsestään",
  "blog.spFlow2Desc":
    "Varaus ilmestyy kalenteriisi ja asiakas saa vahvistusviestin omalla kielellään.",
  "blog.spFlow3Title": "3. Muistutus ennen käyntiä",
  "blog.spFlow3Desc":
    "Ajastettu muistutus vähentää saapumatta jääneitä aikoja, ja peruutus vapauttaa ajan seuraavalle.",
  "blog.spFlow4Title": "4. Helppo uusi varaus",
  "blog.spFlow4Desc":
    "Asiakastiedot säilyvät, joten seuraava aika syntyy sekunneissa ja raportit näyttävät kuka palaa.",
  "blog.spStat1Label": "Varauksia tulee sisään töiden ja unen aikana",
  "blog.spStat2Label":
    "Tyypillinen lasku saapumatta jääneissä ajoissa muistutusten myötä",
  "blog.spStat3Label": "Aika lisätä varaus käsin, kun asiakas soittaa",
  "blog.spWhoTitle": "Tehty näille aloille",
  "blog.spWho1":
    "Parturit ja kampaajat: palvelut jotka lasketaan yhteen yhdeksi käynniksi, tuoli- tai tekijäkohtainen saatavuus ja värikäsittelyt oikealla pidemmällä kestolla.",
  "blog.spWho2":
    "Hierojat, hoitojen tarjoajat ja muut hyvinvointialan ammattilaiset: puskuriaika asiakkaiden väliin, huone- ja pöytätason kalenteri ja rauhallinen brändätty sivu.",
  "blog.spWho3":
    "Leipurit ja ruoantekijät: noutoajat istumapaikkojen sijaan, rajattu määrä tilauksia aikaa kohti ja tilausmuistiinpanot täytteille, allergioille ja koolle.",
  "blog.spWho4":
    "Personal trainerit ja valmentajat: toistuvat kerrat, pienryhmäajat, iltahuiput ja selkeät raportit siitä mitkä ajat myyvät.",
  "blog.spBenefitsTitle": "Mitä saat käytännössä",
  "blog.spBenefit1":
    "Oma brändätty varaussivu omalla verkkotunnuksellasi, joten asiakkaat varaavat sinulta ja asiakaslista pysyy sinulla.",
  "blog.spBenefit2":
    "Palvelut oikeilla kestoilla ja hinnoilla, joten kalenteri ei tarjoa aikaa jota et voi toteuttaa.",
  "blog.spBenefit3":
    "Automaattiset vahvistukset ja muistutukset suomeksi, ruotsiksi ja englanniksi, jotka vähentävät saapumatta jääneitä aikoja ilman yhtäkään puhelua.",
  "blog.spBenefit4":
    "Aukioloajat, tauot, vapaapäivät ja yksittäiset työpäivät omassa hallinnassasi, tekijä- ja huonekohtaisesti.",
  "blog.spBenefit5":
    "Kiinteä kuukausihinta ilman varauskohtaista provisiota, joten kiireinen kuukausi kustantaa saman kuin hiljainen.",
  "blog.spBenefit6":
    "Raportit varauksista, palaavista asiakkaista ja parhaiten myyvistä ajoista, sekä useampi toimipiste yhdellä tilillä kun kasvat.",

  // Nav new pages
  "nav.features": "Ominaisuudet",
  "nav.useCases": "Käyttökohteet",
  "nav.blog": "Blogi",
  "nav.whatIs": "Mikä on MimmoBook?",
  "nav.offers": "Tarjoukset",
  "nav.kitchen": "Keittiö",
  "nav.bookingLog": "Varausloki",
  "bookingLog.title": "Varausten validointiloki",
  "bookingLog.tooltip":
    "Jokainen varausyritys tallennetaan tähän kapasiteettitietoineen, joten näet tarkasti miksi pyyntö hyväksyttiin, sai varoituksen tai hylättiin.",
  "bookingLog.recentTitle": "Viimeisimmät yritykset (200)",
  "bookingLog.searchPlaceholder": "Hae nimellä, sähköpostilla tai tyypillä",
  "bookingLog.allOutcomes": "Kaikki tulokset",
  "bookingLog.empty": "Ei vielä lokimerkintöjä.",
  "bookingLog.when": "Aika",
  "bookingLog.guest": "Vieras",
  "bookingLog.type": "Tyyppi / lähde",
  "bookingLog.date": "Päivälle",
  "bookingLog.capacity": "Kapasiteetti",
  "bookingLog.outcome": "Tulos",
  "bookingLog.reasonsTitle": "Validointisyyt:",
  "bookingLog.noReasons": "Ei tallennettuja yksityiskohtia.",
  "bookingLog.softWarningToast":
    "Varaus tallennettu, mutta päivä on lähellä kapasiteetin rajaa tai sen yli.",

  "kitchen.title": "Keittiötilaukset",
  "kitchen.tooltip":
    "Seuraa ruoka-, juoma- ja muita tilauksia ravintola- ja juhlatilavarauksille",
  "kitchen.date": "Päivämäärä",
  "kitchen.prevDay": "Edellinen päivä",
  "kitchen.nextDay": "Seuraava päivä",
  "kitchen.pickDate": "Valitse päivä",
  "kitchen.ordersFor": "Keittiötilaukset: {name}",
  "kitchen.deleteItemNamed": "Poista {name}",
  "kitchen.deleteOrder": "Poista tilaus",
  "kitchen.restoreHidden": "Näytä poistetut kortit ({count})",
  "kitchen.deleteOrderNamed": "Poista koko keittiötilaus asiakkaalta {name}",
  "kitchen.deleteOrderConfirm": "Poistetaanko koko keittiötilaus?",
  "kitchen.deleteOrderHint":
    "Ruoka- ja juomarivit poistetaan ja kortti poistuu Keittiö-välilehdeltä. Varaus itse säilyy.",
  "kitchen.orderDeleted": "Keittiötilaus poistettu",
  "kitchen.menu.priceLabel": "Yksikköhinta euroina",
  "kitchen.today": "Tänään",
  "kitchen.noReservations":
    "Ei ravintola- tai juhlatilavarauksia tälle päivälle.",
  "kitchen.noOrders": "Ei tilauksia vielä. Lisää ensimmäinen tuote alle.",
  "kitchen.addItem": "Lisää tuote",
  "kitchen.itemName": "Tuote",
  "kitchen.itemNamePlaceholder": "esim. Caesar-salaatti",
  "kitchen.quantity": "Määrä",
  "kitchen.category": "Kategoria",
  "kitchen.status": "Tila",
  "kitchen.notes": "Huomautukset",
  "kitchen.notesPlaceholder":
    "Valinnaiset huomautukset (allergiat, muutokset...)",
  "kitchen.unitPrice": "Yksikköhinta (€)",
  "kitchen.total": "Yhteensä",
  "kitchen.guests": "vierasta",
  "kitchen.cat.food": "Ruoka",
  "kitchen.cat.drink": "Juoma",
  "kitchen.cat.other": "Muu",
  "kitchen.status.received": "Vastaanotettu",
  "kitchen.status.preparing": "Valmistuksessa",
  "kitchen.status.ready": "Valmis",
  "kitchen.status.served": "Tarjoiltu",
  "kitchen.save": "Tallenna",
  "kitchen.delete": "Poista",
  "kitchen.deleteConfirm": "Poistetaanko tämä tuote?",
  "kitchen.itemAdded": "Tuote lisätty",
  "kitchen.itemUpdated": "Tuote päivitetty",
  "kitchen.itemDeleted": "Tuote poistettu",
  "kitchen.error": "Tuotteen tallennus epäonnistui",
  "kitchen.filter.all": "Kaikki",
  "kitchen.print": "Tulosta",
  "kitchen.menu.title": "Menupohjat",
  "kitchen.menu.manage": "Hallinnoi menua",
  "kitchen.menu.empty":
    "Ei vielä menutuotteita. Lisää usein käytettyjä tuotteita nopeaa tilaamista varten.",
  "kitchen.menu.addToOrder": "Lisää tilaukseen",
  "kitchen.menu.pickFromMenu": "Menusta",
  "kitchen.menu.newItem": "Lisää menutuote",
  "kitchen.menu.namePlaceholder": "Tuotteen nimi (esim. Margherita-pizza)",
  "kitchen.menu.saved": "Menutuote tallennettu",
  "kitchen.menu.deleted": "Menutuote poistettu",
  "kitchen.menu.saveError": "Menutuotteen tallennus epäonnistui",
  "kitchen.menu.close": "Sulje",
  "kitchen.menu.searchPlaceholder": "Hae menusta...",
  "kitchen.bulk.markAll": "Merkitse kaikki",
  "kitchen.bulk.advanceAll": "Etene kaikilla",
  "kitchen.bulk.allPreparing": "Kaikki valmistukseen",
  "kitchen.bulk.allReady": "Kaikki valmiiksi",
  "kitchen.bulk.allServed": "Kaikki tarjoiltu",
  "kitchen.bulk.updated": "{count} tuotetta päivitetty",
  "kitchen.bulk.nothingToUpdate": "Ei päivitettävää",

  // Offers
  "offers.title": "Tarjoukset",
  "offers.tooltip":
    "Luo ja hallinnoi tarjouksia tapahtumille ja ryhmävarauksille",
  "offers.create": "Uusi tarjous",
  "offers.edit": "Muokkaa tarjousta",
  "offers.empty": "Ei tarjouksia vielä",
  "offers.noResults": "Hakuasi vastaavia tarjouksia ei löytynyt",
  "offers.searchPlaceholder": "Hae tarjouksia...",
  "offers.showArchived": "Näytä arkistoidut",
  "offers.printPdf": "Tulosta tarjous PDF-tiedostona",
  "offers.searchLabel": "Etsi tarjouksia",
  "offers.archive": "Arkistoi",
  "offers.unarchive": "Palauta arkistosta",
  "offers.archived": "Arkistoitu",
  "offers.archivedSuccess": "Tarjous arkistoitu",
  "offers.unarchivedSuccess": "Tarjous palautettu arkistosta",
  "offers.archiveError": "Virhe tarjouksen arkistoinnissa",
  "offers.send": "Lähetä",
  "offers.confirm": "Vahvista",
  "offers.saved": "Tarjous tallennettu",
  "offers.saveError": "Virhe tarjouksen tallennuksessa",
  "offers.fillRequired": "Täytä kaikki pakolliset kentät",
  "offers.confirmedSuccess": "Tarjous vahvistettu",
  "offers.confirmedWithoutPrice":
    "Osa varauksista tallennettiin ilman hintaa. Lisää hinta ennen laskutusta.",
  "offers.statusRegionLabel": "Tarjouksen viimeisin tulos",
  "offers.kitchenOrdersFailedAnnounce":
    "Varaukset tallennettiin, mutta ruoka- ja juomarivejä ei saatu vietyä Keittiö-välilehdelle. Avaa Keittiö-välilehti ja lisää ne käsin.",
  "offers.confirmErrorAnnounce":
    "Tarjousta ei voitu vahvistaa, eikä varauksia luotu. Tarkista tarjouksen tiedot ja yritä uudelleen.",
  "offers.confirmedWithoutPriceAnnounce":
    "Osa varauksista tallennettiin ilman hintaa. Avaa jokainen varaus ja lisää hinta ennen laskutusta.",
  "offers.kitchenOrdersFailed":
    "Varaukset tallennettiin, mutta menua ei saatu vietyä keittiölle. Lisää se Keittiö-välilehdellä.",
  "offers.confirmedKitchenSentOne":
    "Tarjouksesta vietiin 1 ruoka- ja juomarivi Keittiö-välilehdelle.",
  "offers.confirmedKitchenSent":
    "Tarjouksesta vietiin {count} ruoka- ja juomariviä Keittiö-välilehdelle.",
  "offers.confirmedNoKitchen":
    "Tarjouksessa ei ollut ruokia eikä juomia, joten tehtiin tavallinen varaus eikä Keittiö-välilehdelle viety mitään.",
  "offers.priceReviewTitle": "Tarkista hinnat",
  "offers.priceReviewDesc":
    "Nämä varaukset luodaan tarjouksesta. Hinnat tulevat resurssien asetuksista.",
  "offers.priceReviewWarnTitle": "Hinta puuttuu",
  "offers.priceReviewWarnDesc":
    "Joissakin varauksissa resurssilla on useita hintoja eikä mikään vastaa valittua tilaa, joten hintaa ei voi valita automaattisesti. Valitse hinta, kirjoita summa tai päätä jättää se toistaiseksi tyhjäksi.",
  "offers.priceReviewNeedsPrice": "Hinta tarvitaan",
  "offers.priceReviewFromResource": "Resurssin asetuksista",
  "offers.priceReviewReasonAmbiguous":
    "Tällä resurssilla on useita hintoja eikä mikään vastaa valittua tilaa.",
  "offers.priceReviewReasonNoResource":
    "Tälle varaukselle ei löytynyt vastaavaa resurssia.",
  "offers.priceReviewReasonUnpriced":
    "Tälle resurssille ei ole tallennettu hintaa.",
  "offers.priceReviewAmount": "Hinta (EUR)",
  "offers.priceReviewSkip":
    "Jätä toistaiseksi tyhjäksi, henkilökunta lisää hinnan myöhemmin",
  "offers.priceReviewConfirm": "Vahvista tarjous",
  "offers.confirmError": "Virhe tarjouksen vahvistamisessa",
  "offers.sendEmail": "Lähetä sähköposti",
  "offers.emailSent": "Sähköposti lähetetty",
  "offers.emailError": "Virhe sähköpostin lähetyksessä",
  "offers.pdfAttached": "PDF-latauslinkki sisältyy viestiin",
  "offers.lastSent": "Viimeksi lähetetty",
  "offers.statusDraft": "Luonnos",
  "offers.statusSent": "Lähetetty",
  "offers.statusConfirmed": "Vahvistettu",
  "offers.statusExpired": "Vanhentunut",
  "offers.validity": "Voimassaolo",
  "offers.validityPlaceholder": "esim. Voimassa 31.12.2026 asti",
  "offers.startTime": "Alkamisaika",
  "offers.endTime": "Päättymisaika",
  "offers.eventSpace": "Tapahtumatila",
  "offers.selectSpace": "Valitse tila",
  "offers.eventType": "Tapahtumatyyppi",
  "offers.invoicing": "Laskutustiedot",
  "offers.linkedReservations": "Linkitetyt varaukset",
  "offers.specialRequests": "Erityistoiveet",
  "offers.menuPlaceholder": "Syötä menutiedot...",
  "offers.menuKitchenLabel": "Ruoat ja juomat (muodostaa keittiötilauksen)",
  "offers.menuKitchenHint":
    "Jokainen rivi muuttuu yhdeksi keittiötilauksen riviksi ravintola- tai tilavarauksella, kun tarjous hyväksytään. Jätä tyhjäksi, jos haluat tavallisen varauksen ilman mitään Keittiö-välilehdelle.",
  "offers.menuKitchenHintLeg":
    "Tähän kirjatut ruoat ja juomat menevät myös ravintola- tai tilavarauksen keittiötilaukseen, koska huoneet ja muut varaukset eivät näy Keittiö-välilehdellä.",
  "offers.menuFormatHint":
    "Yksi tuote per rivi, esimerkiksi: 2 x Lohi (ei tilliä), 10 Kahvi, Kakku x 3.",
  "offers.menuNoKitchenHint":
    "Ei mene keittiöön. Käytä siihen ruoat ja juomat -kenttää.",
  "offers.menuKitchenLabelMain":
    "Päävarauksen ruoat ja juomat (muodostaa keittiötilauksen)",
  "offers.menuKitchenLabelFor":
    "Ruoat ja juomat: {name} (muodostaa keittiötilauksen)",
  "offers.menuKitchenHintLegOwn":
    "Nämä rivit muodostavat varauksen {name} keittiötilauksen Keittiö-välilehdellä.",
  "offers.menuKitchenHintLegMoved":
    "{name} ei näy Keittiö-välilehdellä, joten nämä rivit lisätään tämän tarjouksen ravintola- tai tilavarauksen keittiötilaukseen.",
  "offers.menuKitchenSummary":
    "Jokaisella tarjouksen osalla on oma ruoat ja juomat -kenttä. Jokainen kenttä muodostaa omat keittiötilauksen rivinsä, kun tarjous hyväksytään, ja niiden osien kentät, jotka eivät näy Keittiö-välilehdellä, kuten huoneet, lisätään ravintola- tai tilavaraukseen.",
  "offers.kitchenPreviewTitle": "Keittiötilauksen esikatselu",
  "offers.kitchenMapTitle": "Mihin kukin ruoat ja juomat -kenttä menee",
  "offers.kitchenMapRule":
    "Ravintola- ja tilavaraus saavat oman keittiötilauksensa. Muut osat, kuten huoneet, eivät näy Keittiö-välilehdellä, joten niiden rivit lisätään ravintolavaraukselle, tai tilavaraukselle jos ravintolavarausta ei ole.",
  "offers.kitchenMapOwn": "saa oman keittiötilauksensa.",
  "offers.kitchenMapTo": "menee varauksen {name} keittiötilaukseen.",
  "offers.kitchenMapNone":
    "ei mene minnekään, koska tarjouksessa ei ole ravintola- eikä tilavarausta.",
  "offers.kitchenPreviewTotal": "Keittiötilauksen rivejä: {count}",
  "offers.kitchenPreviewEmpty":
    "Ruokia tai juomia ei ole vielä kirjattu, joten tarjouksen hyväksyminen luo vain varaukset eikä mitään mene Keittiö-välilehdelle.",
  "offers.kitchenPreviewNone": "Tässä kentässä ei ole ruokia eikä juomia.",
  "offers.kitchenPreviewStays":
    "Nämä rivit menevät tämän varauksen omaan keittiötilaukseen.",
  "offers.kitchenPreviewMoved":
    "Nämä rivit menevät varauksen {name} keittiötilaukseen.",
  "offers.kitchenPreviewLost":
    "Tarjouksessa ei ole ravintola- tai tilavarausta, joten nämä rivit eivät päädy Keittiö-välilehdelle. Lisää varaus tai siirrä ruoat ja juomat sinne.",
  "offers.language": "Kieli",
  "offers.emailTo": "Vastaanottaja",
  "offers.emailSubject": "Aihe",
  "offers.emailBody": "Viestin sisältö",
  "offers.crossBookingTitle": "Ristivaraus",
  "offers.crossBookingAdd": "Lisää varaus",
  "offers.crossBookingAdded": "Varaus linkitetty",
  "offers.crossBookingAddError": "Virhe varauksen linkittämisessä",
  "offers.crossBookingRemoved": "Varauksen linkitys poistettu",
  "offers.crossBookingRemoveError": "Virhe varauksen linkityksen poistamisessa",
  "offers.linkedGroupCurrent": "Nykyinen",
  "offers.linkedGroupTotal": "Yhteensä",
  "offers.linkedBadge": "Ristivaraus",
  "offers.linkedRowService": "Palvelu",
  "offers.linkedRowDate": "Päivämäärä",
  "offers.linkedRowGuests": "Vieraat",
  "offers.linkedRowPrice": "Hinta",
  "offers.linkedRowOpen": "Avaa linkitetty varaus",

  // Tier-rajojen virheet
  "tierError.STAFF_USER_LIMIT_REACHED":
    "Tilauksesi sallii enintään {limit} käyttäjää. Päivitä lisätäksesi tiimiläisiä.",
  "tierError.SITE_LIMIT_REACHED":
    "Tilauksesi sallii enintään {limit} toimipisteen. Päivitä Business-tasoon hallitaksesi useita.",
  "tierError.RESERVATION_TYPE_LIMIT_REACHED":
    "Tilauksesi sallii enintään {limit} varaustyypin. Päivitä lisätäksesi varauskategorioita.",
  "tierError.RESOURCE_PER_TYPE_LIMIT_REACHED":
    "Tilauksesi sallii vain {limit} resurssia per tyyppi. Päivitä Business-tasoon saadaksesi rajattomat resurssit.",

  // Yksityisyys & tilin poisto
  "privacy.panel.title": "Yksityisyys ja tietosi",
  "privacy.panel.description":
    "Lataa kaikki sinusta säilytetyt tiedot tai sulje tilisi. Nämä ovat oikeuksiasi GDPR:n mukaan (Art. 15, 17, 20).",
  "privacy.export.title": "Vie tietoni",
  "privacy.export.description":
    "Lataa JSON-tiedosto, joka sisältää profiilisi, varauksesi, lokitietosi ja muut sinusta säilytetyt tiedot. Raja: yksi vienti 24 tunnin välein.",
  "privacy.export.button": "Lataa tietoni",
  "privacy.export.success": "Tietojesi vienti on ladattu.",
  "privacy.delete.title": "Poista tilini",
  "privacy.delete.description":
    "Asettaa tilisi pysyvästi poistettavaksi 30 päivän peruutusajan jälkeen. Jos olet ainoa omistaja organisaatiossa, jossa on muita jäseniä, siirrä omistajuus ensin.",
  "privacy.delete.button": "Poista tilini",
  "privacy.delete.scheduled": "Poisto on ajastettu. Lopullinen poisto: {date}",
  "privacy.delete.cancel": "Peruuta poisto",
  "privacy.delete.cancelled": "Tilin poisto peruutettu.",
  "privacy.delete.confirmTitle": "Poistetaanko tilisi?",
  "privacy.delete.confirmDescription":
    "Tietosi poistetaan pysyvästi 30 päivän kuluttua. Vahvista kirjoittamalla DELETE alle.",
  "privacy.delete.confirmLabel": "Vahvistus",
  "privacy.delete.confirmAction": "Ajasta poisto",
  "privacy.delete.requested":
    "Tilin poisto on ajastettu. Sinulla on 30 päivää aikaa peruuttaa.",

  // Guest portal
  "guest.portal.label": "Vieraan portaali",
  "guest.portal.title": "Varauksesi",
  "guest.portal.linkExpiredTitle": "Linkki vanhentunut",
  "guest.portal.linkRevokedTitle": "Linkki mitätöity",
  "guest.portal.notFoundTitle": "Varausta ei löytynyt",
  "guest.portal.linkExpiredBody":
    "Tämä varauslinkki on vanhentunut. Ota yhteyttä kohteeseen.",
  "guest.portal.linkRevokedBody":
    "Tämä linkki on mitätöity. Ota yhteyttä kohteeseen.",
  "guest.portal.notFoundBody":
    "Emme löytäneet varausta tällä linkillä. Se on voitu poistaa.",
  "guest.portal.checkOut": "Lähtöpäivä",
  "guest.portal.specialRequests": "Erityistoiveet",
  "guest.portal.total": "Yhteensä",
  "guest.portal.guestsSuffix": "vierasta",
  "guest.portal.needDifferentDate": "Tarvitsetko toisen päivän?",
  "guest.portal.newDate": "Uusi päivä",
  "guest.portal.newTime": "Uusi aika (valinnainen)",
  "guest.portal.message": "Viesti (valinnainen)",
  "guest.portal.messagePlaceholder": "Onko jotain, mitä kohteen tulisi tietää?",
  "guest.portal.requestNewDate": "Pyydä uutta päivää",
  "guest.portal.sending": "Lähetetään...",
  "guest.portal.requestSentBanner":
    "Muutospyyntösi on lähetetty kohteeseen. He ottavat sinuun yhteyttä vahvistaakseen sen.",
  "guest.portal.requestSentToast": "Muutospyyntö lähetetty kohteeseen.",
  "guest.portal.requestError": "Pyyntöä ei voitu lähettää. Yritä uudelleen.",
  "guest.portal.cancelBooking": "Peruuta varaus",
  "guest.portal.cancelTitle": "Peruutetaanko varauksesi?",
  "guest.portal.cancelDescription":
    "Tämä peruuttaa varauksesi. Toimintoa ei voi kumota.",
  "guest.portal.keepBooking": "Säilytä varaus",
  "guest.portal.yesCancel": "Kyllä, peruuta",
  "guest.portal.cancelling": "Peruutetaan...",
  "guest.portal.cancelSuccess": "Varauksesi on peruutettu.",
  "guest.portal.cancelError": "Peruutus epäonnistui. Yritä uudelleen.",
  "guest.portal.pastBooking":
    "Tämän varauksen päivä on jo mennyt. Toivottavasti viihdyit!",
  "guest.portal.questionsFooter":
    "Kysyttävää? Ota yhteyttä suoraan kohteeseen vahvistusviestin yhteystiedoilla.",
  "guest.find.pageTitle": "Etsi varauksesi",
  "guest.find.heading": "Etsi varauksesi",
  "guest.find.intro":
    "Syötä sähköpostiosoite, jota käytit varatessasi, niin lähetämme sinulle turvallisen linkin varauksesi katseluun, muuttamiseen tai peruuttamiseen.",
  "guest.find.emailLabel": "Sähköpostiosoite",
  "guest.find.submit": "Lähetä varauslinkkini",
  "guest.find.sentBody":
    "Jos löysimme tulevia varauksia tällä sähköpostiosoitteella, olemme lähettäneet turvalliset linkit siihen. Linkit ovat voimassa 7 päivää.",
  "guest.find.useAnother": "Käytä toista sähköpostia",
  "guest.find.invalidEmail": "Syötä kelvollinen sähköpostiosoite.",
  "guest.find.error": "Jokin meni pieleen. Yritä hetken kuluttua uudelleen.",
  "guest.find.linkLabel": "Etsi varaukseni",
  "guest.find.linkHint": "Oletko jo varannut? Hallinnoi varaustasi.",

  // Availability timeline
  "timeline.title": "Saatavuuden aikajana",
  "timeline.resource": "Resurssi",
  "timeline.blocked": "Estetty",
  "timeline.availableSlot": "Lisäsaatavuus",
  "timeline.empty": "Ei aktiivisia resursseja tälle päivälle.",
  "timeline.previousDay": "Edellinen päivä",
  "timeline.nextDay": "Seuraava päivä",
  "timeline.legendReservation": "Varaus",
  "timeline.legendPending": "Odottaa",
  "timeline.legendBlocked": "Estetty",
  "timeline.legendSlot": "Lisäsaatavuus",
  "timeline.dragHint":
    "Vinkki: vedä resurssin rivillä estääksesi kyseisen ajan.",
  "timeline.newBlockTitle": "Estä tämä aika",
  "timeline.newBlockDescription":
    "Tälle resurssille ei voi tehdä varauksia valittuna aikana.",
  "timeline.reason": "Syy",
  "timeline.reasonPlaceholder": "Esimerkiksi: huolto, yksityistilaisuus",
  "timeline.createBlock": "Estä aika",
  "timeline.blockCreated": "Aika estetty.",
  "timeline.blockError": "Ajan estäminen ei onnistunut.",
  "timeline.overlapBlocked":
    "Aika menee päällekkäin olemassa olevan varauksen kanssa, valitse vapaa aika.",
  "timeline.undo": "Kumoa",
  "timeline.blockUndone": "Esto poistettu.",
  "ops.digest.title": "Päivittäinen koosteviesti",
  "ops.digest.description":
    "Lähetä huomisen työlista automaattisesti joka aamu klo 06.00 Suomen aikaa.",
  "ops.digest.enabled": "Lähetä päivän työlista sähköpostilla",
  "ops.digest.recipients": "Vastaanottajat",
  "ops.digest.recipientsHelp":
    "Erota pilkulla. Jätä tyhjäksi, niin käytetään yrityksen sähköpostia.",
  "ops.digest.save": "Tallenna kooste",
  "ops.digest.saved": "Koosteasetukset tallennettu.",
  "ops.digest.saveError": "Koosteasetusten tallennus ei onnistunut.",
  "ops.digest.test": "Lähetä testikooste nyt",
  "ops.weekly.title": "Viikkoraportti sähköpostiin",
  "ops.weekly.description":
    "Lähettää seitsemän päivän koosteen ja valmiin CSV-lohkon klo 06.00 paikallista aikaa valittuna viikonpäivänä.",
  "ops.weekly.enabled": "Viikkoraportti päällä",
  "ops.weekly.day": "Lähetyspäivä",
  "ops.weekly.recipientsHelp":
    "Erota pilkulla. Jätä tyhjäksi, niin käytetään yrityksen sähköpostia.",
  "ops.weekly.saved": "Viikkoraportin asetukset tallennettu.",
  "ops.weekly.saveError": "Viikkoraportin asetuksia ei voitu tallentaa.",
  "ops.weekly.test": "Lähetä testiraportti nyt",
  "ops.weekly.testSent": "Testiraportti jonossa.",
  "ops.weekly.testError": "Testiraporttia ei voitu lähettää.",
  "forecast.drilldownTitle": "Huipputunnin erittely",
  "forecast.drilldownEmpty": "Tälle tunnille ei osunut varauksia jaksolla.",
  "forecast.drilldownHint":
    "Valitse ruutu, niin näet sen taustalla olevat palvelut ja vieraiden määrän.",
  "forecast.avgGuests": "Vieraita keskimäärin",
  "forecast.bookings": "Varauksia",
  "forecast.yoyTitle": "Käyttöasteen kehitys viime vuoteen verrattuna",
  "forecast.yoySubtitle":
    "Kuukausittaiset varaukset ja vieraat verrattuna vuoden takaiseen kuukauteen.",
  "forecast.thisYear": "Tänä vuonna",
  "forecast.lastYear": "Viime vuonna",
  "forecast.change": "Muutos",
  "forecast.occupancyTrend": "Kehitys",
  "ops.alerts.title": "Ilmoitukset vieraan muutoksista",
  "ops.alerts.description":
    "Lähetä henkilökunnalle sähköposti, kun vieras pyytää uutta aikaa tai peruu varauksen.",
  "ops.alerts.enabled": "Sähköposti-ilmoitukset päällä",
  "ops.alerts.recipientsHelp":
    "Erota pilkulla. Jätä tyhjäksi, niin käytetään yrityksen sähköpostia.",
  "ops.alerts.saved": "Ilmoitusasetukset tallennettu.",
  "ops.alerts.saveError": "Ilmoitusasetuksia ei voitu tallentaa.",
  "timeline.blockButton": "Varaa aika pois",
  "timeline.startTime": "Alkuaika",
  "timeline.endTime": "Loppuaika",
  "ops.digest.testSent": "Testikooste lähetetty listatuille vastaanottajille.",
  "ops.digest.testError": "Testikoosteen lähetys ei onnistunut.",
  "nav.pendingRequests": "odottavaa vieraspyyntöä",

  // Forecast
  "forecast.title": "Kysyntäennuste",
  "forecast.subtitle":
    "Jo tehdyt varaukset seuraaville 14 päivälle verrattuna kyseisen viikonpäivän tavanomaiseen tahtiin.",
  "forecast.booked": "Varattu",
  "forecast.expected": "Tavanomainen tahti",
  "forecast.next14Booked": "Varaukset 14 päivän aikana",
  "forecast.next14Guests": "Vieraat 14 päivän aikana",
  "forecast.gapToPace": "Ero tavanomaiseen tahtiin",
  "forecast.peakHours": "Ruuhkatunnit",
  "forecast.peakSubtitle":
    "Varausten alkamisajat viikonpäivittäin viimeisen 90 päivän ajalta.",
  "forecast.busiest": "Vilkkain",
  "forecast.basedOn": "Perustuu viime päiviin:",
  "forecast.mon": "Ma",
  "forecast.tue": "Ti",
  "forecast.wed": "Ke",
  "forecast.thu": "To",
  "forecast.fri": "Pe",
  "forecast.sat": "La",
  "forecast.sun": "Su",
};

const sv: TranslationKeys = {
  // Common
  "common.logIn": "Logga in",
  "common.logOut": "Logga ut",
  "common.signUp": "Registrera dig",
  "common.startFreeTrial": "Starta din kostnadsfria provperiod",
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
  "common.showList": "Visa lista",
  "common.hideList": "Dölj lista",
  "common.guests": "gäster",
  "common.date": "Datum",
  "common.noResults": "Inga resultat hittades.",
  "common.selectAll": "Välj alla",
  "common.invalidFileName":
    "Filens namn innehåller tecken som vi inte kan lagra säkert. Byt namn på filen och försök igen.",

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
  "nav.sites": "Platser",
  "nav.profile": "Profil",

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
  "reports.offerConversion": "Offerter till bokningar",
  "reports.totalOffers": "Totalt antal offerter",
  "reports.convertedOffers": "Konverterade till bokningar",
  "reports.conversionRate": "Konverteringsgrad",
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
  "reports.uninvoicedAlert":
    "{count} ej fakturerade av {total}, {amount} ej fakturerat",
  "reports.breakfastAlert":
    "{count} bokningar, {nights} nätter, beräknad frukostintäkt {amount}",
  "reports.nights": "nätter",
  "reports.reservations": "bokningar",
  "reports.ofTotal": "totalt",
  "reports.invoicedPercent": "fakturerat",
  "reports.discountSummary": "Rabattsammanfattning",
  "reports.totalDiscounts": "Totala rabatter",
  "reports.topCodes": "Mest använda koder",
  "reports.discountToRevenue": "Rabatt/intäkt",
  "reports.discountedBookings": "rabatterade bokningar",
  "reports.noDiscounts": "Inga rabatter under denna period",

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
  "settings.noAccessTitle": "Inställningar är inte tillgängliga för din roll",
  "settings.noAccessDesc":
    "Ditt konto har inte behörighet att se eller ändra företagets inställningar. Be en ägare eller administratör att uppdatera dem eller ge dig administratörsrättigheter.",
  "settings.siteNoAccessTitle":
    "Platsens inställningar är inte tillgängliga för din roll",
  "settings.siteNoAccessDesc":
    "Endast ägare och administratörer kan se platsens företagsuppgifter och utseende. Be en ägare eller administratör om behörighet om du behöver ändra dem.",
  "access.requestButton": "Begär behörighet",
  "access.requestTitle": "Begär behörighet av en administratör",
  "access.requestDesc":
    "Vi skickar din begäran till ägarna och administratörerna för det här kontot. Berätta gärna vad du behöver komma åt.",
  "access.requestPlaceholder":
    "Jag behöver komma åt inställningarna för att uppdatera ...",
  "access.requestSubmit": "Skicka begäran",
  "access.requestSending": "Skickar ...",
  "access.requestSent":
    "Din begäran skickades till ägarna och administratörerna",
  "access.requestError": "Begäran kunde inte skickas",
  "access.requestSentInline":
    "Begäran skickad. En ägare eller administratör svarar dig.",
  "access.requestSubject": "Begäran om behörighet",
  "booking.brandingUnavailable":
    "Egna färger och logotyp kunde inte laddas, så sidan använder standardutseendet. Bokningen fungerar som vanligt.",
  "settings.upsellTitle": "Hantera flera platser",
  "settings.upsellDesc":
    "Uppgradera till Business-planen för att hantera hotell, restauranger och evenemangslokaler från en enda instrumentpanel. Var och en med egna resurser, öppettider och bokningssida.",
  "settings.learnMore": "Läs mer",
  "settings.siteOverride": "Platsanpassning",
  "settings.useParentDefault": "Använd företagets standard",
  "settings.customizeForSite": "Anpassa för denna plats",
  "settings.inheritedFromParent": "Ärvd från företagsinställningar",
  "settings.siteSettingsSaved": "Platsinställningar sparade",
  "settings.availabilityThresholds": "Tillgänglighetsgränser",
  "settings.availabilityThresholdsDesc":
    "Antal bokningar innan en dag visas som 'Full' i kalendern.",
  "settings.fullThreshold": "Full vid",
  "settings.logo": "Logotyp",
  "settings.uploadLogo": "Ladda upp logotyp",
  "settings.uploading": "Laddar upp...",
  "settings.logoHint": "PNG, JPG, WebP eller SVG. Max 2 MB.",
  "settings.logoUploaded": "Logotyp uppladdad",
  "settings.logoUploadError": "Kunde inte ladda upp logotyp",
  "settings.logoInvalidType":
    "Ogiltig filtyp. Använd PNG, JPG, WebP eller SVG.",
  "settings.logoTooLarge": "Filen är för stor. Max 2 MB.",
  "settings.heroImage": "Hero-bild",
  "settings.uploadHeroImage": "Ladda upp hero-bild",
  "settings.heroImageHint":
    "Rekommenderat: 1600×600 px. PNG, JPG eller WebP. Max 5 MB.",
  "settings.heroImageUploaded": "Hero-bild uppladdad",
  "settings.heroImageUploadError": "Kunde inte ladda upp hero-bild",
  "settings.resourceTypeNames": "Namn på bokningstyperna",
  "settings.resourceTypeNamesDesc":
    "Ge egna visningsnamn åt dina bokningstyper. Dessa namn visas på den offentliga bokningssidan.",
  "settings.reservationTypes": "Bokningstyper",
  "settings.reservationTypesDesc":
    "Välj vilka bokningstyper ditt företag erbjuder. Dessa visas som rutor på den offentliga bokningssidan.",
  "settings.reservationTypesLimit":
    "Din prenumeration tillåter högst {max} typ(er).",
  "settings.reservationTypesSaved": "Bokningstyperna uppdaterades.",
  "settings.reservationTypesUpgrade":
    "Uppgradera din prenumeration för att aktivera fler typer.",
  "settings.resourceTypeName": "Visningsnamn för {type}",
  "settings.resourceTypeDescPlaceholder": "Egen beskrivning för bokningssidan",

  // Booking
  "booking.title": "Gör en bokning",
  "booking.selectType": "Vad vill du boka?",
  "booking.selectLocation": "Välj plats",
  "booking.allLocations": "Alla platser",
  "booking.atSite": "på",
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
  "booking.linkedReservations": "Länkade reservationer",
  "booking.addLinked": "Lägg till länkad",
  "booking.linkedHint":
    "Lägg till ytterligare reservationer av annan typ för samma gäst. De delar gästens uppgifter och grupperas tillsammans.",
  "booking.closedDay": "Stängt denna dag.",
  "days.monday": "Måndag",
  "days.tuesday": "Tisdag",
  "days.wednesday": "Onsdag",
  "days.thursday": "Torsdag",
  "days.friday": "Fredag",
  "days.saturday": "Lördag",
  "days.sunday": "Söndag",
  "openingHours.tooltip":
    "Ange standardöppettider per bokningstyp. Dessa används på den publika bokningssidan för att bestämma tillgängliga tider. När du skapar en ny plats kopieras dessa standardvärden automatiskt.",
  "openingHours.siteTooltip":
    "Dessa öppettider gäller bara för denna plats. De åsidosätter organisationens standardvärden.",
  "openingHours.siteOverride":
    "Platsspecifika öppettider (åsidosätter standard)",
  "openingHours.usingDefaults":
    "Använder organisationens standardvärden. Spara för att skapa platsspecifika öppettider.",
  "openingHours.resetToDefaults": "Återställ till standard",
  "openingHours.resetConfirm":
    "Detta raderar platsspecifika öppettider och återgår till organisationens standardvärden.",
  "openingHours.resetDone":
    "Öppettider återställda till organisationens standardvärden",
  "resourceHours.title": "Öppettider",
  "resourceHours.sameEveryDay": "Samma varje dag",
  "resourceHours.perDay": "Per dag",
  "resourceHours.openTime": "Öppnar",
  "resourceHours.closeTime": "Stänger",
  "resourceHours.sameEveryDayDesc":
    "Samma tider gäller alla öppna dagar. Stäng enskilda dagar nedan.",
  "resourceHours.removeHours": "Ta bort öppettider",
  "resourceHours.saveFirst":
    "Spara resursen först, redigera sedan för att ställa in öppettider.",
  "resourceHours.savedOnCreate": "Öppettiderna sparas när du skapar resursen.",
  "resourceHours.openingHoursLabel": "Öppettider",
  "occasionalSlots.title": "Tillfälliga arbetspass",
  "occasionalSlots.description":
    "För sporadisk tillgänglighet. Lägg till enskilda datum och tider då resursen är bokningsbar utöver veckoschemat.",
  "occasionalSlots.addSlot": "Lägg till pass",
  "occasionalSlots.date": "Datum",
  "occasionalSlots.from": "Från",
  "occasionalSlots.to": "Till",
  "occasionalSlots.note": "Notering (valfri)",
  "occasionalSlots.notePlaceholder": "t.ex. besökande terapeut",
  "occasionalSlots.empty": "Inga tillfälliga pass ännu.",
  "occasionalSlots.save": "Spara pass",
  "occasionalSlots.cancel": "Avbryt",
  "occasionalSlots.remove": "Ta bort",
  "occasionalSlots.invalidRange": "Sluttiden måste vara efter starttiden.",
  "occasionalSlots.pastDate": "Välj dagens datum eller senare.",
  "timezone.label": "Tidszon",
  "timezone.inheritTenant": "Ärv från organisationen ({tz})",
  "timezone.shownIn": "Tider visas i {tz}",
  "timezone.fallback": "standard",
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
  "booking.serviceMisconfigured":
    "Onlinebokning är tillfälligt otillgänglig. Ingen bokning skapades och du har inte debiterats. Kontakta verksamheten direkt via telefon eller e-post, eller försök igen om några minuter.",
  "booking.serviceMisconfiguredAdmin":
    "Onlinebokning är tillfälligt otillgänglig eftersom servern saknar sin service role-nyckel. Ingen bokning skapades. Så här åtgärdar du det: öppna Lovable Cloud, gå till Backend, sedan API keys, kopiera service_role-nyckeln, gå därefter till Backend, Edge Functions, Secrets, och lägg till den som SUPABASE_SERVICE_ROLE_KEY. Onlinebokningen börjar fungera så snart hemligheten har sparats.",
  "booking.misconfigBannerTitle": "Bokning är tillfälligt otillgänglig",
  "booking.misconfigBannerNoReservation":
    "Ingen bokning skapades. Dina uppgifter har inte sparats och du har inte debiterats.",
  "booking.misconfigBannerDisabled":
    "Att skicka igen fungerar inte förrän verksamheten har återställt serverkonfigurationen.",
  "booking.misconfigBannerTryAgain": "Försök igen",
  "booking.dateBlocked": "Detta datum är inte tillgängligt för bokning.",
  "booking.timeBlocked": "Denna tidslucka är inte tillgänglig för bokning.",
  "booking.blocked": "Blockerad",
  "booking.fixedPricePlaceholder": "t.ex. 45,00",
  "booking.thankYou": "Tack!",
  "booking.confirmationMsg":
    "Din bokning har mottagits. Du kommer att få ett bekräftelsemail från {name}.",
  "booking.checkSpam":
    "Om du inte ser e-postmeddelandet i din inkorg, kontrollera din skräppost- eller skräppostmapp.",
  "booking.duplicateTitle": "Du har redan skickat den här bokningen",
  "booking.duplicateMsg":
    "Vi hittade en identisk bokning som du nyss skickade, så vi behöll den första och skapade ingen andra bokning.",
  "booking.duplicateHint":
    "Om du ville boka mer, till exempel ett till rum eller ett andra bord, skicka en ny bokning med de uppgifterna.",
  "booking.makeAnother": "Gör en ny bokning",
  "booking.addToCalendar": "Lägg till i kalender",
  "booking.notFound": "Företag hittades inte",
  "booking.notFoundDesc": "Bokningssidan du letar efter finns inte.",
  "booking.emailPreviewTitle": "Förhandsgranskning av bekräftelsemail",
  "booking.whatGuestReceives": "Detta är vad gästen kommer att få via e-post:",
  "booking.pricingType": "Prissättning",
  "booking.pricingMenu": "Enligt meny",
  "booking.pricingFixed": "Fast pris",
  "booking.pricingQuote": "Begär en offert",
  "booking.pricingQuoteDesc": "Få ett anpassat pris för ditt evenemang",
  "booking.pricingReserveTable": "Reservera bord",
  "booking.pricingReserveTableDesc": "Boka bord och beställ från menyn",
  "booking.pricingSetMenu": "Fast meny",
  "booking.pricingSetMenuDesc": "Förarrangerad meny till fast pris",
  "booking.fixedPrice": "Fast pris (€)",
  "booking.restaurantSubType": "Tjänstetyp",
  "booking.subTypeDineIn": "Äta på plats",
  "booking.subTypeCatering": "Catering",
  "booking.subTypePopup": "Pop-up restaurang",
  "booking.subTypeDineInDesc": "Reservera ett bord på restaurangen",
  "booking.subTypeCateringDesc": "Beställ catering till ditt evenemang",
  "booking.subTypePopupDesc":
    "Behöver du matservering på ditt evenemang? Vi kommer gärna!",
  "booking.cateringQuoteDesc":
    "Berätta om ditt evenemang så tar vi fram en skräddarsydd offert åt dig.",
  "booking.cateringDetails": "Cateringdetaljer",
  "booking.deliveryAddress": "Evenemangs-/leveransadress",
  "booking.dietaryNotes": "Kostrestriktioner och allergier",
  "booking.equipmentNeeded": "Serveringsutrustning behövs",
  "booking.staffNeeded": "Serveringspersonal behövs",
  "booking.popupDetails": "Evenemangsdetaljer",
  "booking.festivalName": "Evenemangs-/festivalnamn",
  "booking.stallSize": "Önskad uppställningsstorlek",
  "booking.stallSizeSmall": "Liten (2×2 m)",
  "booking.stallSizeMedium": "Medel (3×3 m)",
  "booking.stallSizeLarge": "Stor (4×4 m)",
  "booking.electricityNeeded": "Elanslutning behövs",
  "booking.waterNeeded": "Vattenanslutning behövs",
  "booking.foodPermits": "Livsmedelstillstånd / certifikat",
  "booking.stallFee": "Uppställningsavgift (€)",
  "email.subject": "Ämne",
  "email.confirmationSubject": "Bokningsbekräftelse",
  "email.confirmationTitle": "Bokning bekräftad!",
  "email.greeting": "Kära",
  "email.confirmationBody":
    "Vi har nöjet att bekräfta din bokning. Här är detaljerna:",
  "email.confirmationFooter":
    "Om du har några frågor, tveka inte att kontakta oss. Vi ser fram emot att välkomna dig!",
  "email.cancellationSubject": "Bokningsavbokning",
  "email.cancellationTitle": "Bokning avbokad",
  "email.cancellationBody":
    "Vi beklagar att din bokning har avbokats. Här var detaljerna:",
  "email.cancellationFooter":
    "Om du tror att detta är ett misstag eller vill boka om, tveka inte att kontakta oss.",
  "email.confirmationTab": "Bekräftelse",
  "email.cancellationTab": "Avbokning",
  "email.at": "kl",
  "email.duration": "Varaktighet",
  "email.preview": "E-postförhandsgranskning",
  "email.customMessage": "Anpassat meddelande",
  "email.customMessagePlaceholder":
    "Lägg till ett personligt meddelande i e-postmeddelandet...",
  "email.editDetails": "Redigera detaljer",
  "email.previewTab": "E-postförhandsgranskning",

  "admin.addUser": "Lägg till användare",
  "admin.role": "Roll",
  "admin.staff": "Personal",
  "admin.invalidCustomRole":
    "Denna anpassade roll kan inte tilldelas. Välj en roll med hierarkinivå 10 eller lägre, och inte owner eller superadmin.",

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
  "admin.userManagementDesc":
    "Hantera teammedlemmar, tilldela roller och kontrollera åtkomst.",
  "admin.staffLimitReached":
    "Personalanvändargränsen har nåtts. Uppgradera din plan för att lägga till fler användare.",
  "admin.approvedUsers": "Godkända användare",
  "admin.colName": "Namn",
  "admin.colEmail": "E-post",
  "admin.colRole": "Roll",
  "admin.colStatus": "Status",
  "admin.colActions": "Åtgärder",
  "admin.colSites": "Platser",
  "admin.siteAssignments": "Platstilldelningar",
  "admin.siteAssignmentsUpdated": "Platstilldelningar uppdaterade",
  "admin.usersAssigned": "användare tilldelade",
  "admin.noSitesAvailable": "Inga aktiva platser tillgängliga",
  "admin.statusApproved": "Godkänd",
  "admin.statusPending": "Väntar",
  "admin.confirmRemove": "Är du säker?",
  "admin.confirmRemoveDesc":
    "Är du säker på att du vill ta bort denna användare? Denna åtgärd kan inte ångras.",
  "admin.cancel": "Avbryt",
  "admin.remove": "Ta bort",
  "admin.supportRequests": "Supportförfrågningar",
  "admin.noSupportRequests": "Inga supportförfrågningar ännu.",
  "admin.supportRequestsDesc":
    "Business-användare kan skicka förfrågningar via chattwidgeten.",
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
  "admin.permissionCol": "Behörighet",
  "admin.permTooltip":
    "Definiera vad varje roll kan komma åt. Ägaren har alltid full åtkomst. Växla individuella behörigheter för Admin, Personal och anpassade roller.",
  "admin.deleteRoleTitle": 'Ta bort rollen "{name}"?',
  "admin.deleteRoleDesc":
    "Detta tar permanent bort denna anpassade roll och alla dess behörigheter. Användare som tilldelats denna roll förlorar sin åtkomst.",
  "admin.roleDeleted": "Roll borttagen",
  "admin.roleRenamed": "Roll omdöpt",
  "admin.roleKeyHint": "Unik identifierare som används internt",
  "admin.clickToRename": "Klicka för att byta namn",
  "admin.catReservations": "Bokningar",
  "admin.catResources": "Resurser",
  "admin.catCalendar": "Kalender",
  "admin.catReports": "Rapporter",
  "admin.catSettings": "Inställningar",
  "admin.catAdmin": "Admin",
  "admin.catSupport": "Support",
  "admin.permViewReservations": "Visa bokningar",
  "admin.permCreateReservations": "Skapa bokningar",
  "admin.permEditReservations": "Redigera bokningar",
  "admin.permDeleteReservations": "Ta bort bokningar",
  "admin.permViewResources": "Visa resurser",
  "admin.permManageResources": "Hantera resurser",
  "admin.permViewCalendar": "Visa kalender",
  "admin.permViewReports": "Visa rapporter",
  "admin.permViewSettings": "Visa inställningar",
  "admin.permManageSettings": "Hantera inställningar",
  "admin.permViewAdmin": "Visa adminpanelen",
  "admin.permManageAdmin": "Hantera användare och roller",
  "admin.permViewSupport": "Visa supportförfrågningar",
  "admin.permManageSupport": "Svara på supportförfrågningar",
  "admin.catSites": "Platser",
  "admin.permViewSites": "Visa platser",
  "admin.permManageSites": "Skapa och redigera platser",
  "admin.permApproveSites": "Godkänn platsändringar",

  "hero.badge": "Nu i beta. 30 dagars gratis provperiod",
  "hero.title":
    "Verktyg för hantering av bokning av boende, catering och\u00a0tjänstesektorn",
  "hero.titleHighlight": "bokning av boende och catering",
  "hero.subtitle":
    "Bearbeta och hantera din service bokningar, restaurangbokningar, förfrågningar om lokaler och hotell- eller gästhusbokningar från en enda instrumentpanel. Du kan skapa dina egna varumärkesbaserade bokningssidor, skicka automatiserade e-postmeddelanden för bekräftelser och användarhantering ingår.",
  "hero.viewPricing": "Se priser",

  // Features
  "features.title": "Allt du behöver för att hantera dina bokningar",
  "features.subtitle":
    "Den kompletta bokningswebbplatsen för boende- och cateringföretag.",
  "features.smartReservations": "Bokningar",
  "features.smartReservationsDesc":
    "Hantera restaurangbokningar, förfrågningar om lokaler, boende på värdshus och friskvårdstider från en enda instrumentpanel.",
  "features.customBranding": "Anpassa till ditt varumärke",
  "features.customBrandingDesc":
    "Din egen logotyp, färger och bilder. Varje bokningssida är varumärkesanpassad till ditt företag.",
  "features.teamManagement": "Användarhantering",
  "features.teamManagementDesc":
    "Lägg enkelt till personal, tilldela roller och hantera behörigheter.",
  "features.brandedPages": "Bokningstyper",
  "features.brandedPagesDesc":
    "Hotell/pensionat, restaurang, evenemangslokaler och yrkesverksamma inom service, som massörer, barberare, frisörer, bagare, makeupartister, behandlare och personliga tränare.",
  "features.reportsInsights": "Rapportering",
  "features.reportsInsightsDesc":
    "Spåra bokningar, beläggning och intäkter med en snabb blick.",
  "features.automatedEmails": "Automatiserade e-postmeddelanden",
  "features.automatedEmailsDesc":
    "Skicka bekräftelse-, påminnelse- och avbokningsmejl automatiskt.",

  // How it works
  "howItWorks.title": "Igång på några minuter",
  "howItWorks.subtitle":
    "Tre enkla steg för att börja ta emot onlinebokningar.",
  "howItWorks.step1Title": "Registrera ditt företag och välj ditt mjukvaruplan",
  "howItWorks.step1Desc":
    "Skapa ditt konto och börja din 30-dagars gratis provperiod.",
  "howItWorks.step2Title": "Ställ in ditt företag",
  "howItWorks.step2Desc":
    "Ladda upp ditt varumärke, lägg till din(a) anläggning(ar) och verksamhet, och konfigurera öppettider, priser, beläggningskapacitet och mycket mer.",
  "howItWorks.step3Title": "Dela din bokningslänk",
  "howItWorks.step3Desc":
    "Skicka din bokningssida till kunder, lägg till den på din webbplats och börja ta emot bokningar.",

  // Pricing
  "pricing.title": "Enkel och transparent prissättning",
  "pricing.subtitle":
    "Börja med en 30 dagars gratis provperiod. Uppgradera till nästa nivå eller avbryt när som helst.",
  "pricing.simpleTitle": "Enkel och transparent prissättning",
  "pricing.simpleSubtitle":
    "Börja med en 30 dagars gratis provperiod. Uppgradera till nästa nivå eller avbryt när som helst.",
  "pricing.comparePlans": "Jämför planer",
  "pricing.plansTitle": "Välj din plan",
  "home.videoTitle": "Se MimmoBook i praktiken",
  "pricing.faq": "Vanliga frågor",
  "pricing.feature": "Funktion",
  "pricing.monthlyPrice": "Månadspris",
  "pricing.freeTrial": "Gratis provperiod",
  "pricing.days30": "30 dagar",
  "pricing.reservationTypes": "Bokningstyper",
  "pricing.staffUsers": "Personalanvändare",
  "pricing.trialIncluded": "30 dagars gratis provperiod",
  "pricing.perMonth": "/mån",
  "pricing.mostPopular": "Mest populär",
  "pricing.ctaTitle": "Starta din gratis provperiod idag",
  "pricing.ctaSubtitle": "Igång snabbt och enkelt.",

  // CTA
  "cta.title": "Redo att modernisera dina bokningar?",
  "cta.subtitle":
    "Gå med i besöksnärings- och friskvårdsföretag som redan använder MimmoBook för att effektivisera sina bokningar.",

  // Login
  "login.title": "Logga in på ditt konto",
  "login.subtitle": "Ange dina uppgifter för att komma åt din instrumentpanel.",
  "login.welcomeBack": "Välkommen tillbaka",
  "login.welcomeBackSubtitle":
    "Logga in för att hantera dina bokningar och ditt team.",
  "login.forgotPassword": "Glömt lösenord?",
  "login.noAccount": "Har du inget konto?",
  "login.loggingIn": "Loggar in...",
  "login.orContinueWith": "Eller fortsätt med",
  "login.continueGoogle": "Fortsätt med Google",
  "login.continueApple": "Fortsätt med Apple",
  "login.haveCode": "Har du en kod?",
  "login.codePlaceholder": "Ange åtkomst- eller rabattkod",
  "login.codeHint":
    "Beta-, åtkomst- eller rabattkod — den tillämpas efter inloggning.",
  "login.codeRedeemed": "Koden har lösts in!",
  "login.codeRedeemFailed":
    "Koden kunde inte lösas in. Du kan försöka igen från instrumentpanelen.",

  // Signup
  "signup.title": "Skapa ditt konto",
  "signup.subtitle":
    "Starta din 30 dagars gratis provperiod, inget kreditkort krävs.",
  "signup.heroTitle": "Börja hantera bokningar idag",
  "signup.heroSubtitle":
    "30 dagars gratis provperiod. Inget kreditkort krävs. Igång på minuter.",
  "signup.businessName": "Företagsnamn",
  "signup.yourName": "Ditt namn",
  "signup.creatingAccount": "Skapar konto...",
  "signup.alreadyHaveAccount": "Har du redan ett konto?",
  "signup.accountCreated":
    "Konto skapat! Kontrollera din e-post för att verifiera kontot innan du loggar in.",
  "signup.orContinueWith": "Eller registrera med",
  "signup.continueGoogle": "Registrera med Google",
  "signup.continueApple": "Registrera med Apple",

  // Forgot password
  "forgot.title": "Återställ ditt lösenord",
  "forgot.subtitle":
    "Ange din e-post så skickar vi en länk för att återställa ditt lösenord.",
  "forgot.sendLink": "Skicka återställningslänk",
  "forgot.sending": "Skickar...",
  "forgot.checkEmail": "Kontrollera din e-post",
  "forgot.checkEmailDesc":
    "Vi har skickat en länk för lösenordsåterställning till",
  "forgot.backToLogin": "Tillbaka till inloggning",

  // Dashboard
  "dashboard.welcome": "Välkommen",
  "dashboard.todaysReservations": "Dagens bokningar",
  "dashboard.pending": "Väntande",
  "dashboard.confirmed": "Bekräftad",
  "dashboard.cancelled": "Avbokad",
  "dashboard.checkedIn": "Incheckad",
  "dashboard.sendReminder": "Skicka påminnelse",
  "dashboard.reminderSent": "Påminnelse skickad",
  "dashboard.reminderSentAt": "Påminnelse skickad",
  "dashboard.confirmationSentAt": "Bekräftelse skickad",
  "dashboard.cancellationSentAt": "Avbokning skickad",
  "dashboard.reminderError": "Kunde inte skicka påminnelse",
  "dashboard.sendReminderMsg":
    "Skicka ett påminnelsemail till gästen om denna bokning?",
  "dashboard.notCheckedIn": "Ej incheckad",
  "dashboard.todayFilter": "Idag",
  "dashboard.activeResources": "Aktiva resurser",
  "dashboard.bookingLink": "Bokningslänk",
  "dashboard.bookingLinkDesc":
    "Dela denna länk med dina kunder så att de kan boka.",
  "dashboard.shareTitle": "Lägg till bokning på din egen webbplats",
  "dashboard.shareDesc":
    "Lägg bokningssidan på din webbplats som en undersida, en knapp eller med en egen webbadress.",
  "dashboard.shareTabEmbed": "Bädda in på din sida",
  "dashboard.shareTabButton": "Länk och knapp",
  "dashboard.shareTabDomain": "Egen adress",
  "dashboard.shareEmbedDesc":
    "Klistra in detta på den sida där bokningen ska visas, till exempel dinsida.se/bokning. Formuläret visas på din egen sida, utan vårt sidhuvud och sidfot.",
  "dashboard.shareEmbedHint":
    "Justera höjden om det behövs. Färger, logotyp och priser följer med automatiskt.",
  "dashboard.shareButtonDesc":
    "Klistra in detta där du vill ha en Boka nu-knapp, eller länka bara till adressen nedan.",
  "dashboard.shareButtonHint":
    "Bokningssidan öppnas i en ny flik så att besökaren behåller din sida öppen.",
  "dashboard.shareButtonLabel": "Boka nu",
  "dashboard.shareDomainDesc":
    "Du kan också använda en egen webbadress, till exempel bokning.dinsida.se.",
  "dashboard.shareDomainStep1":
    "Logga in där din domän hanteras, till exempel hos din domänleverantör eller webbvärd.",
  "dashboard.shareDomainStep2":
    "Skapa en vidarebefordran från bokning.dinsida.se till adressen nedan.",
  "dashboard.shareDomainStep3":
    "Spara och vänta en stund, testa sedan adressen i webbläsaren.",
  "dashboard.shareDomainHint":
    "Efter vidarebefordran kommer besökaren till din bokningssida men ser vår adress i adressfältet. Vill du att din egen adress syns, använd inbäddning i stället.",
  "dashboard.shareCopyCode": "Kopiera kod",
  "dashboard.shareCopyAddress": "Kopiera adress",
  "dashboard.shareIframeTitle": "Onlinebokning",
  "dashboard.allServices": "Alla tjänster",
  "dashboard.byServiceType": "Per tjänstetyp",
  "dashboard.byLocation": "Per plats",
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
  "dashboard.noResources":
    "Inga resurser ännu. Lägg till ditt första rum, bord eller lokal.",
  "dashboard.capacity": "kapacitet",
  "dashboard.perNight": "/natt",
  "dashboard.resourceCreated": "Resurs skapad",
  "dashboard.resourceUpdated": "Resurs uppdaterad",
  "dashboard.resourceDeleted": "Resurs raderad",
  "dashboard.copyResource": "Kopiera resurs",
  "dashboard.copyResourceDesc":
    "Hur många kopior vill du skapa av denna resurs?",
  "dashboard.copyCount": "Antal kopior",
  "dashboard.resourcesCopied": "Resurser kopierade",
  "booking.stayDetails": "Vistelseinformation",
  "dashboard.uploadImage": "Ladda upp bild",
  "dashboard.imageUploaded": "Bild uppladdad",
  "dashboard.imageUploadError": "Kunde inte ladda upp bild",
  "dashboard.restaurant": "Restaurang",
  "dashboard.venue": "Lokal",
  "dashboard.guesthouse": "Hotell / Gästhus",
  "dashboard.hotel": "Hotell",
  "dashboard.wellness": "Friskvårdstjänster",
  "dashboard.custom": "Lägg till egen",
  "dashboard.checkoutToday": "Utcheckningar idag",
  "dashboard.editReservation": "Redigera bokning",
  "dashboard.reservationUpdated": "Bokning uppdaterad",
  "dashboard.reservationUpdateError": "Kunde inte uppdatera bokningen",
  "dashboard.checkOutDate": "Utcheckningsdatum",
  "dashboard.priceEur": "Pris (EUR)",
  "dashboard.internalNotes": "Interna anteckningar",
  "dashboard.staffNotes": "Personalanteckningar",
  "dashboard.gallery": "Bildgalleri",
  "dashboard.galleryHint":
    "Upp till 5 bilder. PNG, JPG eller WebP. Max 5 MB per bild.",
  "dashboard.imageDeleted": "Bild raderad",
  "dashboard.maxImages": "Max 5 bilder",
  "dashboard.roomMultipliers": "Rumstypsprismultiplikatorer",
  "dashboard.roomMultipliersDesc":
    "Multipliceras med baspris per natt. T.ex. 1,5× vid €100 bas = €150.",
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
  "autoReminder.title": "Automatiska påminnelser",
  "autoReminder.tooltip":
    "Påminnelsemejl skickas automatiskt 24 timmar före varje bekräftad bokning.",
  "autoReminder.hourly": "Varje timme",
  "autoReminder.nextRun": "Nästa batch",
  "autoReminder.active": "Aktiv",
  "autoReminder.recentLog": "Nyligen skickade",
  "autoReminder.sent7d": "senaste 7 dagarna",
  "autoReminder.noRecent": "Inga påminnelser skickade de senaste 7 dagarna.",
  "notifications.title": "Aviseringar",
  "notifications.empty": "Inga aviseringar ännu.",
  "notifications.markAllRead": "Markera alla som lästa",
  "notifications.markRead": "Markera som läst",
  "notifications.used": "Bokning markerad som använd",
  "notifications.invoiced": "Bokning markerad som fakturerad",
  "dashboard.used": "Använd",
  "dashboard.invoiced": "Fakturerad",
  "invoiceRefusal.NO_PRICE":
    "Bokningen har inget pris än, så den kan inte markeras som fakturerad. Lägg till priset först.",
  "invoiceRefusal.AMOUNT_MISMATCH":
    "Beloppet stämmer inte med de omräknade rums- och frukostsummorna. Korrigera priset och försök igen.",
  "invoiceRefusal.INVOICED_LOCKED":
    "Bokningen är redan fakturerad, så ändringen skulle göra summorna motstridiga.",
  "invoiceRefusal.NOT_PERMITTED":
    "Ditt konto får inte ändra fakturastatus för den här bokningen.",
  "invoiceRefusal.UNKNOWN": "Fakturastatusen kunde inte uppdateras.",
  "invoiceRefusal.serverReasonLabel": "Orsak:",
  "invoiceRefusal.guestNotice":
    "Bokningen är redan fakturerad och kan inte längre ändras här. Kontakta oss direkt.",
  "invoiceRefusal.CANCELLED":
    "Bokningen är avbokad, så dess fakturastatus kan inte ändras.",
  "invoiceRefusal.NOT_FOUND":
    "Bokningen kunde inte hittas längre. Uppdatera listan och försök igen.",
  "invoiceRefusal.SESSION_EXPIRED":
    "Din session gick ut innan ändringen sparades. Logga in igen och försök sedan på nytt.",
  "invoiceRefusal.OFFLINE":
    "Ändringen nådde inte servern. Kontrollera din anslutning och försök igen.",
  "invoiceRefusal.RATE_LIMITED":
    "För många försök på kort tid. Vänta en stund och försök igen.",
  "invoiceRefusal.CONFLICT":
    "Någon annan ändrade bokningen först. Uppdatera den och gör om din ändring.",
  "invoiceRefusal.SERVER_ERROR":
    "Servern kunde inte slutföra ändringen. Försök igen om en liten stund.",
  "invoiceRefusalGuest.NO_PRICE":
    "Bokningen kan inte ändras här än. Kontakta oss direkt.",
  "invoiceRefusalGuest.AMOUNT_MISMATCH":
    "Bokningen kan inte ändras här. Kontakta oss direkt.",
  "invoiceRefusalGuest.INVOICED_LOCKED":
    "Bokningen är redan fakturerad och kan inte längre ändras här. Kontakta oss direkt.",
  "invoiceRefusalGuest.NOT_PERMITTED":
    "Bokningen kan inte längre ändras med den här länken. Kontakta oss direkt.",
  "invoiceRefusalGuest.CANCELLED":
    "Bokningen är redan avbokad, så det finns inget kvar att ändra.",
  "invoiceRefusalGuest.NOT_FOUND":
    "Bokningslänken är inte längre giltig. Kontakta oss direkt.",
  "invoiceRefusalGuest.SESSION_EXPIRED":
    "Bokningslänken har gått ut. Kontakta oss direkt.",
  "invoiceRefusalGuest.OFFLINE":
    "Din förfrågan gick inte igenom. Kontrollera din anslutning och försök igen.",
  "invoiceRefusalGuest.RATE_LIMITED":
    "För många försök på kort tid. Vänta en stund och försök igen.",
  "invoiceRefusalGuest.CONFLICT":
    "Bokningen uppdaterades just nu. Ladda om sidan och försök igen.",
  "invoiceRefusalGuest.SERVER_ERROR":
    "Något gick fel hos oss. Försök igen om en liten stund.",
  "invoiceRefusalGuest.UNKNOWN":
    "Din förfrågan kunde inte slutföras. Försök igen eller kontakta oss direkt.",
  "dashboard.downloadInvoice": "Ladda ner faktura",
  "dashboard.downloadInvoicePdf": "Ladda ner faktura som PDF",
  "reports.downloadReportPdf": "Ladda ner rapport som PDF",
  "dashboard.markLinkedUsed": "Markera länkade bokningar som använda?",
  "dashboard.markLinkedUsedMsg":
    "Denna bokning är länkad till ett erbjudande med andra bokningar. Vill du markera alla som använda?",
  "dashboard.markAll": "Markera alla använda",
  "dashboard.markLinkedInvoiced": "Markera länkade bokningar som fakturerade?",
  "dashboard.markLinkedInvoicedMsg":
    "Denna bokning är länkad till ett erbjudande med andra bokningar. Vill du markera alla som fakturerade?",
  "dashboard.markAllInvoiced": "Markera alla fakturerade",
  "dashboard.total": "totalt",
  "dashboard.dailySnapshot": "Daglig översikt",
  "dashboard.overviewSubtitle": "Daglig översikt",
  "alerts.pendingAction": "bokningar väntar på bekräftelse",
  "alerts.uninvoicedAction": "bokningar ej fakturerade",
  "alerts.checkoutsAction": "utcheckningar idag",
  "alerts.shortcuts": "Tangentbordsgenvägar: Alt+1 till 8 för navigering",
  "blocking.pendingApproval": "väntar på godkännande",
  "dashboard.calendarHotel": "Hotell / Gästhus",
  "dashboard.calendarVenue": "Festlokaler",
  "dashboard.calendarRestaurant": "Restaurang",
  "dashboard.legendHasReservations": "Har bokningar",
  "dashboard.legendBlocked": "Blockerad",
  "dashboard.legendRecurring": "Återkommande blockering",
  "dashboard.legendBoth": "Båda",
  "dashboard.calendarTooltip":
    "Klicka på ett datum för att se dess bokningar. Markerade datum har bokningar. Röda datum har engångsblockeringar. Lila streckade datum har återkommande blockeringar.",
  "dashboard.blockDay": "Blockera dag",
  "dashboard.recurringBlocks": "Återkommande blockeringar",
  "dashboard.blocked": "Blockerad",
  "dashboard.allDay": "Hela dagen",
  "dashboard.reservationsLabel": "Bokningar",
  "dashboard.every": "Varje",
  "dashboard.blockTitle": "Blockera",
  "dashboard.blockedLabel": "Blockerad",
  "dashboard.blockLabel": "Blockera",
  "dashboard.blockReason": "Anledning till blockering (valfritt)",
  "dashboard.unblockAll": "Avblockera alla",
  "dashboard.blockRestaurantDay": "Blockera restaurangen för dagen",
  "dashboard.blockAllTitle": "Blockera alla",
  "dashboard.resourceManagement": "Resurshantering",
  "dashboard.resourceManagementDesc": "Hantera lokaler, rum och bord",
  "dashboard.actions": "Åtgärder",
  "dashboard.active": "Aktiv",
  "dashboard.serviceOptions": "Tilläggstjänster",
  "dashboard.offersCatering": "Erbjud cateringtjänster",
  "dashboard.offersPopup": "Erbjud pop-up restaurang vid evenemang",
  "dashboard.dineInOptions": "Bokningsalternativ för restaurang",
  "dashboard.offersTableReservation": "Reservera bord (beställ från menyn)",
  "dashboard.offersQuote": "Begär en offert (anpassad prissättning)",
  "dashboard.offersSetMenu": "Fast meny (fast pris)",
  "dashboard.inactive": "Inaktiv",
  "dashboard.namePlaceholder": "T.ex. Festsal",
  "dashboard.descriptionPlaceholder": "Kort beskrivning...",
  "dashboard.capacityPlaceholder": "t.ex. 50",
  "dashboard.pricePlaceholder": "t.ex. 140",
  "dashboard.breakfastPlaceholder": "t.ex. 15",
  "dashboard.venuePrice": "Lokalpris (€)",
  "dashboard.roomPrice": "Rumpris (€/natt)",
  "dashboard.breakfastPrice": "Frukostpris (€/pers/morgon)",
  "dashboard.pricingHint":
    "Standardpris för nya bokningar. Enskilda bokningspriser kan justeras i bokningsdetaljerna.",
  "dashboard.roomTypeLabel": "Rumstyp",
  "dashboard.bedConfiguration": "Sängkonfiguration",
  "dashboard.roomDescription": "Rumsbeskrivning",
  "dashboard.roomDescPlaceholder":
    "Beskriv rummen, antal sängar, planlösning...",
  "dashboard.addMode": "Lägga till-läge",
  "dashboard.addModeIndividual": "Lägg till ett rum",
  "dashboard.addModeBulk": "Lägg till flera per typ",
  "dashboard.bulkRoomType": "Rumstyp",
  "dashboard.bulkQuantity": "Antal",
  "dashboard.bulkAdd": "Lägg till rum",
  "dashboard.bulkAdded": "Rum tillagda",
  "dashboard.bedType": "Sängtyp",
  "dashboard.bedCount": "Antal",
  "dashboard.addBed": "Lägg till säng",
  "dashboard.roomType.single": "Enkelrum",
  "dashboard.roomType.double": "Dubbelrum",
  "dashboard.roomType.twin": "Twinrum",
  "dashboard.roomType.double_double": "Dubbelt dubbelrum",
  "dashboard.roomType.triple": "Trippelrum",
  "dashboard.roomType.quad": "Quadrum",
  "dashboard.roomType.studio": "Studiorum",
  "dashboard.roomType.suite": "Svit",
  "dashboard.roomType.connecting": "Kommunicerande rum",
  "dashboard.roomType.entire": "Hela fastigheten",
  "dashboard.bedType.twin_single": "Twin / Enkelsäng",
  "dashboard.bedType.bunk": "Våningssäng",
  "dashboard.bedType.queen": "Queen-säng",
  "dashboard.bedType.king": "King-säng",
  "dashboard.bedType.california_king": "California King",
  "dashboard.bedType.murphy": "Väggbädd",
  "dashboard.bedType.sofa": "Bäddsoffa",
  "dashboard.bedType.trundle": "Utdragssäng",
  "booking.selectRoomType": "Välj rumstyp",
  "booking.roomTypeLabel": "Rumstyp",
  "blocking.title": "Blockerade dagar & tider",
  "blocking.tooltip":
    "Blockera hela resurstyper eller specifika resurser på valda datum eller datumintervall. Valfritt begränsa till specifika timmar.",
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
  "blocking.dateHint":
    "Klicka en gång för en enskild dag eller klicka på två datum för att välja ett intervall.",
  "blocking.duration": "Varaktighet",
  "blocking.fullDay": "Heldag",
  "blocking.specificHours": "Specifika timmar",
  "blocking.startTime": "Starttid",
  "blocking.endTime": "Sluttid",
  "blocking.timeHint":
    "Bara de valda timmarna blockeras. Bokningar utanför detta fönster är fortfarande tillgängliga.",
  "blocking.reason": "Orsak (valfritt)",
  "blocking.reasonPlaceholder": "t.ex. Underhåll, Privat evenemang...",
  "blocking.creating": "Skapar...",
  "blocking.createBlock": "Skapa blockering",
  "blocking.blockDays": "Blockera {count} dagar",
  "blocking.daysBlocked": "{count} dag(ar) blockerad(e)",
  "blocking.blockRemoved": "Blockering borttagen",
  "occasions.title": "Specialtillfällen",
  "occasions.subtitle":
    "Evenemangsdagar som en morsdagslunch eller en julmiddag. Gäster kan boka tillfället på din bokningssida, vid sidan av vanliga bokningar.",
  "occasions.add": "Lägg till tillfälle",
  "occasions.editTitle": "Redigera tillfälle",
  "occasions.name": "Tillfällets namn",
  "occasions.namePlaceholder": "Till exempel julmiddag",
  "occasions.description": "Beskrivning för gäster",
  "occasions.descriptionPlaceholder":
    "Meny, program eller annat gästerna bör veta",
  "occasions.date": "Datum",
  "occasions.service": "Tjänst",
  "occasions.resource": "Lokal eller rum",
  "occasions.anyResource": "Inte bundet till en lokal",
  "occasions.bookingType": "Så bokar gästerna",
  "occasions.seatings": "Fasta sittningar",
  "occasions.openBooking": "Fri bokning",
  "occasions.capacityPerSeating": "Platser per sittning",
  "occasions.capacityPerDay": "Platser för hela tillfället",
  "occasions.capacityHintSeatings":
    "Varje sittning rymmer så här många gäster.",
  "occasions.capacityHintOpen":
    "Alla bokningar för tillfället delar dessa platser.",
  "occasions.seatingTimes": "Sittningstider",
  "occasions.addTime": "Lägg till en tid",
  "occasions.active": "Syns för gäster",
  "occasions.inactive": "Dold",
  "occasions.save": "Spara tillfälle",
  "occasions.cancel": "Avbryt",
  "occasions.delete": "Ta bort",
  "occasions.deleteConfirm":
    "Ta bort det här tillfället? Bokningar som redan gjorts finns kvar i din lista.",
  "occasions.saved": "Tillfället sparat",
  "occasions.deleted": "Tillfället borttaget",
  "occasions.empty": "Inga specialtillfällen ännu.",
  "occasions.seats": "platser",
  "occasions.seatsPerSeating": "{cap} platser per sittning",
  "occasions.nameRequired": "Ge tillfället ett namn",
  "occasions.dateRequired": "Välj ett datum",
  "occasions.timesRequired": "Lägg till minst en sittningstid",
  "booking.occasionSectionTitle": "Specialtillfälle detta datum",
  "booking.occasionHint":
    "Välj tillfället eller fortsätt med en vanlig bokning.",
  "booking.occasionNormal": "Vanlig bokning",
  "booking.occasionSeating": "Sittningstid",
  "booking.occasionSeatsLeft": "{count} platser kvar",
  "booking.occasionFull": "Fullbokat",
  "booking.occasionOpenHint": "Välj vilken tid som helst under dagen.",
  "booking.occasionSeatingRequired": "Välj en sittningstid",
  "booking.occasionErrUnavailable":
    "Det tillfället går inte längre att boka. Välj ett annat tillfälle eller boka en vanlig tid.",
  "booking.occasionErrWrongDate":
    "Tillfället hålls en annan dag. Välj dess egen dag eller boka en vanlig tid den här dagen.",
  "booking.occasionErrWrongType":
    "Tillfället erbjuds inte för den här tjänsten. Välj ett annat tillfälle eller boka en vanlig tid.",
  "booking.occasionErrSeatingRequired":
    "Välj en sittningstid för tillfället innan du skickar bokningen.",
  "booking.occasionErrSeatingUnavailable":
    "Den sittningstiden är inte längre tillgänglig. Välj en av tiderna som visas för tillfället.",
  "booking.occasionErrFull":
    "Tillfället är nu fullbokat. Välj en annan sittningstid eller en annan dag.",
  "booking.occasionErrFullWithSeats":
    "Det finns bara {seats} platser kvar för tillfället, så ditt sällskap får inte plats. Prova ett mindre sällskap, en annan sittningstid eller en annan dag.",
  "booking.occasionNoneOnDate":
    "Det finns inget särskilt tillfälle den här dagen, så du kan boka en vanlig tid nedan.",
  "booking.occasionNextDates": "Kommande tillfällen: {dates}",
  "monitor.title": "Nekade bokningar",
  "monitor.subtitle": "Varför bokningar nekades på din bokningssida",
  "monitor.days": "{days} dagar",
  "monitor.refresh": "Uppdatera",
  "monitor.loading": "Hämtar...",
  "monitor.empty": "Inga nekade bokningar under perioden.",
  "monitor.total": "{count} nekade bokningar totalt",
  "monitor.lastSeen": "Senast: {when}",
  "monitor.code.OCCASION_FULL": "Tillfället var fullbokat",
  "monitor.code.OCCASION_SEATING_UNAVAILABLE":
    "Sittningen var inte längre tillgänglig",
  "monitor.code.OCCASION_SEATING_REQUIRED": "Ingen sittning valdes",
  "monitor.code.OCCASION_WRONG_DATE": "Tillfället gällde ett annat datum",
  "monitor.code.OCCASION_WRONG_TYPE": "Tillfället gällde en annan tjänst",
  "monitor.code.OCCASION_UNAVAILABLE":
    "Tillfället var inte längre tillgängligt",
  "monitor.code.DB_INSERT_FAILED": "Bokningen kunde inte sparas",
  "monitor.code.UNTAGGED": "Annan orsak",

  "blocking.blocksRemoved": "Blockeringar borttagna",
  "blocking.removeBlock": "Ta bort blockering",
  "blocking.removeBlockDesc":
    "Detta tar bort blockeringen för {date}. Bokningar kommer att tillåtas igen.",
  "blocking.remove": "Ta bort",
  "blocking.noBlocks": "Inga blockerade datum eller tider konfigurerade.",
  "blocking.noMatch": "Inga blockeringar matchar det aktuella filtret.",
  "blocking.allTypes": "Alla typer",
  "blocking.allResources": "Alla resurser",
  "blocking.clearFilters": "Rensa filter",
  "blocking.filter": "Filter:",
  "blocking.dateRange": "Datumintervall",
  "blocking.rangeHint":
    "Alla blockeringar inom detta intervall kommer att tas bort.",
  "blocking.noBlocksInRange": "Inga blockeringar hittade i detta intervall.",
  "blocking.blocksWillBeRemoved": "{count} blockering(ar) kommer att tas bort.",
  "blocking.removing": "Tar bort...",
  "blocking.removeCount": "Ta bort {count} blockering(ar)",
  "blocking.allDay": "Heldag",
  "blocking.hotelGuesthouse": "Hotell / Gästhus",
  "blocking.wellness": "Friskvårdstjänster",
  "blocking.restaurant": "Restaurang",
  "blocking.venueEventSpace": "Festlokaler",
  "blocking.room": "rum",
  "blocking.tableArea": "bord/yta",
  "blocking.eventSpace": "festlokal",
  "blocking.recurringTitle": "Återkommande blockeringar",
  "blocking.recurringTooltip":
    "Blockera specifika veckodagar återkommande. T.ex. blockera varje måndag för restaurangen.",
  "blocking.addRecurring": "Lägg till återkommande blockering",
  "blocking.addRecurringTitle": "Lägg till återkommande blockering",
  "blocking.daysOfWeek": "Veckodagar",
  "blocking.recurringTimeHint":
    "Bara de valda timmarna blockeras varje vecka. Bokningar utanför detta fönster är fortfarande tillgängliga.",
  "blocking.recurringReasonPlaceholder":
    "t.ex. Stängt på måndagar, Ledig dag...",
  "blocking.blockWeekly": "Blockera {count} dag(ar) veckovis",
  "blocking.recurringCreated": "Återkommande blockering skapad",
  "blocking.recurringRemoved": "Återkommande blockering borttagen",
  "blocking.removeRecurring": "Ta bort återkommande blockering",
  "blocking.removeRecurringDesc":
    "Detta tar bort den återkommande blockeringen för varje {day}.",
  "blocking.noRecurring": "Inga återkommande blockeringar konfigurerade.",
  "blocking.every": "Varje",
  "blocking.dayNames": "Sön,Mån,Tis,Ons,Tor,Fre,Lör",
  "booking.calculatePrice": "Beräkna pris",

  // Onboarding
  "onboarding.tierStep": "Plan",
  "onboarding.typesStep": "Bokningstyper",
  "onboarding.brandingStep": "Varumärke",
  "onboarding.choosePlan": "Välj din plan",
  "onboarding.choosePlanSubtitle":
    "Alla planer inkluderar en 30 dagars gratis provperiod.",
  "onboarding.whatDoYouNeed": "Vad behöver du?",
  "onboarding.whatDoYouNeedSubtitle": "Välj bokningstyperna för ditt företag.",
  "onboarding.brandWorkspace": "Varumärk din arbetsyta",
  "onboarding.brandWorkspaceSubtitle":
    "Anpassa färger och lägg till företagsinformation.",
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
  "onboarding.customDesc":
    "Definiera egen typ, t.ex. Spa eller Workshops, med valfria undertjänster.",
  "onboarding.wellnessDesc":
    "Frisörer, massörer, makeupartister. Kunderna väljer tjänster ur menyn och bokningens längd anpassas.",
  "booking.subServices": "Välj tjänster",
  "booking.subServiceQty": "Antal",
  "dashboard.customTypeLabel": "Typnamn",
  "dashboard.customTypeLabelHelp":
    "Det som gästerna ser, t.ex. Spa, Workshops, Turer.",
  "dashboard.subServices": "Undertjänster",
  "dashboard.addSubService": "Lägg till undertjänst",
  "dashboard.subServiceName": "Namn",
  "dashboard.subServicePrice": "Pris (€)",
  "dashboard.subServiceDuration": "Längd (min)",
  "dashboard.wellnessServicesHint":
    "Kunder kan kryssa i en eller flera av dessa när de bokar. Varje tjänst behöver en längd i 5 minuters steg (5 to 480 minuter).",
  "booking.servicesMenu": "Välj tjänster",
  "booking.servicesMenuHelp":
    "Bocka för det du vill ha. Total tid och pris uppdateras automatiskt.",
  "booking.totalDuration": "Total tid",
  "booking.totalPrice": "Totalt pris",
  "booking.noServicesYet":
    "Leverantören har inte publicerat någon tjänstmeny ännu. Du kan ändå boka en tid nedan.",
  // Tiers
  "tier.basic": "Basic",
  "tier.basicDesc":
    "Perfekt för ett enskilt hotell, en restaurang eller en eventlokal.",
  "tier.pro": "Pro",
  "tier.proDesc":
    "För företag som erbjuder hotell-, restaurang- och evenemangstjänster på ett ställe.",
  "tier.professional": "Professional",
  "tier.professionalDesc": "Flera bokningstyper, teamhantering.",
  "tier.business": "Business",
  "tier.businessDesc":
    "Funktionsrik plattform för företag med flera platser och verksamheter.",

  // Footer
  "footer.tagline":
    "Den moderna bokningsplattformen för restauranger, lokaler, gästhus och de professionella inom servicebranschen.",
  "footer.product": "Produkt",
  "footer.company": "Företag",
  "footer.legal": "Juridik",
  "footer.featuresComingSoon": "Funktioner",
  "footer.aboutComingSoon": "Om oss",
  "footer.contactComingSoon": "Kontakt",
  "footer.privacyPolicy": "Integritetspolicy",
  "footer.termsOfService": "Användarvillkor",
  "footer.allRightsReserved": "Alla rättigheter förbehållna.",

  "nav.about": "Om oss",
  "nav.accessibility": "Tillgänglighet",

  "about.heroBadge": "Vår berättelse",
  "about.heroTitle": "Bokningsplattformen byggd med omsorg",
  "about.heroSubtitle":
    "Vi hjälper hotell- och restaurangföretag att hantera sina bokningar enkelt, så de kan fokusera på att skapa minnesvärda gästupplevelser.",
  "about.missionBadge": "Vårt uppdrag",
  "about.missionTitle": "Göra bokningshantering enkel och smidig",
  "about.missionP1":
    "Små besöksnäringsföretag förtjänar praktiska och informativa verktyg för att arbeta mer effektivt. Vi startade MimmoBook för att göra det möjligt.",
  "about.missionP2":
    "Vår plattform samlar bokningar, varumärkeshantering och rapportering i ett enhetligt arbetsutrymme och eliminerar utspridda anteckningsböcker och missade bokningar.",
  "about.point1Title": "Snabbhet utan kompromisser",
  "about.point1Desc":
    "Få din varumärkta bokningssida live på en dag eller två, inte veckor.",
  "about.point2Title": "Datadrivna insikter",
  "about.point2Desc":
    "Följ bokningar, beläggning och intäkter med ett ögonkast.",
  "about.point3Title": "Byggt för team",
  "about.point3Desc": "Rollbaserad åtkomst och stöd för flera medarbetare.",
  "about.valuesTitle": "Våra kärnvärden",
  "about.valuesSubtitle":
    "Vi styr vår dagliga verksamhet och fattar beslut baserat på dessa principer, från produktdesign till kundsupport.",
  "about.valuePrecision": "Precision",
  "about.valuePrecisionDesc":
    "Varje detalj spelar roll, från pixelprecisa bokningssidor till uppdaterade tillgänglighetskalendrar.",
  "about.valueInnovation": "Innovation",
  "about.valueInnovationDesc":
    "Vi förbättrar ständigt vår plattform. Vi vill ha din feedback för att göra den ännu bättre.",
  "about.valueCollaboration": "Samarbete",
  "about.valueCollaborationDesc":
    "Vi arbetar nära hotell- och restaurangföretag för att förstå deras verkliga behov.",
  "about.valueTrust": "Förtroende",
  "about.valueTrustDesc":
    "Dina data är säkra. Vi följer GDPR-standarder och bästa säkerhetspraxis.",
  "about.valuePassion": "Passion",
  "about.valuePassionDesc":
    "Vi brinner för att hjälpa småföretag att lyckas inom hotell- och restaurangbranschen.",
  "about.valueGlobal": "Tillgänglighet",
  "about.valueGlobalDesc":
    "Vår plattform är flerspråkig och utformad för att vara tillgänglig för alla.",
  "about.ctaTitle": "Redo att förenkla dina bokningar?",
  "about.ctaSubtitle":
    "Gå med i de hotell- och restaurangföretag som redan använder MimmoBook för att effektivisera dina bokningar.",

  "privacy.title": "Integritetspolicy",
  "privacy.lastUpdated": "Senast uppdaterad:",
  "privacy.s1Title": "1. Introduktion",
  "privacy.s1P1":
    "Denna integritetspolicy förklarar hur MimmoBook samlar in, använder och skyddar dina personuppgifter. Vi följer EU:s allmänna dataskyddsförordning (GDPR).",
  "privacy.s2Title": "2. Personuppgiftsansvarig",
  "privacy.s2P1":
    "MimmoBook är personuppgiftsansvarig. Kontakta oss via supportsidan för dataskyddsfrågor.",
  "privacy.s3Title": "3. Data vi samlar in",
  "privacy.s3P1": "Vi samlar in följande kategorier av personuppgifter:",
  "privacy.s3Item1": "Kontoinformation: namn, e-postadress, lösenord (hashad)",
  "privacy.s3Item2": "Företagsinformation: företagsnamn, adress, telefonnummer",
  "privacy.s3Item3":
    "Bokningsdata: gästnamn, e-post, telefonnummer, bokningsdetaljer",
  "privacy.s3Item4":
    "Användningsdata: besökta sidor, använda funktioner, webbläsartyp",
  "privacy.s4Title": "4. Syfte med behandling",
  "privacy.s4P1": "Vi behandlar dina uppgifter för följande ändamål:",
  "privacy.s4Item1":
    "Att tillhandahålla och underhålla vår bokningshanteringstjänst",
  "privacy.s4Item2":
    "Att skicka bokningsbekräftelser, påminnelser och avbokningsmeddelanden",
  "privacy.s4Item3": "Att förbättra vår plattform och utveckla nya funktioner",
  "privacy.s5Title": "5. Datalagring",
  "privacy.s5P1":
    "Vi behåller dina personuppgifter så länge ditt konto är aktivt. Bokningsdata behålls under prenumerationsperioden plus 12 månader.",
  "privacy.s6Title": "6. Dina rättigheter",
  "privacy.s6P1": "Enligt GDPR har du följande rättigheter:",
  "privacy.s6Item1":
    "Rätt till tillgång: begär en kopia av dina personuppgifter",
  "privacy.s6Item2": "Rätt till rättelse: korrigera felaktiga uppgifter",
  "privacy.s6Item3": "Rätt till radering: begär radering av dina uppgifter",
  "privacy.s6Item4": "Rätt att begränsa behandling",
  "privacy.s6Item5": "Rätt till dataportabilitet",
  "privacy.s7Title": "7. Cookies",
  "privacy.s7P1":
    "Vi använder nödvändiga cookies för att plattformen ska fungera. Analyticscookies laddas först efter ditt uttryckliga samtycke.",
  "privacy.s8Title": "8. Kontakt",
  "privacy.s8P1":
    "Kontakta oss via supportsidan för frågor om denna integritetspolicy.",

  "a11y.title": "Tillgänglighetsredogörelse",
  "a11y.lastUpdated": "Senast uppdaterad:",
  "a11y.s1Title": "1. Vårt åtagande",
  "a11y.s1P1":
    "MimmoBook är engagerat i att säkerställa digital tillgänglighet för alla. Vi förbättrar ständigt användarupplevelsen och tillämpar relevanta tillgänglighetsstandarder.",
  "a11y.s2Title": "2. Tillgänglighetsfunktioner",
  "a11y.s2P1": "Vår plattform inkluderar följande tillgänglighetsfunktioner:",
  "a11y.s2Item1": "Justerbar teckenstorlek (80% till 150%)",
  "a11y.s2Item2": "Högkontrastläge för förbättrad läsbarhet",
  "a11y.s2Item3": "Dyslexivänligt teckensnitt",
  "a11y.s2Item4": "Reducerat rörelseläge",
  "a11y.s2Item5": "Förstärkta fokusindikatorer för tangentbordsnavigering",
  "a11y.s2Item6": "Kortkommando (Alt+A) för att öppna tillgänglighetswidgeten",
  "a11y.s3Title": "3. Standarder",
  "a11y.s3P1":
    "Vi strävar efter att uppfylla WCAG 2.1 nivå AA. Viktiga områden:",
  "a11y.s3Item1": "Semantisk HTML för skärmläsarkompatibilitet",
  "a11y.s3Item2": "Tillräckliga färgkontrastförhållanden",
  "a11y.s3Item3": "Tangentbordsnavigerbart gränssnitt",
  "a11y.s4Title": "4. Kända begränsningar",
  "a11y.s4P1":
    "Vissa tredjepartskomponenter uppfyller kanske inte alla WCAG 2.1 AA-kriterier. Vi arbetar aktivt med att åtgärda dessa.",
  "a11y.s5Title": "5. Feedback",
  "a11y.s5P1":
    "Vi välkomnar din feedback om tillgängligheten. Kontakta oss via supportsidan.",
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
  "cookie.acceptAll": "Acceptera alla",
  "cookie.rejectAll": "Avvisa alla",
  "cookie.customize": "Anpassa",
  "cookie.savePreferences": "Spara inställningar",
  "cookie.title": "Cookie-inställningar",
  "cookie.description":
    "Välj vilka kategorier av cookies du tillåter. Nödvändiga cookies är alltid aktiva för att sajten ska fungera.",
  "cookie.category.necessary": "Nödvändiga",
  "cookie.category.necessaryDesc":
    "Krävs för att sajten ska fungera, inklusive inloggning, säkerhet och språkval.",
  "cookie.category.analytics": "Analys",
  "cookie.category.analyticsDesc":
    "Hjälper oss förstå hur besökare använder MimmoBook så att vi kan förbättra tjänsten.",
  "cookie.category.marketing": "Marknadsföring",
  "cookie.category.marketingDesc":
    "Används för att mäta effektiviteten av våra marknadsföringskampanjer. Av som standard.",
  "cookie.alwaysOn": "Alltid på",
  "password.minLength": "Minst 12 tecken",
  "password.uppercase": "En stor bokstav",
  "password.lowercase": "En liten bokstav",
  "password.number": "En siffra",
  "password.checking": "Kontrollerar läckta lösenord…",
  "password.breached":
    "Detta lösenord har hittats i dataintrång. Välj ett annat.",
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

  // Help & Support page
  "help.title": "Hjälp & Support",
  "help.subtitle":
    "Bläddra bland guider, vanliga frågor och fråga AI-assistenten.",
  "help.searchPlaceholder": "Sök efter hjälp...",
  "help.noResults": "Inga resultat hittades. Prova ett annat sökord.",
  "help.aiTitle": "MimmoSupporter",
  "help.aiSubtitle": "Fråga vad som helst om MimmoBook",
  "help.askOrGuide": "Ställ en fråga eller prova en snabbguide:",
  "help.thinking": "Tänker...",
  "help.cancelRequest": "Avbryt förfrågan",
  "help.submitRequest": "Skicka supportärende",
  "help.subjectPlaceholder": "Ämne (t.ex. Funktionsönskemål)",
  "help.describePlaceholder": "Beskriv din förfrågan...",
  "help.submitToAdmin": "Skicka till admin",
  "help.typePlaceholder": "Skriv din fråga...",
  "help.errorNoTenant": "Kan inte skicka förfrågan. Ingen klient hittades.",
  "help.errorSubmit": "Kunde inte skicka förfrågan",
  "help.successSubmit": "Supportärende skickat",
  "help.errorConnect": "Kunde inte ansluta. Försök igen.",
  "help.requestSubmitted": "Supportärende",
  "help.requestSubmittedDetail":
    "Ditt supportärende har skickats! Adminteamet granskar det och svarar snart.",
  "help.art1Title": "Komma igång",
  "help.art1Desc":
    "Skapa ditt konto och din första bokningssida på några minuter.",
  "help.art1C1":
    "Registrera dig för en gratis 30-dagars provperiod. Inget kreditkort behövs.",
  "help.art1C2":
    "Slutför installationsguiden för att namnge ditt företag och välja bokningstyper.",
  "help.art1C3": "Anpassa ditt varumärke (logotyp, färger) i Inställningar.",
  "help.art1C4": "Dela din bokningslänk med kunderna!",
  "help.art2Title": "Hantera bokningar",
  "help.art2Desc":
    "Visa, redigera, bekräfta och avboka bokningar från instrumentpanelen.",
  "help.art2C1":
    "Använd kalendervyn för en visuell översikt av kommande bokningar.",
  "help.art2C2":
    "Byt till listvyn för att filtrera efter status, typ eller datumintervall.",
  "help.art2C3":
    "Klicka på en bokning för att redigera detaljer, lägga till anteckningar eller ändra status.",
  "help.art2C4": "Bekräftelse- och avbokningsmeddelanden skickas automatiskt.",
  "help.art3Title": "E-postmallar",
  "help.art3Desc":
    "Anpassa bekräftelse- och avbokningsmejl som skickas till gäster.",
  "help.art3C1":
    "Gå till Inställningar → E-postmallar för att anpassa dina mejl.",
  "help.art3C2": "Förhandsgranska mejlens utseende innan du skickar dem.",
  "help.art3C3":
    "Lägg till anpassade meddelanden vid bekräftelse eller avbokning.",
  "help.art3C4": "Mejl stöder flerspråkigt innehåll (EN, FI, SV).",
  "help.art4Title": "Varumärke & Bokningssida",
  "help.art4Desc":
    "Anpassa din offentliga bokningssida med din varumärkesidentitet.",
  "help.art4C1":
    "Ladda upp din logotyp och ange primär-/accentfärger i Inställningar.",
  "help.art4C2": "Lägg till en hero-bild för bokningssidans rubrik.",
  "help.art4C3": "Din bokningssida finns på /book/din-slug.",
  "help.art4C4": "Företagsbeskrivningen visas för gäster på bokningssidan.",
  "help.art5Title": "Öppettider",
  "help.art5Desc":
    "Konfigurera när ditt företag tar emot bokningar för varje typ.",
  "help.art5C1":
    "Ange standardöppettider per bokningstyp (restaurang, lokal, hotell, wellness, anpassad) på organisationsnivå. De gäller alla resurser av den typen om de inte åsidosätts.",
  "help.art5C2":
    "Variera öppnings- och stängningstider per veckodag och markera enskilda dagar som stängda.",
  "help.art5C3":
    "Öppettider styr vilka tider som visas på den publika bokningssidan.",
  "help.art5C4":
    "Åsidosätt standardvärden på plats- eller resursnivå och använd blockerade tider för tillfälliga stängningar.",
  "help.art6Title": "Resurser & Rum",
  "help.art6Desc": "Hantera rum, bord och evenemangslokaler som kan bokas.",
  "help.art6C1": "Lägg till resurser i Resurser-sektionen.",
  "help.art6C2":
    "Ange kapacitet, prissättning och beskrivningar för varje resurs.",
  "help.art6C3":
    "Ladda upp bilder för att visa dina utrymmen på bokningssidan.",
  "help.art6C4": "Inaktivera resurser för att tillfälligt dölja dem.",
  "help.art7Title": "Personal & Användarhantering",
  "help.art7Desc": "Bjud in teammedlemmar och hantera roller och behörigheter.",
  "help.art7C1": "Ägare kan bjuda in personal via Adminpanelen.",
  "help.art7C2":
    "Roller: Ägare (full åtkomst), Admin (hantera resurser), Personal (visa bokningar).",
  "help.art7C3": "Godkänn eller ta bort teammedlemmar när som helst.",
  "help.art7C4":
    "Varje plan har en personalgräns. Uppgradera för att lägga till fler.",
  "help.art8Title": "Planer & Fakturering",
  "help.art8Desc": "Förstå prisnivåer och hantera din prenumeration.",
  "help.art8C1":
    "Basic (19 €/mån): 1 typ, 1 till 5 personal, AI-chatbot-support.",
  "help.art8C2":
    "Professional (59 €/mån): Alla typer, upp till 25 personal, anpassade mallar, AI-chatbot-support.",
  "help.art8C3":
    "Business (179 €/mån): Alla typer, upp till 50 personal, prioritetssupport med 24h svarstid.",
  "help.art8C4":
    "Enterprise (enligt offert): obegränsat antal personalanvändare. Uppgradera eller nedgradera när som helst, ändringar börjar gälla nästa faktureringsperiod.",
  "help.art9Title": "Vanliga frågor",
  "help.art9Desc": "Svar på de vanligaste frågorna om MimmoBook.",
  "help.art9C1": "F: Behöver jag ett kreditkort för provperioden? S: Nej!",
  "help.art9C2":
    "F: Kan jag använda min egen domän? S: Egna domäner finns på vår roadmap.",
  "help.art9C3":
    "F: Hur får gäster bekräftelser? S: Automatiskt via mejl när du bekräftar en bokning.",
  "help.art9C4":
    "F: Kan jag exportera mina data? S: Ja, rapporter kan exporteras från Rapporter-panelen.",
  "help.art10Title": "Nyheter",
  "help.art10Desc":
    "Senaste funktionerna: gästportal, väntelista, kalendersynk, export och mer.",
  "help.art10C1":
    "Gästportal: gäster kan visa eller avboka sin bokning via en magisk länk (/my-booking/:token) — ingen inloggning krävs.",
  "help.art10C2":
    "Väntelista: när en tid är fullbokad kan gäster gå med i en väntelista och meddelas automatiskt när en plats blir ledig.",
  "help.art10C3":
    "Google Kalender-synk: prenumerera på dina bokningar via iCal-flödet (Inställningar → Kalendersynk). CSV/PDF-export från Bokningar och Rapporter.",
  "help.art10C4":
    "Förbättringar i instrumentpanelen: mörkt läge, kortkommandon (tryck ?), Snabbåtgärds-FAB på mobil, introduktionscheckslista, granskningsloggfilter, analysdiagram, inloggningsbegränsning, säkerhetskopieringsstatus, publika omdömen/recensioner, flerspråkig publik bokningssida, kökets beställningar för restaurang- och lokalbokningar, och en Stripe-intäktspanel för superadmins.",
  "help.art10C5":
    "Senaste tilläggen: faktura-PDF per bokning, PDF-nedladdning av periodrapporter, mest bokade timmar och veckodag, plocklistor för kök, logi och evenemang, fördelning av bokningskanaler (gäst eller personal), tidslinje för e-postleveranser per bokning, granskningsvy för korsbokningar, offertpriser hämtade från resurserna, köksmeny med priser, behörighetsmeddelanden med knappen Begär åtkomst, samt ombokningsförfrågningar och avbokning av gäst.",
  "help.art10C6":
    "Allra senast: särskilda tillfällen med kapacitetsgräns (till exempel julmiddag), ett kort för avvisade bokningar som visar varför en gäst inte kunde boka, skydd mot dubbelbokning, köksrader som styrs automatiskt från en accepterad offert, och den nya Enterprise-planen med obegränsad personal.",
  "help.art11Title": "Bygg ditt system steg för steg",
  "help.art11Desc":
    "Rekommenderad ordning, från företagsuppgifter till din första testbokning.",
  "help.art11C1":
    "1) Företagsuppgifter och varumärke: namn, e-post, adress, telefon, logotyp, färger, bild och bokningssidans texter i Inställningar.",
  "help.art11C2":
    "2) Bokningstyper, platser (Business och Enterprise) och sedan resurser: rum och rumstyper, bord, lokaler eller välmåendetjänster med kapacitet, längd, pris och bilder.",
  "help.art11C3":
    "3) Öppettider (standard, platsspecifika undantag, resursens eget veckoschema), priser och rabattkoder, sedan e-postmallar samt avsändarnamn och svarsadress.",
  "help.art11C4":
    "4) Bjud in personal och sätt roller och platser, lägg till särskilda tillfällen och blockeringar, kopiera eller bädda in bokningslänken och gör till sist en testbokning: kontrollera e-posten, ladda ner fakturan och avboka.",
  "help.art12Title": "Särskilda tillfällen, köksstyrning och Enterprise",
  "help.art12Desc":
    "De nyaste funktionerna och hur de påverkar det daliga arbetet.",
  "help.art12C1":
    "Särskilda tillfällen: skapa en namngiven dag, till exempel julmiddag, med total kapacitet och antingen **fasta sittningar** eller fri bokning. Priset sätts på bokningen, inte på tillfället, och databasen hindrar samtidiga bokningar från att överboka.",
  "help.art12C2":
    "Avvisade bokningar: ett kort på instrumentpanelen listar bokningar som systemet nekade med orsak (tillfället fullt, stängd dag, dubbelinskick, felaktiga uppgifter), och ett upprepat inskick inom 15 minuter visar gästen meddelandet Du har redan skickat denna bokning.",
  "help.art12C3":
    "Köksstyrning från offerter: när en korsbokning accepteras skapas köksrader från varje dels eget fält för mat och dryck. Evenemangsrader till evenemangsbokningen, mat- och rumsrader till matbokningen (eller evenemangsbokningen om matdel saknas). Specialönskemål skickas aldrig, tomma fält skapar inget, och Förhandsvisning av köksbeställning visar exakt vad som skickas.",
  "help.art12C4":
    "Planer: Basic 5 användare, Pro 25, Business 50, Enterprise obegränsat och prissatt per offert via Begär offert på prissidan.",
  "help.guide7Q":
    "Hur skapar jag ett särskilt tillfälle, till exempel julmiddag?",
  "help.guide7A":
    "Öppna bokningstypens inställningar och lägg till ett **särskilt tillfälle**: namn, datum, total kapacitet och antingen **fasta sittningar** (gästen väljer en av dina starttider) eller **fri bokning** (valfri tid inom öppettiderna). Sätt priset på bokningen eller resursen, aldrig på tillfället. Gästerna ser tillfället på bokningssidan för den dagen, och kapaciteten kan inte överskridas ens när två gäster bokar samtidigt.",
  "help.guide8Q": "Vart går mat och dryck från en accepterad offert?",
  "help.guide8A":
    "Varje dels eget fält för mat och dryck blir köksrader på den bokning som utför den: evenemangsrader på evenemangsbokningen, matrader på matbokningen och rumsrader på matbokningen (eller evenemangsbokningen om matdel saknas). **Specialönskemål skickas aldrig till köket**, ett tomt fält skapar ingen beställning, och **Förhandsvisning av köksbeställning** samt panelen **Vart varje fält går** visar styrningen och summorna innan du accepterar.",
  "help.guide1Q": "Hur hanterar jag bokningar?",
  "help.guide1A":
    "Gå till **Instrumentpanel → Bokningar** för att visa, filtrera, redigera och hantera alla bokningar.",
  "help.guide2Q": "Hur anpassar jag min bokningssida?",
  "help.guide2A":
    "Navigera till **Inställningar** i instrumentpanelen. Ladda upp din logotyp, ange varumärkesfärger och lägg till en hero-bild.",
  "help.guide3Q": "Hur konfigurerar jag e-postmallar?",
  "help.guide3A":
    "I **Inställningar → E-postmallar** kan du anpassa bekräftelse- och avbokningsmejl.",
  "help.guide4Q": "Hur lägger jag till personal?",
  "help.guide4A":
    "Gå till **Admin → Användare** för att bjuda in ny personal. Du kan ange roller och godkänna eller ta bort medlemmar.",
  "help.guide5Q": "Hur lägger jag till eller redigerar resurser?",
  "help.guide5A":
    "Gå till **Instrumentpanel → Resurser** för att skapa rum, bord eller lokaler.",
  "help.guide6Q": "Vad är nytt i MimmoBook?",
  "help.guide6A":
    "Senaste tilläggen: **Gästportal** (bokningshantering via magisk länk), **väntelista** med automatiska aviseringar, **Google Kalender-synk** via iCal-flöde, **CSV/PDF-export**, **mörkt läge**, **kortkommandon** (tryck `?`), **Snabbåtgärds-FAB** på mobil, **introduktionscheckslista**, **granskningsloggfilter**, **analysdiagram**, **publika omdömen/recensioner**, **kökets beställningar** för restaurang- och lokalbokningar, **Offerter till bokningar konverteringsrapport** med CSV-export, och en **Stripe-intäktspanel** för superadmins.",

  // MimmoAid
  "aid.title": "MimmoAid",
  "aid.subtitle": "Fråga vad som helst om MimmoBook",
  "aid.myRequests": "Mina ärenden",
  "aid.yourRequests": "Dina inskickade supportärenden",
  "aid.askOrGuide": "Ställ en fråga eller prova en snabbguide:",
  "aid.quickGuides": "Snabbguider ▸",
  "aid.thinking": "Tänker...",
  "aid.cancelRequest": "Avbryt ärende",
  "aid.submitRequest": "Skicka supportärende",
  "aid.subjectPlaceholder": "Ämne (t.ex. Funktionsförfrågan)",
  "aid.messagePlaceholder": "Beskriv ditt ärende eller förslag...",
  "aid.submitToAdmin": "Skicka till admin",
  "aid.typePlaceholder": "Skriv din fråga...",
  "aid.sendMessage": "Skicka meddelande",
  "aid.chat": "Chatt",
  "aid.requests": "Ärenden",
  "aid.loadingRequests": "Laddar ärenden...",
  "aid.noRequests": "Inga supportärenden ännu.",
  "aid.noRequestsHint": "Skicka ett från chattvyn.",
  "aid.yourMessage": "Ditt meddelande",
  "aid.adminResponse": "Adminsvar",
  "aid.awaitingResponse": "Inväntar adminsvar...",
  "aid.requestSubmitted": "Supportärende",
  "aid.requestSubmittedDetail":
    "Ditt supportärende har skickats! Ditt adminteam granskar det snart. Du får en avisering när det har besvarats.",
  "aid.statusOpen": "Öppet",
  "aid.statusInProgress": "Pågående",
  "aid.statusResolved": "Löst",
  "aid.statusClosed": "Stängt",
  "aid.errorNoTenant": "Kunde inte skicka ärende. Ingen hyresgäst hittades.",
  "aid.errorSubmit": "Kunde inte skicka ärende",
  "aid.successSubmit": "Supportärende skickat",
  "aid.errorConnect": "Kunde inte ansluta. Försök igen.",
  "aid.guideQ1": "Hur hanterar jag bokningar?",
  "aid.guideA1":
    "Gå till **Instrumentpanel → Bokningar** för att visa, filtrera, redigera och hantera alla bokningar. Du kan bekräfta eller avboka via åtgärdsmenyn på varje kort.",
  "aid.guideQ2": "Hur anpassar jag min bokningssida?",
  "aid.guideA2":
    "Navigera till **Inställningar** i din instrumentpanel. Ladda upp din logotyp, ställ in varumärkesfärger och lägg till en hero-bild. Din publika bokningssida uppdateras automatiskt.",
  "aid.guideQ3": "Hur konfigurerar jag e-postmallar?",
  "aid.guideA3":
    "Under **Inställningar → E-postmallar** kan du anpassa både bekräftelse- och avbokningsmail. Använd förhandsgranskningsfliken för att se hur de ser ut för gästerna.",
  "aid.guideQ4": "Hur lägger jag till personal?",
  "aid.guideA4":
    "Gå till **Admin → Användare** för att bjuda in ny personal. Du kan ange roller (Ägare, Admin, Personal) och godkänna eller ta bort teammedlemmar.",
  "aid.guideQ5": "Hur lägger jag till eller redigerar resurser?",
  "aid.guideA5":
    "Gå till **Instrumentpanel → Resurser** för att skapa rum, bord eller lokaler. Du kan ange kapacitet, prissättning, ladda upp upp till 5 bilder och växla aktiv/inaktiv status.",
  "aid.guideQ6": "Hur ställer jag in öppettider?",
  "aid.guideA6":
    "Under **Inställningar → Öppettider** anger du standardvärden per bokningstyp med olika öppnings- och stängningstider för varje veckodag. Markera enskilda dagar som stängda vid behov. På Business-planen kan du åsidosätta per plats, och vilken resurs som helst kan få ett eget veckoschema från resursens redigeringsdialog.",
  "aid.guideQ7": "Hur visar jag rapporter?",
  "aid.guideA7":
    "Navigera till **Instrumentpanel → Rapporter** för att se bokningstrender, beläggningsgrad och intäktssammanfattningar. Du kan filtrera efter datumintervall och exportera utskrivbara rapporter.",
  "aid.guideQ8": "Hur fungerar prissättning för rum?",
  "aid.guideA8":
    "Ange ett **baspris per natt** för varje resurs och konfigurera **rumstypmultiplikatorer** (Enkelrum 1.0×, Dubbelrum 1.5×, Svit 2.5× osv.). Bokningssidan beräknar summorna automatiskt.",
  "aid.guideQ9": "Hur delar jag min bokningslänk?",
  "aid.guideA9":
    "Din publika bokningslänk visas på **Instrumentpanelens översikt**. Klicka på **Kopiera länk** för att kopiera den eller öppna den i en ny flik. Dela den på din webbplats eller sociala medier.",
  "aid.guideQ10": "Hur blockerar jag datum eller tider?",
  "aid.guideA10":
    "Under **Instrumentpanel → Kalender**, klicka på ett datum och använd **Blockera tid** för att förhindra bokningar för specifika datum, tider eller resurser.",
  "aid.guideQ11": "Hur hanterar jag återkommande blockeringar?",
  "aid.guideA11":
    "Gå till **Instrumentpanel → Kalender** och öppna panelen **Återkommande blockeringar**. Du kan skapa veckovis återkommande blockeringar för specifika dagar, tidsintervall och resurstyper (t.ex. stänga restaurangen varje måndag). Slå av/på eller ta bort blockeringar när som helst. Ändringar gäller direkt på den publika bokningssidan.",
  "aid.guideQ12": "Hur fungerar särskilda tillfällen?",
  "aid.guideA12":
    "Lägg till ett **särskilt tillfälle** i bokningstypens inställningar: namn, datum, total kapacitet och antingen fasta sittningar eller fri bokning. Gästerna väljer det på bokningssidan för den dagen. Priset sätts på bokningen, inte på tillfället, och kapaciteten kan aldrig överskridas.",
  "aid.guideQ13": "Vart går mat och dryck från en offert?",
  "aid.guideA13":
    "Varje dels eget fält för mat och dryck blir köksrader på den bokning som utför den: evenemangsrader på evenemangsbokningen, mat- och rumsrader på matbokningen (eller evenemangsbokningen om matdel saknas). Specialönskemål skickas aldrig till köket, och **Förhandsvisning av köksbeställning** visar varje rad innan du accepterar.",
  "aid.guideQ14": "I vilken ordning bör jag bygga systemet?",
  "aid.guideA14":
    "1) Företagsuppgifter och varumärke, 2) bokningstyper, platser och resurser, 3) öppettider, priser och rabattkoder, 4) e-postmallar och avsändaruppgifter, 5) personal, roller och platstilldelningar, 6) särskilda tillfällen och blockeringar, 7) dela eller bädda in bokningslänken och gör sedan en testbokning från början till slut.",
  // Sites
  "sites.title": "Platser",
  "sites.addSite": "Lägg till plats",
  "sites.editSite": "Redigera plats",
  "sites.tooltip":
    "Hantera flera platser eller fastigheter under ditt konto. Varje plats kan ha egna resurser, öppettider och bokningssida.",
  "sites.allSites": "Alla platser",
  "sites.approvals": "Godkännanden",
  "sites.siteName": "Platsnamn",
  "sites.siteType": "Typ",
  "sites.slug": "Slug",
  "sites.slugHint": "Används i boknings-URL: /book/",
  "sites.location": "Plats",
  "sites.description": "Beskrivning",
  "sites.descriptionPlaceholder": "Valfri beskrivning av denna plats",
  "sites.createSite": "Skapa plats",
  "sites.updateSite": "Uppdatera plats",
  "sites.siteCreated": "Plats skapad",
  "sites.siteUpdated": "Plats uppdaterad",
  "sites.siteDeleted": "Plats borttagen",
  "sites.duplicateSlug": "En plats med denna slug finns redan",
  "sites.deleteSite": "Ta bort",
  "sites.deleteConfirm":
    "Detta tar bort platsen permanent. Resurser kopplade till den blir otilldelade.",
  "sites.noSites":
    "Inga platser ännu. Skapa din första plats för att hantera flera lokaler.",
  "sites.resources": "Resurser",
  "sites.status": "Status",
  "sites.actions": "Åtgärder",
  "sites.active": "Aktiv",
  "sites.draft": "Utkast",
  "sites.typeHotel": "Hotell / Gästhus",
  "sites.typeRestaurant": "Restaurang",
  "sites.typeVenue": "Eventlokal",
  "sites.resourceName": "Resursnamn",
  "sites.resourceType": "Resurstyp",
  "sites.capacity": "Kapacitet",
  "sites.noResourcesInSite": "Inga resurser på denna plats ännu.",
  "sites.assignUsers": "Tilldela användare",
  "sites.alreadyAssigned": "Tilldelad",
  "sites.usersSelected": "valda",
  // Sample period
  "sample.warningWeek":
    "Din gratis provperiod slutar om {days} dagar. Kontakta support för att uppgradera.",
  "sample.warningDay":
    "Din gratis provperiod löper ut idag! Kontakta support för att fortsätta.",
  "sample.warningDayTomorrow":
    "Din gratis provperiod löper ut imorgon! Kontakta support för att fortsätta.",
  "sample.readOnly":
    "Din provperiod har löpt ut. Instrumentpanelen är skrivskyddad i {days} dagar till. Kontakta support.",
  "sample.blocked":
    "Din provperiod har löpt ut och åtkomst är blockerad. Kontakta support för att återaktivera.",
  "discount.title": "Rabatt",
  "discount.type": "Typ",
  "discount.value": "Värde",
  "discount.reason": "Anledning",
  "discount.reasonPlaceholder": "t.ex. Stammkund",
  "discount.percentage": "Procent (%)",
  "discount.fixed": "Fast belopp (€)",
  "discount.freeNights": "Gratis nätter/måltider",
  "discount.promoCode": "Kampanjkod",
  "discount.promoCodePlaceholder": "Ange kod om du har en",
  "discountCodes.title": "Rabattkoder",
  "discountCodes.description":
    "Skapa och hantera kampanjrabattkoder för dina kunder.",
  "discountCodes.add": "Lägg till kod",
  "discountCodes.addTitle": "Skapa rabattkod",
  "discountCodes.editTitle": "Redigera rabattkod",
  "discountCodes.formDesc": "Konfigurera rabattkodens detaljer och giltighet.",
  "discountCodes.code": "Kod",
  "discountCodes.discountCol": "Rabatt",
  "discountCodes.discountType": "Rabattyp",
  "discountCodes.value": "Värde",
  "discountCodes.uses": "Användningar",
  "discountCodes.validity": "Giltighet",
  "discountCodes.actions": "Åtgärder",
  "discountCodes.maxUses": "Max användningar",
  "discountCodes.unlimited": "Obegränsad",
  "discountCodes.minPrice": "Minbeställning (€)",
  "discountCodes.validFrom": "Giltig från",
  "discountCodes.validUntil": "Giltig till",
  "discountCodes.from": "Från",
  "discountCodes.until": "Till",
  "discountCodes.active": "Aktiv",
  "discountCodes.inactive": "Inaktiv",
  "discountCodes.activeLabel": "Aktiv vid skapande",
  "discountCodes.empty": "Inga rabattkoder ännu. Skapa din första!",
  "discountCodes.created": "Rabattkod skapad",
  "discountCodes.updated": "Rabattkod uppdaterad",
  "discountCodes.deleted": "Rabattkod borttagen",
  "discountCodes.saveError": "Kunde inte spara rabattkod",
  "discountCodes.deleteError": "Kunde inte ta bort rabattkod",
  "discountCodes.deleteTitle": "Ta bort rabattkod",
  "discountCodes.deleteConfirm":
    "Är du säker på att du vill ta bort denna rabattkod? Åtgärden kan inte ångras.",
  "approval.colType": "Typ",
  "approval.colName": "Namn",
  "approval.colDetail": "Detalj",
  "approval.colSite": "Plats",
  "approval.colSubmitted": "Inskickad",
  "approval.colActions": "Åtgärder",
  "approval.approve": "Godkänn",
  "approval.reject": "Avslå",
  "approval.rejecting": "Avslår…",
  "approval.approved": "Godkänd",
  "approval.rejected": "Avslagen",
  "approval.rejectChange": "Avslå ändring",
  "approval.rejectingLabel": "Avslår:",
  "approval.rejectionReason": "Anledning till avslag…",
  "approval.noItems": "Inga väntande godkännanden",
  "approval.noItemsDesc": "Alla ändringar har granskats.",
  "approval.typeResource": "Resurs",
  "approval.typeBlockedSlot": "Blockerad tid",
  "approval.typeRecurringBlock": "Återkommande blockering",
  "approval.typeOpeningHours": "Öppettider",
  "approval.typeEmailTemplate": "E-postmall",
  "approval.noReason": "Ingen anledning",
  "approval.closed": "Stängd",
  "approval.pendingApproval": "Inskickad för godkännande",

  // Email Template Editor
  "emailTemplates.title": "E-postmallar",
  "emailTemplates.tooltip":
    "Anpassa ämnesrad och innehåll för bekräftelse-, påminnelse- och avbokningsmejl som skickas till gäster.",
  "emailTemplates.description":
    "Anpassa mejlen som skickas till gäster vid bekräftelser, påminnelser och avbokningar.",
  "emailTemplates.proRequired": "Pro+ krävs",
  "emailTemplates.confirmation": "Bekräftelse",
  "emailTemplates.reminder": "Påminnelse",
  "emailTemplates.cancellation": "Avbokning",
  "emailTemplates.language": "Språk",
  "emailTemplates.subject": "Ämnesrad",
  "emailTemplates.body": "Mejlinnehåll (HTML)",
  "emailTemplates.showPreview": "Visa förhandsgranskning",
  "emailTemplates.hidePreview": "Dölj förhandsgranskning",
  "emailTemplates.previewLabel": "Förhandsgranskning med exempeldata",
  "emailTemplates.availableVars": "Tillgängliga variabler",
  "emailTemplates.activeToggle": "Aktivera denna mall",
  "emailTemplates.activeToggleDesc":
    "När avaktiverad används systemets standardmall istället.",
  "emailTemplates.resetDefault": "Återställ till standard",
  "emailTemplates.saved": "E-postmall sparad",
  "emailTemplates.saveError": "Kunde inte spara mallen",
  "emailTemplates.active": "Aktiv",
  "emailTemplates.inactive": "Inaktiv",
  "emailTemplates.upgradeHint":
    "Uppgradera till Professional eller Business för att anpassa e-postmallar.",
  "emailTemplates.overrideRemoved":
    "Platsspecifik ändring borttagen, använder standardmall",
  "emailTemplates.siteOverride": "Platsspecifik",
  "emailTemplates.usingTenantDefault": "Använder standardmall",
  "emailTemplates.revertToDefault": "Ta bort platsspecifik ändring",
  "emailTemplates.siteDescription":
    "Anpassa e-postmallar för denna plats. Ändringar här åsidosätter standardmallarna.",

  // Pricing page
  "pricing.heroTitle": "Enkel och transparent prissättning",
  "pricing.heroSubtitle":
    "Börja med en 30 dagars gratis provperiod. Uppgradera till nästa nivå eller avbryt när som helst.",
  "pricing.basicName": "Basic",
  "pricing.basicDesc":
    "Perfekt för ett enskilt hotell, en restaurang eller en eventlokal.",
  "pricing.basicTypes": "2 typer",
  "pricing.basicStaff": "1 till 5",
  "pricing.basicResourcesTotal": "2 totalt",
  "pricing.proResourcesPerType": "Upp till 5",
  "pricing.proName": "Pro",
  "pricing.proDesc":
    "För företag som erbjuder hotell-, restaurang- och evenemangstjänster på ett ställe.",
  "pricing.proTypes":
    "Upp till 5 bokningstyper i valfri kombination (t.ex. två restauranger och ett hotell)",
  "pricing.proStaff": "Upp till 25",
  "pricing.businessName": "Business",
  "pricing.businessDesc":
    "Funktionsrik plattform för företag med flera platser och verksamheter.",
  "pricing.businessTypes": "Alla typer, obegränsat antal",
  "pricing.businessStaff": "Upp till 50",
  "pricing.enterpriseName": "Enterprise",
  "pricing.enterpriseDesc":
    "Skräddarsydd plan för stora verksamheter som behöver mer än 50 användare.",
  "pricing.enterpriseTypes": "Alla typer, obegränsat antal",
  "pricing.enterpriseStaff": "Obegränsat",
  "pricing.enterpriseF1": "Allt i Business",
  "pricing.enterpriseF2": "Obegränsat antal personalanvändare",
  "pricing.enterpriseF3": "Prioriterad support och hjälp med införandet",
  "pricing.enterpriseF4": "Priset avtalas per offert",
  "pricing.enterprisePrice": "Enligt offert",
  "pricing.enterpriseCta": "Begär en offert",
  "pricing.byOffer": "Enligt offert",
  "pricing.basicF1": "Egen varumärkesprofil (logotyp, färger, bilder)",
  "pricing.basicF2": "Standard e-postmallar",
  "pricing.basicF3": "Konfiguration av öppettider",
  "pricing.basicF4": "Varumärkt bokningssida",
  "pricing.basicF5": "AI-driven chatbot-support",
  "pricing.proF1": "Alla grundfunktioner",
  "pricing.proF2": "Anpassade e-postmallar",
  "pricing.proF3": "AI-driven chatbot-support",
  "pricing.businessF1": "Alla Pro-funktioner",
  "pricing.businessF2":
    "Obegränsat antal platser och verksamheter, upp till 50 användare",
  "pricing.businessF3": "Avancerade rapporter",
  "pricing.businessF4": "Support (24 timmars svarstid)",
  "pricing.sitesLocations": "Platser / platser",
  "pricing.resourcesPerType": "Resurser per typ",
  "pricing.operationTypes": "Operationstyper",
  "pricing.onePerResType": "1 per res.typ",
  "pricing.responseTime24h": "Svarstid 24 timmar",
  "pricing.customBranding": "Egen varumärkesprofil",
  "pricing.brandedBooking": "Varumärkesanpassad bokningssida",
  "pricing.defaultTemplates": "Standard e-postmallar",
  "pricing.customTemplates": "Anpassade e-postmallar",
  "pricing.advancedRules": "Avancerade bokningsregler",
  "pricing.multiLanguage": "Flerspråkiga sidor",
  "pricing.multisiteManagement": "Hantering av flera platser",
  "pricing.analyticsReports": "Analys och rapporter",
  "pricing.offers": "Offerter (eventförslag och PDF)",
  "pricing.crossReservations": "Korsreservationer",
  "pricing.supportLevel": "Stöd",
  "pricing.basic": "Basic",
  "pricing.advanced": "Avancerat",
  "pricing.unlimited": "Obegränsat",
  "pricing.all": "Alla",
  "pricing.multiLocationTitle": "Hantera flera platser?",
  "pricing.multiLocationDesc":
    "Företagsplanen stöder obegränsat antal platser med hantering av flera platser. Styr dina hotell, restauranger och lokaler från en enda instrumentpanel.",
  "pricing.tryBusinessFree": "Prova Företag gratis i 30 dagar",
  "pricing.faqQ1": "Vad händer efter 30 dagars provperiod?",
  "pricing.faqA1":
    "Du får ett meddelande om att din provperiod övergår till en betald prenumeration. Du kan avbryta när som helst innan provperioden slutar, utan kostnad. Om du inte avbryter startar prenumerationen. Om du avbryter efter att prenumerationen har startat faktureras du för den första faktureringsperioden, som är 30 dagar.",
  "pricing.faqQ2": "Kan jag ändra plan senare?",
  "pricing.faqA2":
    "Ja! Du kan uppgradera eller nedgradera din plan när som helst. Ändringar träder i kraft vid början av nästa faktureringsperiod.",
  "pricing.faqQ3": "Vilka bokningstyper kan jag välja?",
  "pricing.faqA3":
    "Restaurang (bordsreservationer), Lokal (lokalförfrågningar), Gästhus (rumsreservationer) och Friskvårdstjänster (tidsbokningar för frisörer, massörer, makeupartister och liknande). Basic låter dig välja en. Pro låser upp alla typer, en av varje, på en plats. Business lägger till obegränsade platser.",
  "pricing.faqQ4": "Kan jag använda min egen domän?",
  "pricing.faqA4":
    'Varje företag får en varumärkt subdomän (t.ex. dittforetag.mimmobook.com), och du kan redan nu använda din egen webbadress tillsammans med den. I kontrollpanelen har kortet "Dela bokningssida" en flik "Egen adress": den visar hur du pekar till exempel bokning.dinsajt.se mot din bokningssida med en vidarebefordran hos din domänleverantör, och ger dig färdig kod för att bädda in bokningssidan eller lägga till en "Boka nu"-knapp på din sajt, så att din egen adress syns hela tiden. Fullt hostade egna domäner finns på vår roadmap och erbjuds då med enterprise-prissättning.',
  "pricing.faqQ5":
    "Vad är skillnaden mellan AI-chatbot-support och 24-timmarssupport?",
  "pricing.faqA5":
    "Alla planer inkluderar MimmoAid, vår AI-chatbot som kan svara på frågor, hjälpa till med felsökning och guida dig genom funktioner. Chatboten är tillgänglig 24/7 i din instrumentpanel. Business-planen lägger till 24-timmarssupport: du kan eskalera varje konversation till vårt team på plattformen via chatboten och få ett garanterat svar inom 24 timmar.",

  // Support page
  "support.heroTitle": "Hur kan vi hjälpa till?",
  "support.heroSubtitle":
    "Bläddra bland guider, vanliga frågor och svar och tips för att få ut det mesta av MimmoBook.",
  "support.articlesHeading": "Guider och svar",
  "support.searchPlaceholder": "Sök efter hjälp...",
  "support.noResults": "Inga resultat hittades. Prova ett annat sökord.",
  "support.stillNeedHelp": "Behöver du fortfarande hjälp?",
  "support.stillNeedHelpDesc":
    "Alla planer inkluderar AI-chatbot-support i instrumentpanelen. Business-kunder får support med garanterat 24-timmarssvar från vårt team. Det finns också en nedladdningsbar användarguide i backend-vyn för att hjälpa till med användningen.",
  "support.gettingStarted": "Komma igång",
  "support.gettingStartedDesc":
    "Konfigurera ditt konto och skapa din första bokningssida.",
  "support.gettingStartedC1":
    "Registrera dig för en gratis 30-dagars provperiod.",
  "support.gettingStartedC2":
    "Slutför onboarding-guiden för att namnge ditt företag och välja dina bokningstyper.",
  "support.gettingStartedC3":
    "Anpassa ditt varumärke (logotyp, färger) i Inställningar.",
  "support.gettingStartedC4": "Dela din bokningslänk med kunder!",
  "support.managingRes": "Hantera bokningar",
  "support.managingResDesc":
    "Kolla, redigera, bekräfta och avboka bokningar från din instrumentpanel.",
  "support.managingResC1":
    "Använd kalendervyn för en visuell översikt över kommande bokningar.",
  "support.managingResC2":
    "Växla till listvyn för att filtrera efter status, typ eller datumintervall.",
  "support.managingResC3":
    "Klicka på valfri bokning för att redigera information, lägga till anteckningar eller ändra status.",
  "support.managingResC4":
    "Bekräftelse- och avbokningsmejl skickas automatiskt.",
  "support.emailTemplates": "E-postmallar",
  "support.emailTemplatesDesc":
    "Kunder på företagsnivå kan anpassa bekräftelse- och avbokningsmejl som skickas till gäster.",
  "support.emailTemplatesC1":
    "Gå till Inställningar → E-postmallar för att anpassa dina e-postmeddelanden.",
  "support.emailTemplatesC2":
    "Förhandsgranska hur e-postmeddelanden ser ut innan du skickar med den inbyggda förhandsgranskningen.",
  "support.emailTemplatesC3":
    "Lägg till anpassade meddelanden per bokning när du bekräftar eller avbokar.",
  "support.emailTemplatesC4":
    "E-postmeddelanden stöder flerspråkigt innehåll (enska, finska, svenska).",
  "support.brandingTitle": "Inställningar och resurssidor",
  "support.brandingDesc":
    "Anpassa din offentliga bokningssida med din varumärkesidentitet.",
  "support.brandingC1":
    "Ladda upp din logotyp och ange primär-/accentfärger i Inställningar.",
  "support.brandingC2": "Lägg till en huvudbild för din bokningssidas rubrik.",
  "support.brandingC3":
    "Företagsbeskrivningen visas på bokningssidan för gäster.",
  "support.brandingC4": "",
  "support.openingHoursTitle": "Öppettider",
  "support.openingHoursDesc":
    "Konfigurera när ditt företag accepterar bokningar för varje typ.",
  "support.openingHoursC1":
    "Ställ in standardöppettider per bokningstyp (restaurang, lokal, hotell, friskvård, anpassad) på organisationsnivå. De gäller alla matchande resurser om de inte åsidosätts.",
  "support.openingHoursC2":
    "Välj samma tider för alla öppna dagar eller olika tider per dag, och markera enskilda dagar som stängda.",
  "support.openingHoursC3":
    "Öppettiderna styr vilka tidsluckor som visas på den publika bokningssidan.",
  "support.openingHoursC4":
    "Använd blockerade tidsluckor för att tillfälligt stänga ett specifikt datum eller tidsintervall utan att ändra veckoschemat.",
  "support.openingHoursC5":
    "Tre lager, finast vinner: organisationens standard, platsspecifika åsidosättningar (Business-plan) och öppettider per resurs. Vilken resurstyp som helst kan ha sitt eget veckoschema, inte bara restauranger.",
  "support.openingHoursC6":
    "Tillfälliga arbetstider: öppna ett specifikt datum och tidsfönster för sporadiska arbetare (t.ex. en friskvårdare som bara jobbar vissa lördagar). Bokningskalendern öppnar dagen även om veckoschemat markerar den stängd; blockerade tider gäller fortfarande.",
  "support.openingHoursC7":
    "Varje resurs kan åsidosätta sin tidszon (IANA-namn som Europe/Helsinki). Om den inte är inställd används organisationens tidszon. Alla väggklocka-kontroller (idag, veckodag, tidsluckor) använder resursens effektiva tidszon.",
  "support.resourcesTitle": "Resurser och rum",
  "support.resourcesDesc":
    "Hantera rum, bord och evenemangsutrymmen som kan bokas.",
  "support.resourcesC1":
    "Lägg till resurser i avsnittet Resurser på din instrumentpanel.",
  "support.resourcesC2":
    "Ställ in kapacitet, priser och beskrivningar för varje resurs.",
  "support.resourcesC3":
    "Ladda upp foton för att visa upp dina utrymmen på bokningssidan.",
  "support.resourcesC4":
    "Inaktivera resurser för att tillfälligt dölja dem från bokningar.",
  "support.staffTitle": "Användarhantering",
  "support.staffDesc":
    "Bjud in teammedlemmar och hantera roller och behörigheter.",
  "support.staffC1": "Ägare kan bjuda in personal via administratörspanelen.",
  "support.staffC2":
    "Roller: Ägare (full åtkomst), Admin (hantera resurser), Personal (visa reservationer).",
  "support.staffC3": "Godkänn eller ta bort teammedlemmar när som helst.",
  "support.staffC4":
    "Planer har en begränsning för personalanvändare och reservationstyper. Uppgradera för att lägga till fler.",
  "support.billingTitle": "Planer och fakturering",
  "support.billingDesc": "Förstå prisnivåer och hantera din prenumeration.",
  "support.billingC1":
    "Basic (19 €/mån): 1 reserveringstyp, 1 till 5 anställda, AI-chatbotsupport.",
  "support.billingC2":
    "Professional (59 €/mån): Alla reserveringstyper (en per typ), upp till 25 anställda, AI-chatbotsupport.",
  "support.billingC3":
    "Business (179 €/mån): Alla reserveringstyper och obegränsat antal, obegränsat antal anställda, prioriterad support med 24 timmars svar.",
  "support.billingC4":
    "Uppgradera eller nedgradera när som helst. Ändringarna träder i kraft nästa faktureringscykel.",
  "support.faqTitle": "Vanliga frågor",
  "support.faqDesc": "Svar på de vanligaste frågorna om MimmoBook.",
  "support.faqC1":
    "F: Kan jag använda min egen domän? S: Anpassade domäner finns på vår färdplan.",
  "support.faqC2":
    "F: Hur får gäster bekräftelser? S: Automatiskt via e-post när du bekräftar en bokning.",
  "support.faqC3":
    "F: Kan jag exportera mina data? S: Ja, rapporter kan exporteras från rapportpanelen.",
  "support.faqC4":
    "F: Vad är skillnaden mellan AI-chatbot och prioriterad support? A: Alla planer inkluderar MimmoAid, vår AI-chatbot som är öppen dygnet runt. Affärsplanen lägger till möjlighet för supportförfrågningar som ställs på plattformen med garanterat 24-timmarssvar.",
  "support.faqC5": "",
  "support.catBasics": "Grunder",
  "support.catReservations": "Bokningar",
  "support.catCommunication": "Kommunikation",
  "support.catCustomization": "Anpassning",
  "support.catConfiguration": "Konfiguration",
  "support.catTeam": "Team",
  "support.catBilling": "Fakturering",
  "support.catFaq": "Vanliga frågor",

  // What Is MimmoBook
  "whatIs.badge": "Om plattformen",
  "whatIs.heroTitle": "Vad är MimmoBook?",
  "whatIs.heroSubtitle":
    "MimmoBook är en molnbaserad bokningshanteringsplattform byggd för restauranger, eventlokaler, hotell och gästhus. Ett verktyg för att hantera alla dina bokningar.",
  "whatIs.seeFeatures": "Se alla funktioner",
  "whatIs.definitionTitle": "MimmoBook: Bokningshantering för besöksnäringen",
  "whatIs.definitionP1":
    "MimmoBook är en SaaS-plattform som hjälper besöksnäringsföretag att hantera bokningar online. Oavsett om du driver en restaurang, eventlokal, hotell eller gästhus ger MimmoBook dig en centraliserad instrumentpanel för att hantera bokningar, kommunicera med gäster och spåra affärsprestanda.",
  "whatIs.definitionP2":
    "Till skillnad från generiska bokningsverktyg är MimmoBook designat specifikt för besöksnäringen. Det stöder flera bokningstyper, inklusive bordsreserveringar, rumsreserveringar, lokalhyra, cateringbeställningar och popup-evenemang, allt från ett enda konto. Varje företag får en varumärkesanpassad bokningssida.",
  "whatIs.definitionP3":
    "MimmoBook finns tillgängligt på engelska, finska och svenska, vilket gör det idealiskt för företag som verkar i Norden och internationellt. Plattformen skalas från enskilda restauranger till besöksnäringsgrupper med flera platser.",
  "whatIs.whoTitle": "Vem är MimmoBook till för?",
  "whatIs.whoSubtitle":
    "MimmoBook betjänar besöksnäringsföretag i alla storlekar inom fyra huvudkategorier.",
  "whatIs.whoRestaurants": "Restauranger",
  "whatIs.whoRestaurantsDesc":
    "Hantera bordsreserveringar, set-menyer och gästpreferenser. Hantera walk-ins och onlinebokningar från en instrumentpanel.",
  "whatIs.whoVenues": "Eventlokaler",
  "whatIs.whoVenuesDesc":
    "Samordna lokal­bokningar, utrustningsbehov, cateringförfrågningar och evenemangsscheman med automatiska bekräftelser.",
  "whatIs.whoHotels": "Hotell",
  "whatIs.whoHotelsDesc":
    "Hantera rumsreserveringar, in-/utcheckning, frukost­alternativ och rumstyps­prissättning för din fastighet.",
  "whatIs.whoGuesthouses": "Gästhus",
  "whatIs.whoGuesthousesDesc":
    "Förenkla gästboende med enkel rumsbokning, tillgänglighetshantering och personlig kommunikation.",
  "whatIs.whoWellness": "Friskvårdstjänster",
  "whatIs.whoWellnessDesc":
    "Frisörer, massörer, makeupartister och liknande leverantörer kan publicera en bockbar tjänstemeny så att kunderna bokar rätt mängd tid.",
  "whatIs.howTitle": "Hur fungerar MimmoBook?",
  "whatIs.howSubtitle": "Kom igång på fyra enkla steg.",
  "whatIs.howStep1": "Registrera dig",
  "whatIs.howStep1Desc":
    "Skapa ditt konto och starta en 30-dagars gratis provperiod. Inget kreditkort behövs.",
  "whatIs.howStep2": "Konfigurera",
  "whatIs.howStep2Desc":
    "Ställ in din företagsprofil, bokningstyper, öppettider och varumärkesanpassning.",
  "whatIs.howStep3": "Dela",
  "whatIs.howStep3Desc":
    "Dela din varumärkes­anpassade bokningssida med gäster via din webbplats, sociala medier eller e-post.",
  "whatIs.howStep4": "Hantera",
  "whatIs.howStep4Desc":
    "Hantera alla bokningar från din instrumentpanel med automatiserade e-postmeddelanden, rapporter och teamverktyg.",
  "whatIs.keyFeaturesTitle": "Nyckelfunktioner",
  "whatIs.feat1": "Smarta bokningar",
  "whatIs.feat1Desc":
    "Ta emot och hantera bokningar för restauranger, lokaler, hotell och gästhus från en plattform.",
  "whatIs.feat2": "Anpassat varumärke",
  "whatIs.feat2Desc":
    "Din bokningssida speglar ditt varumärke med anpassade färger, logotyp och bilder.",
  "whatIs.feat3": "Teamhantering",
  "whatIs.feat3Desc":
    "Bjud in personal, tilldela roller och kontrollera behörigheter för hela ditt team.",
  "whatIs.feat4": "Flerspråkigt stöd",
  "whatIs.feat4Desc":
    "Instrumentpanel och bokningssidor tillgängliga på engelska, finska och svenska.",
  "whatIs.feat5": "Rapporter och analys",
  "whatIs.feat5Desc":
    "Följ intäkter, beläggning och bokningstrender med exporterbara rapporter.",
  "whatIs.feat6": "Automatiserade e-postmeddelanden",
  "whatIs.feat6Desc":
    "Bekräftelse-, påminnelse- och avbokningsmeddelanden skickas automatiskt till gäster.",
  "whatIs.allFeatures": "Visa alla funktioner",
  "whatIs.ctaTitle": "Redo att förenkla dina bokningar?",
  "whatIs.ctaSubtitle":
    "Starta din 30-dagars gratis provperiod idag. Inget kreditkort behövs.",

  // Features Page
  "featuresPage.badge": "Plattformens funktioner",
  "featuresPage.heroTitle": "Allt du behöver för att hantera bokningar",
  "featuresPage.heroSubtitle":
    "Från bokningssidor till rapporter, MimmoBook ger dig en komplett verktygslåda för bokningshantering inom besöksnäringen.",
  "featuresPage.ctaTitle": "Börja hantera bokningar idag",
  "featuresPage.ctaSubtitle":
    "Testa alla funktioner gratis i 30 dagar. Inget kreditkort behövs.",
  "featuresPage.comparePlans": "Jämför planer",
  "features.catReservations": "Bokningshantering",
  "features.catBranding": "Varumärke och bokningssidor",
  "features.catManagement": "Team- och verksamhetshantering",
  "features.catComms": "Kommunikation och rapportering",
  "features.f1Title": "Flertyps­bokningar",
  "features.f1Desc":
    "Stöd för bordsreserveringar, rumsreserveringar, lokalhyra, cateringbeställningar och popup-evenemang från ett konto.",
  "features.f2Title": "Öppettider och tillgänglighet",
  "features.f2Desc":
    "Konfigurera öppettider per bokningstyp med blockerade tidsluckor och återkommande stängningar.",
  "features.f3Title": "Automatiska påminnelser",
  "features.f3Desc":
    "Gäster får automatiska påminnelsemeddelanden före sin bokning för att minska uteblivanden.",
  "features.f4Title": "Rabattkoder",
  "features.f4Desc":
    "Skapa procent- eller beloppsrabattkoder med användningsgränser och datumbegränsningar.",
  "features.f5Title": "Varumärkesanpassade bokningssidor",
  "features.f5Desc":
    "Din publika bokningssida visar din logotyp, färger, huvudbild och företagsbeskrivning.",
  "features.f6Title": "Redo för egen domän",
  "features.f6Desc":
    "Varje företag får en unik boknings-URL. Dela den på din webbplats, sociala medier eller tryckt material.",
  "features.f7Title": "Flerspråkigt (EN/FI/SV)",
  "features.f7Desc":
    "Instrumentpanel och bokningssidor är helt översatta till engelska, finska och svenska.",
  "features.f8Title": "Mobilanpassad",
  "features.f8Desc":
    "Bokningssidan och instrumentpanelen fungerar perfekt på telefoner, surfplattor och datorer.",
  "features.f9Title": "Teamroller och behörigheter",
  "features.f9Desc":
    "Bjud in personal som ägare, administratörer eller teammedlemmar med detaljerad behörighetskontroll.",
  "features.f10Title": "Resurshantering",
  "features.f10Desc":
    "Skapa och hantera rum, bord, eventlokaler och andra bokningsbara resurser med foton och beskrivningar.",
  "features.f11Title": "Stöd för flera platser",
  "features.f11Desc":
    "Hantera flera platser från ett konto med varumärkesanpassning, personal och rapportering per plats.",
  "features.f12Title": "Godkännandeflöden",
  "features.f12Desc":
    "Granska och godkänn bokningar, resursändringar och blockerade tidsluckor innan de publiceras.",
  "features.f13Title": "E-postmallar",
  "features.f13Desc":
    "Anpassa bekräftelse-, påminnelse- och avbokningsmeddelanden per bokningstyp och språk.",
  "features.f14Title": "Anpassade e-postmallar",
  "features.f14Desc":
    "Business-kunder kan helt anpassa e-postens HTML med sitt eget varumärke och budskap.",
  "features.f15Title": "Rapporter och analys",
  "features.f15Desc":
    "Intäktsrapporter, bokningstrender, beläggningsgrader och CSV-exporter för bokföring.",
  "features.f16Title": "Faktureringsuppföljning",
  "features.f16Desc":
    "Markera bokningar som fakturerade och spåra ofakturerade intäkter för alla bokningstyper.",
  "features.f17Title": "Erbjudanden och förslag",
  "features.f17Desc":
    "Skapa professionella erbjudanden med PDF-generering och skicka dem direkt till gäster via e-post.",
  "features.f18Title": "Korsbokningar",
  "features.f18Desc":
    "Länka bokningar mellan utrymmen och tjänster. Markera länkade bokningar som använda eller fakturerade tillsammans.",
  "features.catGuests": "Gästupplevelse och självbetjäning",
  "features.catOperations": "Daglig drift",
  "features.catSecurity": "Säkerhet och förtroende",
  "features.catPlatform": "Plattform och effektivitet",
  "features.f19Title": "Gästens egen bokningssida",
  "features.f19Desc":
    "Gästen öppnar sin bokning via en säker länk och kan se eller avboka utan konto.",
  "features.f20Title": "Väntelista",
  "features.f20Desc":
    "När en tid är full ställer gästen sig i kö och får e-post så snart en plats blir ledig.",
  "features.f21Title": "Ombokningsförfrågningar",
  "features.f21Desc":
    "Gästen föreslår en ny tid från sin bokningssida och personalen godkänner eller avslår.",
  "features.f22Title": "Gästomdömen",
  "features.f22Desc":
    "Efter besöket skickas en förfrågan om omdöme, och de omdömen du publicerar visas på bokningssidan.",
  "features.f23Title": "Köksordrar",
  "features.f23Desc":
    "Följ mat, dryck och noteringar per bokning med statusarna mottagen, tillagas, klar och serverad.",
  "features.f24Title": "Återanvändbar köksmeny",
  "features.f24Desc":
    "Spara menyposterna en gång, sedan fylls namn, kategori och pris i på orderraden med ett klick.",
  "features.f25Title": "Utskrivbara plocklistor",
  "features.f25Desc":
    "Skriv ut listor för kök, logi och evenemang för valfri dag så teamet kan arbeta från papper.",
  "features.f26Title": "Kalendersynk",
  "features.f26Desc":
    "Prenumerera på ditt bokningsflöde i Google Kalender, Apple Kalender eller Outlook.",
  "features.f27Title": "Specialtillfällen",
  "features.f27Desc":
    "Namnge ett datum, ange kapacitet och välj fasta sittningar eller fri bokning i stället för ordinarie tider.",
  "features.f28Title": "Bokningsfakturor",
  "features.f28Desc":
    "Ladda ner en PDF-faktura med originalbelopp, använd rabattkod, rabatt och slutsumma.",
  "features.f29Title": "Topptimmar och travaste dag",
  "features.f29Desc":
    "Se vilka timmar och veckodagar som fylls först och bemanna och prissätt därefter.",
  "features.f30Title": "Fördelning av bokningskanaler",
  "features.f30Desc":
    "Jämför hur många bokningar som kommer från den publika sidan och hur många personalen lägger in.",
  "features.f31Title": "Tidslinje för e-post",
  "features.f31Desc":
    "Varje bokning visar vilka e-postmeddelanden som köades, skickades eller misslyckades och när.",
  "features.f32Title": "Tvåstegsinloggning",
  "features.f32Desc":
    "Skydda konton med en kod från en autentiseringsapp och engångskoder för återställning.",
  "features.f33Title": "Händelselogg",
  "features.f33Desc":
    "Se vem som ändrade vad och när, filtrerat på åtgärd, tidsperiod eller person.",
  "features.f34Title": "Inloggningsskydd",
  "features.f34Desc":
    "Långa lösenord, kontroll mot kända läckta lösenord och en gräns för upprepade inloggningsförsök.",
  "features.f35Title": "Dataisolering och lagring",
  "features.f35Desc":
    "Dina uppgifter hålls skilda från andra företag, med automatisk arkivering och gallring enligt schema.",
  "features.f36Title": "Dela och bädda in",
  "features.f36Desc":
    "Färdiga bokningslänkar, länkar per tjänst och per plats samt inbäddning på din egen webbplats.",
  "features.f37Title": "Mörkt läge och kortkommandon",
  "features.f37Desc":
    "Arbeta i ljust eller mörkt läge och hoppa mellan paneler med kortkommandon.",
  "features.f38Title": "Checklista för start",
  "features.f38Desc":
    "Ett förloppskort guidar dig genom resurser, öppettider och e-post redan första dagen.",
  "features.f39Title": "Guide och supportassistent",
  "features.f39Desc":
    "Inbyggd guidebok, utskrivbar personalguide och en supportassistent som svarar i appen.",
  "features.offersAndCross": "Erbjudanden och korsbokningar",
  "features.offersAndCrossDesc":
    "Skapa erbjudanden, generera varumärkesanpassade PDF:er och länka bokningar mellan utrymmen och hantera allt tillsammans.",

  // Use Cases
  "useCases.badge": "Användningsfall",
  "useCases.ogTitle":
    "Bokningssystem för barberare, salonger, massörer, bagerier och tränare",
  "useCases.ogDescription":
    "För serviceyrken: bokningar dygnet runt, väntelista, priser på tjänster, påminnelser och kundomdömen. Även för restauranger, lokaler och hotell.",
  "useCases.ogImageAlt":
    "MimmoBooks användningsfall för serviceyrken och besöksnäringen",
  "useCases.seoTitle":
    "Användningsfall: barberare, frisörer, massörer, bagerier",
  "useCases.seoDescription":
    "Se hur MimmoBook fungerar för barberare, frisörer, massörer, bagare, personliga tränare, makeupartister, restauranger, lokaler, hotell, gästhus och catering.",
  "useCases.seoKeywords":
    "barberare bokningssystem, frisör bokning, massör bokning, bageri bokning, personlig tränare bokning, makeupartist bokning, bokningssystem för serviceföretag, restaurangbokning, lokalbokning",
  "useCases.heroTitle":
    "Byggd för alla typer av besöksnärings- och serviceföretag",
  "useCases.heroSubtitle":
    "Se hur MimmoBook löser bokningsutmaningar för restauranger, lokaler, hotell, gästhus, cateringföretag, popup-evenemang och serviceproffs: barberare, frisörer, massörer, bagare, makeupartister och personliga tränare.",
  "useCases.challengesLabel": "Vanliga utmaningar",
  "useCases.solutionLabel": "Hur MimmoBook hjälper",
  "useCases.restaurant": "Restaurangbokningar",
  "useCases.restaurantDesc":
    "Restauranger behöver hantera bordsreserveringar, walk-ins, set-menyer och specialkost samtidigt som de spårar gästpreferenser och uteblivanden.",
  "useCases.restaurantChallenges":
    "Telefonbokning är tidskrävande och felbenägen. Rusningstider skapar flaskhalsar. Uteblivanden slösar kapacitet. Manuell spårning missar gästpreferenser.",
  "useCases.restaurantSolution":
    "MimmoBook erbjuder en varumärkesanpassad online-bokningssida där gäster bokar själva. Automatiska bekräftelser och påminnelser minskar uteblivanden. Alla gästdata och preferenser lagras på ett ställe.",
  "useCases.venue": "Lokal- och evenemangsbokningar",
  "useCases.venueDesc":
    "Eventlokaler behöver samordna utrymmestillgänglighet, utrustning, catering och personal medan de hanterar flera bokningar och klientkommunikation.",
  "useCases.venueChallenges":
    "Dubbelbokningar vid e-post- eller telefonbokning. Komplex logistik för flera utrymmen. Splittrad kommunikation med klienter. Svårt att spåra intäkter per evenemangstyp.",
  "useCases.venueSolution":
    "MimmoBooks resurshantering förhindrar dubbelbokningar. Varje lokal har sin egen tillgänglighetskalender. Automatiserade e-postmeddelanden håller klienterna informerade.",
  "useCases.hotel": "Hotellrumsbokningar",
  "useCases.hotelDesc":
    "Hotell behöver hantera rumstillgänglighet, in-/utcheckning, rumstyper, prisnivåer och frukost­alternativ.",
  "useCases.hotelChallenges":
    "Hantering av rumsinventarie per rumstyp. Manuell in-/utcheckningsspårning. Samordning av frukost­alternativ och prissättning. Professionell bokningsupplevelse utan dyra system.",
  "useCases.hotelSolution":
    "MimmoBook stöder rumstyps­prissättning, sängkonfigurationer, frukost­alternativ och in-/utchecknings­spårning. Den varumärkesanpassade bokningssidan ger gästerna en professionell bokningsupplevelse.",
  "useCases.guesthouse": "Gästhusbokningar",
  "useCases.guesthouseDesc":
    "Gästhus och B&B behöver ett enkelt system för att hantera gästvistelser, tillgänglighet och kommunikation utan företags­programvarans komplexitet.",
  "useCases.guesthouseChallenges":
    "Företagshotellsystem är för komplexa och dyra. Kalkylblad och telefonbokningar missar reserveringar. Ingen automatiserad gästkommunikation. Svårt att visa tillgänglighet online.",
  "useCases.guesthouseSolution":
    "MimmoBook erbjuder ett enkelt, prisvärt bokningssystem dimensionerat för gästhus. Gäster bokar direkt via din varumärkesanpassade sida. Automatiserade e-postmeddelanden hanterar bekräftelser och påminnelser.",
  "useCases.catering": "Cateringbeställningar",
  "useCases.cateringDesc":
    "Cateringföretag behöver hantera leveransdetaljer, menyval, specialkost och evenemangsspecifik logistik för varje beställning.",
  "useCases.cateringChallenges":
    "Beställningsdetaljer försvinner i e-postkedjor. Specialkost missas. Ingen centraliserad vy över kommande beställningar. Manuell samordning slösar tid.",
  "useCases.cateringSolution":
    "MimmoBook samlar alla cateringdetaljer i strukturerade bokningsformulär. Leveransadresser, kostinformation och gästantal lagras per beställning.",
  "useCases.popup": "Popup-evenemang och marknader",
  "useCases.popupDesc":
    "Popup-arrangemang behöver hantera leverantörsansökningar, ståndstilldelning och evenemangslogistik på tillfälliga platser.",
  "useCases.popupChallenges":
    "Leverantörshantering via e-post är kaotisk. Ståndstilldelning spåras manuellt. Ingen centraliserad vy över leverantörsdetaljer. Avgiftsspårning är inkonsekvent.",
  "useCases.popupSolution":
    "MimmoBooks popup-bokningstyp samlar ståndstorlek, avgifter, utrustningsbehov och leverantörsdetaljer. Arrangörer ser alla ansökningar i en instrumentpanel med godkännandeflöden.",
  "useCases.wellness": "Friskvårds- och servicebokningar",
  "useCases.wellnessDesc":
    "Frisörer, massörer, makeupartister och liknande leverantörer behöver att kunderna bokar rätt mängd tid, vilket varierar beroende på vilka tjänster de väljer.",
  "useCases.wellnessChallenges":
    "Kunder vet inte alltid hur lång tid besöket tar. Att kombinera flera tjänster i ett besök är svårt att förklara via telefon. Att lägga ihop tjänstetider manuellt är felbenäget.",
  "useCases.wellnessSolution":
    "MimmoBook låter dig publicera en bockbar tjänstemeny med pris och tid per tjänst (i 5 minuters steg, upp till 8 timmar). Kunden bockar i det de vill ha och bokningstiden anpassas automatiskt. Inga betalningar, bara tidsbokningen.",
  "useCases.workflowsTitle":
    "Så sköter yrkespersoner inom servicebranschen sin vecka",
  "useCases.workflowsSubtitle":
    "Fyra vardagliga exempel på bokningar, väntelista, priser och fakturering samt kundomdömen i MimmoBook. Kunden betalar dig på plats eller mot faktura, MimmoBook håller ordning på tider, priser och papper.",
  "useCases.wf1Role": "Frisör eller barberare",
  "useCases.wf1Focus": "Bokningar",
  "useCases.wf1S1":
    "Du publicerar dina tjänster med pris och tid för varje, och ställer in öppettiderna per dag.",
  "useCases.wf1S2":
    "Kunden väljer en tjänst på din egen bokningssida, och tidens längd anpassas till valet.",
  "useCases.wf1S3":
    "Kunden får en bekräftelse direkt, du får bokningen i kalendern och en notis i appen.",
  "useCases.wf1S4":
    "Ett påminnelsemeddelande går ut före besöket, och du markerar kunden som anländ.",
  "useCases.wf2Role": "Massör",
  "useCases.wf2Focus": "Väntelista",
  "useCases.wf2S1":
    "När de önskade tiderna är fullbokade går kunden med på väntelistan för den dag de vill.",
  "useCases.wf2S2":
    "Du ser alla väntande med namn, telefonnummer och önskat datum i en enda lista.",
  "useCases.wf2S3":
    "En avbokning frigör en timme, så du kontaktar den första i listan och markerar personen som meddelad.",
  "useCases.wf2S4":
    "Du lägger in bokningen själv med några klick, eller låter kunden boka den lediga tiden.",
  "useCases.wf3Role": "Bageri eller tårtbagare",
  "useCases.wf3Focus": "Priser och fakturering",
  "useCases.wf3S1":
    "Beställningarna kommer in med upphämtningsdag, antal och kundens anteckningar om kost.",
  "useCases.wf3S2":
    "Du sätter priset själv, eller låter de publicerade tjänstepriserna räkna ut summan automatiskt.",
  "useCases.wf3S3":
    "Till företagskunder skickar du en offert som PDF i din egen stil och kopplar flera beställningar till samma evenemang.",
  "useCases.wf3S4":
    "Du markerar beställningen som fakturerad, och rapporterna visar vad som ännu inte fakturerats.",
  "useCases.wf4Role": "Personlig tränare",
  "useCases.wf4Focus": "Kundomdömen",
  "useCases.wf4S1":
    "Efter passet får kunden en personlig länk för att ge betyg och en kommentar.",
  "useCases.wf4S2":
    "Alla omdömen hamnar i din översikt, och bara de du publicerar syns utåt.",
  "useCases.wf4S3":
    "Publicerade omdömen visas på din bokningssida, så nya kunder ser riktig återkoppling före bokningen.",
  "useCases.wf4S4":
    "Betygens utveckling syns i rapporterna vid sidan av bokningar, rusningstider och avbokningar.",
  "useCases.tradeCtaTitle": "Börja med en bokningssida gjord för ditt yrke",
  "useCases.tradeCtaSubtitle":
    "Välj ditt arbete och kom igång på en eftermiddag. Varje plan börjar med 30 dagars kostnadsfri provperiod, utan kort.",
  "useCases.tradeCtaBarberName": "Barberare",
  "useCases.tradeCtaBarberLine":
    "Fasta tider för klippning och skägg i följd, med påminnelser som minskar uteblivna besök.",
  "useCases.tradeCtaBarberButton": "Kom igång med barberarbokningar",
  "useCases.tradeCtaHairdresserName": "Frisörer",
  "useCases.tradeCtaHairdresserLine":
    "Färg och behandlingstider räknas ut automatiskt när kunden väljer tjänster.",
  "useCases.tradeCtaHairdresserButton": "Kom igång med salongsbokningar",
  "useCases.tradeCtaMassageName": "Massörer",
  "useCases.tradeCtaMassageLine":
    "Behandlingar på 30, 60 och 90 minuter, plus väntelista för dina mest bokade timmar.",
  "useCases.tradeCtaMassageButton": "Kom igång med behandlingsbokningar",
  "useCases.tradeCtaBakerName": "Bagare",
  "useCases.tradeCtaBakerLine":
    "Tårt och cateringbeställningar med upphämtningsdag, kostnoteringar, priser och fakturering.",
  "useCases.tradeCtaBakerButton": "Kom igång med beställningar",
  "useCases.tradeCtaMakeupName": "Makeupartister",
  "useCases.tradeCtaMakeupLine":
    "Bröllops och evenemangsbokningar med adress, antal personer och egen offert som PDF.",
  "useCases.tradeCtaMakeupButton": "Kom igång med makeupbokningar",
  "useCases.tradeCtaTrainerName": "Personliga tränare",
  "useCases.tradeCtaTrainerLine":
    "Återkommande pass, incheckning på plats och publicerade kundomdömen på din sida.",
  "useCases.tradeCtaTrainerButton": "Kom igång med träningsbokningar",
  "useCases.ctaTitle": "Hittade du ditt användningsfall?",
  "useCases.ctaSubtitle":
    "Starta din 30-dagars gratis provperiod och skapa din första bokningssida på minuter.",

  // Blog
  "blog.badge": "Blogg",
  "blog.heroTitle": "Insikter och guider för besöksnäringen",
  "blog.heroSubtitle":
    "Tips, bästa praxis och insikter för besöksnäringsföretag som hanterar bokningar.",
  "blog.readMore": "Läs mer",
  "blog.backToBlog": "Tillbaka till bloggen",
  "blog.postCta": "Redo att effektivisera dina bokningar?",
  "blog.relatedReading": "Läs också",
  "blog.ctaTitle": "Håll dig uppdaterad",
  "blog.ctaSubtitle":
    "Testa MimmoBook gratis i 30 dagar och se hur det förändrar din bokningshantering.",
  "blog.catInsights": "Insikter",
  "blog.catGuides": "Guider",
  "blog.post1Title": "5 bokningsutmaningar som små besöksnäringsföretag möter",
  "blog.post1Excerpt":
    "Från uteblivanden till dubbelbokningar, små restauranger, lokaler och gästhus möter unika utmaningar. Här är de och hur man löser dem.",
  "blog.post1C1":
    "Små besöksnäringsföretag, såsom restauranger med en handfull bord, boutiquelokaler och familjedrivna gästhus, möter bokningsutmaningar som större verksamheter löser med dedikerad personal och företagsprogramvara. Men för ett företag med 5 till 30 platser är dessa lösningar överdimensionerade.",
  "blog.post1C2":
    "Den första utmaningen är uteblivanden. När ett bord för fyra inte dyker upp på en restaurang med 20 platser, försvinner 20% av kapaciteten. Automatiska påminnelsemeddelanden 24 timmar före en bokning kan minska uteblivandena med 30 till 50%.",
  "blog.post1C3":
    "Den andra utmaningen är dubbelbokningar. När bokningar kommer via telefon, e-post, Instagram-meddelanden och walk-ins, är det lätt att boka samma bord eller rum dubbelt. Ett centraliserat bokningssystem med realtidstillgänglighet eliminerar detta helt.",
  "blog.post1C4":
    "För det tredje är gästkommunikationen inkonsekvent. Vissa gäster får bekräftelsemeddelande, andra inte. Automatiserade e-postflöden säkerställer att varje gäst får samma professionella upplevelse.",
  "blog.post1C5":
    "För det fjärde är intäktsspårning manuell och felbenägen. Små företag använder ofta kalkylblad eller papper för att spåra bokningar. Ett bokningssystem med inbyggd rapportering löser detta. För det femte lider onlinesynligheten. Utan en professionell bokningssida kan potentiella gäster inte enkelt hitta tillgänglighet.",
  "blog.post2Title": "Varför kalkylblad inte fungerar för bokningshantering",
  "blog.post2Excerpt":
    "Kalkylblad är flexibla men skapar problem för bokningshantering. Här är varför dedikerad programvara är värd bytet.",
  "blog.post2C1":
    "Kalkylblad är standardverktyget för många småföretag. De är gratis, flexibla och välkända. Men för bokningshantering skapar de problem som förvärras med tiden.",
  "blog.post2C2":
    "Det största problemet är att kalkylblad inte är realtid. När två medarbetare uppdaterar samma ark uppstår konflikter. Det finns ingen live-tillgänglighetsvy, så personalen måste kontrollera manuellt före varje bekräftelse.",
  "blog.post2C3":
    "Kalkylblad kan inte heller skicka e-post. Varje bekräftelse, påminnelse och avbokning måste hanteras manuellt. Ett dedikerat bokningssystem automatiserar all gästkommunikation.",
  "blog.post2C4":
    "Slutligen erbjuder kalkylblad ingen analys. Du kan inte enkelt se beläggningsgrader, bokningstrender eller intäkter per bokningstyp utan komplexa formler. Bokningsprogramvara genererar dessa rapporter automatiskt.",
  "blog.post3Title":
    "Varför varumärkesanpassade bokningssidor är viktiga för ditt företag",
  "blog.post3Excerpt":
    "Ett generiskt bokningsformulär berättar inget om ditt varumärke. En varumärkesanpassad bokningssida bygger förtroende och ökar konverteringar.",
  "blog.post3C1":
    "När en gäst besöker din bokningssida är det ofta deras första interaktion med ditt företag online. Om sidan är ett generiskt formulär utan varumärkesanpassning skickar det fel budskap.",
  "blog.post3C2":
    "En varumärkesanpassad bokningssida, med din logotyp, färger, huvudbild och företagsbeskrivning, skapar ett professionellt första intryck. Studier visar att varumärkesanpassade bokningsupplevelser har 20 till 40% högre konverteringsgrad.",
  "blog.post3C3":
    "MimmoBook låter varje företag anpassa sin bokningssida med sitt eget varumärke. Ladda upp din logotyp, ställ in dina färger, lägg till en huvudbild och skriv en beskrivning. Resultatet är en bokningsupplevelse som känns som en förlängning av din webbplats.",
  "blog.post4Title": "Hantera bokningar på flera platser",
  "blog.post4Excerpt":
    "Besöksnäringsföretag med flera platser behöver centraliserade verktyg. Så hanterar du bokningar på flera platser utan att tappa kontrollen.",
  "blog.post4C1":
    "Att driva flera besöksnäringsplatser, till exempel en restauranggrupp, gästhuskedja eller lokaler i olika städer, mångdubblar bokningshanteringens komplexitet.",
  "blog.post4C2":
    "Utmaningen är att upprätthålla konsekvens samtidigt som man respekterar varje plats unika behov. Ett centraliserat system låter dig hantera alla platser från en instrumentpanel med separata bokningssidor, personalbehörigheter och rapporter per plats.",
  "blog.post4C3":
    "MimmoBooks funktion för flera platser är designad för detta. Varje plats får sin egen varumärkesanpassade bokningssida, personaluppdrag och rapportering.",
  "blog.post4C4":
    "Den viktigaste fördelen är synlighet. Istället för att logga in på separata system eller kontrollera flera kalkylblad ser du alla dina platser på ett ställe.",
  "blog.post5Title":
    "Bokningar inom friskvårdsbranschen: hur enkelhet driver tillväxt",
  "blog.post5Excerpt":
    "Spa, salonger, yogastudios och friskvårdskliniker växer med smidiga bokningar. Så driver ett enkelt bokningssystem återbesök och intäkter.",
  "blog.post5C1":
    "Friskvårdsbranschen bygger på förtroende och atmosfär. Från massörer och spa till yogastudios, skönhetssalonger, fysioterapikliniker och meditationsretreat formar varje gästmöte om kunden kommer tillbaka. Den upplevelsen börjar inte i receptionen utan i stunden då någon försöker boka.",
  "blog.post5C2":
    "Enkelhet är den enskilt viktigaste faktorn för att förvandla en nyfiken besökare till en betalande kund. Friskvårdskunder bokar ofta i mobilen sent på kvällen efter en stressig dag. Om din bokningssida är långsam, rörig eller gömd bakom ett telefonnummer och öppettider går de vidare till en konkurrent vars sida fungerar på under en minut. Ett rent, varumärkesanpassat bokningsflöde med tydliga beskrivningar, priser och tillgänglighet i realtid tar bort friktionen och höjer konverteringen markant.",
  "blog.post5C3":
    "Återbesök är där friskvårdsföretag faktiskt växer. En förstagångskund som bokar 60 minuters massage blir lönsam först när hen kommer tillbaka. Automatiska bekräftelser och påminnelser minskar uteblivanden, medan en sparad profil, enkel ombokning och ett igenkännbart varumärke håller kunderna lojala. Studier visar att friskvårdsföretag med självbetjäningsbokning ökar kundlojaliteten med 20 till 35 procent jämfört med enbart telefonbokning.",
  "blog.post5C4":
    "Operativt frigör ett modernt bokningssystem friskvårdsägaren från receptionen. Istället för att svara i telefon mellan behandlingar kan personalen fokusera på kunden i rummet. Schemaläggning för flera resurser hanterar terapeuter, rum och utrustning i en vy så att dubbelbokningar försvinner. Rapporter visar vilka tjänster, tider och medarbetare som genererar mest intäkter så att du kan prissätta, marknadsföra och bemanna med säkerhet.",
  "blog.post5C5":
    "MimmoBook ger friskvårdsföretag en varumärkesanpassad bokningssida, automatisk kundkommunikation, schemaläggning för flera resurser och tydlig rapportering på ett ställe. Det är byggt för små och växande friskvårdsvarumärken som vill se professionella ut online, minska administrationen och skapa den lugna, smidiga upplevelse kunderna förväntar sig, från första klicket till nästa besök.",
  "blog.post6Title":
    "Bästa bokningsapparna för restauranger 2026: gratis och betalda system jämförda",
  "blog.post6Excerpt":
    "Letar du efter den bästa bokningsappen för restaurang? Vi jämför gratis och betalda onlinebokningssystem för restauranger, kaféer och lokaler, och visar var MimmoBook passar in.",
  "blog.post6C1":
    "Att välja bokningsapp för din restaurang är ett av de viktigaste besluten du fattar. Rätt onlinebokningssystem fyller tomma bord, minskar uteblivanden och frigör personalen från telefonen. Fel system låser in dig i avgifter per gäst, gömmer dina gäster bakom en marknadsplats eller tvingar dig att köra ett kalkylark vid sidan om. Den här guiden jämför de viktigaste kategorierna av bokningsappar för restauranger 2026, från gratis onlinebokningssystem till betalda plattformar, och visar var MimmoBook passar in för fristående restauranger, kaféer, vinbarer och små grupper.",
  "blog.post6C2":
    "Gratis onlinebokningssystem är en vanlig startpunkt. Verktyg som Google Reserve-integrationer, enkla formulärbyggare och gratisnivåer hos större plattformar låter dig ta emot en bokning utan månadsavgift. Kompromissen är verklig: de flesta gratisystem begränsar antalet månatliga bokningar, döljer rapportering bakom en betald plan, visar konkurrentannonser på din bokningssida eller kräver en avgift per gäst när du växer. För en mycket liten restaurang med några få bord och låg volym kan en gratisnivå fungera i några månader. Därefter överstiger de dolda kostnaderna oftast en måttlig betald prenumeration.",
  "blog.post6C3":
    "Marknadsplatsbaserade bokningsappar som globala katalogplattformar drar in fler gäster men tar kontrollen över gästrelationen. Din restaurang visas bredvid konkurrenter, gäster ser marknadsplatsens varumärke istället för ditt, och du betalar vanligtvis per bokad gäst utöver en månadsavgift. För restauranger i innerstan med hög omsättning som behöver extra volym är marknadsplatser fortfarande vettiga. För kvartersrestauranger, vinbarer, bruncher och destinationsrestauranger som redan har en lojal publik äter avgiften per gäst upp marginalen och urvattnar varumärket.",
  "blog.post6C4":
    "Den tredje kategorin är bokningsprogramvara byggd för restaurangen, inte för marknadsplatsen. Dessa verktyg ger dig en varumärkesanpassad bokningssida på din egen domän, tillgänglighet i realtid, automatiska bekräftelser och påminnelser på gästens språk, depositioner och förhandsbetalningar vid behov och rapportering över gäster, intäkter, uteblivanden och återkommande besökare. Eftersom gästen bokar direkt hos dig finns ingen avgift per gäst och kundrelationen stannar hos dig. Det är här MimmoBook passar in.",
  "blog.post6C5":
    "MimmoBook är en molnbaserad bokningsplattform för restauranger, kaféer, vinbarer, evenemangslokaler, hotell och friskvårdsverksamheter. Restauranger får en varumärkesanpassad bokningssida på finska, svenska och engelska, tillgänglighet i realtid över matsalar och terrasser, automatiska bekräftelser och påminnelser, rabatt- och förskottsbetalningar, hantering av flera platser för restaurangkedjor och tydlig rapportering över gäster, uteblivanden och intäkter. Prissättningen är en fast månadsavgift, inte per gäst, så tillväxt straffas inte. En gratis provperiod låter dig utvärdera hela produkten innan du binder dig.",
  "blog.post6C6":
    "Praktiskt val: om du tar under 20 gäster per vecka, börja på en gratisnivå och utvärdera efter tre månader. Om din restaurang lever på turister som passerar kan en marknadsplats vara en användbar extrakanal utöver din egen bokningssida. Om du har återkommande publik, ett starkt varumärke eller mer än en plats betalar sig dedikerad programvara som MimmoBook oftast tillbaka redan första månaden genom återvunna uteblivanden, snabbare arbetsflöde och högre direktbokningskonvertering. Den bästa bokningsappen för restaurang är den som håller kvar både gästrelationen och marginalen hos dig.",
  "blog.post7Title":
    "MimmoBook vs Resy vs Tock: bokningssystem för restaurang jämförda",
  "blog.post7Excerpt":
    "En praktisk jämförelse av MimmoBook, Resy och Tock för restaurangbokningar. Se hur fast pris, flerplatshantering och en varumärkt bokningssida står sig mot avgifter per gäst.",
  "blog.post7C1":
    "Om du driver en självständig restaurang, vinbar, brunchställe eller liten restauranggrupp kokar valet av bokningsplattform 2026 ner till tre alternativ: MimmoBook, Resy och Tock. Alla tar bokningar och skickar bekräftelser, men prismodell, varumärkeskontroll och stöd för flera platser skiljer sig kraftigt. Den här guiden jämför dem sida vid sida så att du kan välja det bokningssystem som håller kvar både marginalen och gästrelationen hos dig.",
  "blog.post7C2":
    "Priset är där plattformarna skiljer sig snabbast. Resy och Tock kombinerar en månadsavgift med avgift per gäst eller per transaktion, så en full service kostar tyst mer än en lugn. MimmoBook tar ett fast månadspris utan avgift per gäst, så en fullbokad lördag kostar lika mycket som en lugn tisdag. För en restaurang med 800 to 1 500 gäster per månad blir skillnaden på ett år ofta större än hela årsavgiften för MimmoBook.",
  "blog.post7C3":
    "Varumärkeskontroll är den andra axeln. Resy och Tock är först och främst marknadsplatser: gäster kan hitta din restaurang i appen, men bekräftelsemejlet, profilen och lojalitetsrelationen bor kvar hos marknadsplatsen. MimmoBook är motsatsen: din bokningssida ligger på din egen domän, i dina färger och på ditt språk, och varje utskick går ut från din identitet. Om direktbokningar och återkommande gäster väger tyngre än marknadsplatsens synlighet är MimmoBook modellen som håller kvar gästen hos dig.",
  "blog.post7C4":
    "Flerplatshantering märks direkt när du öppnar ett andra ställe. Resy och Tock stödjer flera platser, men pris per plats och avgifter per gäst växer linjärt med tillväxten. MimmoBook är byggt kring en tenant med flera platser: en inloggning, en instrumentpanel, platsspecifika undantag för öppettider, varumärke och e-postavsändare, och ett enda fast paket för hela gruppen. För en verksamhet med 2 to 6 platser sjunker den operativa belastningen tydligt och fakturan förblir förutsägbar.",
  "blog.post7C5":
    "Användarvänlighet för små team är den tredje praktiska faktorn. Resy och Tock är kraftfulla men förutsätter en golvchef som lever inne i verktyget. MimmoBook är byggt för ägare och små staber: bokningar under 30 sekunder, mobilanpassad instrumentpanel, automatiska bekräftelser och påminnelser på finska, svenska och engelska, kökskvitton för dinein-resurser och en snabbguide för personal att skriva ut som PDF. Att lära upp en ny servitör mäts i minuter, inte skift.",
  "blog.post7C6":
    "Så väljer du: om din restaurang lever på turister i en storstad och du klarar avgifterna per gäst kan Resy eller Tock som extra kanal fortfarande vara vettigt. Om du har en lojal grannskapspublik, ett starkt varumärke eller mer än en plats är MimmoBook bokningsplattformen som passar, med fast pris, en varumärkt bokningssida och flerplatshantering inbyggt. Testa MimmoBook på gratisnivån och jämför en hel månad mot din nuvarande faktura per gäst, siffrorna brukar besluta åt dig.",
  "blog.post8Title":
    "MimmoBook vs Mindbody, Vagaro, Fresha, Acuity: bokningssystem för wellness jämförda",
  "blog.post8Excerpt":
    "Så står sig MimmoBook mot Mindbody, Vagaro, Fresha och Acuity för spa, salong, yogastudio och wellnessklinik: pris, varumärkeskontroll, flera platser och användarvänlighet.",
  "blog.post8C1":
    "Om du driver ett spa, en salong, en yogastudio, en massagemottagning eller en liten wellnessgrupp ser kortlistan över bokningsplattformar 2026 oftast likadan ut: Mindbody, Vagaro, Fresha, Acuity Scheduling och MimmoBook. Alla fem kan ta emot en onlinebokning, men affärsmodellen bakom var och en är väldigt olika, och det är just modellen som tyst avgör hur mycket du betalar, vem som äger kundrelationen och hur smärtsam tillväxten blir. Den här guiden jämför dem från MimmoBooks perspektiv så att du kan välja det wellness-bokningssystem som håller kvar både marginal och kunder hos dig.",
  "blog.post8C2":
    "Pris är det snabbaste sättet att skilja dem åt. Mindbody ligger i företagsänden med nivåbaserade månadsplaner som stiger snabbt när du lägger till varumärkta appar, marknadsföringsautomation eller extra personal. Vagaro ser billigt ut på ingångsnivå men tar betalt per personalplats, plus tillägg för formulär, medlemskap och SMS-påminnelser. Fresha är gratis att ta emot bokningar och tar istället provision på nya kunders köp och kortavgifter, så plattformen är bara gratis när marknadsplatsens kunder inte konverterar. Acuity är ett fast schemaläggningsabonnemang, billigt på pappret men begränsat så fort du behöver flera platser, medlemskap eller hospitality-hantering. MimmoBook tar en fast månadsavgift per tenant, ingen kostnad per personalplats, ingen provision på bokningar, ingen skimning per transaktion. För en studio med 3 to 8 anställda eller ett spa som tar 500 plus tider i månaden är årsdifferensen oftast större än hela MimmoBook-abonnemanget.",
  "blog.post8C3":
    "Varumärkeskontroll är den andra axeln, och det är där marknadsplatserna tyst ändrar spelet. Mindbody och Fresha pushar båda kunder in i sina egna konsumentappar: din studio visas bredvid konkurrenter, bekräftelsemejlet är varumärkt av marknadsplatsen och kundrelationen ligger formellt hos plattformen. Vagaro är lättare som marknadsplats men leder ändå upptäckten via vagaro.com. Acuity är white label men generisk, med begränsad visuell anpassning. MimmoBook är motsatsen: en varumärkt bokningssida på din egen domän i dina egna färger, gästmejl skickas från din identitet, inget tredjepartsupptäcktslager mellan dig och kunden. Om återkommande besök, medlemskap eller presentkort är kärnan i intäkten vill du ha kundrelationen på din sida, inte marknadsplatsens.",
  "blog.post8C4":
    "Flerplats- och flertjänsthantering är där wellnessföretag snubblar. Mindbody stöder flera platser men du hamnar ofta på en högre nivå för det och varje plats lägger till kostnad. Vagaro och Fresha behandlar varje plats som en separat verksamhet med egna inställningar och, i Freshas fall, egen marknadsplatslistning. Acuitys flerplatsberättelse är begränsad och manuell. MimmoBook är byggt kring en tenant med flera platser från dag ett: en inloggning, en instrumentpanel, platsspecifika undantag för öppettider, varumärke, personal, e-postavsändare och pris, samt ett enda fast paket för hela gruppen. För en wellnessverksamhet med 2 to 6 platser sjunker den operativa belastningen tydligt och fakturan förblir förutsägbar när du öppnar plats 3, 4 och 5.",
  "blog.post8C5":
    "Användarvänlighet för små team är den tredje praktiska faktorn. Mindbody är kraftfullt men förutsätter en dedikerad receptionschef som lever inne i verktyget. Vagaro är vänligare men gränssnittet växer snabbt när du slår på medlemskap, formulär och lönehantering. Fresha är smidigt på konsumentsidan men proffsinstrumentpanelen lutar sig mot marknadsplatsbeteenden. Acuity är rent men stannar innan hospitality-arbetsflödena som ett spa eller en wellnessklinik faktiskt behöver, som rum- eller platslayouter, depositioner per resurs eller flertjänstblockningar. MimmoBook är byggt för ägare och små staber: bokning under 30 sekunder, mobilanpassad instrumentpanel, automatiska bekräftelser och påminnelser på finska, svenska och engelska, resursnivåtillgänglighet för rum och behandlingsbritsar samt en snabbguide för personal att skriva ut som PDF. Att lära upp en ny terapeut eller receptionist mäts i minuter, inte skift.",
  "blog.post8C6":
    "Så väljer du i praktiken: om du är en salong på en enda plats med tungt beroende av upptäckt av nya kunder kan Freshas marknadsplats vara en användbar förvärvskanal. Om du är en amerikansk företagskedja med ett dedikerat driftteam håller Mindbodys djup fortfarande. Om du bara behöver en enkel schemaläggare och aldrig planerar att lägga till flera platser eller hospitality-funktioner är Acuity okej. För de flesta europeiska spa, salonger, yogastudior, wellnessklinker och små flerplatsföretag inom wellness är MimmoBook plattformen som passar: fast pris, en varumärkt bokningssida på din egen domän, riktig flerplatshantering, GDPR-vänlig EU-drift och stöd på finska, svenska och engelska. Testa MimmoBook på gratisnivån och jämför en hel månad mot din nuvarande faktura, siffrorna brukar besluta åt dig.",
  "blog.post9Title":
    "Bokningssystem för serviceyrken: barberare, frisörer, massörer, bagare och personliga tränare",
  "blog.post9Excerpt":
    "En praktisk guide för enmansföretag och små team: hur onlinebokning fyller kalendern, minskar uteblivna besök och ger tillbaka timmarna du nu lägger i telefon.",
  "blog.post9C1":
    "En yrkesperson inom service säljer tid, inte produkter. En barberare har ungefär 40 stoltimmar i veckan, en massör kanske 25 behandlingstimmar, en personlig tränare ett fåtal attraktiva kvällstider och en bagare ett begränsat antal upphämtningstider innan ugnarna är fulla. Varje timme som står obokad, eller som ett uteblivet besök tömmer, är intäkt du inte får tillbaka. Därför betyder bokningsprocessen mer i ett serviceföretag än nästan någon annanstans.",
  "blog.post9C2":
    "De flesta små serviceföretag tar fortfarande bokningar på samma sätt: ett samtal mellan kunder, ett meddelande på kvällen och en papperskalender på disken. Det fungerar tills det inte gör det. Samtal missas när händerna är upptagna, en lördag dubbelbokas, kunden som ville ha 17:00 glöms bort och kvällarna går till meddelanden i stället för vila. Kunderna märker det också. Många bokar hellre klockan 22 i mobilen än ringer under dagen, och kan de inte det bokar de hos någon annan.",
  "blog.post9C3":
    "En bokningssida på nätet löser detta utan att ändra hur du arbetar. Dina tjänster visas med verklig längd och pris, så klippning och skäggtrim bokar 45 minuter och en massage på 90 minuter bokar 90, och kalendern erbjuder aldrig en tid du inte kan hålla. Bekräftelser går ut direkt, påminnelser före besöket och en avbokning frigör tiden automatiskt för någon annan. Öppettider, pauser och lediga dagar bestämmer du själv, även den enstaka lördag du väljer att jobba.",
  "blog.post9C4":
    "Siffrorna är enkla. Uteblivna besök ligger i personliga tjänster typiskt mellan 10 och 20 procent av bokningarna, och automatiska påminnelser skär bort ungefär en tredjedel av det. Om du tar 60 bokningar i veckan för 50 euro är redan fem procent återvunna tider ungefär 150 euro i veckan, betydligt mer än vad ett bokningssystem kostar. Lägg till administrationen: många ägare lägger mellan 3 och 5 timmar i veckan på bokningsmeddelanden, och självbetjäning tar bort större delen av det.",
  "blog.post9C5":
    "Olika yrken behöver lite olika saker. Barberare och frisörer behöver tjänster som läggs samman, så att färg och klippning bokas som ett längre besök, plus tillgänglighet per stol eller per frisör. Massörer och behandlare behöver buffertid mellan kunder, schema på rum och bänknivå och en lugn varumärkt sida som matchar upplevelsen de säljer. Bagare behöver upphämtningstider och orderuppgifter i stället för platser, med ett begränsat antal ordrar per tid. Personliga tränare behöver återkommande pass, smågruppstider och kvällstoppar. MimmoBook hanterar allt detta från samma panel, och ett företag med flera platser kan driva dem under ett konto.",
  "blog.post9C6":
    "Är du yrkesperson inom service, ensam eller med ett litet team, börja enkelt: lägg ut dina verkliga tjänster och längder, slå på bekräftelser och påminnelser och publicera sidan på din egen domän så att kunderna bokar hos dig och inte på en marknadsplats som äger din kundlista. MimmoBook har fast månadspris utan provision per bokning, fungerar på finska, svenska och engelska och driftas i EU med GDPR i fokus. Gratisnivån låter dig testa en hel månad med riktiga kunder innan du bestämmer dig.",
  "blog.spHeroCaption":
    "Barberare, frisörer, massörer, bagare och personliga tränare säljer alla tid i fasta pass, och det är precis vad onlinebokning skyddar.",
  "blog.spSlotsTitle": "Din vecka är ett rutnät av tider",
  "blog.spSlotsCaption":
    "Sex arbetspass per dag för en person. Varje ledigt pass och varje uteblivet besök är intäkt som inte kan hämtas tillbaka senare.",
  "blog.spSlotsBooked": "Bokat och betalt",
  "blog.spSlotsOpen": "Ledigt, ingen kunde boka utanför dina telefontider",
  "blog.spSlotsLost":
    "Förlorat till ett uteblivet besök eller en sen avbokning",
  "blog.spFlowTitle": "Så går en bokning, från kund till återbesök",
  "blog.spFlowCaption":
    "Fyra steg som sköter sig själva när tjänster och tider är satta.",
  "blog.spFlow1Title": "1. Kunden väljer tjänst",
  "blog.spFlow1Desc":
    "Hen ser dina tjänster med verklig längd och pris, och bara de tider du faktiskt kan hålla.",
  "blog.spFlow2Title": "2. Bekräftelsen är automatisk",
  "blog.spFlow2Desc":
    "Bokningen landar i din kalender och kunden får en bekräftelse på sitt eget språk.",
  "blog.spFlow3Title": "3. Påminnelse före besöket",
  "blog.spFlow3Desc":
    "En tidsatt påminnelse minskar uteblivna besök, och en avbokning öppnar tiden för någon annan.",
  "blog.spFlow4Title": "4. Enkel ombokning",
  "blog.spFlow4Desc":
    "Kunduppgifterna sparas, så nästa tid tar sekunder och rapporterna visar vilka som återkommer.",
  "blog.spStat1Label": "Bokningar kommer in medan du jobbar eller sover",
  "blog.spStat2Label":
    "Typisk minskning av uteblivna besök med automatiska påminnelser",
  "blog.spStat3Label":
    "Tid att lägga in en bokning för hand när en kund ringer",
  "blog.spWhoTitle": "Byggt för dessa yrken",
  "blog.spWho1":
    "Barberare och frisörer: tjänster som läggs samman till ett besök, tillgänglighet per stol eller per frisör och färgbehandlingar med rätt längre tid.",
  "blog.spWho2":
    "Massörer, behandlare och andra yrkespersoner inom wellness: buffertid mellan kunder, schema på rum och bänknivå och en lugn varumärkt sida.",
  "blog.spWho3":
    "Bagare och matproducenter: upphämtningstider i stället för platser, ett begränsat antal ordrar per tid och ordernoteringar för fyllningar, allergier och storlek.",
  "blog.spWho4":
    "Personliga tränare och coacher: återkommande pass, smågruppstider, kvällstoppar och tydliga rapporter över vilka tider som säljer.",
  "blog.spBenefitsTitle": "Vad du får i praktiken",
  "blog.spBenefit1":
    "En egen varumärkt bokningssida på din egen domän, så att kunderna bokar hos dig och kundlistan förblir din.",
  "blog.spBenefit2":
    "Tjänster med verklig längd och pris, så att kalendern aldrig erbjuder en tid du inte kan hålla.",
  "blog.spBenefit3":
    "Automatiska bekräftelser och påminnelser på finska, svenska och engelska, som minskar uteblivna besök utan ett enda samtal.",
  "blog.spBenefit4":
    "Öppettider, pauser, lediga dagar och enstaka arbetsdagar som du styr själv, per person och per rum.",
  "blog.spBenefit5":
    "Fast månadspris utan provision per bokning, så en full månad kostar lika mycket som en lugn.",
  "blog.spBenefit6":
    "Rapporter över bokningar, återkommande kunder och de tider som säljer bäst, plus flera platser under ett konto när du växer.",

  // Nav new pages
  "nav.features": "Funktioner",
  "nav.useCases": "Användningsfall",
  "nav.blog": "Blogg",
  "nav.whatIs": "Vad är MimmoBook?",
  "nav.offers": "Erbjudanden",
  "nav.kitchen": "Kök",
  "nav.bookingLog": "Bokningslogg",
  "bookingLog.title": "Bokningsvalideringslogg",
  "bookingLog.tooltip":
    "Varje bokningsförsök loggas här med kapacitetskontext, så du ser exakt varför en begäran accepterades, varnades för eller avvisades.",
  "bookingLog.recentTitle": "Senaste försöken (200)",
  "bookingLog.searchPlaceholder": "Sök efter namn, e-post eller typ",
  "bookingLog.allOutcomes": "Alla utfall",
  "bookingLog.empty": "Inga bokningsförsök loggade ännu.",
  "bookingLog.when": "När",
  "bookingLog.guest": "Gäst",
  "bookingLog.type": "Typ / källa",
  "bookingLog.date": "För datum",
  "bookingLog.capacity": "Kapacitet",
  "bookingLog.outcome": "Utfall",
  "bookingLog.reasonsTitle": "Valideringsskäl:",
  "bookingLog.noReasons": "Inga detaljer registrerade.",
  "bookingLog.softWarningToast":
    "Bokning sparad, men datumet är nära eller över kapaciteten.",

  "kitchen.title": "Köksbeställningar",
  "kitchen.tooltip":
    "Följ mat-, dryck- och andra beställningar för restaurang- och festlokalbokningar",
  "kitchen.date": "Datum",
  "kitchen.prevDay": "Föregående dag",
  "kitchen.nextDay": "Nästa dag",
  "kitchen.pickDate": "Välj ett datum",
  "kitchen.ordersFor": "Köksbeställningar: {name}",
  "kitchen.deleteItemNamed": "Ta bort {name}",
  "kitchen.deleteOrder": "Ta bort order",
  "kitchen.restoreHidden": "Visa borttagna kort ({count})",
  "kitchen.deleteOrderNamed": "Ta bort hela köksordern för {name}",
  "kitchen.deleteOrderConfirm": "Ta bort hela köksordern?",
  "kitchen.deleteOrderHint":
    "Mat- och dryckesraderna tas bort och kortet försvinner från Kök-fliken. Bokningen finns kvar.",
  "kitchen.orderDeleted": "Köksordern borttagen",
  "kitchen.menu.priceLabel": "Enhetspris i euro",
  "kitchen.today": "Idag",
  "kitchen.noReservations":
    "Inga restaurang- eller festlokalbokningar detta datum.",
  "kitchen.noOrders": "Inga beställningar än. Lägg till första objektet nedan.",
  "kitchen.addItem": "Lägg till",
  "kitchen.itemName": "Objekt",
  "kitchen.itemNamePlaceholder": "t.ex. Caesarsallad",
  "kitchen.quantity": "Antal",
  "kitchen.category": "Kategori",
  "kitchen.status": "Status",
  "kitchen.notes": "Anteckningar",
  "kitchen.notesPlaceholder": "Valfria anteckningar (allergier, ändringar...)",
  "kitchen.unitPrice": "Enhetspris (€)",
  "kitchen.total": "Totalt",
  "kitchen.guests": "gäster",
  "kitchen.cat.food": "Mat",
  "kitchen.cat.drink": "Dryck",
  "kitchen.cat.other": "Övrigt",
  "kitchen.status.received": "Mottagen",
  "kitchen.status.preparing": "Tillagas",
  "kitchen.status.ready": "Klar",
  "kitchen.status.served": "Serverad",
  "kitchen.save": "Spara",
  "kitchen.delete": "Ta bort",
  "kitchen.deleteConfirm": "Ta bort detta objekt?",
  "kitchen.itemAdded": "Objekt tillagt",
  "kitchen.itemUpdated": "Objekt uppdaterat",
  "kitchen.itemDeleted": "Objekt borttaget",
  "kitchen.error": "Kunde inte spara objektet",
  "kitchen.filter.all": "Alla",
  "kitchen.print": "Skriv ut",
  "kitchen.menu.title": "Menymallar",
  "kitchen.menu.manage": "Hantera meny",
  "kitchen.menu.empty":
    "Inga menyobjekt än. Lägg till vanliga objekt för att snabbt infoga dem i beställningar.",
  "kitchen.menu.addToOrder": "Lägg till i beställning",
  "kitchen.menu.pickFromMenu": "Från meny",
  "kitchen.menu.newItem": "Lägg till menyobjekt",
  "kitchen.menu.namePlaceholder": "Objektnamn (t.ex. Margherita-pizza)",
  "kitchen.menu.saved": "Menyobjekt sparat",
  "kitchen.menu.deleted": "Menyobjekt borttaget",
  "kitchen.menu.saveError": "Kunde inte spara menyobjektet",
  "kitchen.menu.close": "Stäng",
  "kitchen.menu.searchPlaceholder": "Sök i menyn...",
  "kitchen.bulk.markAll": "Markera alla",
  "kitchen.bulk.advanceAll": "Gå framåt alla",
  "kitchen.bulk.allPreparing": "Alla till Tillagas",
  "kitchen.bulk.allReady": "Alla till Klar",
  "kitchen.bulk.allServed": "Alla till Serverad",
  "kitchen.bulk.updated": "{count} objekt uppdaterade",
  "kitchen.bulk.nothingToUpdate": "Inget att uppdatera",

  // Offers
  "offers.title": "Erbjudanden",
  "offers.tooltip":
    "Skapa och hantera erbjudanden för evenemang och gruppbokningar",
  "offers.create": "Nytt erbjudande",
  "offers.edit": "Redigera erbjudande",
  "offers.empty": "Inga erbjudanden ännu",
  "offers.noResults": "Inga erbjudanden matchar din sökning",
  "offers.searchPlaceholder": "Sök erbjudanden...",
  "offers.showArchived": "Visa arkiverade",
  "offers.printPdf": "Skriv ut erbjudandet som PDF",
  "offers.searchLabel": "Sök erbjudanden",
  "offers.archive": "Arkivera",
  "offers.unarchive": "Avarkivera",
  "offers.archived": "Arkiverad",
  "offers.archivedSuccess": "Erbjudande arkiverat",
  "offers.unarchivedSuccess": "Erbjudande avarkiverat",
  "offers.archiveError": "Fel vid arkivering",
  "offers.send": "Skicka",
  "offers.confirm": "Bekräfta",
  "offers.saved": "Erbjudande sparat",
  "offers.saveError": "Fel vid sparande",
  "offers.fillRequired": "Fyll i alla obligatoriska fält",
  "offers.confirmedSuccess": "Erbjudande bekräftat",
  "offers.confirmedWithoutPrice":
    "Vissa bokningar sparades utan pris. Lägg till priset innan du fakturerar dem.",
  "offers.statusRegionLabel": "Senaste resultat för erbjudandet",
  "offers.kitchenOrdersFailedAnnounce":
    "Bokningarna sparades, men mat- och dryckesraderna kunde inte skickas till Kök-fliken. Öppna Kök-fliken och lägg till dem manuellt.",
  "offers.confirmErrorAnnounce":
    "Erbjudandet kunde inte bekräftas och inga bokningar skapades. Kontrollera uppgifterna och försök igen.",
  "offers.confirmedWithoutPriceAnnounce":
    "Vissa bokningar sparades utan pris. Öppna varje bokning och lägg till priset innan fakturering.",
  "offers.kitchenOrdersFailed":
    "Bokningarna sparades, men menyn kunde inte skickas till köket. Lägg till den i Kök-fliken.",
  "offers.confirmedKitchenSentOne":
    "1 mat- och dryckesrad från erbjudandet skickades till Kök-fliken.",
  "offers.confirmedKitchenSent":
    "{count} mat- och dryckesrader från erbjudandet skickades till Kök-fliken.",
  "offers.confirmedNoKitchen":
    "Erbjudandet hade ingen mat eller dryck, så en vanlig bokning skapades och inget skickades till Kök-fliken.",
  "offers.priceReviewTitle": "Kontrollera priserna",
  "offers.priceReviewDesc":
    "Dessa bokningar skapas från erbjudandet. Priserna kommer från resursinställningarna.",
  "offers.priceReviewWarnTitle": "Ett pris saknas",
  "offers.priceReviewWarnDesc":
    "För vissa bokningar har resursen flera priser och inget matchar det valda utrymmet, så priset kan inte väljas automatiskt. Välj ett pris, skriv in ett belopp eller lämna det tomt för nu.",
  "offers.priceReviewNeedsPrice": "Pris behövs",
  "offers.priceReviewFromResource": "Från resursinställningarna",
  "offers.priceReviewReasonAmbiguous":
    "Denna resurs har flera priser och inget matchar det valda utrymmet.",
  "offers.priceReviewReasonNoResource":
    "Ingen matchande resurs hittades för denna bokning.",
  "offers.priceReviewReasonUnpriced":
    "Inget pris har sparats för denna resurs.",
  "offers.priceReviewAmount": "Pris (EUR)",
  "offers.priceReviewSkip":
    "Lämna tomt för nu, personalen lägger till priset senare",
  "offers.priceReviewConfirm": "Bekräfta erbjudande",
  "offers.confirmError": "Fel vid bekräftelse",
  "offers.sendEmail": "Skicka e-post",
  "offers.emailSent": "E-post skickad",
  "offers.emailError": "Fel vid e-postsändning",
  "offers.pdfAttached": "PDF-nedladdningslänk ingår",
  "offers.lastSent": "Senast skickad",
  "offers.statusDraft": "Utkast",
  "offers.statusSent": "Skickad",
  "offers.statusConfirmed": "Bekräftad",
  "offers.statusExpired": "Utgången",
  "offers.validity": "Giltighet",
  "offers.validityPlaceholder": "t.ex. Giltig till 31.12.2026",
  "offers.startTime": "Starttid",
  "offers.endTime": "Sluttid",
  "offers.eventSpace": "Evenemangslokal",
  "offers.selectSpace": "Välj lokal",
  "offers.eventType": "Evenemangstyp",
  "offers.invoicing": "Faktureringsuppgifter",
  "offers.linkedReservations": "Länkade bokningar",
  "offers.specialRequests": "Specialönskemål",
  "offers.menuPlaceholder": "Ange menydetaljer...",
  "offers.menuKitchenLabel": "Mat och dryck (blir köksordern)",
  "offers.menuKitchenHint":
    "Varje rad blir en rad i köksordern på restaurang- eller lokalbokningen när erbjudandet accepteras. Lämna tomt för en vanlig bokning där inget skickas till Kök-fliken.",
  "offers.menuKitchenHintLeg":
    "Mat och dryck som skrivs här går också till köksordern för restaurang- eller lokalbokningen, eftersom rum och andra bokningar aldrig visas i Kök-fliken.",
  "offers.menuFormatHint":
    "En post per rad, till exempel: 2 x Lax (utan dill), 10 Kaffe, Tårta x 3.",
  "offers.menuNoKitchenHint":
    "Skickas inte till köket. Använd fältet för mat och dryck till det.",
  "offers.menuKitchenLabelMain":
    "Mat och dryck för huvudbokningen (blir köksordern)",
  "offers.menuKitchenLabelFor": "Mat och dryck: {name} (blir köksordern)",
  "offers.menuKitchenHintLegOwn":
    "Dessa rader blir köksordern för bokningen {name} i Kök-fliken.",
  "offers.menuKitchenHintLegMoved":
    "{name} visas aldrig i Kök-fliken, så dessa rader läggs till köksordern för restaurang- eller lokalbokningen i det här erbjudandet.",
  "offers.menuKitchenSummary":
    "Varje del av erbjudandet har ett eget fält för mat och dryck. Varje fält skapar sina egna rader i köksordern när erbjudandet accepteras, och fält på delar som aldrig visas i Kök-fliken, till exempel rum, läggs i stället till restaurang- eller lokalbokningen.",
  "offers.kitchenPreviewTitle": "Förhandsvisning av köksordern",
  "offers.kitchenMapTitle": "Vart varje fält för mat och dryck går",
  "offers.kitchenMapRule":
    "En restaurang- eller lokalbokning får sin egen köksorder. Andra delar, som rum, visas inte på Kök-fliken, så deras rader läggs till restaurangbokningen, eller lokalbokningen om restaurangbokning saknas.",
  "offers.kitchenMapOwn": "får sin egen köksorder.",
  "offers.kitchenMapTo": "går till köksordern för {name}.",
  "offers.kitchenMapNone":
    "har ingen mottagare, eftersom erbjudandet saknar restaurang- och lokalbokning.",
  "offers.kitchenPreviewTotal": "Rader i köksordern: {count}",
  "offers.kitchenPreviewEmpty":
    "Ingen mat eller dryck är ifylld, så att acceptera erbjudandet skapar bara bokningarna och inget går till Kök-fliken.",
  "offers.kitchenPreviewNone": "Ingen mat eller dryck i det här fältet.",
  "offers.kitchenPreviewStays":
    "Dessa rader går till den här bokningens egen köksorder.",
  "offers.kitchenPreviewMoved": "Dessa rader går till köksordern för {name}.",
  "offers.kitchenPreviewLost":
    "Erbjudandet har ingen restaurang- eller lokalbokning, så dessa rader når inte Kök-fliken. Lägg till en bokning eller flytta maten och drycken dit.",
  "offers.language": "Språk",
  "offers.emailTo": "Till",
  "offers.emailSubject": "Ämne",
  "offers.emailBody": "Meddelandetext",
  "offers.crossBookingTitle": "Korsbokning",
  "offers.crossBookingAdd": "Lägg till bokning",
  "offers.crossBookingAdded": "Bokning länkad",
  "offers.crossBookingAddError": "Fel vid länkning av bokning",
  "offers.crossBookingRemoved": "Bokning avlänkad",
  "offers.crossBookingRemoveError": "Fel vid avlänkning av bokning",
  "offers.linkedGroupCurrent": "Aktuell",
  "offers.linkedGroupTotal": "Totalt",
  "offers.linkedBadge": "Korsbokning",
  "offers.linkedRowService": "Tjänst",
  "offers.linkedRowDate": "Datum",
  "offers.linkedRowGuests": "Gäster",
  "offers.linkedRowPrice": "Pris",
  "offers.linkedRowOpen": "Öppna länkad bokning",

  // Tier-gränsfel
  "tierError.STAFF_USER_LIMIT_REACHED":
    "Din plan tillåter upp till {limit} användare. Uppgradera för att lägga till fler teammedlemmar.",
  "tierError.SITE_LIMIT_REACHED":
    "Din plan tillåter upp till {limit} plats. Uppgradera till Business för att hantera flera platser.",
  "tierError.RESERVATION_TYPE_LIMIT_REACHED":
    "Din plan tillåter upp till {limit} bokningstyp. Uppgradera för fler bokningskategorier.",
  "tierError.RESOURCE_PER_TYPE_LIMIT_REACHED":
    "Din plan tillåter endast {limit} resurs(er) per typ. Uppgradera till Business för obegränsade resurser.",

  // Integritet & kontoradering
  "privacy.panel.title": "Integritet och dina uppgifter",
  "privacy.panel.description":
    "Exportera allt vi har om dig, eller stäng ditt konto. Detta är dina rättigheter enligt GDPR (Art. 15, 17, 20).",
  "privacy.export.title": "Exportera mina uppgifter",
  "privacy.export.description":
    "Ladda ner en JSON-fil med din profil, dina bokningar, granskningsloggar och andra uppgifter vi har om dig. Gräns: en export var 24:e timme.",
  "privacy.export.button": "Ladda ner mina uppgifter",
  "privacy.export.success": "Din dataexport har laddats ner.",
  "privacy.delete.title": "Radera mitt konto",
  "privacy.delete.description":
    "Schemalägger ditt konto för permanent radering efter en 30-dagars ångerperiod. Om du är den enda ägaren av en organisation med andra medlemmar, överför ägarskapet först.",
  "privacy.delete.button": "Radera mitt konto",
  "privacy.delete.scheduled":
    "Radering schemalagd. Slutgiltig radering: {date}",
  "privacy.delete.cancel": "Avbryt radering",
  "privacy.delete.cancelled": "Kontoradering avbruten.",
  "privacy.delete.confirmTitle": "Radera ditt konto?",
  "privacy.delete.confirmDescription":
    "Dina uppgifter kommer att raderas permanent efter 30 dagar. För att bekräfta, skriv DELETE nedan.",
  "privacy.delete.confirmLabel": "Bekräftelse",
  "privacy.delete.confirmAction": "Schemalägg radering",
  "privacy.delete.requested":
    "Kontoradering schemalagd. Du har 30 dagar att avbryta.",

  // Guest portal
  "guest.portal.label": "Gästportal",
  "guest.portal.title": "Din bokning",
  "guest.portal.linkExpiredTitle": "Länken har gått ut",
  "guest.portal.linkRevokedTitle": "Länken är återkallad",
  "guest.portal.notFoundTitle": "Bokningen hittades inte",
  "guest.portal.linkExpiredBody":
    "Den här bokningslänken har gått ut. Kontakta verksamheten för hjälp.",
  "guest.portal.linkRevokedBody":
    "Den här länken har återkallats. Kontakta verksamheten.",
  "guest.portal.notFoundBody":
    "Vi kunde inte hitta någon bokning med den här länken. Den kan ha tagits bort.",
  "guest.portal.checkOut": "Utcheckning",
  "guest.portal.specialRequests": "Särskilda önskemål",
  "guest.portal.total": "Totalt",
  "guest.portal.guestsSuffix": "gäst(er)",
  "guest.portal.needDifferentDate": "Behöver du ett annat datum?",
  "guest.portal.newDate": "Nytt datum",
  "guest.portal.newTime": "Ny tid (valfritt)",
  "guest.portal.message": "Meddelande (valfritt)",
  "guest.portal.messagePlaceholder": "Något verksamheten bör veta?",
  "guest.portal.requestNewDate": "Begär nytt datum",
  "guest.portal.sending": "Skickar...",
  "guest.portal.requestSentBanner":
    "Din ändringsbegäran har skickats till verksamheten. De kontaktar dig för att bekräfta.",
  "guest.portal.requestSentToast": "Ändringsbegäran skickad till verksamheten.",
  "guest.portal.requestError": "Din begäran kunde inte skickas. Försök igen.",
  "guest.portal.cancelBooking": "Avboka",
  "guest.portal.cancelTitle": "Vill du avboka din bokning?",
  "guest.portal.cancelDescription":
    "Detta avbokar din bokning. Åtgärden kan inte ångras.",
  "guest.portal.keepBooking": "Behåll bokningen",
  "guest.portal.yesCancel": "Ja, avboka",
  "guest.portal.cancelling": "Avbokar...",
  "guest.portal.cancelSuccess": "Din bokning har avbokats.",
  "guest.portal.cancelError": "Avbokningen misslyckades. Försök igen.",
  "guest.portal.pastBooking":
    "Datumet för den här bokningen har passerat. Vi hoppas att du trivdes!",
  "guest.portal.questionsFooter":
    "Frågor? Kontakta verksamheten direkt med uppgifterna i ditt bekräftelsemejl.",
  "guest.find.pageTitle": "Hitta din bokning",
  "guest.find.heading": "Hitta din bokning",
  "guest.find.intro":
    "Ange e-postadressen du använde vid bokningen så skickar vi en säker länk där du kan se, ändra eller avboka din reservation.",
  "guest.find.emailLabel": "E-postadress",
  "guest.find.submit": "Skicka min bokningslänk",
  "guest.find.sentBody":
    "Om vi hittade kommande bokningar för den e-postadressen har vi skickat säkra länkar dit. Länkarna är giltiga i 7 dagar.",
  "guest.find.useAnother": "Använd en annan e-postadress",
  "guest.find.invalidEmail": "Ange en giltig e-postadress.",
  "guest.find.error": "Något gick fel. Försök igen om en stund.",
  "guest.find.linkLabel": "Hitta min bokning",
  "guest.find.linkHint": "Redan bokat? Hantera din reservation.",

  // Availability timeline
  "timeline.title": "Tillgänglighetstidslinje",
  "timeline.resource": "Resurs",
  "timeline.blocked": "Blockerad",
  "timeline.availableSlot": "Extra tillgänglighet",
  "timeline.empty": "Inga aktiva resurser för den här dagen.",
  "timeline.previousDay": "Föregående dag",
  "timeline.nextDay": "Nästa dag",
  "timeline.legendReservation": "Bokning",
  "timeline.legendPending": "Väntande",
  "timeline.legendBlocked": "Blockerad",
  "timeline.legendSlot": "Extra tillgänglighet",
  "timeline.dragHint":
    "Tips: dra över en resursrad för att blockera den tiden.",
  "timeline.newBlockTitle": "Blockera den här tiden",
  "timeline.newBlockDescription":
    "Inget kan bokas på resursen under den valda tiden.",
  "timeline.reason": "Orsak",
  "timeline.reasonPlaceholder": "Till exempel: underhåll, privat evenemang",
  "timeline.createBlock": "Blockera tid",
  "timeline.blockCreated": "Tiden blockerad.",
  "timeline.blockError": "Det gick inte att blockera tiden.",
  "timeline.overlapBlocked":
    "Tiden överlappar en befintlig bokning, välj en ledig tid.",
  "timeline.undo": "Ångra",
  "timeline.blockUndone": "Blockeringen togs bort.",
  "ops.digest.title": "Dagligt sammandrag via e-post",
  "ops.digest.description":
    "Skicka morgondagens körschema automatiskt varje morgon kl. 06.00 finsk tid.",
  "ops.digest.enabled": "Skicka dagens körschema via e-post",
  "ops.digest.recipients": "Mottagare",
  "ops.digest.recipientsHelp":
    "Separera med komma. Lämna tomt för att använda företagets e-post.",
  "ops.digest.save": "Spara sammandrag",
  "ops.digest.saved": "Inställningarna sparade.",
  "ops.digest.saveError": "Det gick inte att spara inställningarna.",
  "nav.pendingRequests": "väntande gästförfrågningar",
  "ops.digest.test": "Skicka testsammandrag nu",
  "ops.weekly.title": "Veckorapport via e-post",
  "ops.weekly.description":
    "Skickar ett sammandrag för sju dagar med ett färdigt CSV-block kl. 06.00 lokal tid på vald veckodag.",
  "ops.weekly.enabled": "Veckorapport på",
  "ops.weekly.day": "Skickas på",
  "ops.weekly.recipientsHelp":
    "Separera med komma. Lämna tomt för att använda företagets e-post.",
  "ops.weekly.saved": "Inställningarna för veckorapporten sparade.",
  "ops.weekly.saveError":
    "Kunde inte spara inställningarna för veckorapporten.",
  "ops.weekly.test": "Skicka testrapport nu",
  "ops.weekly.testSent": "Testrapporten är i kö.",
  "ops.weekly.testError": "Kunde inte skicka testrapporten.",
  "forecast.drilldownTitle": "Detaljer för topptimme",
  "forecast.drilldownEmpty":
    "Inga bokningar började denna timme under perioden.",
  "forecast.drilldownHint":
    "Välj en ruta för att se tjänsterna och gästvolymen bakom den.",
  "forecast.avgGuests": "Gäster i snitt",
  "forecast.bookings": "Bokningar",
  "forecast.yoyTitle": "Beläggningstrend jämfört med i fjol",
  "forecast.yoySubtitle":
    "Bokningar och gäster per månad jämfört med samma månad i fjol.",
  "forecast.thisYear": "I år",
  "forecast.lastYear": "I fjol",
  "forecast.change": "Förändring",
  "forecast.occupancyTrend": "Trend",
  "ops.alerts.title": "Aviseringar om gäständringar",
  "ops.alerts.description":
    "Mejla personalen när en gäst begär ny tid eller avbokar.",
  "ops.alerts.enabled": "E-postaviseringar på",
  "ops.alerts.recipientsHelp":
    "Separera med komma. Lämna tomt för att använda företagets e-post.",
  "ops.alerts.saved": "Aviseringsinställningarna sparade.",
  "ops.alerts.saveError": "Kunde inte spara aviseringsinställningarna.",
  "timeline.blockButton": "Blockera tid",
  "timeline.startTime": "Starttid",
  "timeline.endTime": "Sluttid",
  "ops.digest.testSent": "Testsammandraget skickades till mottagarna.",
  "ops.digest.testError": "Det gick inte att skicka testsammandraget.",

  // Forecast
  "forecast.title": "Efterfrågeprognos",
  "forecast.subtitle":
    "Redan gjorda bokningar för de kommande 14 dagarna jämfört med din vanliga takt för den veckodagen.",
  "forecast.booked": "Bokat",
  "forecast.expected": "Vanlig takt",
  "forecast.next14Booked": "Bokningar nästa 14 dagar",
  "forecast.next14Guests": "Gäster nästa 14 dagar",
  "forecast.gapToPace": "Skillnad mot vanlig takt",
  "forecast.peakHours": "Toppentimmar",
  "forecast.peakSubtitle":
    "Bokningarnas starttider per veckodag under de senaste 90 dagarna.",
  "forecast.busiest": "Mest bokat",
  "forecast.basedOn": "Baserat på de senaste dagarna:",
  "forecast.mon": "Mån",
  "forecast.tue": "Tis",
  "forecast.wed": "Ons",
  "forecast.thu": "Tors",
  "forecast.fri": "Fre",
  "forecast.sat": "Lör",
  "forecast.sun": "Sön",
};

export const translations: Record<Language, TranslationKeys> = { en, fi, sv };
