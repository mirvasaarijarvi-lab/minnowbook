-- Refactor RLS policies: replace get_user_tenant_id(auth.uid()) checks with
-- is_user_tenant_member(auth.uid(), tenant_id) for clearer, multi-tenant-safe semantics.
-- Each policy is dropped and recreated with the new predicate. Behavior is preserved
-- (and becomes correct even if a user belonged to >1 tenant, which the unique
-- constraint on tenant_users.user_id now prevents anyway).

-- access_code_redemptions
DROP POLICY IF EXISTS "Tenant owners can view their redemptions" ON public.access_code_redemptions;
CREATE POLICY "Tenant owners can view their redemptions"
  ON public.access_code_redemptions FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- access_codes
DROP POLICY IF EXISTS "Tenants can view their redeemed access codes" ON public.access_codes;
CREATE POLICY "Tenants can view their redeemed access codes"
  ON public.access_codes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM access_code_redemptions acr
    WHERE acr.access_code_id = access_codes.id
      AND is_user_tenant_member(auth.uid(), acr.tenant_id)
  ));

-- archived_reservations
DROP POLICY IF EXISTS "Owners/admins can manage archived reservations" ON public.archived_reservations;
CREATE POLICY "Owners/admins can manage archived reservations"
  ON public.archived_reservations FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Staff can view archived reservations" ON public.archived_reservations;
CREATE POLICY "Staff can view archived reservations"
  ON public.archived_reservations FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- audit_log
DROP POLICY IF EXISTS "Owners/admins can view audit log" ON public.audit_log;
CREATE POLICY "Owners/admins can view audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));

-- beta_feedback
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.beta_feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.beta_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_user_tenant_member(auth.uid(), tenant_id));

-- blocked_slots
DROP POLICY IF EXISTS "Owners/admins can manage blocked slots" ON public.blocked_slots;
CREATE POLICY "Owners/admins can manage blocked slots"
  ON public.blocked_slots FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Users can view their tenant blocked slots" ON public.blocked_slots;
CREATE POLICY "Users can view their tenant blocked slots"
  ON public.blocked_slots FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- booking_tokens
DROP POLICY IF EXISTS "Owners/admins can delete booking tokens" ON public.booking_tokens;
CREATE POLICY "Owners/admins can delete booking tokens"
  ON public.booking_tokens FOR DELETE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Owners/admins can update booking tokens" ON public.booking_tokens;
CREATE POLICY "Owners/admins can update booking tokens"
  ON public.booking_tokens FOR UPDATE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Owners/admins can view booking tokens" ON public.booking_tokens;
CREATE POLICY "Owners/admins can view booking tokens"
  ON public.booking_tokens FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Staff can create booking tokens" ON public.booking_tokens;
CREATE POLICY "Staff can create booking tokens"
  ON public.booking_tokens FOR INSERT TO authenticated
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id));

-- booking_validation_log
DROP POLICY IF EXISTS "Owners/admins can delete validation log" ON public.booking_validation_log;
CREATE POLICY "Owners/admins can delete validation log"
  ON public.booking_validation_log FOR DELETE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Owners/admins can view validation log" ON public.booking_validation_log;
CREATE POLICY "Owners/admins can view validation log"
  ON public.booking_validation_log FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Tenant members can insert validation log" ON public.booking_validation_log;
CREATE POLICY "Tenant members can insert validation log"
  ON public.booking_validation_log FOR INSERT TO authenticated
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id));

-- discount_codes
DROP POLICY IF EXISTS "Owners/admins can manage discount codes" ON public.discount_codes;
CREATE POLICY "Owners/admins can manage discount codes"
  ON public.discount_codes FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Staff can view discount codes" ON public.discount_codes;
CREATE POLICY "Staff can view discount codes"
  ON public.discount_codes FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- email_send_log
