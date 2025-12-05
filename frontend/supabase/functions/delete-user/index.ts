import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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
    return new Response(null, { headers: corsHeaders })
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

    // 2. Get the user ID to delete from the request body
    const { userId } = await req.json();
    if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID to delete is required.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 3. Prevent an admin from deleting themselves
    if (adminUser.id === userId) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot delete your own account.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 4. Create a Supabase client with the service role key to perform admin actions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 5. Delete the user using the admin client
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(JSON.stringify({ message: "User deleted successfully" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})