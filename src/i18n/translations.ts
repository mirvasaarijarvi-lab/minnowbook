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
  "common.selectAll": string;

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
  "resourceHours.openingHoursLabel": string;
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
  "booking.dateBlocked": string;
  "booking.timeBlocked": string;
  "booking.blocked": string;
  "booking.fixedPricePlaceholder": string;
  "booking.thankYou": string;
  "booking.confirmationMsg": string;
  "booking.checkSpam": string;
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

  // Pricing page
  "pricing.heroTitle": string;
  "pricing.heroSubtitle": string;
  "pricing.basicName": string;
  "pricing.basicDesc": string;
  "pricing.basicTypes": string;
  "pricing.basicStaff": string;
  "pricing.proName": string;
  "pricing.proDesc": string;
  "pricing.proTypes": string;
  "pricing.proStaff": string;
  "pricing.businessName": string;
  "pricing.businessDesc": string;
  "pricing.businessTypes": string;
  "pricing.businessStaff": string;
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
  "features.offersAndCross": string;
  "features.offersAndCrossDesc": string;


  "useCases.badge": string;
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
  "useCases.ctaTitle": string;
  "useCases.ctaSubtitle": string;

  // Blog
  "blog.badge": string;
  "blog.heroTitle": string;
  "blog.heroSubtitle": string;
  "blog.readMore": string;
  "blog.backToBlog": string;
  "blog.postCta": string;
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

  // Tier limit errors (raised by backend triggers / RPCs)
  "tierError.STAFF_USER_LIMIT_REACHED": string;
  "tierError.SITE_LIMIT_REACHED": string;
  "tierError.RESERVATION_TYPE_LIMIT_REACHED": string;
  "tierError.RESOURCE_PER_TYPE_LIMIT_REACHED": string;
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
  "common.selectAll": "Select all",

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
  "reports.uninvoicedAlert": "{count} uninvoiced out of {total}, {amount} uninvoiced",
  "reports.breakfastAlert": "{count} reservations, {nights} nights. Estimated breakfast revenue {amount}",
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
  "settings.upsellTitle": "Manage multiple locations",
  "settings.upsellDesc": "Upgrade to the Business plan to manage hotels, restaurants, and venues from a single dashboard, each with its own resources, hours, and booking page.",
  "settings.learnMore": "Learn more",
  "settings.siteOverride": "Site Override",
  "settings.useParentDefault": "Use company default",
  "settings.customizeForSite": "Customize for this site",
  "settings.inheritedFromParent": "Inherited from company settings",
  "settings.siteSettingsSaved": "Site settings saved",
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
   "settings.resourceTypeNames": "Resource Type Names",
   "settings.resourceTypeNamesDesc": "Give custom display names to your booking types. These names appear on the public booking page.",
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
  "booking.closedDay": "Closed on this day.",
  "days.monday": "Monday",
  "days.tuesday": "Tuesday",
  "days.wednesday": "Wednesday",
  "days.thursday": "Thursday",
  "days.friday": "Friday",
  "days.saturday": "Saturday",
  "days.sunday": "Sunday",
  "openingHours.tooltip": "Set default opening hours per reservation type. These are used on the public booking page to determine available time slots. When you create a new site, these defaults are copied automatically.",
  "openingHours.siteTooltip": "These opening hours apply only to this site. They override the tenant-level defaults.",
  "openingHours.siteOverride": "Site-specific hours (overrides defaults)",
  "openingHours.usingDefaults": "Using tenant defaults. Save to create site-specific overrides.",
  "openingHours.resetToDefaults": "Reset to defaults",
  "openingHours.resetConfirm": "This will delete site-specific hours and revert to tenant defaults.",
  "openingHours.resetDone": "Opening hours reset to tenant defaults",
  "resourceHours.title": "Opening hours",
  "resourceHours.sameEveryDay": "Same every day",
  "resourceHours.perDay": "Per day",
  "resourceHours.openTime": "Opens",
  "resourceHours.closeTime": "Closes",
  "resourceHours.sameEveryDayDesc": "Same hours apply to all open days. Toggle individual days closed below.",
  "resourceHours.removeHours": "Remove hours",
  "resourceHours.saveFirst": "Save the resource first, then edit it to set opening hours.",
  "resourceHours.openingHoursLabel": "Hours",
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
  "booking.dateBlocked": "This date is not available for booking.",
  "booking.timeBlocked": "This time slot is not available for booking.",
  "booking.blocked": "Blocked",
  "booking.fixedPricePlaceholder": "e.g. 45.00",
  "booking.thankYou": "Thank you!",
  "booking.confirmationMsg": "Your reservation has been received. You will receive a confirmation email from {name}.",
  "booking.checkSpam": "If you don't see the email in your inbox, please check your spam or junk folder.",
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
  "booking.cateringQuoteDesc": "Tell us about your event and we'll prepare a custom quote for you.",
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
  "admin.staffLimitReached": "Staff user limit reached. Upgrade your plan to add more users.",
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
  "admin.permissionCol": "Permission",
  "admin.permTooltip": "Define what each role can access. Owner always has full access. Toggle individual permissions for Admin, Staff, and custom roles.",
  "admin.deleteRoleTitle": "Delete role \"{name}\"?",
  "admin.deleteRoleDesc": "This will permanently remove this custom role and all its permissions. Users assigned to this role will lose access.",
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
  "hero.titleHighlight": "hospitality reservations",
  "hero.subtitle": "Process and manage restaurant bookings, venue inquiries, and hotel or guesthouse reservations from one dashboard. Create your own branded booking pages, send automated confirmation emails. User management included.",
  "hero.viewPricing": "View Pricing",

  // Features
  "features.title": "Everything you need to manage your reservations",
  "features.subtitle": "A complete booking site for hospitality businesses with user management.",
  "features.smartReservations": "Reservations",
  "features.smartReservationsDesc": "Handle restaurant bookings, venue inquiries, and guesthouse stays, all from one dashboard.",
  "features.customBranding": "Custom Branding",
  "features.customBrandingDesc": "Your logo, your colors, your images. Every booking page matches your brand identity.",
  "features.teamManagement": "User Management",
  "features.teamManagementDesc": "Invite staff members, assign roles, and manage permissions with ease.",
  "features.brandedPages": "Reservation Types",
  "features.brandedPagesDesc": "Hotel/guesthouse, restaurant and event spaces.",
  "features.reportsInsights": "Reports",
  "features.reportsInsightsDesc": "Track reservation trends, occupancy rates, and revenue at a glance.",
  "features.automatedEmails": "Automated Emails",
  "features.automatedEmailsDesc": "Send confirmation, reminder, and cancellation emails automatically.",

  // How it works
  "howItWorks.title": "Up and running is fast and easy",
  "howItWorks.subtitle": "Three simple steps to start accepting online reservations.",
  "howItWorks.step1Title": "Sign up & pick your plan",
  "howItWorks.step1Desc": "Create your account and start your 30-day free trial.",
  "howItWorks.step2Title": "Set up your business",
  "howItWorks.step2Desc": "Upload your branding, add your site(s) and operations, and configure opening hours, pricing, occupancy capacity and much more.",
  "howItWorks.step3Title": "Share your booking link",
  "howItWorks.step3Desc": "Send your custom booking page to customers and start receiving reservations.",

  // Pricing
  "pricing.title": "Simple and transparent pricing",
  "pricing.subtitle": "Start with a 30-day free trial. Upgrade to the next tier or cancel anytime.",
  "pricing.simpleTitle": "Simple and transparent pricing",
  "pricing.simpleSubtitle": "Start with a 30-day free trial. Upgrade to the next tier or cancel anytime.",
  "pricing.comparePlans": "Compare plans in detail",
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
  "cta.subtitle": "Join hospitality businesses already using MimmoBook to streamline their bookings.",

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
  "login.codeHint": "Beta, access, or discount code — it will be applied after you sign in.",
  "login.codeRedeemed": "Code redeemed successfully!",
  "login.codeRedeemFailed": "Code could not be redeemed. You can try again from your dashboard.",

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
  "signup.orContinueWith": "Or sign up with",
  "signup.continueGoogle": "Sign up with Google",
  "signup.continueApple": "Sign up with Apple",

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
  "dashboard.sendReminder": "Send reminder",
  "dashboard.reminderSent": "Reminder sent",
  "dashboard.reminderSentAt": "Reminder sent",
  "dashboard.confirmationSentAt": "Confirmation sent",
  "dashboard.cancellationSentAt": "Cancellation sent",
  "dashboard.reminderError": "Failed to send reminder",
  "dashboard.sendReminderMsg": "Send a reminder email to the guest about this reservation?",
  "dashboard.notCheckedIn": "Not checked in",
  "dashboard.todayFilter": "Today",
  "dashboard.activeResources": "Active Resources",
  "dashboard.bookingLink": "Booking Link",
  "dashboard.bookingLinkDesc": "Share this link with your customers so they can make reservations.",
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
  "dashboard.noResources": "No resources yet. Add your first room, table, or venue.",
  "dashboard.capacity": "capacity",
  "dashboard.perNight": "/night",
  "dashboard.resourceCreated": "Resource created",
  "dashboard.resourceUpdated": "Resource updated",
  "dashboard.resourceDeleted": "Resource deleted",
  "dashboard.copyResource": "Copy resource",
  "dashboard.copyResourceDesc": "How many copies of this resource do you want to create?",
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
  "autoReminder.title": "Auto Reminders",
  "autoReminder.tooltip": "Reminder emails are automatically sent 24 hours before each confirmed reservation.",
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
  "dashboard.markLinkedUsed": "Mark linked reservations used?",
  "dashboard.markLinkedUsedMsg": "This reservation is linked to an offer with other reservations. Would you like to mark them all as used?",
  "dashboard.markAll": "Mark all used",
  "dashboard.markLinkedInvoiced": "Mark linked reservations as invoiced?",
  "dashboard.markLinkedInvoicedMsg": "This reservation is linked to an offer with other reservations. Would you like to mark them all as invoiced?",
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
  "dashboard.calendarTooltip": "Click a date to see its reservations. Highlighted dates have bookings. Red dates have one-off blocks. Purple dashed dates have recurring blocks.",
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
  "dashboard.pricingHint": "Default price for new reservations. Individual reservation prices can be adjusted in the reservation details.",
  "dashboard.roomTypeLabel": "Room type",
  "dashboard.bedConfiguration": "Bed configuration",
  "dashboard.roomDescription": "Room description",
  "dashboard.roomDescPlaceholder": "Describe the rooms, number of beds, layout...",
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
  "tier.basicDesc": "Perfect for a single hotel, restaurant or event venue.",
  "tier.pro": "Pro",
  "tier.proDesc": "For businesses offering hotel, restaurant and event venue services in one place.",
  "tier.professional": "Professional",
  "tier.professionalDesc": "Multiple reservation types, team management.",
  "tier.business": "Business",
  "tier.businessDesc": "Feature-rich platform for businesses with multiple sites and operations.",

  // Footer
  "footer.tagline": "The modern reservation platform for restaurants, venues, and guesthouses.",
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
  "about.heroSubtitle": "We help hospitality businesses manage their bookings effortlessly, so they can focus on creating memorable guest experiences.",
  "about.missionBadge": "Our Mission",
  "about.missionTitle": "Making reservation management simple and easy",
  "about.missionP1": "Small hospitality businesses deserve practical and informative tools to operate more efficiently. We started MimmoBook to make that happen.",
  "about.missionP2": "Our platform brings reservations, branding, and reporting into one unified workspace eliminating the scattered notebooks and missed bookings.",
  "about.point1Title": "Speed without compromise",
  "about.point1Desc": "Get your branded booking page live in a day or two, not weeks.",
  "about.point2Title": "Data-driven insights",
  "about.point2Desc": "Track reservations, occupancy, and revenue at a glance.",
  "about.point3Title": "Built for teams",
  "about.point3Desc": "Role-based access and multi-staff support built in.",
  "about.valuesTitle": "Our core values",
  "about.valuesSubtitle": "We use these principles to guide every-day decisions we make, from product design to customer support.",
  "about.valuePrecision": "Precision",
  "about.valuePrecisionDesc": "Every detail matters from pixel-perfect booking pages to accurate availability calendars.",
  "about.valueInnovation": "Innovation",
  "about.valueInnovationDesc": "We continuously improve our platform. We crave for user feedback to make the platform even better.",
  "about.valueCollaboration": "Collaboration",
  "about.valueCollaborationDesc": "We work closely with hospitality businesses to understand their real needs.",
  "about.valueTrust": "Trust",
  "about.valueTrustDesc": "Your data is secure. We follow GDPR standards and best security practices.",
  "about.valuePassion": "Passion",
  "about.valuePassionDesc": "We're passionate about helping small businesses succeed in hospitality.",
  "about.valueGlobal": "Accessibility",
  "about.valueGlobalDesc": "Our platform is multilingual and designed to be accessible to everyone.",
  "about.ctaTitle": "Ready to simplify your reservations?",
  "about.ctaSubtitle": "Join hospitality businesses already using MimmoBook to streamline your bookings.",

  "privacy.title": "Privacy Policy",
  "privacy.lastUpdated": "Last updated:",
  "privacy.s1Title": "1. Introduction",
  "privacy.s1P1": "This privacy policy explains how MimmoBook collects, uses, stores, and protects your personal data when you use our reservation management platform. We are committed to protecting your privacy in accordance with the EU General Data Protection Regulation (GDPR).",
  "privacy.s2Title": "2. Data Controller",
  "privacy.s2P1": "MimmoBook is the data controller for the personal data processed through this platform. For data protection inquiries, please contact us through the Support page.",
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
  "privacy.s6Item1": "Right of access: request a copy of your personal data",
  "privacy.s6Item2": "Right to rectification: correct inaccurate data",
  "privacy.s6Item3": "Right to erasure: request deletion of your data",
  "privacy.s6Item4": "Right to restrict processing",
  "privacy.s6Item5": "Right to data portability: receive your data in a structured format",
  "privacy.s7Title": "7. Cookies",
  "privacy.s7P1": "We use essential cookies required for the platform to function. Analytics cookies are only loaded after you give explicit consent via our cookie banner. You can change your cookie preferences at any time.",
  "privacy.s8Title": "8. Contact",
  "privacy.s8P1": "For any questions about this privacy policy or to exercise your data protection rights, please contact us through the Support page.",

  "a11y.title": "Accessibility Statement",
  "a11y.lastUpdated": "Last updated:",
  "a11y.s1Title": "1. Our Commitment",
  "a11y.s1P1": "MimmoBook is committed to ensuring digital accessibility for people of all abilities. We continually improve the user experience for everyone and apply relevant accessibility standards.",
  "a11y.s2Title": "2. Accessibility Features",
  "a11y.s2P1": "Our platform includes the following accessibility features:",
  "a11y.s2Item1": "Adjustable font size (80% to 150%)",
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
  "a11y.s5P1": "We welcome your feedback on the accessibility of MimmoBook. Please contact us through the Support page if you encounter any barriers or have suggestions for improvement.",
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
  "password.breached": "This password has been found in data breaches. Choose a different one",
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
  "help.requestSubmittedDetail": "Your support request has been submitted! Your admin team will review it and respond soon.",
  "help.art1Title": "Getting Started",
  "help.art1Desc": "Set up your account and create your first booking page in minutes.",
  "help.art1C1": "Sign up for a free 30-day trial. No credit card needed.",
  "help.art1C2": "Complete the onboarding wizard to name your business and choose your reservation types.",
  "help.art1C3": "Customize your branding (logo, colors) in Settings.",
  "help.art1C4": "Share your booking link with customers!",
  "help.art2Title": "Managing Reservations",
  "help.art2Desc": "View, edit, confirm, and cancel reservations from your dashboard.",
  "help.art2C1": "Use the Calendar view for a visual overview of upcoming bookings.",
  "help.art2C2": "Switch to the List view to filter by status, type, or date range.",
  "help.art2C3": "Click any reservation to edit details, add notes, or change status.",
  "help.art2C4": "Confirmation and cancellation emails are sent automatically.",
  "help.art3Title": "Email Templates",
  "help.art3Desc": "Customize confirmation and cancellation emails sent to guests.",
  "help.art3C1": "Go to Settings → Email Templates to customize your emails.",
  "help.art3C2": "Preview how emails look before sending using the built-in preview.",
  "help.art3C3": "Add custom messages per reservation when confirming or cancelling.",
  "help.art3C4": "Emails support multi-language content (EN, FI, SV).",
  "help.art4Title": "Branding & Booking Page",
  "help.art4Desc": "Customize your public booking page with your brand identity.",
  "help.art4C1": "Upload your logo and set primary/accent colors in Settings.",
  "help.art4C2": "Add a hero image for your booking page header.",
  "help.art4C3": "Your booking page is available at /book/your-slug.",
  "help.art4C4": "Business description appears on the booking page for guests.",
  "help.art5Title": "Opening Hours",
  "help.art5Desc": "Configure when your business accepts bookings for each type.",
  "help.art5C1": "Set opening hours per reservation type (restaurant, venue, hotel).",
  "help.art5C2": "Mark specific days as closed.",
  "help.art5C3": "Opening hours determine available time slots on the booking page.",
  "help.art5C4": "Use blocked slots to temporarily close specific dates.",
  "help.art6Title": "Resources & Rooms",
  "help.art6Desc": "Manage rooms, tables, and event spaces that can be booked.",
  "help.art6C1": "Add resources in the Resources section of your dashboard.",
  "help.art6C2": "Set capacity, pricing, and descriptions for each resource.",
  "help.art6C3": "Upload photos to showcase your spaces on the booking page.",
  "help.art6C4": "Deactivate resources to temporarily hide them from bookings.",
  "help.art7Title": "Staff & User Management",
  "help.art7Desc": "Invite team members and manage roles and permissions.",
  "help.art7C1": "Owners can invite staff via the Admin panel.",
  "help.art7C2": "Roles: Owner (full access), Admin (manage resources), Staff (view reservations).",
  "help.art7C3": "Approve or remove team members at any time.",
  "help.art7C4": "Each plan has a staff user limit. Upgrade to add more.",
  "help.art8Title": "Plans & Billing",
  "help.art8Desc": "Understand pricing tiers and manage your subscription.",
  "help.art8C1": "Basic (€29/mo): 1 type, 1 to 5 staff, AI chatbot support.",
  "help.art8C2": "Pro (€79/mo): All types, up to 25 staff, custom templates, AI chatbot support.",
  "help.art8C3": "Business (€199/mo): All types, unlimited staff, priority support with 24h response.",
  "help.art8C4": "Upgrade or downgrade anytime. Changes take effect next billing cycle.",
  "help.art9Title": "Frequently Asked Questions",
  "help.art9Desc": "Answers to the most common questions about MimmoBook.",
  "help.art9C1": "Q: Do I need a credit card for the trial? A: No!",
  "help.art9C2": "Q: Can I use my own domain? A: Custom domains are on our roadmap.",
  "help.art9C3": "Q: How do guests receive confirmations? A: Automatically via email when you confirm a booking.",
  "help.art9C4": "Q: Can I export my data? A: Yes, reports can be exported from the Reports panel.",
  "help.art10Title": "What's New",
  "help.art10Desc": "Recent features: Guest Portal, Waitlist, Calendar Sync, exports and more.",
  "help.art10C1": "Guest Portal: guests can view or cancel their booking via a magic link (/my-booking/:token) — no login required.",
  "help.art10C2": "Waitlist: when a slot is full, guests can join a waitlist and get notified automatically when it opens.",
  "help.art10C3": "Google Calendar sync: subscribe to your reservations via the iCal feed (Settings → Calendar Sync). CSV/PDF export from Reservations and Reports.",
  "help.art10C4": "Dashboard upgrades: dark mode, keyboard shortcuts (press ?), Quick Actions FAB on mobile, onboarding checklist, audit log filters, analytics charts, login rate limiting, backup status indicator, public reviews/testimonials, multi-language public booking, and a Stripe revenue dashboard for superadmins.",
  "help.guide1Q": "How do I manage reservations?",
  "help.guide1A": "Go to your **Dashboard → Reservations** to view, filter, edit, and manage all bookings. You can confirm or cancel reservations from the action menu on each card.",
  "help.guide2Q": "How do I customize my booking page?",
  "help.guide2A": "Navigate to **Settings** in your dashboard. Upload your logo, set brand colors, and add a hero image. Your public booking page updates automatically.",
  "help.guide3Q": "How do I set up email templates?",
  "help.guide3A": "In **Settings → Email Templates**, you can customize both confirmation and cancellation emails. Use the preview tab to see how they'll look to guests.",
  "help.guide4Q": "How do I add staff members?",
  "help.guide4A": "Go to **Admin → Users** to invite new staff. You can set roles (Owner, Admin, Staff) and approve or remove team members.",
  "help.guide5Q": "How do I add or edit resources?",
  "help.guide5A": "Go to **Dashboard → Resources** to create rooms, tables, or venues. You can set capacity, pricing, upload up to 5 images, and toggle active/inactive status.",
  "help.guide6Q": "What's new in MimmoBook?",
  "help.guide6A": "Recent additions: **Guest Portal** (magic-link booking management), **Waitlist** with auto-notify, **Google Calendar sync** via iCal feed, **CSV/PDF export**, **dark mode**, **keyboard shortcuts** (press `?`), **Quick Actions FAB** on mobile, **onboarding checklist**, **audit-log filters**, **analytics charts**, **public reviews/testimonials**, and a **Stripe revenue dashboard** for superadmins.",

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
  "aid.chat": "Chat",
  "aid.requests": "Requests",
  "aid.loadingRequests": "Loading requests...",
  "aid.noRequests": "No support requests yet.",
  "aid.noRequestsHint": "Submit one from the chat view.",
  "aid.yourMessage": "Your message",
  "aid.adminResponse": "Admin response",
  "aid.awaitingResponse": "Awaiting admin response...",
  "aid.requestSubmitted": "Support Request",
  "aid.requestSubmittedDetail": "Your support request has been submitted! Your admin team will review it and respond soon. You'll see a notification when it's been addressed.",
  "aid.statusOpen": "Open",
  "aid.statusInProgress": "In Progress",
  "aid.statusResolved": "Resolved",
  "aid.statusClosed": "Closed",
  "aid.errorNoTenant": "Unable to submit request. No tenant found.",
  "aid.errorSubmit": "Failed to submit request",
  "aid.successSubmit": "Support request submitted",
  "aid.errorConnect": "Sorry, I couldn't connect. Please try again.",
  "aid.guideQ1": "How do I manage reservations?",
  "aid.guideA1": "Go to your **Dashboard → Reservations** to view, filter, edit, and manage all bookings. You can confirm or cancel reservations from the action menu on each card.",
  "aid.guideQ2": "How do I customize my booking page?",
  "aid.guideA2": "Navigate to **Settings** in your dashboard. Upload your logo, set brand colors, and add a hero image. Your public booking page updates automatically.",
  "aid.guideQ3": "How do I set up email templates?",
  "aid.guideA3": "In **Settings → Email Templates**, you can customize both confirmation and cancellation emails. Use the preview tab to see how they'll look to guests.",
  "aid.guideQ4": "How do I add staff members?",
  "aid.guideA4": "Go to **Admin → Users** to invite new staff. You can set roles (Owner, Admin, Staff) and approve or remove team members.",
  "aid.guideQ5": "How do I add or edit resources?",
  "aid.guideA5": "Go to **Dashboard → Resources** to create rooms, tables, or venues. You can set capacity, pricing, upload up to 5 images, and toggle active/inactive status.",
  "aid.guideQ6": "How do I set opening hours?",
  "aid.guideA6": "In **Settings → Opening Hours**, configure open/close times for each day of the week per resource type. Mark days as closed when needed.",
  "aid.guideQ7": "How do I view reports?",
  "aid.guideA7": "Navigate to **Dashboard → Reports** to see reservation trends, occupancy rates, and revenue summaries. You can filter by date range and export printable reports.",
  "aid.guideQ8": "How does pricing work for rooms?",
  "aid.guideA8": "Set a **base price per night** on each resource, then configure **room type multipliers** (Single 1.0×, Double 1.5×, Suite 2.5×, etc.). The booking page calculates totals automatically.",
  "aid.guideQ9": "How do I share my booking link?",
  "aid.guideA9": "Your public booking link is shown on the **Dashboard Overview**. Click **Copy link** to copy it, or open it in a new tab to preview. Share it on your website or social media.",
   "aid.guideQ10": "How do I block dates or time slots?",
   "aid.guideA10": "In **Dashboard → Calendar**, click on a date and use the **Block Slot** option to prevent bookings for specific dates, times, or resources.",
   "aid.guideQ11": "How do I manage recurring blocked slots?",
   "aid.guideA11": "Go to **Dashboard → Calendar** and open the **Recurring Blocks** panel. You can create weekly repeating blocks for specific days, time ranges, and resource types (e.g. close the restaurant every Monday). Toggle blocks on/off or delete them anytime. Changes apply immediately to the public booking page.",
  // Sites
  "sites.title": "Sites",
  "sites.addSite": "Add Site",
  "sites.editSite": "Edit Site",
  "sites.tooltip": "Manage multiple locations or properties under your account. Each site can have its own resources, opening hours, and booking page.",
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
  "sites.deleteConfirm": "This will permanently remove this site. Resources assigned to it will become unassigned.",
  "sites.noSites": "No sites yet. Create your first site to manage multiple locations.",
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
  "sample.warningWeek": "Your free trial ends in {days} days. Contact support to upgrade.",
  "sample.warningDay": "Your free trial expires today! Contact support to continue.",
  "sample.warningDayTomorrow": "Your free trial expires tomorrow! Contact support to continue.",
  "sample.readOnly": "Your free trial has expired. Dashboard is read-only for {days} more days. Contact support to upgrade.",
  "sample.blocked": "Your free trial has expired and access is blocked. Contact support to reactivate.",
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
  "discountCodes.description": "Create and manage promotional discount codes for your customers.",
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
  "discountCodes.deleteConfirm": "Are you sure you want to delete this discount code? This action cannot be undone.",
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
  "emailTemplates.tooltip": "Customize the subject and body of confirmation, reminder, and cancellation emails sent to guests.",
  "emailTemplates.description": "Customize the emails sent to guests for confirmations, reminders, and cancellations.",
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
  "emailTemplates.activeToggleDesc": "When disabled, the system default will be used instead.",
  "emailTemplates.resetDefault": "Reset to default",
  "emailTemplates.saved": "Email template saved",
  "emailTemplates.saveError": "Failed to save template",
  "emailTemplates.active": "Active",
  "emailTemplates.inactive": "Inactive",
  "emailTemplates.upgradeHint": "Upgrade to Professional or Business to customize email templates.",
  "emailTemplates.overrideRemoved": "Site override removed, using tenant defaults",
  "emailTemplates.siteOverride": "Site override",
  "emailTemplates.usingTenantDefault": "Using tenant default",
  "emailTemplates.revertToDefault": "Remove site override",
  "emailTemplates.siteDescription": "Customize email templates for this site. Changes here override the tenant-level defaults.",

  // Pricing page
  "pricing.heroTitle": "Simple and transparent pricing",
  "pricing.heroSubtitle": "Start with a 30-day free trial. Upgrade to the next tier or cancel anytime.",
  "pricing.basicName": "Basic",
  "pricing.basicDesc": "Perfect for a single hotel, restaurant or event venue.",
  "pricing.basicTypes": "1 type",
  "pricing.basicStaff": "1 to 5",
  "pricing.proName": "Pro",
  "pricing.proDesc": "For businesses offering hotel, restaurant and event venue services in one place.",
  "pricing.proTypes": "All 3 types, 1 of each (e.g. cannot switch to two restaurants and one hotel)",
  "pricing.proStaff": "Up to 25",
  "pricing.businessName": "Business",
  "pricing.businessDesc": "Feature-rich platform for businesses with multiple sites and operations.",
  "pricing.businessTypes": "All 3 types, unlimited number",
  "pricing.businessStaff": "Unlimited",
  "pricing.basicF1": "Custom branding (logo, colors, images)",
  "pricing.basicF2": "Default email templates",
  "pricing.basicF3": "Opening hours configuration",
  "pricing.basicF4": "Branded booking page",
  "pricing.basicF5": "AI chatbot support",
  "pricing.proF1": "Everything in Basic",
  "pricing.proF2": "Custom email templates",
  "pricing.proF3": "AI chatbot support",
  "pricing.businessF1": "Everything in Pro",
  "pricing.businessF2": "Unlimited number of sites, operations and staff",
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
  "pricing.multiLocationDesc": "The Business plan supports unlimited sites with multi-site management. Run your hotels, restaurants, and venues from a single dashboard.",
  "pricing.tryBusinessFree": "Try Business Free for 30 Days",
  "pricing.faqQ1": "What happens after the 30-day trial?",
  "pricing.faqA1": "You get a message notifying you about your trial converting to a paid subscription. You can cancel anytime before the trial ends, no charge. If you do not cancel, the subscription starts. If you cancel after subscription has started, you will be invoiced for the first billing cycle, which is 30 days.",
  "pricing.faqQ2": "Can I change my plan later?",
  "pricing.faqA2": "Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
  "pricing.faqQ3": "What reservation types can I choose?",
  "pricing.faqA3": "Restaurant (table bookings), Venue (event space inquiries), and Gasthaus/Guesthouse (room reservations). Basic lets you pick one. Pro unlocks all types, one per type, on a single site. Business adds unlimited sites.",
  "pricing.faqQ4": "Can I use my own domain?",
  "pricing.faqA4": "Each business gets a branded subdomain (e.g., yourbusiness.mimmobook.com). Custom domain support is on our roadmap and will be then offered with an enterprise pricing.",
  "pricing.faqQ5": "What's the difference between AI chatbot support and 24-hour response support?",
  "pricing.faqA5": "All plans include MimmoAid, our AI chatbot that can answer questions, help troubleshoot issues, and guide you through features instantly. The chatbot is available 24/7 in your dashboard. The Business plan adds 24-hour response support: you can escalate any conversation to our team on the platform via the chatbot and receive a guaranteed response within 24 hours.",

  // Support page
  "support.heroTitle": "How can we help?",
  "support.heroSubtitle": "Browse guides, FAQs, and tips to get the most out of MimmoBook.",
  "support.searchPlaceholder": "Search for help...",
  "support.noResults": "No results found. Try a different search term.",
  "support.stillNeedHelp": "Still need help?",
  "support.stillNeedHelpDesc": "All plans include AI chatbot support in the dashboard. Business plan customers get support with guaranteed 24-hour response from our team. There is also a user downloadable user guide in the backend view to help with use.",
  "support.gettingStarted": "Getting Started",
  "support.gettingStartedDesc": "Set up your account and create your first booking page.",
  "support.gettingStartedC1": "Sign up for a free 30-day trial.",
  "support.gettingStartedC2": "Complete the onboarding wizard to name your business and choose your reservation types.",
  "support.gettingStartedC3": "Customize your branding (logo, colors) in Settings.",
  "support.gettingStartedC4": "Share your booking link with customers!",
  "support.managingRes": "Managing Reservations",
  "support.managingResDesc": "View, edit, confirm, and cancel reservations from your dashboard.",
  "support.managingResC1": "Use the Calendar view for a visual overview of upcoming bookings.",
  "support.managingResC2": "Switch to the List view to filter by status, type, or date range.",
  "support.managingResC3": "Click any reservation to edit details, add notes, or change status.",
  "support.managingResC4": "Confirmation and cancellation emails are sent automatically.",
  "support.emailTemplates": "Email Templates",
  "support.emailTemplatesDesc": "Business tier customer can customize confirmation and cancellation emails sent to guests.",
  "support.emailTemplatesC1": "Go to Settings → Email Templates to customize your emails.",
  "support.emailTemplatesC2": "Preview how emails look before sending using the built-in preview.",
  "support.emailTemplatesC3": "Add custom messages per reservation when confirming or cancelling.",
  "support.emailTemplatesC4": "Emails support multi-language content (EN, FI, SV).",
  "support.brandingTitle": "Settings & Resource Pages",
  "support.brandingDesc": "Customize your public booking page with your brand identity.",
  "support.brandingC1": "Upload your logo and set primary/accent colors in Settings.",
  "support.brandingC2": "Add a hero image for your booking page header.",
  "support.brandingC3": "Business description appears on the booking page for guests.",
  "support.brandingC4": "",
  "support.openingHoursTitle": "Opening Hours",
  "support.openingHoursDesc": "Configure when your business accepts bookings for each type.",
  "support.openingHoursC1": "Set opening hours per reservation type (restaurant, venue, hotel).",
  "support.openingHoursC2": "Possibility to mark specific hours or days as closed.",
  "support.openingHoursC3": "Opening hours determine available time slots on the booking page.",
  "support.openingHoursC4": "Use blocked slots to temporarily close specific hours or dates.",
  "support.resourcesTitle": "Resources & Rooms",
  "support.resourcesDesc": "Manage rooms, tables, and event spaces that can be booked.",
  "support.resourcesC1": "Add resources in the Resources section of your dashboard.",
  "support.resourcesC2": "Set capacity, pricing, and descriptions for each resource.",
  "support.resourcesC3": "Upload photos to showcase your spaces on the booking page.",
  "support.resourcesC4": "Deactivate resources to temporarily hide them from bookings.",
  "support.staffTitle": "User Management",
  "support.staffDesc": "Invite team members and manage roles and permissions.",
  "support.staffC1": "Owners can invite staff via the Admin panel.",
  "support.staffC2": "Roles: Owner (full access), Admin (manage resources), Staff (view reservations).",
  "support.staffC3": "Approve or remove team members at any time.",
  "support.staffC4": "The plans have a staff user and a reservation type limits, upgrade to add more.",
  "support.billingTitle": "Plans & Billing",
  "support.billingDesc": "Understand pricing tiers and manage your subscription.",
  "support.billingC1": "Basic (€29/mo): 1 type, 1 to 5 staff users, AI chatbot support.",
  "support.billingC2": "Pro (€79/mo): All types (one per type), up to 25 staff users, AI chatbot support.",
  "support.billingC3": "Business (€199/mo): All types and unlimited number, unlimited number staff users, priority support with 24h response.",
  "support.billingC4": "Upgrade or downgrade anytime. Changes take effect next billing cycle.",
  "support.faqTitle": "Frequently Asked Questions",
  "support.faqDesc": "Answers to the most common questions about MimmoBook.",
  "support.faqC1": "Q: Can I use my own domain? A: Custom domains are on our roadmap.",
  "support.faqC2": "Q: How do guests receive confirmations? A: Automatically via email when you confirm a booking.",
  "support.faqC3": "Q: Can I export my data? A: Yes, reports can be exported from the Reports panel.",
  "support.faqC4": "Q: What's the difference between AI chatbot and priority support? A: All plans include MimmoAid, our 24/7 AI chatbot. Business plan adds support requests asked on the platform with a guaranteed 24-hour response.",
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
  "whatIs.heroSubtitle": "MimmoBook is a cloud-based reservation management platform built for restaurants, venues, hotels and guesthouses. One tool to manage all your bookings.",
  "whatIs.seeFeatures": "See all features",
  "whatIs.definitionTitle": "MimmoBook: Reservation Management for Hospitality",
  "whatIs.definitionP1": "MimmoBook is a software-as-a-service (SaaS) platform that helps hospitality businesses manage reservations online. Whether you run a restaurant, event venue, hotel, or guesthouse, MimmoBook gives you a centralized dashboard to handle bookings, communicate with guests, and track your business performance.",
  "whatIs.definitionP2": "Unlike generic booking tools, MimmoBook is designed specifically for hospitality. It supports multiple reservation types, including table bookings, room reservations, venue hire, catering orders, and popup events, all from a single account. Each business gets a branded booking page that matches their identity.",
  "whatIs.definitionP3": "MimmoBook is available in English, Finnish, and Swedish, making it ideal for businesses operating in the Nordics and internationally. The platform scales from single-location restaurants to multi-site hospitality groups.",
  "whatIs.whoTitle": "Who Is MimmoBook For?",
  "whatIs.whoSubtitle": "MimmoBook serves hospitality businesses of all sizes across four main categories.",
  "whatIs.whoRestaurants": "Restaurants",
  "whatIs.whoRestaurantsDesc": "Manage table reservations, set menus, and guest preferences. Handle walk-ins and online bookings from one dashboard.",
  "whatIs.whoVenues": "Event Venues",
  "whatIs.whoVenuesDesc": "Coordinate space bookings, equipment needs, catering requests, and event scheduling with automated confirmations.",
  "whatIs.whoHotels": "Hotels",
  "whatIs.whoHotelsDesc": "Manage room reservations, check-in/check-out, breakfast options, and room-type pricing across your property.",
  "whatIs.whoGuesthouses": "Guesthouses",
  "whatIs.whoGuesthousesDesc": "Streamline guest stays with simple room booking, availability management, and personalized communication.",
  "whatIs.howTitle": "How Does MimmoBook Work?",
  "whatIs.howSubtitle": "Get started in four simple steps.",
  "whatIs.howStep1": "Sign Up",
  "whatIs.howStep1Desc": "Create your account and start a 30-day free trial. No credit card required.",
  "whatIs.howStep2": "Configure",
  "whatIs.howStep2Desc": "Set up your business profile, reservation types, opening hours, and branding.",
  "whatIs.howStep3": "Share",
  "whatIs.howStep3Desc": "Share your branded booking page with guests via your website, social media, or email.",
  "whatIs.howStep4": "Manage",
  "whatIs.howStep4Desc": "Handle all reservations from your dashboard with automated emails, reports, and team tools.",
  "whatIs.keyFeaturesTitle": "Key Features",
  "whatIs.feat1": "Smart Reservations",
  "whatIs.feat1Desc": "Accept and manage bookings for restaurants, venues, hotels, and guesthouses from one platform.",
  "whatIs.feat2": "Custom Branding",
  "whatIs.feat2Desc": "Your booking page reflects your brand with custom colors, logo, and hero images.",
  "whatIs.feat3": "Team Management",
  "whatIs.feat3Desc": "Invite staff, assign roles, and control permissions for your entire team.",
  "whatIs.feat4": "Multilingual Support",
  "whatIs.feat4Desc": "Dashboard and booking pages available in English, Finnish, and Swedish.",
  "whatIs.feat5": "Reports & Analytics",
  "whatIs.feat5Desc": "Track revenue, occupancy, and booking trends with exportable reports.",
  "whatIs.feat6": "Automated Emails",
  "whatIs.feat6Desc": "Confirmation, reminder, and cancellation emails sent automatically to guests.",
  "whatIs.allFeatures": "View all features",
  "whatIs.ctaTitle": "Ready to Simplify Your Reservations?",
  "whatIs.ctaSubtitle": "Start your 30-day free trial today. No credit card required.",

  // Features Page
  "featuresPage.badge": "Platform Features",
  "featuresPage.heroTitle": "Everything You Need to Manage Reservations",
  "featuresPage.heroSubtitle": "From booking pages to reports, MimmoBook provides a complete toolkit for hospitality reservation management.",
  "featuresPage.ctaTitle": "Start Managing Reservations Today",
  "featuresPage.ctaSubtitle": "Try all features free for 30 days. No credit card required.",
  "featuresPage.comparePlans": "Compare plans",
  "features.catReservations": "Reservation Management",
  "features.catBranding": "Branding & Booking Pages",
  "features.catManagement": "Team & Business Management",
  "features.catComms": "Communication & Reporting",
  "features.f1Title": "Multi-Type Reservations",
  "features.f1Desc": "Support table bookings, room reservations, venue hire, catering orders, and popup events from one account.",
  "features.f2Title": "Opening Hours & Availability",
  "features.f2Desc": "Configure opening hours per reservation type with blocked slots and recurring closures.",
  "features.f3Title": "Automated Reminders",
  "features.f3Desc": "Guests receive automatic reminder emails before their reservation to reduce no-shows.",
  "features.f4Title": "Discount Codes",
  "features.f4Desc": "Create percentage or fixed-amount discount codes with usage limits and date restrictions.",
  "features.f5Title": "Branded Booking Pages",
  "features.f5Desc": "Your public booking page displays your logo, colors, hero image, and business description.",
  "features.f6Title": "Custom Domain Ready",
  "features.f6Desc": "Each business gets a unique booking URL. Share it on your website, social media, or print materials.",
  "features.f7Title": "Multilingual (EN/FI/SV)",
  "features.f7Desc": "Dashboard and booking pages are fully translated in English, Finnish, and Swedish.",
  "features.f8Title": "Mobile Responsive",
  "features.f8Desc": "The booking page and dashboard work perfectly on phones, tablets, and desktops.",
  "features.f9Title": "Team Roles & Permissions",
  "features.f9Desc": "Invite staff as owners, admins, or team members with granular permission control.",
  "features.f10Title": "Resource Management",
  "features.f10Desc": "Create and manage rooms, tables, event spaces, and other bookable resources with photos and descriptions.",
  "features.f11Title": "Multi-Site Support",
  "features.f11Desc": "Manage multiple locations from one account with per-site branding, staff, and reporting.",
  "features.f12Title": "Approval Workflows",
  "features.f12Desc": "Review and approve reservations, resource changes, and blocked slots before they go live.",
  "features.f13Title": "Email Templates",
  "features.f13Desc": "Customize confirmation, reminder, and cancellation emails per reservation type and language.",
  "features.f14Title": "Custom Email Templates",
  "features.f14Desc": "Business plan users can fully customize email HTML with their branding and messaging.",
  "features.f15Title": "Reports & Analytics",
  "features.f15Desc": "Revenue reports, booking trends, occupancy rates, and CSV exports for accounting.",
  "features.f16Title": "Invoicing Tracking",
  "features.f16Desc": "Mark reservations as invoiced and track uninvoiced revenue across all reservation types.",
  "features.f17Title": "Offers & Proposals",
  "features.f17Desc": "Create professional offers with PDF generation and send them directly to guests via email.",
  "features.f18Title": "Cross-Reservations",
  "features.f18Desc": "Link reservations across spaces and services. Mark linked bookings as used or invoiced together.",
  "features.offersAndCross": "Offers & Cross-Reservations",
  "features.offersAndCrossDesc": "Create offers, generate branded PDFs, and link reservations across spaces — manage everything together.",

  // Use Cases
  "useCases.badge": "Use Cases",
  "useCases.heroTitle": "Built for Every Type of Hospitality Business",
  "useCases.heroSubtitle": "See how MimmoBook solves booking challenges for restaurants, venues, hotels, guesthouses, caterers, and popup events.",
  "useCases.challengesLabel": "Common Challenges",
  "useCases.solutionLabel": "How MimmoBook Helps",
  "useCases.restaurant": "Restaurant Reservations",
  "useCases.restaurantDesc": "Restaurants need to manage table bookings, walk-ins, set menus, and special dietary requirements while keeping track of guest preferences and no-show rates.",
  "useCases.restaurantChallenges": "Phone-based booking is time-consuming and error-prone. Peak hours create bottlenecks. No-shows waste capacity. Manual tracking misses guest preferences and special requests.",
  "useCases.restaurantSolution": "MimmoBook provides a branded online booking page where guests self-serve. Automated confirmations and reminders reduce no-shows. All guest data, dietary notes, and preferences are stored in one place.",
  "useCases.venue": "Venue & Event Bookings",
  "useCases.venueDesc": "Event venues need to coordinate space availability, equipment, catering, and staffing while managing multiple bookings and client communications.",
  "useCases.venueChallenges": "Double-bookings when using email or phone. Complex logistics across multiple spaces. Scattered communication with clients. Difficulty tracking revenue per event type.",
  "useCases.venueSolution": "MimmoBook's resource management prevents double-bookings. Each venue space has its own availability calendar. Automated emails keep clients informed. Reports show revenue by event type.",
  "useCases.hotel": "Hotel Room Reservations",
  "useCases.hotelDesc": "Hotels need to manage room availability, check-in/check-out, room types, pricing tiers, and breakfast options while providing a professional booking experience.",
  "useCases.hotelChallenges": "Managing room inventory across room types. Tracking check-in/check-out manually. Coordinating breakfast options and pricing. Providing a professional booking experience without expensive systems.",
  "useCases.hotelSolution": "MimmoBook supports room-type pricing, bed configurations, breakfast options, and check-in/check-out tracking. The branded booking page gives guests a professional reservation experience.",
  "useCases.guesthouse": "Guesthouse Bookings",
  "useCases.guesthouseDesc": "Guesthouses and B&Bs need a simple system to manage guest stays, availability, and communication without the complexity of enterprise hotel software.",
  "useCases.guesthouseChallenges": "Enterprise hotel systems are too complex and expensive. Spreadsheets and phone bookings miss reservations. No automated guest communication. Difficult to show availability online.",
  "useCases.guesthouseSolution": "MimmoBook offers a simple, affordable booking system sized for guesthouses. Guests book directly through your branded page. Automated emails handle confirmations and reminders.",
  "useCases.catering": "Catering Orders",
  "useCases.cateringDesc": "Catering businesses need to manage delivery details, menu selections, dietary requirements, and event-specific logistics for every order.",
  "useCases.cateringChallenges": "Order details get lost in email chains. Dietary requirements are missed. No centralized view of upcoming orders. Manual coordination wastes time.",
  "useCases.cateringSolution": "MimmoBook captures all catering details in structured booking forms. Delivery addresses, dietary notes, and guest counts are stored per order. The dashboard shows all upcoming catering events.",
  "useCases.popup": "Popup Events & Markets",
  "useCases.popupDesc": "Popup event organizers need to manage vendor applications, stall assignments, and event logistics across temporary locations.",
  "useCases.popupChallenges": "Vendor management is chaotic via email. Stall assignments are tracked manually. No centralized view of vendor details and requirements. Fee tracking is inconsistent.",
  "useCases.popupSolution": "MimmoBook's popup reservation type captures stall size, fees, equipment needs, and vendor details. Organizers see all applications in one dashboard with approval workflows.",
  "useCases.ctaTitle": "Find Your Use Case?",
  "useCases.ctaSubtitle": "Start your free 30-day trial and set up your first booking page in minutes.",

  // Blog
  "blog.badge": "Blog",
  "blog.heroTitle": "Hospitality Insights & Guides",
  "blog.heroSubtitle": "Tips, best practices, and insights for hospitality businesses managing reservations.",
  "blog.readMore": "Read more",
  "blog.backToBlog": "Back to Blog",
  "blog.postCta": "Ready to streamline your reservations?",
  "blog.ctaTitle": "Stay Up to Date",
  "blog.ctaSubtitle": "Try MimmoBook free for 30 days and see how it transforms your booking management.",
  "blog.catInsights": "Insights",
  "blog.catGuides": "Guides",
  "blog.post1Title": "5 Reservation Challenges Small Hospitality Businesses Face",
  "blog.post1Excerpt": "From no-shows to double bookings, small restaurants, venues and guesthouses face unique challenges. Here's what they are and how to solve them.",
  "blog.post1C1": "Small hospitality businesses, such as restaurants with a handful of tables, boutique venues and family-run guesthouses, face reservation challenges that larger operations solve with dedicated staff and enterprise software. But for a business with 5 to 30 covers or a few rooms, those solutions are overkill.",
  "blog.post1C2": "The first challenge is no-shows. When a four-top doesn't show up at a 20-seat restaurant, that's 20% of capacity gone. Unlike large hotels that absorb no-shows in volume, small businesses feel every empty seat. Automated reminder emails sent 24 hours before a reservation can cut no-show rates by 30 to 50%.",
  "blog.post1C3": "The second challenge is double bookings. When reservations come in via phone, email, Instagram DMs, and walk-ins, it's easy to book the same table or room twice. A centralized booking system with real-time availability eliminates this entirely.",
  "blog.post1C4": "Third, guest communication is inconsistent. Some guests get a confirmation email, others don't. Some get reminders, some are forgotten. Automated email flows ensure every guest receives the same professional experience regardless of how busy the staff is.",
  "blog.post1C5": "Fourth, tracking revenue is manual and error-prone. Small businesses often use spreadsheets or paper to track bookings and payments, making it hard to know actual occupancy rates, average booking values, or seasonal trends. A booking system with built-in reporting solves this. Fifth, online visibility suffers. Without a professional booking page, potential guests can't easily find availability or make reservations, and they move on to competitors who offer online booking.",
  "blog.post2Title": "Why Spreadsheets Fail for Booking Management",
  "blog.post2Excerpt": "Spreadsheets are flexible but they create problems when used for reservation management. Here's why dedicated software is worth the switch.",
  "blog.post2C1": "Spreadsheets are the default tool for many small businesses. They're free, flexible, and familiar. But when used for reservation management, they create problems that grow worse over time.",
  "blog.post2C2": "The biggest issue is that spreadsheets are not real-time. When two staff members update the same sheet, conflicts happen. When a guest books by phone while someone else is editing the document, data gets lost. There's no live availability view, so staff must manually check before confirming each booking.",
  "blog.post2C3": "Spreadsheets also can't send emails. Every confirmation, reminder, and cancellation must be handled manually. This takes time, introduces errors, and creates an inconsistent guest experience. A dedicated booking system automates all guest communication.",
  "blog.post2C4": "Finally, spreadsheets don't provide analytics. You can't easily see occupancy rates, booking trends, or revenue by reservation type without building complex formulas. Booking software generates these reports automatically, helping you make data-driven decisions about staffing, pricing, and marketing.",
  "blog.post3Title": "Why Branded Booking Pages Matter for Your Business",
  "blog.post3Excerpt": "A generic booking form tells guests nothing about your brand. A branded booking page builds trust and increases conversions.",
  "blog.post3C1": "When a guest visits your booking page, it's often their first interaction with your business online. If that page is a generic form with no branding, it sends the wrong message. It looks unprofessional and doesn't build confidence.",
  "blog.post3C2": "A branded booking page with your logo, colors, hero image, and business description creates a professional first impression. Guests immediately know they're in the right place. It builds trust before they even make a reservation. Studies show that branded booking experiences have 20 to 40% higher conversion rates than generic forms.",
  "blog.post3C3": "MimmoBook lets every business customize their booking page with their own branding. Upload your logo, set your brand colors, add a hero image, and write a description. The result is a booking experience that feels like an extension of your website, not a third-party tool.",
  "blog.post4Title": "Managing Reservations Across Multiple Locations",
  "blog.post4Excerpt": "Multi-site hospitality businesses need centralized tools. Here's how to manage bookings across locations without losing control.",
  "blog.post4C1": "Running multiple hospitality locations, whether it's a restaurant group, a chain of guesthouses, or venues in different cities, multiplies the complexity of reservation management. Each location has its own availability, staff, branding, and guest base.",
  "blog.post4C2": "The challenge is maintaining consistency while respecting each location's unique needs. A centralized system lets you manage all locations from one dashboard while keeping separate booking pages, staff permissions, and reports per site.",
  "blog.post4C3": "MimmoBook's multi-site feature is designed for this. Each site gets its own branded booking page, its own staff assignments, and its own reporting. But owners and admins can switch between sites from a single account, compare performance, and manage settings centrally.",
  "blog.post4C4": "The key benefit is visibility. Instead of logging into separate systems or checking multiple spreadsheets, you see all your locations in one place. Reservation trends, revenue comparisons, and staffing needs become clear at a glance.",

  // Nav new pages
  "nav.features": "Features",
  "nav.useCases": "Use Cases",
  "nav.blog": "Blog",
  "nav.whatIs": "What Is MimmoBook?",
  "nav.offers": "Offers",
  "nav.kitchen": "Kitchen",
  "nav.bookingLog": "Booking log",
  "bookingLog.title": "Booking validation log",
  "bookingLog.tooltip": "Every booking attempt is recorded here with capacity context, so you can see exactly why a request was accepted, warned about, or rejected.",
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
  "bookingLog.softWarningToast": "Booking saved, but this date is near or above capacity.",

  "kitchen.title": "Kitchen Orders",
  "kitchen.tooltip": "Track food, drink, and other orders for restaurant and venue reservations",
  "kitchen.date": "Date",
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
  "kitchen.menu.empty": "No menu items yet. Add common items to insert them quickly into orders.",
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

  // Tier limit errors
  "tierError.STAFF_USER_LIMIT_REACHED": "Your plan allows up to {limit} staff users. Upgrade to add more team members.",
  "tierError.SITE_LIMIT_REACHED": "Your plan allows up to {limit} site. Upgrade to Business to manage multiple locations.",
  "tierError.RESERVATION_TYPE_LIMIT_REACHED": "Your plan allows up to {limit} reservation type. Upgrade to unlock additional booking categories.",
  "tierError.RESOURCE_PER_TYPE_LIMIT_REACHED": "Your plan allows only {limit} resource per type. Upgrade to Business for unlimited resources.",
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
  "common.guests": "vierasta",
  "common.date": "Päivämäärä",
  "common.noResults": "Ei tuloksia.",
  "common.selectAll": "Valitse kaikki",

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
  "reports.uninvoicedAlert": "{count} ei laskutettu kaikista {total}, {amount} ei laskutettu",
  "reports.breakfastAlert": "{count} varausta, {nights} yötä, arvioitu aamupalatulo {amount}",
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
  "settings.upsellTitle": "Hallinnoi useita toimipisteitä",
  "settings.upsellDesc": "Päivitä Business-suunnitelmaan hallinnoidaksesi hotelleja, ravintoloita ja juhlatiloja yhdestä hallintapaneelista. Jokaisella on omat resurssit, aukioloajat ja varaussivu.",
  "settings.learnMore": "Lue lisää",
  "settings.siteOverride": "Toimipisteen mukautus",
  "settings.useParentDefault": "Käytä yrityksen oletusarvoja",
  "settings.customizeForSite": "Mukauta tälle toimipisteelle",
  "settings.inheritedFromParent": "Peritty yrityksen asetuksista",
  "settings.siteSettingsSaved": "Toimipisteen asetukset tallennettu",
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
   "settings.resourceTypeNames": "Varauskohteiden nimet",
   "settings.resourceTypeNamesDesc": "Anna omat näyttönimet varauskohteillesi. Nämä nimet näkyvät julkisella varaussivulla.",
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
  "booking.closedDay": "Suljettu tänä päivänä.",
  "days.monday": "Maanantai",
  "days.tuesday": "Tiistai",
  "days.wednesday": "Keskiviikko",
  "days.thursday": "Torstai",
  "days.friday": "Perjantai",
  "days.saturday": "Lauantai",
  "days.sunday": "Sunnuntai",
  "openingHours.tooltip": "Aseta oletusaukioloajat varaustyypeittäin. Nämä näkyvät julkisella varaussivulla käytettävissä olevina aikoina. Kun luot uuden toimipisteen, nämä oletukset kopioidaan automaattisesti.",
  "openingHours.siteTooltip": "Nämä aukioloajat koskevat vain tätä toimipistettä. Ne ohittavat organisaation oletusasetukset.",
  "openingHours.siteOverride": "Toimipistekohtaiset aukioloajat (ohittaa oletukset)",
  "openingHours.usingDefaults": "Käytetään organisaation oletusarvoja. Tallenna luodaksesi toimipistekohtaiset aukioloajat.",
  "openingHours.resetToDefaults": "Palauta oletukset",
  "openingHours.resetConfirm": "Tämä poistaa toimipistekohtaiset aukioloajat ja palauttaa organisaation oletukset.",
  "openingHours.resetDone": "Aukioloajat palautettu organisaation oletuksiin",
  "resourceHours.title": "Aukioloajat",
  "resourceHours.sameEveryDay": "Sama joka päivä",
  "resourceHours.perDay": "Päiväkohtainen",
  "resourceHours.openTime": "Avautuu",
  "resourceHours.closeTime": "Sulkeutuu",
  "resourceHours.sameEveryDayDesc": "Samat ajat kaikille avoimille päiville. Voit sulkea yksittäisiä päiviä alla.",
  "resourceHours.removeHours": "Poista aukioloajat",
  "resourceHours.saveFirst": "Tallenna resurssi ensin, sitten voit muokata aukioloaikoja.",
  "resourceHours.openingHoursLabel": "Aukioloajat",
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
  "booking.dateBlocked": "Tämä päivä ei ole varattavissa.",
  "booking.timeBlocked": "Tämä aikaväli ei ole varattavissa.",
  "booking.blocked": "Estetty",
  "booking.fixedPricePlaceholder": "esim. 45,00",
  "booking.thankYou": "Kiitos!",
  "booking.confirmationMsg": "Varauksesi on vastaanotettu. Saat vahvistusviestin lähettäjältä {name}.",
  "booking.checkSpam": "Jos et näe sähköpostia saapuneissa, tarkista roskaposti- tai roskapostikansio.",
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
  "booking.subTypePopupDesc": "Tarvitsetko ruokatarjoilua tapahtumaasi? Tulemme mielellämme!",
  "booking.cateringQuoteDesc": "Kerro tapahtumastasi, niin laadimme sinulle räätälöidyn tarjouksen.",
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
  "admin.staffLimitReached": "Henkilökunnan käyttäjäraja saavutettu. Päivitä sopimustasi lisätäksesi käyttäjiä.",
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
  "admin.permissionCol": "Oikeus",
  "admin.permTooltip": "Määritä mitä kukin rooli voi käyttää. Omistajalla on aina täydet oikeudet. Vaihda yksittäisiä oikeuksia Admin-, Staff- ja mukautetuille rooleille.",
  "admin.deleteRoleTitle": "Poistetaanko rooli \"{name}\"?",
  "admin.deleteRoleDesc": "Tämä poistaa pysyvästi tämän mukautetun roolin ja kaikki sen oikeudet. Tähän rooliin määritetyt käyttäjät menettävät pääsynsä.",
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
  "hero.title": "Majoitus- ja ravitsemusalan",
  "hero.titleHighlight": "varausten hallintatyökalu",
  "hero.subtitle": "Käsittele ja hoida ravintolavarauksia, tapahtumapaikkojen tiedusteluja sekä hotelli- tai majatalovarauksia yhden hallintapaneelin avulla. Voit luoda omat brändätyt varaussivut, lähettää automaattisia sähköposteja vahvistuksiin. Hintaan sisältyy myös käyttäjähallinta.",
  "hero.viewPricing": "Näytä hinnat",

  // Features
  "features.title": "Kaikki mitä tarvitset varaustesi hallintaan",
  "features.subtitle": "Täydellinen varaussivusto majoitus- ja ravitsemusalan yrityksille.",
  "features.smartReservations": "Varaukset",
  "features.smartReservationsDesc": "Hoida ravintolavaraukset, tapahtumapaikkojen tiedustelut ja majatalomajoituksia samassa hallintapaneelista.",
  "features.customBranding": "Räätälöi oman brändisi mukaiseksi",
  "features.customBrandingDesc": "Oma logosi, värisi, kuvasi. Jokainen varaussivu yrityksesi brändin mukaisena.",
  "features.teamManagement": "Käyttäjähallinta",
  "features.teamManagementDesc": "Lisää henkilökuntaa, määritä rooleja ja hallinnoi käyttöoikeuksia helposti.",
  "features.brandedPages": "Varaustyypit",
  "features.brandedPagesDesc": "Hotelli/majatalo, ravintola ja tilat tapahtumiin.",
  "features.reportsInsights": "Raportointi",
  "features.reportsInsightsDesc": "Seuraa varauksia, käyttöasteita ja tuloja yhdellä silmäyksellä.",
  "features.automatedEmails": "Automaattiset sähköpostit",
  "features.automatedEmailsDesc": "Lähetä vahvistus-, muistutus- ja peruutussähköpostit automaattisesti.",

  // How it works
  "howItWorks.title": "Käyttöönotto on helppoa ja nopeaa",
  "howItWorks.subtitle": "Kolme helppoa askelta ja voit alkaa vastaanottamaan verkkovarauksia.",
  "howItWorks.step1Title": "Rekisteröidy ja valitse yrityksellesi sopiva palvelupaketti",
  "howItWorks.step1Desc": "Luo tili ja aloita 30 päivän ilmainen kokeilujakso.",
  "howItWorks.step2Title": "Luo yrityksesi alustalle",
  "howItWorks.step2Desc": "Lataa brändisi, lisää toimipisteesi ja toimintasi sekä määritä aukioloajat, hinnoittelu, käyttöaste ja paljon muuta.",
  "howItWorks.step3Title": "Jaa varauslinkkisi",
  "howItWorks.step3Desc": "Lähetä yrityksellesi räätälöity varaussivu asiakkaille ja aloita varausten vastaanottaminen.",

  // Pricing
  "pricing.title": "Yksinkertainen ja läpinäkyvä hinnoittelu",
  "pricing.subtitle": "Aloita 30 päivän ilmaisella kokeilujaksolla. Korota seuraavaan tasoon tai peruuta milloin tahansa.",
  "pricing.simpleTitle": "Yksinkertainen ja läpinäkyvä hinnoittelu",
  "pricing.simpleSubtitle": "Aloita 30 päivän ilmaisella kokeilujaksolla. Korota seuraavaan tasoon tai peruuta milloin tahansa.",
  "pricing.comparePlans": "Vertaile eri tasoja",
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
  "cta.subtitle": "Liity majoitusalan yrityksiin, jotka jo käyttävät MimmoBookia varausten sujuvoittamiseen.",

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
  "login.codeHint": "Beta-, pääsy- tai alennuskoodi — se käytetään kirjautumisen jälkeen.",
  "login.codeRedeemed": "Koodi lunastettu onnistuneesti!",
  "login.codeRedeemFailed": "Koodia ei voitu lunastaa. Voit yrittää uudelleen hallintapaneelista.",

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
  "signup.orContinueWith": "Tai rekisteröidy palvelulla",
  "signup.continueGoogle": "Rekisteröidy Googlella",
  "signup.continueApple": "Rekisteröidy Applella",

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
  "dashboard.sendReminder": "Lähetä muistutus",
  "dashboard.reminderSent": "Muistutus lähetetty",
  "dashboard.reminderSentAt": "Muistutus lähetetty",
  "dashboard.confirmationSentAt": "Vahvistus lähetetty",
  "dashboard.cancellationSentAt": "Peruutus lähetetty",
  "dashboard.reminderError": "Muistutuksen lähetys epäonnistui",
  "dashboard.sendReminderMsg": "Lähetä muistutussähköposti vieraalle tästä varauksesta?",
  "dashboard.notCheckedIn": "Ei kirjautunut",
  "dashboard.todayFilter": "Tänään",
  "dashboard.activeResources": "Aktiiviset resurssit",
  "dashboard.bookingLink": "Varauslinkki",
  "dashboard.bookingLinkDesc": "Jaa tämä linkki asiakkaillesi, jotta he voivat tehdä varauksia.",
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
  "dashboard.noResources": "Ei resursseja vielä. Lisää ensimmäinen huone, pöytä tai tila.",
  "dashboard.capacity": "kapasiteetti",
  "dashboard.perNight": "/yö",
  "dashboard.resourceCreated": "Resurssi luotu",
  "dashboard.resourceUpdated": "Resurssi päivitetty",
  "dashboard.resourceDeleted": "Resurssi poistettu",
  "dashboard.copyResource": "Kopioi resurssi",
  "dashboard.copyResourceDesc": "Kuinka monta kopiota haluat luoda resurssista?",
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
   "dashboard.checkoutToday": "Uloskirjaukset tänään",
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
  "autoReminder.title": "Automaattimuistutukset",
  "autoReminder.tooltip": "Muistutussähköpostit lähetetään automaattisesti 24 tuntia ennen vahvistettua varausta.",
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
  "dashboard.markLinkedUsed": "Merkitäänkö linkitetyt varaukset käytetyiksi?",
  "dashboard.markLinkedUsedMsg": "Tämä varaus on linkitetty tarjoukseen, jossa on muita varauksia. Haluatko merkitä ne kaikki käytetyiksi?",
  "dashboard.markAll": "Merkitse kaikki käytetyiksi",
  "dashboard.markLinkedInvoiced": "Merkitäänkö linkitetyt varaukset laskutetuiksi?",
  "dashboard.markLinkedInvoicedMsg": "Tämä varaus on linkitetty tarjoukseen, jossa on muita varauksia. Haluatko merkitä ne kaikki laskutetuiksi?",
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
  "dashboard.calendarTooltip": "Klikkaa päivää nähdäksesi sen varaukset. Korostetut päivät sisältävät varauksia. Punaiset päivät sisältävät yksittäisiä estoja. Violetit katkoviivapäivät sisältävät toistuvia estoja.",
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
  "dashboard.pricingHint": "Oletushinta uusille varauksille. Yksittäisen varauksen hintaa voi muuttaa sisäisissä tiedoissa.",
  "dashboard.roomTypeLabel": "Huonetyyppi",
  "dashboard.bedConfiguration": "Sänkyjen kokoonpano",
  "dashboard.roomDescription": "Huoneen kuvaus",
  "dashboard.roomDescPlaceholder": "Kuvaile huoneita, sänkyjen määrä, pohjaratkaisu...",
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
  "tier.basicDesc": "Täydellinen yhdelle hotellille, ravintolalle tai tapahtumapaikalle.",
  "tier.pro": "Protaso",
  "tier.proDesc": "Yrityksille, jotka tarjoavat hotelli-, ravintola- ja tapahtumatilapalvelun yhdessä paikassa.",
  "tier.professional": "Professional",
  "tier.professionalDesc": "Useita varaustyyppejä, tiiminhallinta.",
  "tier.business": "Business taso",
  "tier.businessDesc": "Monin ominaisuuksin varusteltu alusta yrityksille, joilla on useampia toimipisteitä ja toimintoja.",

  // Footer
  "footer.tagline": "Moderni varausalusta ravintoloille, tiloille ja majataloille.",
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
  "about.heroSubtitle": "Autamme majoitusalan yrityksiä hallitsemaan varauksiaan vaivattomasti, jotta he voivat keskittyä luomaan unohtumattomia vieraskokemuksia.",
  "about.missionBadge": "Missiomme",
  "about.missionTitle": "Varausten hallinta yksinkertaiseksi ja helpoksi",
  "about.missionP1": "Pienet majoitusalan yritykset ansaitsevat käytännöllisiä ja informatiivisia työkaluja toimiakseen tehokkaammin. Siksi loimme MimmoBookin.",
  "about.missionP2": "Alustamme yhdistää varaukset, brändäyksen ja raportoinnin yhteen työkaluun, poistaen hajallaan olevat muistivihot ja unohtuneet varaukset.",
  "about.point1Title": "Nopeutta ilman kompromisseja",
  "about.point1Desc": "Saat brändätyn varaussivun käyttöön päivässä tai kahdessa, ei viikoissa.",
  "about.point2Title": "Tietoon perustuvat päätökset",
  "about.point2Desc": "Seuraa varauksia, käyttöastetta ja liikevaihtoa yhdellä silmäyksellä.",
  "about.point3Title": "Rakennettu tiimeille",
  "about.point3Desc": "Roolipohjainen pääsy ja monihenkilöstötuki sisäänrakennettuna.",
  "about.valuesTitle": "Ydinarvomme",
  "about.valuesSubtitle": "Ohjaamme päivittäistä toimintaamme ja teemme päätöksiä näiden periaatteiden mukaisesti tuotesuunnittelusta asiakastukeen.",
  "about.valuePrecision": "Tarkkuus",
  "about.valuePrecisionDesc": "Jokainen yksityiskohta on tärkeä pikselin tarkoista varaussivuista ajantasaisiin saatavuuskalentereihin.",
  "about.valueInnovation": "Innovaatio",
  "about.valueInnovationDesc": "Parannamme alustaamme jatkuvasti. Kaipaamme käyttäjien palautetta, jotta voimme tehdä alustasta entistä paremman.",
  "about.valueCollaboration": "Yhteistyö",
  "about.valueCollaborationDesc": "Teemme tiivistä yhteistyötä hotelli- ja ravintola-alan yritysten kanssa ymmärtääksemme heidän todellisia tarpeita.",
  "about.valueTrust": "Luottamus",
  "about.valueTrustDesc": "Tietosi ovat turvassa. Noudatamme GDPR-standardeja ja parhaita turvallisuuskäytäntöjä.",
  "about.valuePassion": "Intohimo",
  "about.valuePassionDesc": "Olemme intohimoisia auttamaan pieniä yrityksiä menestymään hotelli- ja ravintola-alalla.",
  "about.valueGlobal": "Saavutettavuus",
  "about.valueGlobalDesc": "Alustamme on monikielinen ja suunniteltu kaikkien saavutettavaksi.",
  "about.ctaTitle": "Oletko valmis yksinkertaistamaan varauksiasi?",
  "about.ctaSubtitle": "Liity hotelli- ja ravintola-alan yritysten joukkoon, jotka jo käyttävät MimmoBookia, virtaviivaistaksesi varauksiasi.",

  "privacy.title": "Tietosuojakäytäntö",
  "privacy.lastUpdated": "Päivitetty viimeksi:",
  "privacy.s1Title": "1. Johdanto",
  "privacy.s1P1": "Tämä tietosuojakäytäntö selittää, miten MimmoBook kerää, käyttää ja suojaa henkilötietojasi. Noudatamme EU:n yleistä tietosuoja-asetusta (GDPR).",
  "privacy.s2Title": "2. Rekisterinpitäjä",
  "privacy.s2P1": "MimmoBook on henkilötietojen rekisterinpitäjä. Tietosuojakyselyissä ota yhteyttä tukisivumme kautta.",
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
  "a11y.s1P1": "MimmoBook on sitoutunut varmistamaan digitaalisen saavutettavuuden kaikille. Parannamme jatkuvasti käyttökokemusta ja noudatamme saavutettavuusstandardeja.",
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
  "password.breached": "Tämä salasana on löytynyt tietovuodoista. Valitse toinen.",
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
  "help.requestSubmittedDetail": "Tukipyyntösi on lähetetty! Ylläpitotiimi tarkistaa sen ja vastaa pian.",
  "help.art1Title": "Aloittaminen",
  "help.art1Desc": "Luo tili ja ensimmäinen varaussivu muutamassa minuutissa.",
  "help.art1C1": "Rekisteröidy 30 päivän ilmaiseen kokeiluun. Luottokorttia ei tarvita.",
  "help.art1C2": "Täytä ohjattu asennus nimetäksesi yrityksesi ja valitaksesi varaustyypit.",
  "help.art1C3": "Mukauta brändi (logo, värit) Asetuksissa.",
  "help.art1C4": "Jaa varauslinkki asiakkaillesi!",
  "help.art2Title": "Varausten hallinta",
  "help.art2Desc": "Selaa, muokkaa, vahvista ja peruuta varauksia hallintapaneelista.",
  "help.art2C1": "Käytä kalenterinäkymää visuaaliseen yleiskatsaukseen.",
  "help.art2C2": "Vaihda listanäkymään suodattaaksesi tilan, tyypin tai päivämäärän mukaan.",
  "help.art2C3": "Napsauta varausta muokataksesi tietoja, lisätäksesi huomioita tai muuttaaksesi tilaa.",
  "help.art2C4": "Vahvistus- ja peruutussähköpostit lähetetään automaattisesti.",
  "help.art3Title": "Sähköpostimallit",
  "help.art3Desc": "Mukauta vieraille lähetettävät vahvistus- ja peruutussähköpostit.",
  "help.art3C1": "Siirry kohtaan Asetukset → Sähköpostimallit muokataksesi sähköpostejasi.",
  "help.art3C2": "Esikatsele sähköpostien ulkoasua ennen lähettämistä.",
  "help.art3C3": "Lisää mukautettuja viestejä vahvistaessa tai peruuttaessa.",
  "help.art3C4": "Sähköpostit tukevat monikielistä sisältöä (EN, FI, SV).",
  "help.art4Title": "Brändi ja varaussivu",
  "help.art4Desc": "Mukauta julkinen varaussivu brändi-identiteettisi mukaiseksi.",
  "help.art4C1": "Lataa logo ja aseta pää-/korostusvärit Asetuksissa.",
  "help.art4C2": "Lisää hero-kuva varaussivun yläosaan.",
  "help.art4C3": "Varaussivusi on osoitteessa /book/oma-slug.",
  "help.art4C4": "Yrityskuvaus näkyy vieraille varaussivulla.",
  "help.art5Title": "Aukioloajat",
  "help.art5Desc": "Määritä milloin yrityksesi vastaanottaa varauksia kullekin tyypille.",
  "help.art5C1": "Aseta aukioloajat varaustyypeittäin (ravintola, juhlatila, hotelli).",
  "help.art5C2": "Merkitse yksittäiset päivät suljetuksi.",
  "help.art5C3": "Aukioloajat määrittävät käytettävissä olevat ajat varaussivulla.",
  "help.art5C4": "Käytä estettyjä aikoja tilapäiseen sulkemiseen.",
  "help.art6Title": "Resurssit ja huoneet",
  "help.art6Desc": "Hallinnoi huoneita, pöytiä ja juhlatiloja, jotka ovat varattavissa.",
  "help.art6C1": "Lisää resursseja Resurssit-osiossa.",
  "help.art6C2": "Aseta kapasiteetti, hinnoittelu ja kuvaukset kullekin resurssille.",
  "help.art6C3": "Lataa kuvia tilojen esittelyyn varaussivulla.",
  "help.art6C4": "Poista resursseja käytöstä piilottaaksesi ne väliaikaisesti.",
  "help.art7Title": "Henkilöstö ja käyttäjähallinta",
  "help.art7Desc": "Kutsu tiimin jäseniä ja hallinnoi rooleja ja käyttöoikeuksia.",
  "help.art7C1": "Omistajat voivat kutsua henkilöstöä Hallinta-paneelista.",
  "help.art7C2": "Roolit: Omistaja (täysi pääsy), Admin (resurssien hallinta), Henkilöstö (varausten tarkastelu).",
  "help.art7C3": "Hyväksy tai poista tiimin jäseniä milloin tahansa.",
  "help.art7C4": "Jokaisella tilauksella on henkilöstöraja. Päivitä lisätäksesi.",
  "help.art8Title": "Tilaukset ja laskutus",
  "help.art8Desc": "Tutustu hinnoittelutasoihin ja hallinnoi tilaustasi.",
  "help.art8C1": "Basic (29 €/kk): 1 tyyppi, 1–5 henkilöä, AI-chatbot-tuki.",
  "help.art8C2": "Pro (79 €/kk): Kaikki tyypit, jopa 25 henkilöä, mukautetut mallit, AI-chatbot-tuki.",
  "help.art8C3": "Business (199 €/kk): Kaikki tyypit, rajaton henkilöstö, prioriteettituki 24h vasteajalla.",
  "help.art8C4": "Päivitä tai alenna milloin tahansa. Muutokset astuvat voimaan seuraavalla laskutuskaudella.",
  "help.art9Title": "Usein kysytyt kysymykset",
  "help.art9Desc": "Vastauksia yleisimpiin kysymyksiin MimmoBookista.",
  "help.art9C1": "K: Tarvitsenko luottokortin kokeiluun? V: Ei!",
  "help.art9C2": "K: Voinko käyttää omaa verkkotunnusta? V: Omat verkkotunnukset ovat suunnitelmissa.",
  "help.art9C3": "K: Miten vieraat saavat vahvistuksen? V: Automaattisesti sähköpostitse vahvistuksen yhteydessä.",
  "help.art9C4": "K: Voinko viedä tietoni? V: Kyllä, raportit voidaan viedä Raportit-paneelista.",
  "help.art10Title": "Mitä uutta",
  "help.art10Desc": "Uusimmat ominaisuudet: vierasportaali, jonotuslista, kalenterisynkronointi, vienti ja muuta.",
  "help.art10C1": "Vierasportaali: vieraat voivat katsoa tai peruuttaa varauksensa maagisella linkillä (/my-booking/:token) — kirjautumista ei tarvita.",
  "help.art10C2": "Jonotuslista: kun vuoro on täynnä, vieraat voivat liittyä jonoon ja saavat automaattisen ilmoituksen, kun paikka vapautuu.",
  "help.art10C3": "Google-kalenterisynkronointi: tilaa varauksesi iCal-syötteellä (Asetukset → Kalenterisynkronointi). CSV/PDF-vienti Varauksista ja Raporteista.",
  "help.art10C4": "Hallintapaneelin parannukset: tumma teema, pikanäppäimet (paina ?), pikatoimintojen FAB mobiilissa, käyttöönoton tarkistuslista, audit-lokin suodattimet, analytiikkakaaviot, kirjautumisen rate-rajoitus, varmuuskopion tilailmaisin, julkiset arvostelut/suosittelut, monikielinen julkinen varaussivu ja Stripe-tulospaneeli pääkäyttäjille.",
  "help.guide1Q": "Miten hallitsen varauksia?",
  "help.guide1A": "Siirry kohtaan **Hallintapaneeli → Varaukset** selataksesi, suodattaaksesi, muokataksesi ja hallinnoitsesi kaikkia varauksia.",
  "help.guide2Q": "Miten mukautan varaussivua?",
  "help.guide2A": "Siirry **Asetuksiin** hallintapaneelissa. Lataa logo, aseta brändivärit ja lisää hero-kuva.",
  "help.guide3Q": "Miten asetan sähköpostimallit?",
  "help.guide3A": "Kohdassa **Asetukset → Sähköpostimallit** voit mukauttaa vahvistus- ja peruutussähköpostit.",
  "help.guide4Q": "Miten lisään henkilöstöä?",
  "help.guide4A": "Siirry kohtaan **Hallinta → Käyttäjät** kutsuaksesi uutta henkilöstöä. Voit asettaa rooleja ja hyväksyä tai poistaa jäseniä.",
  "help.guide5Q": "Miten lisään tai muokkaan resursseja?",
  "help.guide5A": "Siirry kohtaan **Hallintapaneeli → Resurssit** luodaksesi huoneita, pöytiä tai tiloja.",
  "help.guide6Q": "Mitä uutta MimmoBookissa?",
  "help.guide6A": "Viimeisimmät lisäykset: **Vierasportaali** (varauksen hallinta maagisella linkillä), **jonotuslista** automaattisilla ilmoituksilla, **Google-kalenterisynkronointi** iCal-syötteellä, **CSV/PDF-vienti**, **tumma teema**, **pikanäppäimet** (paina `?`), **pikatoimintojen FAB** mobiilissa, **käyttöönoton tarkistuslista**, **audit-lokin suodattimet**, **analytiikkakaaviot**, **julkiset arvostelut/suosittelut** ja **Stripe-tulospaneeli** pääkäyttäjille.",

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
  "aid.chat": "Chat",
  "aid.requests": "Pyynnöt",
  "aid.loadingRequests": "Ladataan pyyntöjä...",
  "aid.noRequests": "Ei tukipyyntöjä vielä.",
  "aid.noRequestsHint": "Lähetä pyyntö chat-näkymästä.",
  "aid.yourMessage": "Viestisi",
  "aid.adminResponse": "Ylläpidon vastaus",
  "aid.awaitingResponse": "Odotetaan ylläpidon vastausta...",
  "aid.requestSubmitted": "Tukipyyntö",
  "aid.requestSubmittedDetail": "Tukipyyntösi on lähetetty! Ylläpitotiimisi käsittelee sen pian. Saat ilmoituksen kun siihen vastataan.",
  "aid.statusOpen": "Avoin",
  "aid.statusInProgress": "Käsittelyssä",
  "aid.statusResolved": "Ratkaistu",
  "aid.statusClosed": "Suljettu",
  "aid.errorNoTenant": "Pyyntöä ei voitu lähettää — vuokralaista ei löytynyt.",
  "aid.errorSubmit": "Pyynnön lähettäminen epäonnistui",
  "aid.successSubmit": "Tukipyyntö lähetetty",
  "aid.errorConnect": "Yhteyttä ei saatu. Yritä uudelleen.",
  "aid.guideQ1": "Miten hallinnoin varauksia?",
  "aid.guideA1": "Siirry **Hallintapaneeli → Varaukset** -näkymään tarkistaaksesi, suodattaaksesi, muokataksesi ja hallinnoidaksesi kaikkia varauksia. Voit vahvistaa tai peruuttaa varauksia toimintovalikosta.",
  "aid.guideQ2": "Miten mukautan varaussivuani?",
  "aid.guideA2": "Siirry hallintapaneelin **Asetukset**-osioon. Lataa logosi, aseta brändivärit ja lisää hero-kuva. Julkinen varaussivusi päivittyy automaattisesti.",
  "aid.guideQ3": "Miten määritän sähköpostimallit?",
  "aid.guideA3": "**Asetukset → Sähköpostimallit** -osiossa voit muokata sekä vahvistus- että peruutussähköposteja. Esikatselu-välilehdeltä näet miltä ne näyttävät vieraille.",
  "aid.guideQ4": "Miten lisään henkilökuntaa?",
  "aid.guideA4": "Siirry **Ylläpito → Käyttäjät** kutsuaksesi uusia henkilökunnan jäseniä. Voit asettaa roolit (Omistaja, Ylläpitäjä, Henkilökunta) ja hyväksyä tai poistaa tiimin jäseniä.",
  "aid.guideQ5": "Miten lisään tai muokkaan resursseja?",
  "aid.guideA5": "Siirry **Hallintapaneeli → Resurssit** luodaksesi huoneita, pöytiä tai tiloja. Voit asettaa kapasiteetin, hinnoittelun, ladata enintään 5 kuvaa ja vaihtaa aktiivi/ei-aktiivi-tilaa.",
  "aid.guideQ6": "Miten asetan aukioloajat?",
  "aid.guideA6": "**Asetukset → Aukioloajat** -osiossa määrität avaamis- ja sulkemisajat jokaiselle viikonpäivälle resurssityypin mukaan. Merkitse päivät suljetuiksi tarvittaessa.",
  "aid.guideQ7": "Miten tarkastelen raportteja?",
  "aid.guideA7": "Siirry **Hallintapaneeli → Raportit** nähdäksesi varaustrendejä, käyttöasteita ja tuloyhteenvetoja. Voit suodattaa ajanjakson mukaan ja tulostaa raportteja.",
  "aid.guideQ8": "Miten huoneiden hinnoittelu toimii?",
  "aid.guideA8": "Aseta **perushinta per yö** jokaiselle resurssille ja määritä **huonetyyppikertoimet** (Yhden hengen 1.0×, Kahden hengen 1.5×, Sviitti 2.5× jne.). Varaussivu laskee summat automaattisesti.",
  "aid.guideQ9": "Miten jaan varauslinkkini?",
  "aid.guideA9": "Julkinen varauslinkkisi näkyy **Hallintapaneelin yleiskatsauksessa**. Klikkaa **Kopioi linkki** kopioidaksesi sen tai avaa se uudessa välilehdessä. Jaa se verkkosivullasi tai sosiaalisessa mediassa.",
   "aid.guideQ10": "Miten estän päivämääriä tai aikavälejä?",
   "aid.guideA10": "**Hallintapaneeli → Kalenteri** -näkymässä klikkaa päivämäärää ja käytä **Estä aika** -toimintoa estääksesi varaukset tietyille päiville, ajoille tai resursseille.",
   "aid.guideQ11": "Miten hallitsen toistuvia estoja?",
   "aid.guideA11": "Siirry **Hallintapaneeli → Kalenteri** ja avaa **Toistuvat estot** -paneeli. Voit luoda viikoittain toistuvia estoja tietyille päiville, aikaväleille ja resurssityypeille (esim. sulkea ravintolan joka maanantai). Vaihda estoja päälle/pois tai poista ne milloin tahansa. Muutokset näkyvät heti julkisella varaussivulla.",
  // Sites
  "sites.title": "Toimipisteet",
  "sites.addSite": "Lisää toimipiste",
  "sites.editSite": "Muokkaa toimipistettä",
  "sites.tooltip": "Hallitse useita toimipisteitä tai kiinteistöjä tilisi alla. Jokaisella toimipisteellä voi olla omat resurssit, aukioloajat ja varaussivu.",
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
  "sites.deleteConfirm": "Tämä poistaa toimipisteen pysyvästi. Siihen liitetyt resurssit jäävät ilman toimipistettä.",
  "sites.noSites": "Ei toimipisteitä vielä. Luo ensimmäinen toimipiste hallitaksesi useita sijainteja.",
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
  "sample.warningWeek": "Ilmainen kokeilujaksosi päättyy {days} päivän kuluttua. Ota yhteyttä tukeen päivittääksesi.",
  "sample.warningDay": "Ilmainen kokeilujaksosi päättyy tänään! Ota yhteyttä tukeen jatkaaksesi.",
  "sample.warningDayTomorrow": "Ilmainen kokeilujaksosi päättyy huomenna! Ota yhteyttä tukeen jatkaaksesi.",
  "sample.readOnly": "Ilmainen kokeilujaksosi on päättynyt. Hallintapaneeli on vain luku -tilassa vielä {days} päivää. Ota yhteyttä tukeen.",
  "sample.blocked": "Ilmainen kokeilujaksosi on päättynyt ja pääsy on estetty. Ota yhteyttä tukeen aktivoidaksesi tilisi.",
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
  "discountCodes.description": "Luo ja hallinnoi kampanja-alennuskoodeja asiakkaillesi.",
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
  "discountCodes.deleteConfirm": "Haluatko varmasti poistaa tämän alennuskoodin? Toimintoa ei voi peruuttaa.",
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
  "emailTemplates.tooltip": "Mukauta vieraille lähetettävien vahvistus-, muistutus- ja peruutussähköpostien aihetta ja sisältöä.",
  "emailTemplates.description": "Mukauta vieraille lähetettäviä vahvistus-, muistutus- ja peruutussähköposteja.",
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
  "emailTemplates.activeToggleDesc": "Kun poistettu käytöstä, käytetään järjestelmän oletusmallia.",
  "emailTemplates.resetDefault": "Palauta oletukseksi",
  "emailTemplates.saved": "Sähköpostimalli tallennettu",
  "emailTemplates.saveError": "Mallin tallennus epäonnistui",
  "emailTemplates.active": "Aktiivinen",
  "emailTemplates.inactive": "Ei aktiivinen",
  "emailTemplates.upgradeHint": "Päivitä Professional- tai Business-tasolle mukauttaaksesi sähköpostimalleja.",
  "emailTemplates.overrideRemoved": "Sivustokohtainen muokkaus poistettu, käytetään oletusmallia",
  "emailTemplates.siteOverride": "Sivustokohtainen",
  "emailTemplates.usingTenantDefault": "Käytetään oletusmallia",
  "emailTemplates.revertToDefault": "Poista sivustokohtainen muokkaus",
  "emailTemplates.siteDescription": "Mukauta sähköpostimalleja tälle sivustolle. Muutokset ohittavat oletusmallit.",

  // Pricing page
  "pricing.heroTitle": "Yksinkertainen ja läpinäkyvä hinnoittelu",
  "pricing.heroSubtitle": "Aloita 30 päivän ilmaisella kokeilujaksolla. Korota seuraavaan tasoon tai peruuta milloin tahansa.",
  "pricing.basicName": "Perustaso",
  "pricing.basicDesc": "Täydellinen yhdelle hotellille, ravintolalle tai tapahtumapaikalle.",
  "pricing.basicTypes": "1 tyyppi",
  "pricing.basicStaff": "1–5",
  "pricing.proName": "Protaso",
  "pricing.proDesc": "Yrityksille, jotka tarjoavat hotelli-, ravintola- ja tapahtumatilapalvelun yhdessä paikassa.",
  "pricing.proTypes": "Käytössä kaikki 3 tyyppiä, 1 kutakin (ei voi vaihtaa esim. kahteen ravintolaan ja yhteen hotelliin)",
  "pricing.proStaff": "Jopa 25",
  "pricing.businessName": "Business taso",
  "pricing.businessDesc": "Monin ominaisuuksin varusteltu alusta yrityksille, joilla on useampia toimipisteitä ja toimintoja.",
  "pricing.businessTypes": "Kaikki 3 tyyppiä, rajoittamaton määrä",
  "pricing.businessStaff": "Rajoittamaton",
  "pricing.basicF1": "Mukautettu brändäys (logo, värit, kuvat)",
  "pricing.basicF2": "Oletussähköpostipohjat",
  "pricing.basicF3": "Aukioloaikojen määritys",
  "pricing.basicF4": "Brändätty varaussivu",
  "pricing.basicF5": "Tekoälyllä toimiva chatbot tuki",
  "pricing.proF1": "Kaikki perustason toiminnot",
  "pricing.proF2": "Mukautetut sähköpostipohjat",
  "pricing.proF3": "Tekoälyllä toimiva chatbot tuki",
  "pricing.businessF1": "Kaikki Protason toiminnot",
  "pricing.businessF2": "Rajoittamaton määrä toimipisteitä, toimintoja ja henkilökuntaa",
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
  "pricing.multiLocationDesc": "Business-paketti tukee rajatonta määrää toimipisteitä ja usean toimipisteen hallintaa. Hallitse hotellejasi, ravintoloitasi ja muita tapahtumapaikkojasi yhdessä näkymässä.",
  "pricing.tryBusinessFree": "Kokeile Businessia ilmaiseksi 30 päivää",
  "pricing.faqQ1": "Mitä tapahtuu 30 päivän kokeilun jälkeen?",
  "pricing.faqA1": "Saat viestin, jossa kerrotaan kokeilusi muuttuvan maksulliseksi tilaukseksi. Voit peruuttaa milloin tahansa ennen kokeilun päättymistä ilman veloitusta. Jos et peruuta, tilaus alkaa. Jos peruutat tilauksen alkamisen jälkeen, sinulta laskutetaan ensimmäinen laskutusjakso, joka on 30 päivää.",
  "pricing.faqQ2": "Voinko vaihtaa suunnitelmaa myöhemmin?",
  "pricing.faqA2": "Kyllä! Voit päivittää tai alentaa suunnitelmasi milloin tahansa. Muutokset tulevat voimaan seuraavan laskutusjakson alussa.",
  "pricing.faqQ3": "Mitä varaustyyppejä voin valita?",
  "pricing.faqA3": "Ravintola (pöytävaraukset), Tila (tilakatsaukset) ja Majatalo (huonevaraukset). Basic antaa valita yhden. Pro avaa kaikki tyypit, yhden kutakin, yhdellä toimipisteellä. Business lisää rajattomat toimipisteet.",
  "pricing.faqQ4": "Voinko käyttää omaa domainia?",
  "pricing.faqA4": "Jokaiselle yritykselle tulee brändätty alidomain (esim. yrityksesi.mimmobook.com). Oman domainin tuki on tiekartalla ja tarjotaan enterprise-hinnoittelulla.",
  "pricing.faqQ5": "Mikä ero on AI-chatbot-tuella ja 24 tunnin vasteajatuella?",
  "pricing.faqA5": "Kaikki suunnitelmat sisältävät MimmoAid-tekoälychatbotin, joka vastaa kysymyksiin, auttaa vianmäärityksessä ja opastaa ominaisuuksissa. Chatbot on käytettävissä 24/7 hallintapaneelissa. Business-suunnitelma lisää 24 tunnin vasteajatuen: voit eskaloida keskustelun tiimiimme alustan kautta chatbotin avulla ja saada taatun vastauksen 24 tunnin sisällä.",

  // Support page
  "support.heroTitle": "Kuinka voimme auttaa?",
  "support.heroSubtitle": "Selaa oppaita, usein kysyttyjä kysymyksiä ja vinkkejä saadaksesi kaiken irti MimmoBookista.",
  "support.searchPlaceholder": "Hae apua...",
  "support.noResults": "Ei tuloksia. Kokeile toista hakusanaa.",
  "support.stillNeedHelp": "Tarvitsetko vielä apua?",
  "support.stillNeedHelpDesc": "Kaikki suunnitelmat sisältävät AI-chatbot-tuen hallintapaneelissa. Business-asiakkaat saavat tukea taatulla 24 tunnin vasteajalla tiimiimme. Taustanäkymästä on myös ladattavissa käyttöopas käytön tueksi.",
  "support.gettingStarted": "Aloitusopas",
  "support.gettingStartedDesc": "Luo tili ja luo ensimmäinen varaussivusi.",
  "support.gettingStartedC1": "Rekisteröidy ilmaiseen 30 päivän kokeilujaksoon.",
  "support.gettingStartedC2": "Suorita käyttöönottotoiminto nimetäksesi yrityksesi ja valitaksesi varaustyypit.",
  "support.gettingStartedC3": "Mukauta brändäystäsi (logo, värit) asetuksissa.",
  "support.gettingStartedC4": "Jaa varauslinkkisi asiakkaiden kanssa!",
  "support.managingRes": "Varausten hallinta",
  "support.managingResDesc": "Katsele, muokkaa, vahvista ja peruuta varauksia kojelaudassasi.",
  "support.managingResC1": "Käytä kalenterinäkymää saadaksesi visuaalisen yleiskatsauksen tulevista varauksista.",
  "support.managingResC2": "Vaihda luettelonäkymään suodattaaksesi tilan, tyypin tai päivämääräalueen mukaan.",
  "support.managingResC3": "Napsauta mitä tahansa varausta muokataksesi tietoja, lisätäksesi muistiinpanoja tai muuttaaksesi tilaa.",
  "support.managingResC4": "Vahvistus- ja peruutussähköpostit lähetetään automaattisesti.",
  "support.emailTemplates": "Sähköpostimallit",
  "support.emailTemplatesDesc": "Yritystason asiakkaat voivat muokata vieraille lähetettäviä vahvistus- ja peruutussähköposteja.",
  "support.emailTemplatesC1": "Siirry kohtaan Asetukset → Sähköpostimallit mukauttaaksesi sähköpostejasi.",
  "support.emailTemplatesC2": "Esikatsele sähköpostien ulkoasua ennen lähettämistä sisäänrakennetun esikatselun avulla.",
  "support.emailTemplatesC3": "Lisää mukautettuja viestejä varausta kohden vahvistaessasi tai peruuttaessasi.",
  "support.emailTemplatesC4": "Sähköpostit tukevat monikielistä sisältöä (EN, FI, SV).",
  "support.brandingTitle": "Asetukset ja toimipaikkojen asetussivut",
  "support.brandingDesc": "Mukauta julkinen varaussivusi brändi-identiteetilläsi.",
  "support.brandingC1": "Lataa logosi ja aseta pää-/tehostevärit asetuksissa.",
  "support.brandingC2": "Lisää pääkuva varaussivusi otsikkoon.",
  "support.brandingC3": "Yrityksen kuvaus näkyy varaussivulla vieraille.",
  "support.brandingC4": "",
  "support.openingHoursTitle": "Aukioloajat",
  "support.openingHoursDesc": "Määritä, milloin yrityksesi hyväksyy varauksia kullekin varaustyypille.",
  "support.openingHoursC1": "Aseta aukioloajat varaustyypeille (ravintola, tapahtumapaikka, hotelli).",
  "support.openingHoursC2": "Mahdollisuus merkitä tietyt tunnit tai päivät suljetuiksi.",
  "support.openingHoursC3": "Aukioloajat määrittävät käytettävissä olevat aikavälit varaussivulla.",
  "support.openingHoursC4": "Käytä suljettuja aikoja sulkeaksesi väliaikaisesti tietyt tunnit tai päivämäärät.",
  "support.resourcesTitle": "Resurssit ja huoneet",
  "support.resourcesDesc": "Hallinnoi varattavissa olevia huoneita, pöytiä ja tapahtumatiloja.",
  "support.resourcesC1": "Lisää resursseja kojelaudan Resurssit-osioon.",
  "support.resourcesC2": "Aseta kapasiteetti, hinnoittelu ja kuvaukset kullekin resurssille.",
  "support.resourcesC3": "Lataa valokuvia esitelläksesi tilojasi varaussivulla.",
  "support.resourcesC4": "Poista resurssit käytöstä piilottaaksesi ne väliaikaisesti varauksista.",
  "support.staffTitle": "Käyttäjähallinta",
  "support.staffDesc": "Kutsu tiimin jäseniä ja hallinnoi rooleja ja käyttöoikeuksia.",
  "support.staffC1": "Omistajat voivat kutsua henkilökuntaa hallintapaneelin kautta.",
  "support.staffC2": "Roolit: Omistaja (täydet oikeudet), Ylläpitäjä (resurssien hallinta), Henkilökunta (varausten tarkastelu).",
  "support.staffC3": "Hyväksy tai poista tiimin jäseniä milloin tahansa.",
  "support.staffC4": "Paketeissa on henkilöstökäyttäjän ja varaustyypin rajoitukset, päivitä lisätäksesi lisää.",
  "support.billingTitle": "Tilaukset ja laskutus",
  "support.billingDesc": "Hinnoitteluportaat ja tilausten hallinnointi.",
  "support.billingC1": "Basic (29 €/kk): 1 varaustyyppi, 1–5 työntekijäkäyttäjää, tekoälychatbot-tuki.",
  "support.billingC2": "Pro (79 €/kk): Kaikki varaustyypit (yksi per tyyppi), jopa 25 työntekijäkäyttäjää, tekoälychatbot-tuki.",
  "support.billingC3": "Business (199 €/kk): Kaikki varaustyypit ja rajoittamaton määrä, rajoittamaton määrä työntekijäkäyttäjiä, prioriteettituki 24 tunnin vasteajalla.",
  "support.billingC4": "Voit päivittää tai alentaa tilausta milloin tahansa. Muutokset tulevat voimaan seuraavalla laskutuskaudella.",
  "support.faqTitle": "Usein kysytyt kysymykset",
  "support.faqDesc": "Vastauksia yleisimpiin MimmoBookia koskeviin kysymyksiin.",
  "support.faqC1": "K: Voinko käyttää omaa verkkotunnustani? V: Mukautetut verkkotunnukset ovat jatkokehityssuunnitelmassamme.",
  "support.faqC2": "K: Miten vieraat saavat vahvistukset? V: Automaattisesti sähköpostitse, kun vahvistat varauksen.",
  "support.faqC3": "K: Voinko tulostaa tietoni? V: Kyllä, raportit voi tulostaa Raportit-paneelista.",
  "support.faqC4": "K: Mitä eroa on tekoälychatbotilla ja prioriteettituella? A: Kaikkiin paketteihin sisältyy MimmoAid, 24/7 toimiva tekoälychatbottimme. Liiketoimintapakettiin lisätään alustalla esitettyihin tukipyyntöihin vuorokauden vastaustakuu.",
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
  "whatIs.heroSubtitle": "MimmoBook on pilvipohjainen varausten hallintajärjestelmä ravintoloille, tapahtumapaikoille, hotelleille ja majataloille. Yksi työkalu kaikkien varaustesi hallintaan.",
  "whatIs.seeFeatures": "Katso kaikki ominaisuudet",
  "whatIs.definitionTitle": "MimmoBook: Varausten hallinta ravintola-alalle",
  "whatIs.definitionP1": "MimmoBook on SaaS-alusta, joka auttaa majoitus- ja ravintola-alan yrityksiä hallitsemaan varauksia verkossa. Riippumatta siitä, pyöritätkö ravintolaa, tapahtuma­paikkaa, hotellia tai majataloa, MimmoBook tarjoaa keskitetyn hallintapaneelin varausten, vierasviestinnän ja liiketoiminnan seurantaan.",
  "whatIs.definitionP2": "Toisin kuin yleiset varaustyökalut, MimmoBook on suunniteltu nimenomaan ravintola-alalle. Se tukee useita varaustyyppejä, kuten pöytävarauksia, huonevarauksia, tilavuokrausta, catering-tilauksia ja popup-tapahtumia, kaikki yhdellä tilillä. Jokainen yritys saa brändätyn varaussivun.",
  "whatIs.definitionP3": "MimmoBook on saatavilla englanniksi, suomeksi ja ruotsiksi, mikä tekee siitä ihanteellisen Pohjoismaissa ja kansainvälisesti toimiville yrityksille. Alusta skaalautuu yksittäisestä ravintolasta usean toimipisteen ravintola-alan konserniin.",
  "whatIs.whoTitle": "Kenelle MimmoBook on tarkoitettu?",
  "whatIs.whoSubtitle": "MimmoBook palvelee kaikenkokoisia ravintola-alan yrityksiä neljässä pääkategoriassa.",
  "whatIs.whoRestaurants": "Ravintolat",
  "whatIs.whoRestaurantsDesc": "Hallitse pöytävarauksia, set-menuja ja vierastoiveita. Käsittele walk-in- ja verkkovaraukset yhdestä hallintapaneelista.",
  "whatIs.whoVenues": "Tapahtumapaikat",
  "whatIs.whoVenuesDesc": "Koordinoi tilavarauksia, laitetarpeita, catering-pyyntöjä ja tapahtuma-aikatauluja automaattisilla vahvistuksilla.",
  "whatIs.whoHotels": "Hotellit",
  "whatIs.whoHotelsDesc": "Hallitse huonevarauksia, sisään-/uloskirjautumista, aamiaisvaihtoehtoja ja huonetyyppihinnoittelua.",
  "whatIs.whoGuesthouses": "Majatalot",
  "whatIs.whoGuesthousesDesc": "Yksinkertaista vierasmajoitusta helppokäyttöisellä huonevarauksella, saatavuuden hallinnalla ja henkilökohtaisella viestinnällä.",
  "whatIs.howTitle": "Miten MimmoBook toimii?",
  "whatIs.howSubtitle": "Aloita neljässä yksinkertaisessa vaiheessa.",
  "whatIs.howStep1": "Rekisteröidy",
  "whatIs.howStep1Desc": "Luo tili ja aloita 30 päivän ilmainen kokeilu. Luottokorttia ei tarvita.",
  "whatIs.howStep2": "Määritä asetukset",
  "whatIs.howStep2Desc": "Aseta yritysprofiilisi, varaustyypit, aukioloajat ja brändäys.",
  "whatIs.howStep3": "Jaa",
  "whatIs.howStep3Desc": "Jaa brändätty varaussivusi vieraille verkkosivusi, sosiaalisen median tai sähköpostin kautta.",
  "whatIs.howStep4": "Hallitse",
  "whatIs.howStep4Desc": "Käsittele kaikki varaukset hallintapaneelista automaattisilla sähköposteilla, raporteilla ja tiimivälineillä.",
  "whatIs.keyFeaturesTitle": "Keskeiset ominaisuudet",
  "whatIs.feat1": "Älykkäät varaukset",
  "whatIs.feat1Desc": "Vastaanota ja hallitse varauksia ravintoloille, tiloille, hotelleille ja majataloille yhdellä alustalla.",
  "whatIs.feat2": "Oma brändäys",
  "whatIs.feat2Desc": "Varaussivusi heijastaa brändiäsi mukautetuilla väreillä, logolla ja kuvilla.",
  "whatIs.feat3": "Tiiminhallinta",
  "whatIs.feat3Desc": "Kutsu henkilökuntaa, määritä rooleja ja hallitse käyttöoikeuksia koko tiimillesi.",
  "whatIs.feat4": "Monikielinen tuki",
  "whatIs.feat4Desc": "Hallintapaneeli ja varaussivut saatavilla englanniksi, suomeksi ja ruotsiksi.",
  "whatIs.feat5": "Raportit ja analytiikka",
  "whatIs.feat5Desc": "Seuraa liikevaihtoa, käyttöastetta ja varaustrendejä vietävillä raporteilla.",
  "whatIs.feat6": "Automaattiset sähköpostit",
  "whatIs.feat6Desc": "Vahvistus-, muistutus- ja peruutussähköpostit lähetetään automaattisesti vieraille.",
  "whatIs.allFeatures": "Katso kaikki ominaisuudet",
  "whatIs.ctaTitle": "Valmiina yksinkertaistamaan varauksesi?",
  "whatIs.ctaSubtitle": "Aloita 30 päivän ilmainen kokeilu tänään. Luottokorttia ei tarvita.",

  // Features Page
  "featuresPage.badge": "Alustan ominaisuudet",
  "featuresPage.heroTitle": "Kaikki mitä tarvitset varausten hallintaan",
  "featuresPage.heroSubtitle": "Varaussivuista raportteihin, MimmoBook tarjoaa täydellisen työkalupakin ravintola-alan varausten hallintaan.",
  "featuresPage.ctaTitle": "Aloita varausten hallinta tänään",
  "featuresPage.ctaSubtitle": "Kokeile kaikkia ominaisuuksia ilmaiseksi 30 päivää. Luottokorttia ei tarvita.",
  "featuresPage.comparePlans": "Vertaa paketteja",
  "features.catReservations": "Varausten hallinta",
  "features.catBranding": "Brändäys ja varaussivut",
  "features.catManagement": "Tiimi- ja liiketoiminnan hallinta",
  "features.catComms": "Viestintä ja raportointi",
  "features.f1Title": "Monityyppiset varaukset",
  "features.f1Desc": "Tuki pöytävarauksille, huonevarauksille, tilavuokraukselle, catering-tilauksille ja popup-tapahtumille yhdellä tilillä.",
  "features.f2Title": "Aukioloajat ja saatavuus",
  "features.f2Desc": "Määritä aukioloajat varaustyyppien mukaan estettävillä aikaväleillä ja toistuvilla sulkemisilla.",
  "features.f3Title": "Automaattiset muistutukset",
  "features.f3Desc": "Vieraat saavat automaattisen muistutussähköpostin ennen varaustaan no-show-tapausten vähentämiseksi.",
  "features.f4Title": "Alennuskoodit",
  "features.f4Desc": "Luo prosentti- tai euromääräisiä alennuskoodeja käyttörajoilla ja päivämäärärajoituksilla.",
  "features.f5Title": "Brändätyt varaussivut",
  "features.f5Desc": "Julkinen varaussivusi näyttää logosi, värisi, pääkuvasi ja yrityskuvauksen.",
  "features.f6Title": "Oma verkkotunnus -valmis",
  "features.f6Desc": "Jokainen yritys saa yksilöllisen varaus-URL:n. Jaa se verkkosivullasi, sosiaalisessa mediassa tai painomateriaaleissa.",
  "features.f7Title": "Monikielinen (EN/FI/SV)",
  "features.f7Desc": "Hallintapaneeli ja varaussivut ovat täysin käännetty englanniksi, suomeksi ja ruotsiksi.",
  "features.f8Title": "Mobiiliresponsiivinen",
  "features.f8Desc": "Varaussivu ja hallintapaneeli toimivat täydellisesti puhelimilla, tableteilla ja pöytäkoneilla.",
  "features.f9Title": "Tiimiroolit ja oikeudet",
  "features.f9Desc": "Kutsu henkilökuntaa omistajiksi, ylläpitäjiksi tai tiimin jäseniksi tarkalla oikeuksien hallinnalla.",
  "features.f10Title": "Resurssien hallinta",
  "features.f10Desc": "Luo ja hallitse huoneita, pöytiä, tapahtumatiloja ja muita varattavia resursseja kuvilla ja kuvauksilla.",
  "features.f11Title": "Usean toimipisteen tuki",
  "features.f11Desc": "Hallitse useita toimipisteitä yhdellä tilillä omalla brändäyksellä, henkilökunnalla ja raportoinnilla per toimipiste.",
  "features.f12Title": "Hyväksyntätyönkulut",
  "features.f12Desc": "Tarkista ja hyväksy varaukset, resurssimuutokset ja estetyt aikavälit ennen niiden julkaisemista.",
  "features.f13Title": "Sähköpostimallit",
  "features.f13Desc": "Mukauta vahvistus-, muistutus- ja peruutussähköpostit varaustyypin ja kielen mukaan.",
  "features.f14Title": "Mukautetut sähköpostimallit",
  "features.f14Desc": "Business-paketin käyttäjät voivat täysin mukauttaa sähköpostien HTML:n omalla brändäyksellään.",
  "features.f15Title": "Raportit ja analytiikka",
  "features.f15Desc": "Liikevaihtoraportit, varaustrendit, käyttöasteet ja CSV-viennit kirjanpitoon.",
  "features.f16Title": "Laskutuksen seuranta",
  "features.f16Desc": "Merkitse varaukset laskutetuiksi ja seuraa laskuttamatonta liikevaihtoa kaikissa varaustyypeissä.",
  "features.f17Title": "Tarjoukset ja ehdotukset",
  "features.f17Desc": "Luo ammattimaisia tarjouksia PDF-muodossa ja lähetä ne suoraan vieraille sähköpostilla.",
  "features.f18Title": "Ristiinvaraukset",
  "features.f18Desc": "Yhdistä varauksia eri tilojen ja palvelujen välillä. Merkitse yhdistetyt varaukset käytetyiksi tai laskutetuiksi yhdessä.",
  "features.offersAndCross": "Tarjoukset ja ristiinvaraukset",
  "features.offersAndCrossDesc": "Luo tarjouksia, generoi brändätyt PDF:t ja yhdistä varauksia tilojen välillä — hallitse kaikkea yhdessä.",

  // Use Cases
  "useCases.badge": "Käyttökohteet",
  "useCases.heroTitle": "Rakennettu kaikenlaisille ravintola-alan yrityksille",
  "useCases.heroSubtitle": "Katso miten MimmoBook ratkaisee varaushaasteet ravintoloille, tiloille, hotelleille, majataloille, cateringille ja popup-tapahtumille.",
  "useCases.challengesLabel": "Yleiset haasteet",
  "useCases.solutionLabel": "Miten MimmoBook auttaa",
  "useCases.restaurant": "Ravintolavaraukset",
  "useCases.restaurantDesc": "Ravintoloiden on hallittava pöytävarauksia, walk-in-asiakkaita, set-menuja ja erityisruokavaliovaatimuksia samalla kun ne seuraavat asiakastoiveita ja no-show-lukuja.",
  "useCases.restaurantChallenges": "Puhelinvaraus on aikaa vievää ja virhealtista. Ruuhka-ajat luovat pullonkauloja. No-showt hukkaavat kapasiteettia. Manuaalinen seuranta menettää asiakastoiveet.",
  "useCases.restaurantSolution": "MimmoBook tarjoaa brändätyn verkkovaraussivun, jossa vieraat palvelevat itseään. Automaattiset vahvistukset ja muistutukset vähentävät no-show-tapauksia. Kaikki asiakastiedot ja toiveet ovat yhdessä paikassa.",
  "useCases.venue": "Tila- ja tapahtumavaraukset",
  "useCases.venueDesc": "Tapahtumapaikkojen on koordinoitava tilojen saatavuutta, laitteita, cateringia ja henkilökuntaa samalla kun ne hallitsevat useita varauksia.",
  "useCases.venueChallenges": "Tuplavaraukset sähköposti- tai puhelinvarausten yhteydessä. Monimutkaiset logistiikkaketjut useiden tilojen välillä. Hajanainen asiakasviestintä. Vaikeus seurata liikevaihtoa tapahtumatyypeittäin.",
  "useCases.venueSolution": "MimmoBookin resurssien hallinta estää tuplavaraukset. Jokaisella tilalla on oma saatavuuskalenteri. Automaattiset sähköpostit pitävät asiakkaat ajan tasalla.",
  "useCases.hotel": "Hotellihuonevaraukset",
  "useCases.hotelDesc": "Hotellien on hallittava huoneiden saatavuutta, sisään-/uloskirjautumista, huonetyyppejä, hinnoittelutasoja ja aamiaisvaihtoehtoja.",
  "useCases.hotelChallenges": "Huoneinventaarion hallinta huonetyypeittäin. Manuaalinen sisään-/uloskirjautumisen seuranta. Aamiaisvaihtoehtojen ja hinnoittelun koordinointi. Ammattimaisen varauskokemus ilman kalliita järjestelmiä.",
  "useCases.hotelSolution": "MimmoBook tukee huonetyyppihinnoittelua, vuodekokoonpanoja, aamiaisvaihtoehtoja ja sisään-/uloskirjautumisen seurantaa. Brändätty varaussivu tarjoaa vieraille ammattimaisen varauskokemuksen.",
  "useCases.guesthouse": "Majatalovaraukset",
  "useCases.guesthouseDesc": "Majatalot ja B&B:t tarvitsevat yksinkertaisen järjestelmän vierasmajoituksen, saatavuuden ja viestinnän hallintaan ilman yritysohjelmistojen monimutkaisuutta.",
  "useCases.guesthouseChallenges": "Yrityshotellijärjestelmät ovat liian monimutkaisia ja kalliita. Taulukot ja puhelinvaraukset menettävät varauksia. Ei automatisoitua vierasviestintää. Saatavuuden näyttäminen verkossa on vaikeaa.",
  "useCases.guesthouseSolution": "MimmoBook tarjoaa yksinkertaisen, edullisen varausjärjestelmän majataloille sopivana. Vieraat varaavat suoraan brändätyn sivun kautta. Automaattiset sähköpostit hoitavat vahvistukset ja muistutukset.",
  "useCases.catering": "Catering-tilaukset",
  "useCases.cateringDesc": "Catering-yritysten on hallittava toimitustietoja, menuvalintoja, erityisruokavaliovaatimuksia ja tapahtumakohtaista logistiikkaa jokaisessa tilauksessa.",
  "useCases.cateringChallenges": "Tilaustiedot hukkuvat sähköpostiketjuihin. Erityisruokavaliovaatimukset jäävät huomaamatta. Ei keskitettyä näkymää tuleviin tilauksiin. Manuaalinen koordinointi hukkaa aikaa.",
  "useCases.cateringSolution": "MimmoBook tallentaa kaikki catering-tiedot rakenteellisiin varauslomakkeisiin. Toimitusosoitteet, ruokavaliotiedot ja vierasmäärät tallennetaan tilauskohtaisesti.",
  "useCases.popup": "Popup-tapahtumat ja markkinat",
  "useCases.popupDesc": "Popup-tapahtumien järjestäjien on hallittava myyjähakemuksia, kojujen jakoa ja tapahtumien logistiikkaa tilapäisissä paikoissa.",
  "useCases.popupChallenges": "Myyjähallinta sähköpostilla on kaoottista. Kojujen jako tehdään manuaalisesti. Ei keskitettyä näkymää myyjätietoihin. Maksuseuranta on epäjohdonmukaista.",
  "useCases.popupSolution": "MimmoBookin popup-varaustyyppi tallentaa kojun koon, maksut, laitetarpeet ja myyjätiedot. Järjestäjät näkevät kaikki hakemukset yhdessä hallintapaneelissa hyväksyntätyönkulujen kanssa.",
  "useCases.ctaTitle": "Löysitkö käyttökohteesi?",
  "useCases.ctaSubtitle": "Aloita ilmainen 30 päivän kokeilu ja luo ensimmäinen varaussivusi minuuteissa.",

  // Blog
  "blog.badge": "Blogi",
  "blog.heroTitle": "Ravintola-alan oivalluksia ja oppaita",
  "blog.heroSubtitle": "Vinkkejä, parhaita käytäntöjä ja oivalluksia ravintola-alan yrityksille varausten hallinnasta.",
  "blog.readMore": "Lue lisää",
  "blog.backToBlog": "Takaisin blogiin",
  "blog.postCta": "Valmiina tehostamaan varaustenhallintaa?",
  "blog.ctaTitle": "Pysy ajan tasalla",
  "blog.ctaSubtitle": "Kokeile MimmoBookia ilmaiseksi 30 päivää ja katso miten se muuttaa varaustenhallintasi.",
  "blog.catInsights": "Oivallukset",
  "blog.catGuides": "Oppaat",
  "blog.post1Title": "5 varaushaastetta, joita pienet ravintola-alan yritykset kohtaavat",
  "blog.post1Excerpt": "No-show-tapauksista tuplavaraukuksiin, pienet ravintolat, tilat ja majatalot kohtaavat ainutlaatuisia haasteita. Tässä ne ja niiden ratkaisut.",
  "blog.post1C1": "Pienet ravintola-alan yritykset, kuten ravintolat muutamalla pöydällä, boutique-tilat ja perhemajatalot, kohtaavat varaushaast­eita, jotka suuremmat toimijat ratkaisevat omistautuneella henkilökunnalla ja yritysohjelmistoilla. Mutta yritykselle, jossa on 5 to 30 asiakaspaikkaa tai muutama huone, nämä ratkaisut ovat ylimitoitettuja.",
  "blog.post1C2": "Ensimmäinen haaste on no-showt. Kun neljän hengen pöytä ei saavu 20-paikkaisessa ravintolassa, se on 20 % kapasiteetista hukassa. Automaattiset muistutussähköpostit 24 tuntia ennen varausta voivat vähentää no-show-lukuja 30 to 50 %.",
  "blog.post1C3": "Toinen haaste on tuplavaraukset. Kun varauksia tulee puhelimitse, sähköpostitse, Instagram-viesteillä ja walk-ineina, on helppoa varata sama pöytä tai huone kahdesti. Keskitetty varausjärjestelmä reaaliaikaisella saatavuudella poistaa tämän ongelman kokonaan.",
  "blog.post1C4": "Kolmanneksi vierasviestintä on epäjohdonmukaista. Jotkut vieraat saavat vahvistussähköpostin, toiset eivät. Automaattiset sähköpostivirrat varmistavat, että jokainen vieras saa saman ammattimaisen kokemuksen.",
  "blog.post1C5": "Neljänneksi liikevaihdon seuranta on manuaalista ja virhealtista. Pienet yritykset käyttävät usein taulukoita tai paperia varausten seuraamiseen. Varausjärjestelmä sisäänrakennetuilla raporteilla ratkaisee tämän. Viidenneksi verkkonäkyvyys kärsii. Ilman ammattimaista varaussivua potentiaaliset vieraat eivät löydä saatavuutta helposti.",
  "blog.post2Title": "Miksi taulukot eivät toimi varaustenhallinnassa",
  "blog.post2Excerpt": "Taulukot ovat joustavia, mutta ne luovat ongelmia varaustenhallinnassa. Tässä miksi omistettu ohjelmisto kannattaa.",
  "blog.post2C1": "Taulukot ovat monien pienyritysten oletustyökalu. Ne ovat ilmaisia, joustavia ja tuttuja. Mutta varaustenhallinnassa ne luovat ongelmia, jotka pahenevat ajan myötä.",
  "blog.post2C2": "Suurin ongelma on, etteivät taulukot ole reaaliaikaisia. Kun kaksi henkilökunnan jäsentä päivittää samaa taulukkoa, syntyy ristiriitoja. Ei ole live-saatavuusnäkymää, joten henkilökunnan on tarkistettava manuaalisesti ennen jokaista vahvistusta.",
  "blog.post2C3": "Taulukot eivät myöskään voi lähettää sähköposteja. Jokainen vahvistus, muistutus ja peruutus on hoidettava manuaalisesti. Omistettu varausjärjestelmä automatisoi kaiken vierasviestinnän.",
  "blog.post2C4": "Lopuksi taulukot eivät tarjoa analytiikkaa. Et voi helposti nähdä käyttöasteita, varaustrendejä tai liikevaihtoa varaustyypeittäin ilman monimutkaisia kaavoja. Varausohjelmisto tuottaa nämä raportit automaattisesti.",
  "blog.post3Title": "Miksi brändätyt varaussivut ovat tärkeitä yrityksellesi",
  "blog.post3Excerpt": "Geneerinen varauslomake ei kerro vieraille mitään brändistäsi. Brändätty varaussivu rakentaa luottamusta ja lisää konversioita.",
  "blog.post3C1": "Kun vieras vierailee varaussivullasi, se on usein heidän ensimmäinen vuorovaikutuksensa yrityksesi kanssa verkossa. Jos sivu on geneerinen lomake ilman brändäystä, se lähettää väärän viestin.",
  "blog.post3C2": "Brändätty varaussivu, logollasi, väreillä, pääkuvalla ja yrityskuvauksella, luo ammattimaisen ensivaikutelman. Tutkimukset osoittavat, että brändätyt varauskokemukset tuottavat 20 to 40 % korkeampia konversioasteita.",
  "blog.post3C3": "MimmoBook antaa jokaisen yrityksen mukauttaa varaussivunsa omalla brändäyksellään. Lataa logosi, aseta brändivärisi, lisää pääkuva ja kirjoita kuvaus. Tulos on varauskokemus, joka tuntuu verkkosivusi jatkeelta.",
  "blog.post4Title": "Varausten hallinta useissa toimipisteissä",
  "blog.post4Excerpt": "Usean toimipisteen ravintola-alan yritykset tarvitsevat keskitettyjä työkaluja. Näin hallitset varauksia eri paikoissa menettämättä hallintaa.",
  "blog.post4C1": "Useiden ravintola-alan toimipisteiden pyörittäminen, olipa kyseessä ravintolaketju, majataloryhmä tai tilat eri kaupungeissa, moninkertaistaa varaushallinnon monimutkaisuuden.",
  "blog.post4C2": "Haasteena on johdonmukaisuuden ylläpitäminen samalla kun kunnioitetaan jokaisen toimipisteen ainutlaatuisia tarpeita. Keskitetty järjestelmä mahdollistaa kaikkien toimipisteiden hallinnan yhdestä hallintapaneelista.",
  "blog.post4C3": "MimmoBookin usean toimipisteen ominaisuus on suunniteltu juuri tähän. Jokainen toimipiste saa oman brändätyn varaussivun, henkilökuntamäärityksensä ja raportointinsa.",
  "blog.post4C4": "Tärkein hyöty on näkyvyys. Sen sijaan, että kirjautuisit erillisiin järjestelmiin tai tarkistaisit useita taulukoita, näet kaikki toimipisteesi yhdessä paikassa.",

  // Nav new pages
  "nav.features": "Ominaisuudet",
  "nav.useCases": "Käyttökohteet",
  "nav.blog": "Blogi",
  "nav.whatIs": "Mikä on MimmoBook?",
  "nav.offers": "Tarjoukset",
  "nav.kitchen": "Keittiö",
  "nav.bookingLog": "Varausloki",
  "bookingLog.title": "Varausten validointiloki",
  "bookingLog.tooltip": "Jokainen varausyritys tallennetaan tähän kapasiteettitietoineen, joten näet tarkasti miksi pyyntö hyväksyttiin, sai varoituksen tai hylättiin.",
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
  "bookingLog.softWarningToast": "Varaus tallennettu, mutta päivä on lähellä kapasiteetin rajaa tai sen yli.",

  "kitchen.title": "Keittiötilaukset",
  "kitchen.tooltip": "Seuraa ruoka-, juoma- ja muita tilauksia ravintola- ja juhlatilavarauksille",
  "kitchen.date": "Päivämäärä",
  "kitchen.today": "Tänään",
  "kitchen.noReservations": "Ei ravintola- tai juhlatilavarauksia tälle päivälle.",
  "kitchen.noOrders": "Ei tilauksia vielä. Lisää ensimmäinen tuote alle.",
  "kitchen.addItem": "Lisää tuote",
  "kitchen.itemName": "Tuote",
  "kitchen.itemNamePlaceholder": "esim. Caesar-salaatti",
  "kitchen.quantity": "Määrä",
  "kitchen.category": "Kategoria",
  "kitchen.status": "Tila",
  "kitchen.notes": "Huomautukset",
  "kitchen.notesPlaceholder": "Valinnaiset huomautukset (allergiat, muutokset...)",
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
  "kitchen.menu.empty": "Ei vielä menutuotteita. Lisää usein käytettyjä tuotteita nopeaa tilaamista varten.",
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
  "offers.tooltip": "Luo ja hallinnoi tarjouksia tapahtumille ja ryhmävarauksille",
  "offers.create": "Uusi tarjous",
  "offers.edit": "Muokkaa tarjousta",
  "offers.empty": "Ei tarjouksia vielä",
  "offers.noResults": "Hakuasi vastaavia tarjouksia ei löytynyt",
  "offers.searchPlaceholder": "Hae tarjouksia...",
  "offers.showArchived": "Näytä arkistoidut",
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

  // Tier-rajojen virheet
  "tierError.STAFF_USER_LIMIT_REACHED": "Tilauksesi sallii enintään {limit} käyttäjää. Päivitä lisätäksesi tiimiläisiä.",
  "tierError.SITE_LIMIT_REACHED": "Tilauksesi sallii enintään {limit} toimipisteen. Päivitä Business-tasoon hallitaksesi useita.",
  "tierError.RESERVATION_TYPE_LIMIT_REACHED": "Tilauksesi sallii enintään {limit} varaustyypin. Päivitä lisätäksesi varauskategorioita.",
  "tierError.RESOURCE_PER_TYPE_LIMIT_REACHED": "Tilauksesi sallii vain {limit} resurssin per tyyppi. Päivitä Business-tasoon saadaksesi rajattomat resurssit.",
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
  "common.guests": "gäster",
  "common.date": "Datum",
  "common.noResults": "Inga resultat hittades.",
  "common.selectAll": "Välj alla",

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
  "reports.uninvoicedAlert": "{count} ej fakturerade av {total}, {amount} ej fakturerat",
  "reports.breakfastAlert": "{count} bokningar, {nights} nätter, beräknad frukostintäkt {amount}",
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
  "settings.upsellTitle": "Hantera flera platser",
  "settings.upsellDesc": "Uppgradera till Business-planen för att hantera hotell, restauranger och evenemangslokaler från en enda instrumentpanel. Var och en med egna resurser, öppettider och bokningssida.",
  "settings.learnMore": "Läs mer",
  "settings.siteOverride": "Platsanpassning",
  "settings.useParentDefault": "Använd företagets standard",
  "settings.customizeForSite": "Anpassa för denna plats",
  "settings.inheritedFromParent": "Ärvd från företagsinställningar",
  "settings.siteSettingsSaved": "Platsinställningar sparade",
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
   "settings.resourceTypeNames": "Namn på bokningstyperna",
   "settings.resourceTypeNamesDesc": "Ge egna visningsnamn åt dina bokningstyper. Dessa namn visas på den offentliga bokningssidan.",
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
  "booking.closedDay": "Stängt denna dag.",
  "days.monday": "Måndag",
  "days.tuesday": "Tisdag",
  "days.wednesday": "Onsdag",
  "days.thursday": "Torsdag",
  "days.friday": "Fredag",
  "days.saturday": "Lördag",
  "days.sunday": "Söndag",
  "openingHours.tooltip": "Ange standardöppettider per bokningstyp. Dessa används på den publika bokningssidan för att bestämma tillgängliga tider. När du skapar en ny plats kopieras dessa standardvärden automatiskt.",
  "openingHours.siteTooltip": "Dessa öppettider gäller bara för denna plats. De åsidosätter organisationens standardvärden.",
  "openingHours.siteOverride": "Platsspecifika öppettider (åsidosätter standard)",
  "openingHours.usingDefaults": "Använder organisationens standardvärden. Spara för att skapa platsspecifika öppettider.",
  "openingHours.resetToDefaults": "Återställ till standard",
  "openingHours.resetConfirm": "Detta raderar platsspecifika öppettider och återgår till organisationens standardvärden.",
  "openingHours.resetDone": "Öppettider återställda till organisationens standardvärden",
  "resourceHours.title": "Öppettider",
  "resourceHours.sameEveryDay": "Samma varje dag",
  "resourceHours.perDay": "Per dag",
  "resourceHours.openTime": "Öppnar",
  "resourceHours.closeTime": "Stänger",
  "resourceHours.sameEveryDayDesc": "Samma tider gäller alla öppna dagar. Stäng enskilda dagar nedan.",
  "resourceHours.removeHours": "Ta bort öppettider",
  "resourceHours.saveFirst": "Spara resursen först, redigera sedan för att ställa in öppettider.",
  "resourceHours.openingHoursLabel": "Öppettider",
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
  "booking.dateBlocked": "Detta datum är inte tillgängligt för bokning.",
  "booking.timeBlocked": "Denna tidslucka är inte tillgänglig för bokning.",
  "booking.blocked": "Blockerad",
  "booking.fixedPricePlaceholder": "t.ex. 45,00",
  "booking.thankYou": "Tack!",
  "booking.confirmationMsg": "Din bokning har mottagits. Du kommer att få ett bekräftelsemail från {name}.",
  "booking.checkSpam": "Om du inte ser e-postmeddelandet i din inkorg, kontrollera din skräppost- eller skräppostmapp.",
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
  "booking.subTypePopupDesc": "Behöver du matservering på ditt evenemang? Vi kommer gärna!",
  "booking.cateringQuoteDesc": "Berätta om ditt evenemang så tar vi fram en skräddarsydd offert åt dig.",
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
  "admin.staffLimitReached": "Personalanvändargränsen har nåtts. Uppgradera din plan för att lägga till fler användare.",
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
  "admin.permissionCol": "Behörighet",
  "admin.permTooltip": "Definiera vad varje roll kan komma åt. Ägaren har alltid full åtkomst. Växla individuella behörigheter för Admin, Personal och anpassade roller.",
  "admin.deleteRoleTitle": "Ta bort rollen \"{name}\"?",
  "admin.deleteRoleDesc": "Detta tar permanent bort denna anpassade roll och alla dess behörigheter. Användare som tilldelats denna roll förlorar sin åtkomst.",
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
  "hero.title": "Verktyg för hantering av",
  "hero.titleHighlight": "bokning av boende och catering",
  "hero.subtitle": "Bearbeta och hantera restaurangbokningar, förfrågningar om lokaler och hotell- eller gästhusbokningar från en enda instrumentpanel. Du kan skapa dina egna varumärkesbaserade bokningssidor, skicka automatiserade e-postmeddelanden för bekräftelser och användarhantering ingår.",
  "hero.viewPricing": "Se priser",

  // Features
  "features.title": "Allt du behöver för att hantera dina bokningar",
  "features.subtitle": "Den kompletta bokningswebbplatsen för boende- och cateringföretag.",
  "features.smartReservations": "Bokningar",
  "features.smartReservationsDesc": "Hantera restaurangbokningar, förfrågningar om lokaler och boende på värdshus från en enda instrumentpanel.",
  "features.customBranding": "Anpassa till ditt varumärke",
  "features.customBrandingDesc": "Din egen logotyp, färger och bilder. Varje bokningssida är varumärkesanpassad till ditt företag.",
  "features.teamManagement": "Användarhantering",
  "features.teamManagementDesc": "Lägg enkelt till personal, tilldela roller och hantera behörigheter.",
  "features.brandedPages": "Bokningstyper",
  "features.brandedPagesDesc": "Hotell/pensionat, restaurang och evenemangslokaler.",
  "features.reportsInsights": "Rapportering",
  "features.reportsInsightsDesc": "Spåra bokningar, beläggning och intäkter med en snabb blick.",
  "features.automatedEmails": "Automatiserade e-postmeddelanden",
  "features.automatedEmailsDesc": "Skicka bekräftelse-, påminnelse- och avbokningsmejl automatiskt.",

  // How it works
  "howItWorks.title": "Igång på några minuter",
  "howItWorks.subtitle": "Tre enkla steg för att börja ta emot onlinebokningar.",
  "howItWorks.step1Title": "Registrera ditt företag och välj ditt mjukvaruplan",
  "howItWorks.step1Desc": "Skapa ditt konto och börja din 30-dagars gratis provperiod.",
  "howItWorks.step2Title": "Ställ in ditt företag",
  "howItWorks.step2Desc": "Ladda upp ditt varumärke, lägg till din(a) anläggning(ar) och verksamhet, och konfigurera öppettider, priser, beläggningskapacitet och mycket mer.",
  "howItWorks.step3Title": "Dela din bokningslänk",
  "howItWorks.step3Desc": "Skicka din bokningssida till kunder och börja ta emot bokningar.",

  // Pricing
  "pricing.title": "Enkel och transparent prissättning",
  "pricing.subtitle": "Börja med en 30 dagars gratis provperiod. Uppgradera till nästa nivå eller avbryt när som helst.",
  "pricing.simpleTitle": "Enkel och transparent prissättning",
  "pricing.simpleSubtitle": "Börja med en 30 dagars gratis provperiod. Uppgradera till nästa nivå eller avbryt när som helst.",
  "pricing.comparePlans": "Jämför planer",
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
  "cta.subtitle": "Gå med besöksnäringsföretag som redan använder MimmoBook för att effektivisera sina bokningar.",

  // Login
  "login.title": "Logga in på ditt konto",
  "login.subtitle": "Ange dina uppgifter för att komma åt din instrumentpanel.",
  "login.welcomeBack": "Välkommen tillbaka",
  "login.welcomeBackSubtitle": "Logga in för att hantera dina bokningar och ditt team.",
  "login.forgotPassword": "Glömt lösenord?",
  "login.noAccount": "Har du inget konto?",
  "login.loggingIn": "Loggar in...",
  "login.orContinueWith": "Eller fortsätt med",
  "login.continueGoogle": "Fortsätt med Google",
  "login.continueApple": "Fortsätt med Apple",
  "login.haveCode": "Har du en kod?",
  "login.codePlaceholder": "Ange åtkomst- eller rabattkod",
  "login.codeHint": "Beta-, åtkomst- eller rabattkod — den tillämpas efter inloggning.",
  "login.codeRedeemed": "Koden har lösts in!",
  "login.codeRedeemFailed": "Koden kunde inte lösas in. Du kan försöka igen från instrumentpanelen.",

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
  "signup.orContinueWith": "Eller registrera med",
  "signup.continueGoogle": "Registrera med Google",
  "signup.continueApple": "Registrera med Apple",

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
  "dashboard.sendReminder": "Skicka påminnelse",
  "dashboard.reminderSent": "Påminnelse skickad",
  "dashboard.reminderSentAt": "Påminnelse skickad",
  "dashboard.confirmationSentAt": "Bekräftelse skickad",
  "dashboard.cancellationSentAt": "Avbokning skickad",
  "dashboard.reminderError": "Kunde inte skicka påminnelse",
  "dashboard.sendReminderMsg": "Skicka ett påminnelsemail till gästen om denna bokning?",
  "dashboard.notCheckedIn": "Ej incheckad",
  "dashboard.todayFilter": "Idag",
  "dashboard.activeResources": "Aktiva resurser",
  "dashboard.bookingLink": "Bokningslänk",
  "dashboard.bookingLinkDesc": "Dela denna länk med dina kunder så att de kan boka.",
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
  "dashboard.noResources": "Inga resurser ännu. Lägg till ditt första rum, bord eller lokal.",
  "dashboard.capacity": "kapacitet",
  "dashboard.perNight": "/natt",
  "dashboard.resourceCreated": "Resurs skapad",
  "dashboard.resourceUpdated": "Resurs uppdaterad",
  "dashboard.resourceDeleted": "Resurs raderad",
  "dashboard.copyResource": "Kopiera resurs",
  "dashboard.copyResourceDesc": "Hur många kopior vill du skapa av denna resurs?",
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
   "dashboard.checkoutToday": "Utcheckningar idag",
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
  "autoReminder.title": "Automatiska påminnelser",
  "autoReminder.tooltip": "Påminnelsemejl skickas automatiskt 24 timmar före varje bekräftad bokning.",
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
  "dashboard.markLinkedUsed": "Markera länkade bokningar som använda?",
  "dashboard.markLinkedUsedMsg": "Denna bokning är länkad till ett erbjudande med andra bokningar. Vill du markera alla som använda?",
  "dashboard.markAll": "Markera alla använda",
  "dashboard.markLinkedInvoiced": "Markera länkade bokningar som fakturerade?",
  "dashboard.markLinkedInvoicedMsg": "Denna bokning är länkad till ett erbjudande med andra bokningar. Vill du markera alla som fakturerade?",
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
  "dashboard.calendarTooltip": "Klicka på ett datum för att se dess bokningar. Markerade datum har bokningar. Röda datum har engångsblockeringar. Lila streckade datum har återkommande blockeringar.",
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
  "dashboard.pricingHint": "Standardpris för nya bokningar. Enskilda bokningspriser kan justeras i bokningsdetaljerna.",
  "dashboard.roomTypeLabel": "Rumstyp",
  "dashboard.bedConfiguration": "Sängkonfiguration",
  "dashboard.roomDescription": "Rumsbeskrivning",
  "dashboard.roomDescPlaceholder": "Beskriv rummen, antal sängar, planlösning...",
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
  "tier.basicDesc": "Perfekt för ett enskilt hotell, en restaurang eller en eventlokal.",
  "tier.pro": "Pro",
  "tier.proDesc": "För företag som erbjuder hotell-, restaurang- och evenemangstjänster på ett ställe.",
  "tier.professional": "Professional",
  "tier.professionalDesc": "Flera bokningstyper, teamhantering.",
  "tier.business": "Business",
  "tier.businessDesc": "Funktionsrik plattform för företag med flera platser och verksamheter.",

  // Footer
  "footer.tagline": "Den moderna bokningsplattformen för restauranger, lokaler och gästhus.",
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
  "about.heroSubtitle": "Vi hjälper hotell- och restaurangföretag att hantera sina bokningar enkelt, så de kan fokusera på att skapa minnesvärda gästupplevelser.",
  "about.missionBadge": "Vårt uppdrag",
  "about.missionTitle": "Göra bokningshantering enkel och smidig",
  "about.missionP1": "Små besöksnäringsföretag förtjänar praktiska och informativa verktyg för att arbeta mer effektivt. Vi startade MimmoBook för att göra det möjligt.",
  "about.missionP2": "Vår plattform samlar bokningar, varumärkeshantering och rapportering i ett enhetligt arbetsutrymme och eliminerar utspridda anteckningsböcker och missade bokningar.",
  "about.point1Title": "Snabbhet utan kompromisser",
  "about.point1Desc": "Få din varumärkta bokningssida live på en dag eller två, inte veckor.",
  "about.point2Title": "Datadrivna insikter",
  "about.point2Desc": "Följ bokningar, beläggning och intäkter med ett ögonkast.",
  "about.point3Title": "Byggt för team",
  "about.point3Desc": "Rollbaserad åtkomst och stöd för flera medarbetare.",
  "about.valuesTitle": "Våra kärnvärden",
  "about.valuesSubtitle": "Vi styr vår dagliga verksamhet och fattar beslut baserat på dessa principer, från produktdesign till kundsupport.",
  "about.valuePrecision": "Precision",
  "about.valuePrecisionDesc": "Varje detalj spelar roll, från pixelprecisa bokningssidor till uppdaterade tillgänglighetskalendrar.",
  "about.valueInnovation": "Innovation",
  "about.valueInnovationDesc": "Vi förbättrar ständigt vår plattform. Vi vill ha din feedback för att göra den ännu bättre.",
  "about.valueCollaboration": "Samarbete",
  "about.valueCollaborationDesc": "Vi arbetar nära hotell- och restaurangföretag för att förstå deras verkliga behov.",
  "about.valueTrust": "Förtroende",
  "about.valueTrustDesc": "Dina data är säkra. Vi följer GDPR-standarder och bästa säkerhetspraxis.",
  "about.valuePassion": "Passion",
  "about.valuePassionDesc": "Vi brinner för att hjälpa småföretag att lyckas inom hotell- och restaurangbranschen.",
  "about.valueGlobal": "Tillgänglighet",
  "about.valueGlobalDesc": "Vår plattform är flerspråkig och utformad för att vara tillgänglig för alla.",
  "about.ctaTitle": "Redo att förenkla dina bokningar?",
  "about.ctaSubtitle": "Gå med i de hotell- och restaurangföretag som redan använder MimmoBook för att effektivisera dina bokningar.",

  "privacy.title": "Integritetspolicy",
  "privacy.lastUpdated": "Senast uppdaterad:",
  "privacy.s1Title": "1. Introduktion",
  "privacy.s1P1": "Denna integritetspolicy förklarar hur MimmoBook samlar in, använder och skyddar dina personuppgifter. Vi följer EU:s allmänna dataskyddsförordning (GDPR).",
  "privacy.s2Title": "2. Personuppgiftsansvarig",
  "privacy.s2P1": "MimmoBook är personuppgiftsansvarig. Kontakta oss via supportsidan för dataskyddsfrågor.",
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
  "privacy.s6Item1": "Rätt till tillgång: begär en kopia av dina personuppgifter",
  "privacy.s6Item2": "Rätt till rättelse: korrigera felaktiga uppgifter",
  "privacy.s6Item3": "Rätt till radering: begär radering av dina uppgifter",
  "privacy.s6Item4": "Rätt att begränsa behandling",
  "privacy.s6Item5": "Rätt till dataportabilitet",
  "privacy.s7Title": "7. Cookies",
  "privacy.s7P1": "Vi använder nödvändiga cookies för att plattformen ska fungera. Analyticscookies laddas först efter ditt uttryckliga samtycke.",
  "privacy.s8Title": "8. Kontakt",
  "privacy.s8P1": "Kontakta oss via supportsidan för frågor om denna integritetspolicy.",

  "a11y.title": "Tillgänglighetsredogörelse",
  "a11y.lastUpdated": "Senast uppdaterad:",
  "a11y.s1Title": "1. Vårt åtagande",
  "a11y.s1P1": "MimmoBook är engagerat i att säkerställa digital tillgänglighet för alla. Vi förbättrar ständigt användarupplevelsen och tillämpar relevanta tillgänglighetsstandarder.",
  "a11y.s2Title": "2. Tillgänglighetsfunktioner",
  "a11y.s2P1": "Vår plattform inkluderar följande tillgänglighetsfunktioner:",
  "a11y.s2Item1": "Justerbar teckenstorlek (80% till 150%)",
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
  "password.breached": "Detta lösenord har hittats i dataintrång. Välj ett annat.",
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
  "help.subtitle": "Bläddra bland guider, vanliga frågor och fråga AI-assistenten.",
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
  "help.requestSubmittedDetail": "Ditt supportärende har skickats! Adminteamet granskar det och svarar snart.",
  "help.art1Title": "Komma igång",
  "help.art1Desc": "Skapa ditt konto och din första bokningssida på några minuter.",
  "help.art1C1": "Registrera dig för en gratis 30-dagars provperiod. Inget kreditkort behövs.",
  "help.art1C2": "Slutför installationsguiden för att namnge ditt företag och välja bokningstyper.",
  "help.art1C3": "Anpassa ditt varumärke (logotyp, färger) i Inställningar.",
  "help.art1C4": "Dela din bokningslänk med kunderna!",
  "help.art2Title": "Hantera bokningar",
  "help.art2Desc": "Visa, redigera, bekräfta och avboka bokningar från instrumentpanelen.",
  "help.art2C1": "Använd kalendervyn för en visuell översikt av kommande bokningar.",
  "help.art2C2": "Byt till listvyn för att filtrera efter status, typ eller datumintervall.",
  "help.art2C3": "Klicka på en bokning för att redigera detaljer, lägga till anteckningar eller ändra status.",
  "help.art2C4": "Bekräftelse- och avbokningsmeddelanden skickas automatiskt.",
  "help.art3Title": "E-postmallar",
  "help.art3Desc": "Anpassa bekräftelse- och avbokningsmejl som skickas till gäster.",
  "help.art3C1": "Gå till Inställningar → E-postmallar för att anpassa dina mejl.",
  "help.art3C2": "Förhandsgranska mejlens utseende innan du skickar dem.",
  "help.art3C3": "Lägg till anpassade meddelanden vid bekräftelse eller avbokning.",
  "help.art3C4": "Mejl stöder flerspråkigt innehåll (EN, FI, SV).",
  "help.art4Title": "Varumärke & Bokningssida",
  "help.art4Desc": "Anpassa din offentliga bokningssida med din varumärkesidentitet.",
  "help.art4C1": "Ladda upp din logotyp och ange primär-/accentfärger i Inställningar.",
  "help.art4C2": "Lägg till en hero-bild för bokningssidans rubrik.",
  "help.art4C3": "Din bokningssida finns på /book/din-slug.",
  "help.art4C4": "Företagsbeskrivningen visas för gäster på bokningssidan.",
  "help.art5Title": "Öppettider",
  "help.art5Desc": "Konfigurera när ditt företag tar emot bokningar för varje typ.",
  "help.art5C1": "Ange öppettider per bokningstyp (restaurang, lokal, hotell).",
  "help.art5C2": "Markera specifika dagar som stängda.",
  "help.art5C3": "Öppettider bestämmer tillgängliga tider på bokningssidan.",
  "help.art5C4": "Använd blockerade tider för att tillfälligt stänga specifika datum.",
  "help.art6Title": "Resurser & Rum",
  "help.art6Desc": "Hantera rum, bord och evenemangslokaler som kan bokas.",
  "help.art6C1": "Lägg till resurser i Resurser-sektionen.",
  "help.art6C2": "Ange kapacitet, prissättning och beskrivningar för varje resurs.",
  "help.art6C3": "Ladda upp bilder för att visa dina utrymmen på bokningssidan.",
  "help.art6C4": "Inaktivera resurser för att tillfälligt dölja dem.",
  "help.art7Title": "Personal & Användarhantering",
  "help.art7Desc": "Bjud in teammedlemmar och hantera roller och behörigheter.",
  "help.art7C1": "Ägare kan bjuda in personal via Adminpanelen.",
  "help.art7C2": "Roller: Ägare (full åtkomst), Admin (hantera resurser), Personal (visa bokningar).",
  "help.art7C3": "Godkänn eller ta bort teammedlemmar när som helst.",
  "help.art7C4": "Varje plan har en personalgräns. Uppgradera för att lägga till fler.",
  "help.art8Title": "Planer & Fakturering",
  "help.art8Desc": "Förstå prisnivåer och hantera din prenumeration.",
  "help.art8C1": "Basic (29 €/mån): 1 typ, 1 till 5 personal, AI-chatbot-support.",
  "help.art8C2": "Pro (79 €/mån): Alla typer, upp till 25 personal, anpassade mallar, AI-chatbot-support.",
  "help.art8C3": "Business (199 €/mån): Alla typer, obegränsad personal, prioritetssupport med 24h svarstid.",
  "help.art8C4": "Uppgradera eller nedgradera när som helst. Ändringar börjar gälla nästa faktureringsperiod.",
  "help.art9Title": "Vanliga frågor",
  "help.art9Desc": "Svar på de vanligaste frågorna om MimmoBook.",
  "help.art9C1": "F: Behöver jag ett kreditkort för provperioden? S: Nej!",
  "help.art9C2": "F: Kan jag använda min egen domän? S: Egna domäner finns på vår roadmap.",
  "help.art9C3": "F: Hur får gäster bekräftelser? S: Automatiskt via mejl när du bekräftar en bokning.",
  "help.art9C4": "F: Kan jag exportera mina data? S: Ja, rapporter kan exporteras från Rapporter-panelen.",
  "help.art10Title": "Nyheter",
  "help.art10Desc": "Senaste funktionerna: gästportal, väntelista, kalendersynk, export och mer.",
  "help.art10C1": "Gästportal: gäster kan visa eller avboka sin bokning via en magisk länk (/my-booking/:token) — ingen inloggning krävs.",
  "help.art10C2": "Väntelista: när en tid är fullbokad kan gäster gå med i en väntelista och meddelas automatiskt när en plats blir ledig.",
  "help.art10C3": "Google Kalender-synk: prenumerera på dina bokningar via iCal-flödet (Inställningar → Kalendersynk). CSV/PDF-export från Bokningar och Rapporter.",
  "help.art10C4": "Förbättringar i instrumentpanelen: mörkt läge, kortkommandon (tryck ?), Snabbåtgärds-FAB på mobil, introduktionscheckslista, granskningsloggfilter, analysdiagram, inloggningsbegränsning, säkerhetskopieringsstatus, publika omdömen/recensioner, flerspråkig publik bokningssida och en Stripe-intäktspanel för superadmins.",
  "help.guide1Q": "Hur hanterar jag bokningar?",
  "help.guide1A": "Gå till **Instrumentpanel → Bokningar** för att visa, filtrera, redigera och hantera alla bokningar.",
  "help.guide2Q": "Hur anpassar jag min bokningssida?",
  "help.guide2A": "Navigera till **Inställningar** i instrumentpanelen. Ladda upp din logotyp, ange varumärkesfärger och lägg till en hero-bild.",
  "help.guide3Q": "Hur konfigurerar jag e-postmallar?",
  "help.guide3A": "I **Inställningar → E-postmallar** kan du anpassa bekräftelse- och avbokningsmejl.",
  "help.guide4Q": "Hur lägger jag till personal?",
  "help.guide4A": "Gå till **Admin → Användare** för att bjuda in ny personal. Du kan ange roller och godkänna eller ta bort medlemmar.",
  "help.guide5Q": "Hur lägger jag till eller redigerar resurser?",
  "help.guide5A": "Gå till **Instrumentpanel → Resurser** för att skapa rum, bord eller lokaler.",
  "help.guide6Q": "Vad är nytt i MimmoBook?",
  "help.guide6A": "Senaste tilläggen: **Gästportal** (bokningshantering via magisk länk), **väntelista** med automatiska aviseringar, **Google Kalender-synk** via iCal-flöde, **CSV/PDF-export**, **mörkt läge**, **kortkommandon** (tryck `?`), **Snabbåtgärds-FAB** på mobil, **introduktionscheckslista**, **granskningsloggfilter**, **analysdiagram**, **publika omdömen/recensioner** och en **Stripe-intäktspanel** för superadmins.",

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
  "aid.chat": "Chatt",
  "aid.requests": "Ärenden",
  "aid.loadingRequests": "Laddar ärenden...",
  "aid.noRequests": "Inga supportärenden ännu.",
  "aid.noRequestsHint": "Skicka ett från chattvyn.",
  "aid.yourMessage": "Ditt meddelande",
  "aid.adminResponse": "Adminsvar",
  "aid.awaitingResponse": "Inväntar adminsvar...",
  "aid.requestSubmitted": "Supportärende",
  "aid.requestSubmittedDetail": "Ditt supportärende har skickats! Ditt adminteam granskar det snart. Du får en avisering när det har besvarats.",
  "aid.statusOpen": "Öppet",
  "aid.statusInProgress": "Pågående",
  "aid.statusResolved": "Löst",
  "aid.statusClosed": "Stängt",
  "aid.errorNoTenant": "Kunde inte skicka ärende. Ingen hyresgäst hittades.",
  "aid.errorSubmit": "Kunde inte skicka ärende",
  "aid.successSubmit": "Supportärende skickat",
  "aid.errorConnect": "Kunde inte ansluta. Försök igen.",
  "aid.guideQ1": "Hur hanterar jag bokningar?",
  "aid.guideA1": "Gå till **Instrumentpanel → Bokningar** för att visa, filtrera, redigera och hantera alla bokningar. Du kan bekräfta eller avboka via åtgärdsmenyn på varje kort.",
  "aid.guideQ2": "Hur anpassar jag min bokningssida?",
  "aid.guideA2": "Navigera till **Inställningar** i din instrumentpanel. Ladda upp din logotyp, ställ in varumärkesfärger och lägg till en hero-bild. Din publika bokningssida uppdateras automatiskt.",
  "aid.guideQ3": "Hur konfigurerar jag e-postmallar?",
  "aid.guideA3": "Under **Inställningar → E-postmallar** kan du anpassa både bekräftelse- och avbokningsmail. Använd förhandsgranskningsfliken för att se hur de ser ut för gästerna.",
  "aid.guideQ4": "Hur lägger jag till personal?",
  "aid.guideA4": "Gå till **Admin → Användare** för att bjuda in ny personal. Du kan ange roller (Ägare, Admin, Personal) och godkänna eller ta bort teammedlemmar.",
  "aid.guideQ5": "Hur lägger jag till eller redigerar resurser?",
  "aid.guideA5": "Gå till **Instrumentpanel → Resurser** för att skapa rum, bord eller lokaler. Du kan ange kapacitet, prissättning, ladda upp upp till 5 bilder och växla aktiv/inaktiv status.",
  "aid.guideQ6": "Hur ställer jag in öppettider?",
  "aid.guideA6": "Under **Inställningar → Öppettider** konfigurerar du öppnings- och stängningstider för varje veckodag per resurstyp. Markera dagar som stängda vid behov.",
  "aid.guideQ7": "Hur visar jag rapporter?",
  "aid.guideA7": "Navigera till **Instrumentpanel → Rapporter** för att se bokningstrender, beläggningsgrad och intäktssammanfattningar. Du kan filtrera efter datumintervall och exportera utskrivbara rapporter.",
  "aid.guideQ8": "Hur fungerar prissättning för rum?",
  "aid.guideA8": "Ange ett **baspris per natt** för varje resurs och konfigurera **rumstypmultiplikatorer** (Enkelrum 1.0×, Dubbelrum 1.5×, Svit 2.5× osv.). Bokningssidan beräknar summorna automatiskt.",
  "aid.guideQ9": "Hur delar jag min bokningslänk?",
  "aid.guideA9": "Din publika bokningslänk visas på **Instrumentpanelens översikt**. Klicka på **Kopiera länk** för att kopiera den eller öppna den i en ny flik. Dela den på din webbplats eller sociala medier.",
   "aid.guideQ10": "Hur blockerar jag datum eller tider?",
   "aid.guideA10": "Under **Instrumentpanel → Kalender**, klicka på ett datum och använd **Blockera tid** för att förhindra bokningar för specifika datum, tider eller resurser.",
   "aid.guideQ11": "Hur hanterar jag återkommande blockeringar?",
   "aid.guideA11": "Gå till **Instrumentpanel → Kalender** och öppna panelen **Återkommande blockeringar**. Du kan skapa veckovis återkommande blockeringar för specifika dagar, tidsintervall och resurstyper (t.ex. stänga restaurangen varje måndag). Slå av/på eller ta bort blockeringar när som helst. Ändringar gäller direkt på den publika bokningssidan.",
  // Sites
  "sites.title": "Platser",
  "sites.addSite": "Lägg till plats",
  "sites.editSite": "Redigera plats",
  "sites.tooltip": "Hantera flera platser eller fastigheter under ditt konto. Varje plats kan ha egna resurser, öppettider och bokningssida.",
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
  "sites.deleteConfirm": "Detta tar bort platsen permanent. Resurser kopplade till den blir otilldelade.",
  "sites.noSites": "Inga platser ännu. Skapa din första plats för att hantera flera lokaler.",
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
  "sample.warningWeek": "Din gratis provperiod slutar om {days} dagar. Kontakta support för att uppgradera.",
  "sample.warningDay": "Din gratis provperiod löper ut idag! Kontakta support för att fortsätta.",
  "sample.warningDayTomorrow": "Din gratis provperiod löper ut imorgon! Kontakta support för att fortsätta.",
  "sample.readOnly": "Din provperiod har löpt ut. Instrumentpanelen är skrivskyddad i {days} dagar till. Kontakta support.",
  "sample.blocked": "Din provperiod har löpt ut och åtkomst är blockerad. Kontakta support för att återaktivera.",
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
  "discountCodes.description": "Skapa och hantera kampanjrabattkoder för dina kunder.",
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
  "discountCodes.deleteConfirm": "Är du säker på att du vill ta bort denna rabattkod? Åtgärden kan inte ångras.",
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
  "emailTemplates.tooltip": "Anpassa ämnesrad och innehåll för bekräftelse-, påminnelse- och avbokningsmejl som skickas till gäster.",
  "emailTemplates.description": "Anpassa mejlen som skickas till gäster vid bekräftelser, påminnelser och avbokningar.",
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
  "emailTemplates.activeToggleDesc": "När avaktiverad används systemets standardmall istället.",
  "emailTemplates.resetDefault": "Återställ till standard",
  "emailTemplates.saved": "E-postmall sparad",
  "emailTemplates.saveError": "Kunde inte spara mallen",
  "emailTemplates.active": "Aktiv",
  "emailTemplates.inactive": "Inaktiv",
  "emailTemplates.upgradeHint": "Uppgradera till Professional eller Business för att anpassa e-postmallar.",
  "emailTemplates.overrideRemoved": "Platsspecifik ändring borttagen, använder standardmall",
  "emailTemplates.siteOverride": "Platsspecifik",
  "emailTemplates.usingTenantDefault": "Använder standardmall",
  "emailTemplates.revertToDefault": "Ta bort platsspecifik ändring",
  "emailTemplates.siteDescription": "Anpassa e-postmallar för denna plats. Ändringar här åsidosätter standardmallarna.",

  // Pricing page
  "pricing.heroTitle": "Enkel och transparent prissättning",
  "pricing.heroSubtitle": "Börja med en 30 dagars gratis provperiod. Uppgradera till nästa nivå eller avbryt när som helst.",
  "pricing.basicName": "Basic",
  "pricing.basicDesc": "Perfekt för ett enskilt hotell, en restaurang eller en eventlokal.",
  "pricing.basicTypes": "1 typ",
  "pricing.basicStaff": "1 till 5",
  "pricing.proName": "Pro",
  "pricing.proDesc": "För företag som erbjuder hotell-, restaurang- och evenemangstjänster på ett ställe.",
  "pricing.proTypes": "Alla 3 typer, 1 av varje (kan inte byta till t.ex. två restauranger och ett hotell)",
  "pricing.proStaff": "Upp till 25",
  "pricing.businessName": "Business",
  "pricing.businessDesc": "Funktionsrik plattform för företag med flera platser och verksamheter.",
  "pricing.businessTypes": "Alla 3 typer, obegränsat antal",
  "pricing.businessStaff": "Obegränsat",
  "pricing.basicF1": "Egen varumärkesprofil (logotyp, färger, bilder)",
  "pricing.basicF2": "Standard e-postmallar",
  "pricing.basicF3": "Konfiguration av öppettider",
  "pricing.basicF4": "Varumärkt bokningssida",
  "pricing.basicF5": "AI-driven chatbot-support",
  "pricing.proF1": "Alla grundfunktioner",
  "pricing.proF2": "Anpassade e-postmallar",
  "pricing.proF3": "AI-driven chatbot-support",
  "pricing.businessF1": "Alla Pro-funktioner",
  "pricing.businessF2": "Obegränsat antal platser, verksamheter och personal",
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
  "pricing.multiLocationDesc": "Företagsplanen stöder obegränsat antal platser med hantering av flera platser. Styr dina hotell, restauranger och lokaler från en enda instrumentpanel.",
  "pricing.tryBusinessFree": "Prova Företag gratis i 30 dagar",
  "pricing.faqQ1": "Vad händer efter 30 dagars provperiod?",
  "pricing.faqA1": "Du får ett meddelande om att din provperiod övergår till en betald prenumeration. Du kan avbryta när som helst innan provperioden slutar, utan kostnad. Om du inte avbryter startar prenumerationen. Om du avbryter efter att prenumerationen har startat faktureras du för den första faktureringsperioden, som är 30 dagar.",
  "pricing.faqQ2": "Kan jag ändra plan senare?",
  "pricing.faqA2": "Ja! Du kan uppgradera eller nedgradera din plan när som helst. Ändringar träder i kraft vid början av nästa faktureringsperiod.",
  "pricing.faqQ3": "Vilka bokningstyper kan jag välja?",
  "pricing.faqA3": "Restaurang (bordsreservationer), Lokal (lokalförfrågningar) och Gästhus (rumsreservationer). Basic låter dig välja en. Pro låser upp alla typer, en av varje, på en plats. Business lägger till obegränsade platser.",
  "pricing.faqQ4": "Kan jag använda min egen domän?",
  "pricing.faqA4": "Varje företag får en varumärkt subdomän (t.ex. dittforetag.mimmobook.com). Stöd för egna domäner finns på vår roadmap och kommer att erbjudas med enterprise-prissättning.",
  "pricing.faqQ5": "Vad är skillnaden mellan AI-chatbot-support och 24-timmarssupport?",
  "pricing.faqA5": "Alla planer inkluderar MimmoAid, vår AI-chatbot som kan svara på frågor, hjälpa till med felsökning och guida dig genom funktioner. Chatboten är tillgänglig 24/7 i din instrumentpanel. Business-planen lägger till 24-timmarssupport: du kan eskalera varje konversation till vårt team på plattformen via chatboten och få ett garanterat svar inom 24 timmar.",

  // Support page
  "support.heroTitle": "Hur kan vi hjälpa till?",
  "support.heroSubtitle": "Bläddra bland guider, vanliga frågor och svar och tips för att få ut det mesta av MimmoBook.",
  "support.searchPlaceholder": "Sök efter hjälp...",
  "support.noResults": "Inga resultat hittades. Prova ett annat sökord.",
  "support.stillNeedHelp": "Behöver du fortfarande hjälp?",
  "support.stillNeedHelpDesc": "Alla planer inkluderar AI-chatbot-support i instrumentpanelen. Business-kunder får support med garanterat 24-timmarssvar från vårt team. Det finns också en nedladdningsbar användarguide i backend-vyn för att hjälpa till med användningen.",
  "support.gettingStarted": "Komma igång",
  "support.gettingStartedDesc": "Konfigurera ditt konto och skapa din första bokningssida.",
  "support.gettingStartedC1": "Registrera dig för en gratis 30-dagars provperiod.",
  "support.gettingStartedC2": "Slutför onboarding-guiden för att namnge ditt företag och välja dina bokningstyper.",
  "support.gettingStartedC3": "Anpassa ditt varumärke (logotyp, färger) i Inställningar.",
  "support.gettingStartedC4": "Dela din bokningslänk med kunder!",
  "support.managingRes": "Hantera bokningar",
  "support.managingResDesc": "Kolla, redigera, bekräfta och avboka bokningar från din instrumentpanel.",
  "support.managingResC1": "Använd kalendervyn för en visuell översikt över kommande bokningar.",
  "support.managingResC2": "Växla till listvyn för att filtrera efter status, typ eller datumintervall.",
  "support.managingResC3": "Klicka på valfri bokning för att redigera information, lägga till anteckningar eller ändra status.",
  "support.managingResC4": "Bekräftelse- och avbokningsmejl skickas automatiskt.",
  "support.emailTemplates": "E-postmallar",
  "support.emailTemplatesDesc": "Kunder på företagsnivå kan anpassa bekräftelse- och avbokningsmejl som skickas till gäster.",
  "support.emailTemplatesC1": "Gå till Inställningar → E-postmallar för att anpassa dina e-postmeddelanden.",
  "support.emailTemplatesC2": "Förhandsgranska hur e-postmeddelanden ser ut innan du skickar med den inbyggda förhandsgranskningen.",
  "support.emailTemplatesC3": "Lägg till anpassade meddelanden per bokning när du bekräftar eller avbokar.",
  "support.emailTemplatesC4": "E-postmeddelanden stöder flerspråkigt innehåll (enska, finska, svenska).",
  "support.brandingTitle": "Inställningar och resurssidor",
  "support.brandingDesc": "Anpassa din offentliga bokningssida med din varumärkesidentitet.",
  "support.brandingC1": "Ladda upp din logotyp och ange primär-/accentfärger i Inställningar.",
  "support.brandingC2": "Lägg till en huvudbild för din bokningssidas rubrik.",
  "support.brandingC3": "Företagsbeskrivningen visas på bokningssidan för gäster.",
  "support.brandingC4": "",
  "support.openingHoursTitle": "Öppettider",
  "support.openingHoursDesc": "Konfigurera när ditt företag accepterar bokningar för varje typ.",
  "support.openingHoursC1": "Ställ in öppettider per bokningstyp (restaurang, lokal, hotell).",
  "support.openingHoursC2": "Möjlighet att markera specifika timmar eller dagar som stängda.",
  "support.openingHoursC3": "Öppettiderna avgör tillgängliga tidsluckor på bokningssidan.",
  "support.openingHoursC4": "Använd blockerade tidsluckor för att tillfälligt stänga specifika timmar eller datum.",
  "support.resourcesTitle": "Resurser och rum",
  "support.resourcesDesc": "Hantera rum, bord och evenemangsutrymmen som kan bokas.",
  "support.resourcesC1": "Lägg till resurser i avsnittet Resurser på din instrumentpanel.",
  "support.resourcesC2": "Ställ in kapacitet, priser och beskrivningar för varje resurs.",
  "support.resourcesC3": "Ladda upp foton för att visa upp dina utrymmen på bokningssidan.",
  "support.resourcesC4": "Inaktivera resurser för att tillfälligt dölja dem från bokningar.",
  "support.staffTitle": "Användarhantering",
  "support.staffDesc": "Bjud in teammedlemmar och hantera roller och behörigheter.",
  "support.staffC1": "Ägare kan bjuda in personal via administratörspanelen.",
  "support.staffC2": "Roller: Ägare (full åtkomst), Admin (hantera resurser), Personal (visa reservationer).",
  "support.staffC3": "Godkänn eller ta bort teammedlemmar när som helst.",
  "support.staffC4": "Planer har en begränsning för personalanvändare och reservationstyper. Uppgradera för att lägga till fler.",
  "support.billingTitle": "Planer och fakturering",
  "support.billingDesc": "Förstå prisnivåer och hantera din prenumeration.",
  "support.billingC1": "Basic (29 €/mån): 1 reserveringstyp, 1 till 5 anställda, AI-chatbotsupport.",
  "support.billingC2": "Pro (79 €/mån): Alla reserveringstyper (en per typ), upp till 25 anställda, AI-chatbotsupport.",
  "support.billingC3": "Business (199 €/mån): Alla reserveringstyper och obegränsat antal, obegränsat antal anställda, prioriterad support med 24 timmars svar.",
  "support.billingC4": "Uppgradera eller nedgradera när som helst. Ändringarna träder i kraft nästa faktureringscykel.",
  "support.faqTitle": "Vanliga frågor",
  "support.faqDesc": "Svar på de vanligaste frågorna om MimmoBook.",
  "support.faqC1": "F: Kan jag använda min egen domän? S: Anpassade domäner finns på vår färdplan.",
  "support.faqC2": "F: Hur får gäster bekräftelser? S: Automatiskt via e-post när du bekräftar en bokning.",
  "support.faqC3": "F: Kan jag exportera mina data? S: Ja, rapporter kan exporteras från rapportpanelen.",
  "support.faqC4": "F: Vad är skillnaden mellan AI-chatbot och prioriterad support? A: Alla planer inkluderar MimmoAid, vår AI-chatbot som är öppen dygnet runt. Affärsplanen lägger till möjlighet för supportförfrågningar som ställs på plattformen med garanterat 24-timmarssvar.",
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
  "whatIs.heroSubtitle": "MimmoBook är en molnbaserad bokningshanteringsplattform byggd för restauranger, eventlokaler, hotell och gästhus. Ett verktyg för att hantera alla dina bokningar.",
  "whatIs.seeFeatures": "Se alla funktioner",
  "whatIs.definitionTitle": "MimmoBook: Bokningshantering för besöksnäringen",
  "whatIs.definitionP1": "MimmoBook är en SaaS-plattform som hjälper besöksnäringsföretag att hantera bokningar online. Oavsett om du driver en restaurang, eventlokal, hotell eller gästhus ger MimmoBook dig en centraliserad instrumentpanel för att hantera bokningar, kommunicera med gäster och spåra affärsprestanda.",
  "whatIs.definitionP2": "Till skillnad från generiska bokningsverktyg är MimmoBook designat specifikt för besöksnäringen. Det stöder flera bokningstyper, inklusive bordsreserveringar, rumsreserveringar, lokalhyra, cateringbeställningar och popup-evenemang, allt från ett enda konto. Varje företag får en varumärkesanpassad bokningssida.",
  "whatIs.definitionP3": "MimmoBook finns tillgängligt på engelska, finska och svenska, vilket gör det idealiskt för företag som verkar i Norden och internationellt. Plattformen skalas från enskilda restauranger till besöksnäringsgrupper med flera platser.",
  "whatIs.whoTitle": "Vem är MimmoBook till för?",
  "whatIs.whoSubtitle": "MimmoBook betjänar besöksnäringsföretag i alla storlekar inom fyra huvudkategorier.",
  "whatIs.whoRestaurants": "Restauranger",
  "whatIs.whoRestaurantsDesc": "Hantera bordsreserveringar, set-menyer och gästpreferenser. Hantera walk-ins och onlinebokningar från en instrumentpanel.",
  "whatIs.whoVenues": "Eventlokaler",
  "whatIs.whoVenuesDesc": "Samordna lokal­bokningar, utrustningsbehov, cateringförfrågningar och evenemangsscheman med automatiska bekräftelser.",
  "whatIs.whoHotels": "Hotell",
  "whatIs.whoHotelsDesc": "Hantera rumsreserveringar, in-/utcheckning, frukost­alternativ och rumstyps­prissättning för din fastighet.",
  "whatIs.whoGuesthouses": "Gästhus",
  "whatIs.whoGuesthousesDesc": "Förenkla gästboende med enkel rumsbokning, tillgänglighetshantering och personlig kommunikation.",
  "whatIs.howTitle": "Hur fungerar MimmoBook?",
  "whatIs.howSubtitle": "Kom igång på fyra enkla steg.",
  "whatIs.howStep1": "Registrera dig",
  "whatIs.howStep1Desc": "Skapa ditt konto och starta en 30-dagars gratis provperiod. Inget kreditkort behövs.",
  "whatIs.howStep2": "Konfigurera",
  "whatIs.howStep2Desc": "Ställ in din företagsprofil, bokningstyper, öppettider och varumärkesanpassning.",
  "whatIs.howStep3": "Dela",
  "whatIs.howStep3Desc": "Dela din varumärkes­anpassade bokningssida med gäster via din webbplats, sociala medier eller e-post.",
  "whatIs.howStep4": "Hantera",
  "whatIs.howStep4Desc": "Hantera alla bokningar från din instrumentpanel med automatiserade e-postmeddelanden, rapporter och teamverktyg.",
  "whatIs.keyFeaturesTitle": "Nyckelfunktioner",
  "whatIs.feat1": "Smarta bokningar",
  "whatIs.feat1Desc": "Ta emot och hantera bokningar för restauranger, lokaler, hotell och gästhus från en plattform.",
  "whatIs.feat2": "Anpassat varumärke",
  "whatIs.feat2Desc": "Din bokningssida speglar ditt varumärke med anpassade färger, logotyp och bilder.",
  "whatIs.feat3": "Teamhantering",
  "whatIs.feat3Desc": "Bjud in personal, tilldela roller och kontrollera behörigheter för hela ditt team.",
  "whatIs.feat4": "Flerspråkigt stöd",
  "whatIs.feat4Desc": "Instrumentpanel och bokningssidor tillgängliga på engelska, finska och svenska.",
  "whatIs.feat5": "Rapporter och analys",
  "whatIs.feat5Desc": "Följ intäkter, beläggning och bokningstrender med exporterbara rapporter.",
  "whatIs.feat6": "Automatiserade e-postmeddelanden",
  "whatIs.feat6Desc": "Bekräftelse-, påminnelse- och avbokningsmeddelanden skickas automatiskt till gäster.",
  "whatIs.allFeatures": "Visa alla funktioner",
  "whatIs.ctaTitle": "Redo att förenkla dina bokningar?",
  "whatIs.ctaSubtitle": "Starta din 30-dagars gratis provperiod idag. Inget kreditkort behövs.",

  // Features Page
  "featuresPage.badge": "Plattformens funktioner",
  "featuresPage.heroTitle": "Allt du behöver för att hantera bokningar",
  "featuresPage.heroSubtitle": "Från bokningssidor till rapporter, MimmoBook ger dig en komplett verktygslåda för bokningshantering inom besöksnäringen.",
  "featuresPage.ctaTitle": "Börja hantera bokningar idag",
  "featuresPage.ctaSubtitle": "Testa alla funktioner gratis i 30 dagar. Inget kreditkort behövs.",
  "featuresPage.comparePlans": "Jämför planer",
  "features.catReservations": "Bokningshantering",
  "features.catBranding": "Varumärke och bokningssidor",
  "features.catManagement": "Team- och verksamhetshantering",
  "features.catComms": "Kommunikation och rapportering",
  "features.f1Title": "Flertyps­bokningar",
  "features.f1Desc": "Stöd för bordsreserveringar, rumsreserveringar, lokalhyra, cateringbeställningar och popup-evenemang från ett konto.",
  "features.f2Title": "Öppettider och tillgänglighet",
  "features.f2Desc": "Konfigurera öppettider per bokningstyp med blockerade tidsluckor och återkommande stängningar.",
  "features.f3Title": "Automatiska påminnelser",
  "features.f3Desc": "Gäster får automatiska påminnelsemeddelanden före sin bokning för att minska uteblivanden.",
  "features.f4Title": "Rabattkoder",
  "features.f4Desc": "Skapa procent- eller beloppsrabattkoder med användningsgränser och datumbegränsningar.",
  "features.f5Title": "Varumärkesanpassade bokningssidor",
  "features.f5Desc": "Din publika bokningssida visar din logotyp, färger, huvudbild och företagsbeskrivning.",
  "features.f6Title": "Redo för egen domän",
  "features.f6Desc": "Varje företag får en unik boknings-URL. Dela den på din webbplats, sociala medier eller tryckt material.",
  "features.f7Title": "Flerspråkigt (EN/FI/SV)",
  "features.f7Desc": "Instrumentpanel och bokningssidor är helt översatta till engelska, finska och svenska.",
  "features.f8Title": "Mobilanpassad",
  "features.f8Desc": "Bokningssidan och instrumentpanelen fungerar perfekt på telefoner, surfplattor och datorer.",
  "features.f9Title": "Teamroller och behörigheter",
  "features.f9Desc": "Bjud in personal som ägare, administratörer eller teammedlemmar med detaljerad behörighetskontroll.",
  "features.f10Title": "Resurshantering",
  "features.f10Desc": "Skapa och hantera rum, bord, eventlokaler och andra bokningsbara resurser med foton och beskrivningar.",
  "features.f11Title": "Stöd för flera platser",
  "features.f11Desc": "Hantera flera platser från ett konto med varumärkesanpassning, personal och rapportering per plats.",
  "features.f12Title": "Godkännandeflöden",
  "features.f12Desc": "Granska och godkänn bokningar, resursändringar och blockerade tidsluckor innan de publiceras.",
  "features.f13Title": "E-postmallar",
  "features.f13Desc": "Anpassa bekräftelse-, påminnelse- och avbokningsmeddelanden per bokningstyp och språk.",
  "features.f14Title": "Anpassade e-postmallar",
  "features.f14Desc": "Business-kunder kan helt anpassa e-postens HTML med sitt eget varumärke och budskap.",
  "features.f15Title": "Rapporter och analys",
  "features.f15Desc": "Intäktsrapporter, bokningstrender, beläggningsgrader och CSV-exporter för bokföring.",
  "features.f16Title": "Faktureringsuppföljning",
  "features.f16Desc": "Markera bokningar som fakturerade och spåra ofakturerade intäkter för alla bokningstyper.",
  "features.f17Title": "Erbjudanden och förslag",
  "features.f17Desc": "Skapa professionella erbjudanden med PDF-generering och skicka dem direkt till gäster via e-post.",
  "features.f18Title": "Korsbokningar",
  "features.f18Desc": "Länka bokningar mellan utrymmen och tjänster. Markera länkade bokningar som använda eller fakturerade tillsammans.",
  "features.offersAndCross": "Erbjudanden och korsbokningar",
  "features.offersAndCrossDesc": "Skapa erbjudanden, generera varumärkesanpassade PDF:er och länka bokningar mellan utrymmen — hantera allt tillsammans.",

  // Use Cases
  "useCases.badge": "Användningsfall",
  "useCases.heroTitle": "Byggd för alla typer av besöksnäringsföretag",
  "useCases.heroSubtitle": "Se hur MimmoBook löser bokningsutmaningar för restauranger, lokaler, hotell, gästhus, cateringföretag och popup-evenemang.",
  "useCases.challengesLabel": "Vanliga utmaningar",
  "useCases.solutionLabel": "Hur MimmoBook hjälper",
  "useCases.restaurant": "Restaurangbokningar",
  "useCases.restaurantDesc": "Restauranger behöver hantera bordsreserveringar, walk-ins, set-menyer och specialkost samtidigt som de spårar gästpreferenser och uteblivanden.",
  "useCases.restaurantChallenges": "Telefonbokning är tidskrävande och felbenägen. Rusningstider skapar flaskhalsar. Uteblivanden slösar kapacitet. Manuell spårning missar gästpreferenser.",
  "useCases.restaurantSolution": "MimmoBook erbjuder en varumärkesanpassad online-bokningssida där gäster bokar själva. Automatiska bekräftelser och påminnelser minskar uteblivanden. Alla gästdata och preferenser lagras på ett ställe.",
  "useCases.venue": "Lokal- och evenemangsbokningar",
  "useCases.venueDesc": "Eventlokaler behöver samordna utrymmestillgänglighet, utrustning, catering och personal medan de hanterar flera bokningar och klientkommunikation.",
  "useCases.venueChallenges": "Dubbelbokningar vid e-post- eller telefonbokning. Komplex logistik för flera utrymmen. Splittrad kommunikation med klienter. Svårt att spåra intäkter per evenemangstyp.",
  "useCases.venueSolution": "MimmoBooks resurshantering förhindrar dubbelbokningar. Varje lokal har sin egen tillgänglighetskalender. Automatiserade e-postmeddelanden håller klienterna informerade.",
  "useCases.hotel": "Hotellrumsbokningar",
  "useCases.hotelDesc": "Hotell behöver hantera rumstillgänglighet, in-/utcheckning, rumstyper, prisnivåer och frukost­alternativ.",
  "useCases.hotelChallenges": "Hantering av rumsinventarie per rumstyp. Manuell in-/utcheckningsspårning. Samordning av frukost­alternativ och prissättning. Professionell bokningsupplevelse utan dyra system.",
  "useCases.hotelSolution": "MimmoBook stöder rumstyps­prissättning, sängkonfigurationer, frukost­alternativ och in-/utchecknings­spårning. Den varumärkesanpassade bokningssidan ger gästerna en professionell bokningsupplevelse.",
  "useCases.guesthouse": "Gästhusbokningar",
  "useCases.guesthouseDesc": "Gästhus och B&B behöver ett enkelt system för att hantera gästvistelser, tillgänglighet och kommunikation utan företags­programvarans komplexitet.",
  "useCases.guesthouseChallenges": "Företagshotellsystem är för komplexa och dyra. Kalkylblad och telefonbokningar missar reserveringar. Ingen automatiserad gästkommunikation. Svårt att visa tillgänglighet online.",
  "useCases.guesthouseSolution": "MimmoBook erbjuder ett enkelt, prisvärt bokningssystem dimensionerat för gästhus. Gäster bokar direkt via din varumärkesanpassade sida. Automatiserade e-postmeddelanden hanterar bekräftelser och påminnelser.",
  "useCases.catering": "Cateringbeställningar",
  "useCases.cateringDesc": "Cateringföretag behöver hantera leveransdetaljer, menyval, specialkost och evenemangsspecifik logistik för varje beställning.",
  "useCases.cateringChallenges": "Beställningsdetaljer försvinner i e-postkedjor. Specialkost missas. Ingen centraliserad vy över kommande beställningar. Manuell samordning slösar tid.",
  "useCases.cateringSolution": "MimmoBook samlar alla cateringdetaljer i strukturerade bokningsformulär. Leveransadresser, kostinformation och gästantal lagras per beställning.",
  "useCases.popup": "Popup-evenemang och marknader",
  "useCases.popupDesc": "Popup-arrangemang behöver hantera leverantörsansökningar, ståndstilldelning och evenemangslogistik på tillfälliga platser.",
  "useCases.popupChallenges": "Leverantörshantering via e-post är kaotisk. Ståndstilldelning spåras manuellt. Ingen centraliserad vy över leverantörsdetaljer. Avgiftsspårning är inkonsekvent.",
  "useCases.popupSolution": "MimmoBooks popup-bokningstyp samlar ståndstorlek, avgifter, utrustningsbehov och leverantörsdetaljer. Arrangörer ser alla ansökningar i en instrumentpanel med godkännandeflöden.",
  "useCases.ctaTitle": "Hittade du ditt användningsfall?",
  "useCases.ctaSubtitle": "Starta din 30-dagars gratis provperiod och skapa din första bokningssida på minuter.",

  // Blog
  "blog.badge": "Blogg",
  "blog.heroTitle": "Insikter och guider för besöksnäringen",
  "blog.heroSubtitle": "Tips, bästa praxis och insikter för besöksnäringsföretag som hanterar bokningar.",
  "blog.readMore": "Läs mer",
  "blog.backToBlog": "Tillbaka till bloggen",
  "blog.postCta": "Redo att effektivisera dina bokningar?",
  "blog.ctaTitle": "Håll dig uppdaterad",
  "blog.ctaSubtitle": "Testa MimmoBook gratis i 30 dagar och se hur det förändrar din bokningshantering.",
  "blog.catInsights": "Insikter",
  "blog.catGuides": "Guider",
  "blog.post1Title": "5 bokningsutmaningar som små besöksnäringsföretag möter",
  "blog.post1Excerpt": "Från uteblivanden till dubbelbokningar, små restauranger, lokaler och gästhus möter unika utmaningar. Här är de och hur man löser dem.",
  "blog.post1C1": "Små besöksnäringsföretag, såsom restauranger med en handfull bord, boutiquelokaler och familjedrivna gästhus, möter bokningsutmaningar som större verksamheter löser med dedikerad personal och företagsprogramvara. Men för ett företag med 5 till 30 platser är dessa lösningar överdimensionerade.",
  "blog.post1C2": "Den första utmaningen är uteblivanden. När ett bord för fyra inte dyker upp på en restaurang med 20 platser, försvinner 20% av kapaciteten. Automatiska påminnelsemeddelanden 24 timmar före en bokning kan minska uteblivandena med 30 till 50%.",
  "blog.post1C3": "Den andra utmaningen är dubbelbokningar. När bokningar kommer via telefon, e-post, Instagram-meddelanden och walk-ins, är det lätt att boka samma bord eller rum dubbelt. Ett centraliserat bokningssystem med realtidstillgänglighet eliminerar detta helt.",
  "blog.post1C4": "För det tredje är gästkommunikationen inkonsekvent. Vissa gäster får bekräftelsemeddelande, andra inte. Automatiserade e-postflöden säkerställer att varje gäst får samma professionella upplevelse.",
  "blog.post1C5": "För det fjärde är intäktsspårning manuell och felbenägen. Små företag använder ofta kalkylblad eller papper för att spåra bokningar. Ett bokningssystem med inbyggd rapportering löser detta. För det femte lider onlinesynligheten. Utan en professionell bokningssida kan potentiella gäster inte enkelt hitta tillgänglighet.",
  "blog.post2Title": "Varför kalkylblad inte fungerar för bokningshantering",
  "blog.post2Excerpt": "Kalkylblad är flexibla men skapar problem för bokningshantering. Här är varför dedikerad programvara är värd bytet.",
  "blog.post2C1": "Kalkylblad är standardverktyget för många småföretag. De är gratis, flexibla och välkända. Men för bokningshantering skapar de problem som förvärras med tiden.",
  "blog.post2C2": "Det största problemet är att kalkylblad inte är realtid. När två medarbetare uppdaterar samma ark uppstår konflikter. Det finns ingen live-tillgänglighetsvy, så personalen måste kontrollera manuellt före varje bekräftelse.",
  "blog.post2C3": "Kalkylblad kan inte heller skicka e-post. Varje bekräftelse, påminnelse och avbokning måste hanteras manuellt. Ett dedikerat bokningssystem automatiserar all gästkommunikation.",
  "blog.post2C4": "Slutligen erbjuder kalkylblad ingen analys. Du kan inte enkelt se beläggningsgrader, bokningstrender eller intäkter per bokningstyp utan komplexa formler. Bokningsprogramvara genererar dessa rapporter automatiskt.",
  "blog.post3Title": "Varför varumärkesanpassade bokningssidor är viktiga för ditt företag",
  "blog.post3Excerpt": "Ett generiskt bokningsformulär berättar inget om ditt varumärke. En varumärkesanpassad bokningssida bygger förtroende och ökar konverteringar.",
  "blog.post3C1": "När en gäst besöker din bokningssida är det ofta deras första interaktion med ditt företag online. Om sidan är ett generiskt formulär utan varumärkesanpassning skickar det fel budskap.",
  "blog.post3C2": "En varumärkesanpassad bokningssida, med din logotyp, färger, huvudbild och företagsbeskrivning, skapar ett professionellt första intryck. Studier visar att varumärkesanpassade bokningsupplevelser har 20 till 40% högre konverteringsgrad.",
  "blog.post3C3": "MimmoBook låter varje företag anpassa sin bokningssida med sitt eget varumärke. Ladda upp din logotyp, ställ in dina färger, lägg till en huvudbild och skriv en beskrivning. Resultatet är en bokningsupplevelse som känns som en förlängning av din webbplats.",
  "blog.post4Title": "Hantera bokningar på flera platser",
  "blog.post4Excerpt": "Besöksnäringsföretag med flera platser behöver centraliserade verktyg. Så hanterar du bokningar på flera platser utan att tappa kontrollen.",
  "blog.post4C1": "Att driva flera besöksnäringsplatser, till exempel en restauranggrupp, gästhuskedja eller lokaler i olika städer, mångdubblar bokningshanteringens komplexitet.",
  "blog.post4C2": "Utmaningen är att upprätthålla konsekvens samtidigt som man respekterar varje plats unika behov. Ett centraliserat system låter dig hantera alla platser från en instrumentpanel med separata bokningssidor, personalbehörigheter och rapporter per plats.",
  "blog.post4C3": "MimmoBooks funktion för flera platser är designad för detta. Varje plats får sin egen varumärkesanpassade bokningssida, personaluppdrag och rapportering.",
  "blog.post4C4": "Den viktigaste fördelen är synlighet. Istället för att logga in på separata system eller kontrollera flera kalkylblad ser du alla dina platser på ett ställe.",

  // Nav new pages
  "nav.features": "Funktioner",
  "nav.useCases": "Användningsfall",
  "nav.blog": "Blogg",
  "nav.whatIs": "Vad är MimmoBook?",
  "nav.offers": "Erbjudanden",
  "nav.kitchen": "Kök",
  "nav.bookingLog": "Bokningslogg",
  "bookingLog.title": "Bokningsvalideringslogg",
  "bookingLog.tooltip": "Varje bokningsförsök loggas här med kapacitetskontext, så du ser exakt varför en begäran accepterades, varnades för eller avvisades.",
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
  "bookingLog.softWarningToast": "Bokning sparad, men datumet är nära eller över kapaciteten.",

  "kitchen.title": "Köksbeställningar",
  "kitchen.tooltip": "Följ mat-, dryck- och andra beställningar för restaurang- och festlokalbokningar",
  "kitchen.date": "Datum",
  "kitchen.today": "Idag",
  "kitchen.noReservations": "Inga restaurang- eller festlokalbokningar detta datum.",
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
  "kitchen.menu.empty": "Inga menyobjekt än. Lägg till vanliga objekt för att snabbt infoga dem i beställningar.",
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
  "offers.tooltip": "Skapa och hantera erbjudanden för evenemang och gruppbokningar",
  "offers.create": "Nytt erbjudande",
  "offers.edit": "Redigera erbjudande",
  "offers.empty": "Inga erbjudanden ännu",
  "offers.noResults": "Inga erbjudanden matchar din sökning",
  "offers.searchPlaceholder": "Sök erbjudanden...",
  "offers.showArchived": "Visa arkiverade",
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

  // Tier-gränsfel
  "tierError.STAFF_USER_LIMIT_REACHED": "Din plan tillåter upp till {limit} användare. Uppgradera för att lägga till fler teammedlemmar.",
  "tierError.SITE_LIMIT_REACHED": "Din plan tillåter upp till {limit} plats. Uppgradera till Business för att hantera flera platser.",
  "tierError.RESERVATION_TYPE_LIMIT_REACHED": "Din plan tillåter upp till {limit} bokningstyp. Uppgradera för fler bokningskategorier.",
  "tierError.RESOURCE_PER_TYPE_LIMIT_REACHED": "Din plan tillåter endast {limit} resurs per typ. Uppgradera till Business för obegränsade resurser.",
};

export const translations: Record<Language, TranslationKeys> = { en, fi, sv };