DROP POLICY IF EXISTS "Restrict authenticated access to email_send_log" ON public.email_send_log;
CREATE POLICY "Restrict authenticated access to email_send_log"
  ON public.email_send_log AS RESTRICTIVE FOR ALL TO authenticated
  USING (is_system_admin(auth.uid())
    OR (tenant_id IS NOT NULL
        AND is_user_tenant_member(auth.uid(), tenant_id)
        AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
          OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id))))
  WITH CHECK (is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Tenant owners/admins can view own email logs" ON public.email_send_log;
CREATE POLICY "Tenant owners/admins can view own email logs"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL
    AND is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));

-- guest_reviews
DROP POLICY IF EXISTS "Owners/admins can delete guest reviews" ON public.guest_reviews;
CREATE POLICY "Owners/admins can delete guest reviews"
  ON public.guest_reviews FOR DELETE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Owners/admins can insert guest reviews" ON public.guest_reviews;
CREATE POLICY "Owners/admins can insert guest reviews"
  ON public.guest_reviews FOR INSERT TO authenticated
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Owners/admins can update guest reviews" ON public.guest_reviews;
CREATE POLICY "Owners/admins can update guest reviews"
  ON public.guest_reviews FOR UPDATE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Owners/admins can view guest reviews" ON public.guest_reviews;
CREATE POLICY "Owners/admins can view guest reviews"
  ON public.guest_reviews FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));

-- kitchen_menu_items
DROP POLICY IF EXISTS "Tenant members can delete menu items" ON public.kitchen_menu_items;
CREATE POLICY "Tenant members can delete menu items"
  ON public.kitchen_menu_items FOR DELETE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));
DROP POLICY IF EXISTS "Tenant members can insert menu items" ON public.kitchen_menu_items;
CREATE POLICY "Tenant members can insert menu items"
  ON public.kitchen_menu_items FOR INSERT TO authenticated
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id));
DROP POLICY IF EXISTS "Tenant members can update menu items" ON public.kitchen_menu_items;
CREATE POLICY "Tenant members can update menu items"
  ON public.kitchen_menu_items FOR UPDATE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id));
DROP POLICY IF EXISTS "Tenant members can view menu items" ON public.kitchen_menu_items;
CREATE POLICY "Tenant members can view menu items"
  ON public.kitchen_menu_items FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- kitchen_orders
DROP POLICY IF EXISTS "Tenant members can delete kitchen orders" ON public.kitchen_orders;
CREATE POLICY "Tenant members can delete kitchen orders"
  ON public.kitchen_orders FOR DELETE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));
DROP POLICY IF EXISTS "Tenant members can insert kitchen orders" ON public.kitchen_orders;
CREATE POLICY "Tenant members can insert kitchen orders"
  ON public.kitchen_orders FOR INSERT TO authenticated
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id));
DROP POLICY IF EXISTS "Tenant members can update kitchen orders" ON public.kitchen_orders;
CREATE POLICY "Tenant members can update kitchen orders"
  ON public.kitchen_orders FOR UPDATE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id));
DROP POLICY IF EXISTS "Tenant members can view kitchen orders" ON public.kitchen_orders;
CREATE POLICY "Tenant members can view kitchen orders"
  ON public.kitchen_orders FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- login_history
DROP POLICY IF EXISTS "Owners/admins can view tenant login history" ON public.login_history;
CREATE POLICY "Owners/admins can view tenant login history"
  ON public.login_history FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Users can insert own login history" ON public.login_history;
CREATE POLICY "Users can insert own login history"
  ON public.login_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_user_tenant_member(auth.uid(), tenant_id));

-- notifications
DROP POLICY IF EXISTS "Tenant members can insert notifications" ON public.notifications;
CREATE POLICY "Tenant members can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id));
DROP POLICY IF EXISTS "Tenant members can update notifications" ON public.notifications;
CREATE POLICY "Tenant members can update notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id));
DROP POLICY IF EXISTS "Tenant members can view notifications" ON public.notifications;
CREATE POLICY "Tenant members can view notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- offers
DROP POLICY IF EXISTS "Owners/admins can manage offers" ON public.offers;
CREATE POLICY "Owners/admins can manage offers"
  ON public.offers FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Staff can view offers" ON public.offers;
