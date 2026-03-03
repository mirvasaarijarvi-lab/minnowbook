
-- Insert sites
INSERT INTO sites (tenant_id, name, slug, location, description, is_active)
VALUES 
  ('9ac05fbf-0834-44fd-a52a-d030b7074a30', 'Restaurante Mimmi', 'restaurante-mimmi', NULL, 'Restaurant site', true),
  ('9ac05fbf-0834-44fd-a52a-d030b7074a30', 'Hotel Mimmi', 'hotel-mimmi', NULL, 'Hotel & guesthouse site', true),
  ('9ac05fbf-0834-44fd-a52a-d030b7074a30', 'Eventos Mimmi', 'eventos-mimmi', NULL, 'Event spaces site', true);

-- Assign restaurant resources to restaurant site
UPDATE resources SET site_id = (SELECT id FROM sites WHERE slug = 'restaurante-mimmi' AND tenant_id = '9ac05fbf-0834-44fd-a52a-d030b7074a30')
WHERE resource_type = 'restaurant' AND tenant_id = '9ac05fbf-0834-44fd-a52a-d030b7074a30';

-- Assign guesthouse resources to hotel site
UPDATE resources SET site_id = (SELECT id FROM sites WHERE slug = 'hotel-mimmi' AND tenant_id = '9ac05fbf-0834-44fd-a52a-d030b7074a30')
WHERE resource_type = 'guesthouse' AND tenant_id = '9ac05fbf-0834-44fd-a52a-d030b7074a30';

-- Assign venue resources to event spaces site
UPDATE resources SET site_id = (SELECT id FROM sites WHERE slug = 'eventos-mimmi' AND tenant_id = '9ac05fbf-0834-44fd-a52a-d030b7074a30')
WHERE resource_type = 'venue' AND tenant_id = '9ac05fbf-0834-44fd-a52a-d030b7074a30';
