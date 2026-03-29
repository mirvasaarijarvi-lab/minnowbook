import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Resend confirmation emails to users who signed up but never confirmed.
// Runs daily via pg_cron. Resends up to 3 times over 5 days, then stops.
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

  // Get all unconfirmed users
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  })

  if (listError) {
    console.error('Failed to list users:', listError)
    return new Response(
      JSON.stringify({ error: 'Failed to list users' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const unconfirmedUsers = (users || []).filter(
    (u) => !u.email_confirmed_at && u.email
  )

  if (!unconfirmedUsers.length) {
    console.log('No unconfirmed users found')
    return new Response(
      JSON.stringify({ processed: 0, message: 'No unconfirmed users' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let resent = 0
  let skipped = 0

  for (const user of unconfirmedUsers) {
    const signupAge = Date.now() - new Date(user.created_at).getTime()
    const signupAgeHours = signupAge / (1000 * 60 * 60)

    // Skip users older than 5 days — they've had their chance
    if (signupAgeHours > 120 + 12) {
      skipped++
      continue
    }

    // Count how many confirmation resends we've already done for this user
    const { count: previousResends } = await supabase
      .from('email_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_email', user.email!)
      .eq('template_name', 'signup_resend')
      .in('status', ['sent', 'pending'])

    const totalResends = previousResends || 0

    if (totalResends >= MAX_RESENDS) {
      skipped++
      continue
    }

    // Check if user is within a resend window
    // Find the next window they haven't been sent for yet
    const nextWindowIndex = totalResends // 0-indexed: 0=24h, 1=72h, 2=120h
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
        email: user.email!,
      })

      if (resendError) {
        console.error(`Failed to resend to ${user.email}:`, resendError.message)
        await supabase.from('email_send_log').insert({
          message_id: `resend-${user.id}-${nextWindowIndex}`,
          template_name: 'signup_resend',
          recipient_email: user.email!,
          status: 'failed',
          error_message: resendError.message.slice(0, 1000),
        })
        continue
      }

      // Log the resend
      await supabase.from('email_send_log').insert({
        message_id: `resend-${user.id}-${nextWindowIndex}`,
        template_name: 'signup_resend',
        recipient_email: user.email!,
        status: 'sent',
      })

      console.log(`Resent confirmation to ${user.email} (window ${nextWindowIndex + 1}/${MAX_RESENDS})`)
      resent++
    } catch (err) {
      console.error(`Unexpected error resending to ${user.email}:`, err)
    }

    // Small delay between sends
    await new Promise((r) => setTimeout(r, 500))
  }

  console.log(`Resend complete: ${resent} resent, ${skipped} skipped out of ${unconfirmedUsers.length} unconfirmed`)

  return new Response(
    JSON.stringify({
      processed: unconfirmedUsers.length,
      resent,
      skipped,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
