import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/http-headers.ts";

// Resend confirmation emails to users who signed up but never confirmed.
// Runs every 6 hours via pg_cron. Resends up to 3 times over 5 days, then stops.
// Schedule: Day 1 (24h after signup), Day 3, Day 5.

const RESEND_WINDOWS_HOURS = [24, 72, 120] // 1 day, 3 days, 5 days
const MAX_RESENDS = 3

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Query unconfirmed users directly — users who signed up within the last 6 days
  // and still haven't confirmed their email
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  
  const { data: unconfirmedRows, error: queryError } = await supabase
    .rpc('get_unconfirmed_users', { since_date: sixDaysAgo })

  if (queryError) {
    console.error('Failed to query unconfirmed users:', queryError)
    return new Response(
      JSON.stringify({ error: 'Failed to query unconfirmed users' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!unconfirmedRows?.length) {
    console.log('No unconfirmed users found')
    return new Response(
      JSON.stringify({ processed: 0, message: 'No unconfirmed users' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let resent = 0
  let skipped = 0

  for (const row of unconfirmedRows) {
    const signupAge = Date.now() - new Date(row.created_at).getTime()
    const signupAgeHours = signupAge / (1000 * 60 * 60)

    // Skip users older than 5.5 days
    if (signupAgeHours > 132) {
      skipped++
      continue
    }

    // Count how many confirmation resends we've already done for this user
    const { count: previousResends } = await supabase
      .from('email_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_email', row.email)
      .eq('template_name', 'signup_resend')
      .in('status', ['sent', 'pending'])

    const totalResends = previousResends || 0

    if (totalResends >= MAX_RESENDS) {
      skipped++
      continue
    }

    // Find the next window they haven't been sent for yet
    const nextWindowIndex = totalResends
    if (nextWindowIndex >= RESEND_WINDOWS_HOURS.length) {
      skipped++
      continue
    }

    const requiredAgeHours = RESEND_WINDOWS_HOURS[nextWindowIndex]
    if (signupAgeHours < requiredAgeHours) {
      skipped++
      continue
    }

    // Resend the confirmation email using Supabase Auth's built-in resend
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: row.email,
      })

      if (resendError) {
        console.error(`Failed to resend to ${row.email}:`, resendError.message)
        await supabase.from('email_send_log').insert({
          message_id: `resend-${row.id}-${nextWindowIndex}`,
          template_name: 'signup_resend',
          recipient_email: row.email,
          status: 'failed',
          error_message: resendError.message.slice(0, 1000),
        })
        continue
      }

      // Log the resend
      await supabase.from('email_send_log').insert({
        message_id: `resend-${row.id}-${nextWindowIndex}`,
        template_name: 'signup_resend',
        recipient_email: row.email,
        status: 'sent',
      })

      console.log(`Resent confirmation to ${row.email} (window ${nextWindowIndex + 1}/${MAX_RESENDS})`)
      resent++
    } catch (err) {
      console.error(`Unexpected error resending to ${row.email}:`, err)
    }

    // Small delay between sends
    await new Promise((r) => setTimeout(r, 500))
  }

  console.log(`Resend complete: ${resent} resent, ${skipped} skipped out of ${unconfirmedRows.length} unconfirmed`)

  return new Response(
    JSON.stringify({
      processed: unconfirmedRows.length,
      resent,
      skipped,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
