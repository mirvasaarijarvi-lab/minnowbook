-- Fix blocked_slots with mismatched 'hotel' type to match tenant's 'guesthouse' type
UPDATE public.blocked_slots SET resource_type = 'guesthouse' WHERE resource_type = 'hotel';
