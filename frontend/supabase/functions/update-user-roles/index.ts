import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Create a Supabase client with the user's authorization
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Securely get the user and check for authentication errors
    const { data: { user }, error: authError } = await userSupabaseClient.auth.getUser()

    if (authError || !user) {
      console.error('Authentication error in update-user-roles:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized: ' + (authError?.message || 'Invalid session') }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Parse the request body
    const { userId, roles: newRoles } = await req.json()

    if (!userId || !Array.isArray(newRoles)) {
      return new Response(JSON.stringify({ error: 'Invalid request: userId and roles are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // 4. Check for authorization
    const currentUserRoles = user.user_metadata?.roles as string[] || [];
    const isLegacyAdmin = user.user_metadata?.role === 'admin';
    const isAdmin = isLegacyAdmin || currentUserRoles.includes('admin');

    // Allow a user to assign 'free' role to themselves if they currently have no roles.
    const isSelfAssigningFree = 
      user.id === userId &&
      newRoles.length === 1 &&
      newRoles[0] === 'free' &&
      currentUserRoles.length === 0 &&
      !isLegacyAdmin;

    if (!isAdmin && !isSelfAssigningFree) {
      console.error('Admin check failed for user:', user.id);
      return new Response(JSON.stringify({ error: 'Forbidden: User is not an admin and not self-assigning free role.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // Prevent an admin from removing their own admin role
    if (user.id === userId && isAdmin && !newRoles.includes('admin')) {
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot remove your own admin role.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Create a service role client to perform the privileged update
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 6. Perform the update on the profiles table
    const { error: updateError } = await supabaseAdminClient
      .from('profiles')
      .update({ roles: newRoles, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (updateError) {
      console.error('Supabase profile update error:', updateError);
      throw updateError
    }

    // 7. Update user metadata in auth.users to keep session data consistent
    const { data: { user: targetUser }, error: getUserError } = await supabaseAdminClient.auth.admin.getUserById(userId);
    if (getUserError) {
        console.error('Error fetching user to update metadata:', getUserError);
    } else {
        const newMetadata = { ...targetUser.user_metadata, roles: newRoles };
        const { error: adminUserError } = await supabaseAdminClient.auth.admin.updateUserById(
          userId,
          { user_metadata: newMetadata }
        )
        if (adminUserError) {
            console.error('Supabase auth user update error:', adminUserError);
        }
    }

    // 8. Return a success response
    return new Response(JSON.stringify({ message: 'Roles updated successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Caught unhandled error in edge function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})