CREATE POLICY "Staff can view offers"
  ON public.offers FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- recurring_blocked_slots
DROP POLICY IF EXISTS "Owners/admins can manage recurring blocked slots" ON public.recurring_blocked_slots;
CREATE POLICY "Owners/admins can manage recurring blocked slots"
  ON public.recurring_blocked_slots FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Users can view their tenant recurring blocked slots" ON public.recurring_blocked_slots;
CREATE POLICY "Users can view their tenant recurring blocked slots"
  ON public.recurring_blocked_slots FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- reservations
DROP POLICY IF EXISTS "Staff can manage reservations" ON public.reservations;
CREATE POLICY "Staff can manage reservations"
  ON public.reservations FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));
DROP POLICY IF EXISTS "Users can view their tenant reservations" ON public.reservations;
CREATE POLICY "Users can view their tenant reservations"
  ON public.reservations FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- resource_images
DROP POLICY IF EXISTS "Owners/admins can manage resource images" ON public.resource_images;
CREATE POLICY "Owners/admins can manage resource images"
  ON public.resource_images FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Users can view their tenant resource images" ON public.resource_images;
CREATE POLICY "Users can view their tenant resource images"
  ON public.resource_images FOR SELECT
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- resource_opening_hours
DROP POLICY IF EXISTS "Owners/admins can manage resource opening hours" ON public.resource_opening_hours;
CREATE POLICY "Owners/admins can manage resource opening hours"
  ON public.resource_opening_hours FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));

-- resources
DROP POLICY IF EXISTS "Owners/admins can manage resources" ON public.resources;
CREATE POLICY "Owners/admins can manage resources"
  ON public.resources FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Users can view their tenant resources" ON public.resources;
CREATE POLICY "Users can view their tenant resources"
  ON public.resources FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- role_definitions
DROP POLICY IF EXISTS "Owners can manage role definitions" ON public.role_definitions;
CREATE POLICY "Owners can manage role definitions"
  ON public.role_definitions FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id)
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id));
DROP POLICY IF EXISTS "Tenant members can view role definitions" ON public.role_definitions;
CREATE POLICY "Tenant members can view role definitions"
  ON public.role_definitions FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- role_permissions
DROP POLICY IF EXISTS "Owners can manage role permissions" ON public.role_permissions;
CREATE POLICY "Owners can manage role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id)
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id));
DROP POLICY IF EXISTS "Tenant members can view role permissions" ON public.role_permissions;
CREATE POLICY "Tenant members can view role permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- site_settings
DROP POLICY IF EXISTS "Owners/admins can manage site settings" ON public.site_settings;
CREATE POLICY "Owners/admins can manage site settings"
  ON public.site_settings FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Tenant members can view site settings" ON public.site_settings;
CREATE POLICY "Tenant members can view site settings"
  ON public.site_settings FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- site_users
DROP POLICY IF EXISTS "Owners/admins can manage site users" ON public.site_users;
CREATE POLICY "Owners/admins can manage site users"
  ON public.site_users FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Tenant members can view site users" ON public.site_users;
CREATE POLICY "Tenant members can view site users"
  ON public.site_users FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- sites
DROP POLICY IF EXISTS "Owners/admins can manage sites" ON public.sites;
CREATE POLICY "Owners/admins can manage sites"
  ON public.sites FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Tenant members can view their sites" ON public.sites;
CREATE POLICY "Tenant members can view their sites"
  ON public.sites FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- support_requests
DROP POLICY IF EXISTS "Owners/admins can manage support requests" ON public.support_requests;
CREATE POLICY "Owners/admins can manage support requests"
  ON public.support_requests FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Owners/admins can view all tenant support requests" ON public.support_requests;
