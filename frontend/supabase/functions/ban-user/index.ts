import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to verify the user is an admin
async function verifyAdmin(req: Request): Promise<{ user: any; error: string | null }> {
  const userSupabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )

  const { data: { user }, error: authError } = await userSupabaseClient.auth.getUser()

  if (authError || !user) {
    return { user: null, error: 'Unauthorized: ' + (authError?.message || 'Invalid session') }
  }

  const userRoles = user.user_metadata?.roles as string[] | undefined;
  const isLegacyAdmin = user.user_metadata?.role === 'admin';
  const isAdmin = isLegacyAdmin || userRoles?.includes('admin');

  if (!isAdmin) {
    return { user: null, error: 'Forbidden: User is not an admin.' }
  }

  return { user, error: null }
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify the calling user is an admin
    const { user: adminUser, error: adminError } = await verifyAdmin(req);
    if (adminError) {
      return new Response(JSON.stringify({ error: adminError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Parse request body
    const { userId, ban } = await req.json()
    if (!userId || typeof ban !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Invalid request: userId and ban status (boolean) are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prevent an admin from banning themselves
    if (adminUser.id === userId) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot ban yourself.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // 3. Create service role client
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Update the profile's is_banned status
    const { error: updateError } = await supabaseAdminClient
      .from('profiles')
      .update({ is_banned: ban, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (updateError) {
      console.error('Supabase profile ban update error:', updateError);
      throw updateError
    }

    // 5. Return success
    return new Response(JSON.stringify({ message: `User ${ban ? 'banned' : 'unbanned'} successfully` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Caught unhandled error in ban-user function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})