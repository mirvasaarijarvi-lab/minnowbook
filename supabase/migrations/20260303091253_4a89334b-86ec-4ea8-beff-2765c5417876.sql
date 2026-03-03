
-- Add test reservations for March 2026
INSERT INTO public.reservations (tenant_id, date, guest_name, guest_email, reservation_type, status, guests_count) VALUES
-- Restaurant: busy on Mar 4, full on Mar 7
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-04', 'Testi Asiakas 1', 'test1@example.com', 'restaurant', 'confirmed', 4),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-04', 'Testi Asiakas 2', 'test2@example.com', 'restaurant', 'pending', 2),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-07', 'Testi Asiakas 3', 'test3@example.com', 'restaurant', 'confirmed', 6),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-07', 'Testi Asiakas 4', 'test4@example.com', 'restaurant', 'confirmed', 3),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-07', 'Testi Asiakas 5', 'test5@example.com', 'restaurant', 'pending', 5),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-07', 'Testi Asiakas 6', 'test6@example.com', 'restaurant', 'confirmed', 2),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-07', 'Testi Asiakas 7', 'test7@example.com', 'restaurant', 'pending', 4),
-- Guesthouse: busy on Mar 8, full on Mar 14
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-08', 'Hotel Guest 1', 'hg1@example.com', 'guesthouse', 'confirmed', 2),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-08', 'Hotel Guest 2', 'hg2@example.com', 'guesthouse', 'pending', 1),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-14', 'Hotel Guest 3', 'hg3@example.com', 'guesthouse', 'confirmed', 2),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-14', 'Hotel Guest 4', 'hg4@example.com', 'guesthouse', 'confirmed', 3),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-14', 'Hotel Guest 5', 'hg5@example.com', 'guesthouse', 'pending', 1),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-14', 'Hotel Guest 6', 'hg6@example.com', 'guesthouse', 'confirmed', 2),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-14', 'Hotel Guest 7', 'hg7@example.com', 'guesthouse', 'pending', 1),
-- Venue: busy on Mar 20
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-20', 'Event Corp 1', 'ev1@example.com', 'venue', 'confirmed', 50),
('9ac05fbf-0834-44fd-a52a-d030b7074a30', '2026-03-20', 'Event Corp 2', 'ev2@example.com', 'venue', 'pending', 30);
