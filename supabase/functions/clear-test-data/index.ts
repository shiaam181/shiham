import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: userError } = await adminClient.auth.getClaims(token)
    if (userError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub as string

    // Check developer role
    const { data: role } = await adminClient.from('user_roles').select('role').eq('user_id', userId).single()
    if (role?.role !== 'developer') {
      return new Response(JSON.stringify({ error: 'Only developers can clear data' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { action } = await req.json()

    if (action === 'clear_all_data') {
      // Clear in order to respect foreign keys
      await adminClient.from('employee_live_locations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('employee_consent').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('attendance_challenges').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('leave_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('face_reference_images').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('notification_prefs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('user_seen_updates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('invite_usage_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      return new Response(JSON.stringify({ success: true, message: 'All test data cleared' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'delete_employee') {
      const { user_id: targetUserId } = await req.json().catch(() => ({}))
      // Already parsed above, re-parse body
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