CREATE POLICY "Owners/admins can view all tenant support requests"
  ON public.support_requests FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Users can create support requests" ON public.support_requests;
CREATE POLICY "Users can create support requests"
  ON public.support_requests FOR INSERT TO authenticated
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id) AND user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own support requests" ON public.support_requests;
CREATE POLICY "Users can view own support requests"
  ON public.support_requests FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id) AND user_id = auth.uid());

-- tenant_email_templates
DROP POLICY IF EXISTS "Owners can manage email templates" ON public.tenant_email_templates;
CREATE POLICY "Owners can manage email templates"
  ON public.tenant_email_templates FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id));
DROP POLICY IF EXISTS "Users can view their tenant email templates" ON public.tenant_email_templates;
CREATE POLICY "Users can view their tenant email templates"
  ON public.tenant_email_templates FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- tenant_opening_hours
DROP POLICY IF EXISTS "Owners/admins can manage opening hours" ON public.tenant_opening_hours;
CREATE POLICY "Owners/admins can manage opening hours"
  ON public.tenant_opening_hours FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Users can view their tenant opening hours" ON public.tenant_opening_hours;
CREATE POLICY "Users can view their tenant opening hours"
  ON public.tenant_opening_hours FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- tenant_settings
DROP POLICY IF EXISTS "Owners/admins can manage tenant settings" ON public.tenant_settings;
CREATE POLICY "Owners/admins can manage tenant settings"
  ON public.tenant_settings FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, tenant_id)));
DROP POLICY IF EXISTS "Users can view their tenant settings" ON public.tenant_settings;
CREATE POLICY "Users can view their tenant settings"
  ON public.tenant_settings FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- tenant_users
DROP POLICY IF EXISTS "Owners can add tenant users" ON public.tenant_users;
CREATE POLICY "Owners can add tenant users"
  ON public.tenant_users FOR INSERT TO authenticated
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id)
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    AND user_id <> auth.uid());
DROP POLICY IF EXISTS "Owners can remove other tenant users" ON public.tenant_users;
CREATE POLICY "Owners can remove other tenant users"
  ON public.tenant_users FOR DELETE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    AND user_id <> auth.uid());
DROP POLICY IF EXISTS "Owners can update other tenant users" ON public.tenant_users;
CREATE POLICY "Owners can update other tenant users"
  ON public.tenant_users FOR UPDATE TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id)
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    AND user_id <> auth.uid())
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id)
    AND has_tenant_role(auth.uid(), 'owner'::app_role, tenant_id)
    AND user_id <> auth.uid());
DROP POLICY IF EXISTS "Users can view their tenant members" ON public.tenant_users;
CREATE POLICY "Users can view their tenant members"
  ON public.tenant_users FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));

-- tenants (note: column is `id`, not `tenant_id`)
DROP POLICY IF EXISTS "Owners can update their tenant" ON public.tenants;
CREATE POLICY "Owners can update their tenant"
  ON public.tenants FOR UPDATE TO authenticated
  USING (is_user_tenant_member(auth.uid(), id)
    AND has_tenant_role(auth.uid(), 'owner'::app_role, id));
DROP POLICY IF EXISTS "Owners/admins can view own tenant" ON public.tenants;
CREATE POLICY "Owners/admins can view own tenant"
  ON public.tenants FOR SELECT TO authenticated
  USING (is_user_tenant_member(auth.uid(), id)
    AND (has_tenant_role(auth.uid(), 'owner'::app_role, id)
      OR has_tenant_role(auth.uid(), 'admin'::app_role, id)));

-- waitlist
DROP POLICY IF EXISTS "Staff can manage waitlist" ON public.waitlist;
CREATE POLICY "Staff can manage waitlist"
  ON public.waitlist FOR ALL TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (is_user_tenant_member(auth.uid(), tenant_id));