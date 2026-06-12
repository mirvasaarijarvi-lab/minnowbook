# Records of Processing Activities (RoPA)

Maintained pursuant to Article 30 GDPR. Internal document, available to supervisory authorities on request.

Last updated: 2026-06-12
Owner: MimmoBook Data Protection contact, privacy@mimmobook.com

---

## 1. Controller and contact

- Name: MimmoBook
- Address: Helsinki, Finland
- Contact: privacy@mimmobook.com
- Representative in the EU: N/A (established in the EU)
- DPO: Not formally required, internal data protection contact above

---

## 2. Processing activities

### 2.1 Customer account management
- **Purpose**: Allow users to create and manage MimmoBook accounts.
- **Legal basis**: Art. 6(1)(b) GDPR, performance of contract.
- **Data subjects**: Tenant owners, admins, staff.
- **Data categories**: Email, hashed password, display name, role, MFA factor metadata.
- **Recipients**: Internal staff (least privilege), Supabase (hosting subprocessor).
- **Transfers**: None outside EEA for primary storage. Authentication tokens are processed in EU.
- **Retention**: For the lifetime of the account plus 30 day cancellation window. See `/legal/retention`.
- **Security**: TLS, hashed credentials (bcrypt), MFA, RLS, audit log.

### 2.2 Reservation processing
- **Purpose**: Allow tenants to receive and manage guest reservations.
- **Legal basis**: Art. 6(1)(b) and Art. 6(1)(f) (legitimate interest of the tenant in running their business).
- **Data subjects**: End guests of the tenant.
- **Data categories**: Name, email, phone, reservation details, optional dietary notes.
- **Recipients**: Tenant staff with role-based access, Supabase (subprocessor), Resend (email).
- **Transfers**: SCCs in place for email delivery via Resend.
- **Retention**: Active until tenant deletes, archived 30 days post-event, permanently deleted after 400 days.
- **Security**: RLS, audit log, tenant-scoped queries, signed URLs for private files.

### 2.3 Marketing communications
- **Purpose**: Product updates, newsletters.
- **Legal basis**: Art. 6(1)(a) consent for newsletters; Art. 6(1)(f) for in-product transactional updates.
- **Data subjects**: Account holders who opt in.
- **Data categories**: Email, name, opt-in metadata.
- **Recipients**: Resend.
- **Retention**: Until opt-out. Suppressions retained indefinitely to honor unsubscribes.
- **Security**: List-Unsubscribe header, one-click unsubscribe tokens.

### 2.4 Analytics
- **Purpose**: Understand aggregated marketing site traffic.
- **Legal basis**: Art. 6(1)(a), consent via cookie banner. Default DENIED before consent.
- **Data subjects**: Marketing site visitors.
- **Data categories**: Anonymised page views, device, country.
- **Recipients**: Google Analytics 4, Google Tag Manager.
- **Transfers**: SCCs in place.
- **Retention**: 14 months in GA4.

### 2.5 Billing
- **Purpose**: Subscription billing and payments.
- **Legal basis**: Art. 6(1)(b) contract; Art. 6(1)(c) accounting law obligations.
- **Data subjects**: Tenant owners and billing contacts.
- **Data categories**: Billing name, address, VAT id, invoice history. Card data never reaches MimmoBook.
- **Recipients**: Stripe.
- **Transfers**: SCCs in place.
- **Retention**: 7 years to comply with Finnish accounting law.

### 2.6 Support
- **Purpose**: Respond to support requests.
- **Legal basis**: Art. 6(1)(b).
- **Data subjects**: Account holders and end guests writing to support.
- **Data categories**: Email, message content.
- **Recipients**: Internal support staff.
- **Retention**: 24 months after the request is resolved.

### 2.7 Security and abuse prevention
- **Purpose**: Detect and prevent abuse of public booking pages and uploads.
- **Legal basis**: Art. 6(1)(f), legitimate interest in protecting the service.
- **Data subjects**: Public booking page visitors, uploaders.
- **Data categories**: Validation signals, IP hash, user-agent, upload metadata.
- **Retention**: 7 to 30 days depending on signal type.

---

## 3. Technical and organisational measures (TOMs)

- TLS 1.2+ in transit, AES-256 at rest.
- Row Level Security (RLS) on every public table, tenant scoping enforced at the database.
- Hashed credentials with bcrypt, password breach detection (HIBP), 12-character minimum.
- MFA available, mandatory for system admins.
- Audit log for all sensitive changes, retained 90 days.
- Least-privilege production access, MFA-gated.
- Automated daily backups, 30 day rolling, encrypted.
- Vulnerability scanning on every deploy, forced dependency overrides for known CVEs.
- Incident response runbook with 72 hour breach notification SLA.

---

## 4. Subprocessors

See `/legal/subprocessors` for the full list, including processing region and SCC status.

---

## 5. Review cadence

This RoPA is reviewed at least every 12 months, and within 30 days of any material change to processing activities, subprocessors, or applicable law.
