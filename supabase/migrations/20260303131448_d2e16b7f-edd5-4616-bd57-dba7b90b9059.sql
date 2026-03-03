-- Create a test discount code
INSERT INTO public.discount_codes (tenant_id, code, discount_type, discount_value, is_active, description)
VALUES ('9ac05fbf-0834-44fd-a52a-d030b7074a30', 'TEST20', 'percentage', 20, true, 'Test 20% discount');

-- Create a test reservation using that discount code
INSERT INTO public.reservations (
  tenant_id, site_id, guest_name, guest_email, reservation_type, date, start_time, status,
  discount_type, discount_value, discount_reason,
  discount_code_id
)
VALUES (
  '9ac05fbf-0834-44fd-a52a-d030b7074a30',
  'b040ab30-f4d2-45cc-8695-2000572428d7',
  'Discount Test Guest',
  'discount-test@example.com',
  'restaurant',
  '2026-03-05',
  '19:00',
  'confirmed',
  'percentage',
  20,
  'Promo code: TEST20',
  (SELECT id FROM public.discount_codes WHERE code = 'TEST20' AND tenant_id = '9ac05fbf-0834-44fd-a52a-d030b7074a30' LIMIT 1)
);