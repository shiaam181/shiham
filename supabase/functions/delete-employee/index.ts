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

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: claimsData, error: userError } = await adminClient.auth.getClaims(token)
    if (userError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub as string

    // Get caller's role and company
    const { data: callerRole } = await adminClient.from('user_roles').select('role').eq('user_id', userId).single()
    const { data: callerProfile } = await adminClient.from('profiles').select('company_id').eq('user_id', userId).single()

    const isDev = callerRole?.role === 'developer'
    const isOwner = callerRole?.role === 'owner'

    if (!isDev && !isOwner) {
      return new Response(JSON.stringify({ error: 'Only developers and owners can delete employees' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { target_user_id } = await req.json()
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Can't delete yourself
    if (target_user_id === userId) {
      return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check target's role - no one can delete owners or developers
    const { data: targetRole } = await adminClient.from('user_roles').select('role').eq('user_id', target_user_id).single()
    if (targetRole?.role === 'owner' || targetRole?.role === 'developer') {
      return new Response(JSON.stringify({ error: 'Cannot delete owners or developers' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get target profile
    const { data: targetProfile } = await adminClient.from('profiles').select('company_id').eq('user_id', target_user_id).single()

    // Owner can only delete employees in their company
    if (isOwner && !isDev) {
      if (!callerProfile?.company_id || callerProfile.company_id !== targetProfile?.company_id) {
        return new Response(JSON.stringify({ error: 'Can only delete employees in your company' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Delete related data first
    await adminClient.from('employee_live_locations').delete().eq('user_id', target_user_id)
    await adminClient.from('employee_consent').delete().eq('user_id', target_user_id)
    await adminClient.from('attendance_challenges').delete().eq('user_id', target_user_id)
    await adminClient.from('attendance').delete().eq('user_id', target_user_id)
    await adminClient.from('leave_requests').delete().eq('user_id', target_user_id)
    await adminClient.from('face_reference_images').delete().eq('user_id', target_user_id)
    await adminClient.from('notification_prefs').delete().eq('user_id', target_user_id)
    await adminClient.from('user_seen_updates').delete().eq('user_id', target_user_id)
    await adminClient.from('user_roles').delete().eq('user_id', target_user_id)
    await adminClient.from('profiles').delete().eq('user_id', target_user_id)

    // Delete auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(target_user_id)
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError)
      // Profile and data already deleted, log but don't fail
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
