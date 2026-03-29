UPDATE email_send_state 
SET auth_email_ttl_minutes = 7200, 
    transactional_email_ttl_minutes = 7200,
    updated_at = now()
WHERE id = 1;