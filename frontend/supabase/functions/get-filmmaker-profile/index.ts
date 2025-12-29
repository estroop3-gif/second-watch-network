import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { username } = await req.json()
    if (!username) {
      throw new Error("Username is required.")
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables in Edge Function.")
      throw new Error("Server configuration error.")
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // 1. Get user ID from profiles table
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, location_visible')
      .eq('username', username)
      .single()

    if (userError && userError.code === 'PGRST116') {
      return new Response(JSON.stringify({ profile: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (userError) {
      console.error('Error fetching user by username:', userError.message)
      throw userError
    }
    
    if (!userProfile) {
        return new Response(JSON.stringify({ profile: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    const userId = userProfile.id

    // 2. Fetch the core filmmaker profile with specific columns for efficiency
    const { data: filmmakerProfile, error: filmmakerError } = await supabaseAdmin
      .from('filmmaker_profiles')
      .select('full_name, profile_image_url, bio, department, experience_level, skills, location, portfolio_website, reel_links, accepting_work, show_email, available_for, preferred_locations, contact_method')
      .eq('user_id', userId)
      .single()

    if (filmmakerError) {
      if (filmmakerError.code === 'PGRST116') {
        return new Response(JSON.stringify({ profile: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      console.error('Error fetching filmmaker profile:', filmmakerError.message)
      throw filmmakerError
    }

    // 3. Fetch credits and their related productions with specific columns
    const { data: credits, error: creditsError } = await supabaseAdmin
      .from('credits')
      .select('id, position, production_date, productions(title, slug)')
      .eq('user_id', userId)
      .eq('visibility', 'public')

    if (creditsError) {
      console.error("Error fetching credits:", creditsError.message)
      throw creditsError
    }

    // 4. Fetch email only if the profile settings allow it
    let email = null
    if (filmmakerProfile.show_email) {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (authError) {
        console.error("Error fetching user email:", authError.message)
      }
      if (authUser && authUser.user) {
        email = authUser.user.email
      }
    }

    // 5. Combine all the data into the final profile object
    const finalLocation = userProfile.location_visible ? filmmakerProfile.location : null;

    const fullProfile = {
      ...filmmakerProfile,
      user_id: userId,
      location: finalLocation,
      display_name: userProfile.display_name,
      profile: { username: userProfile.username },
      credits: credits || [],
      email: email,
    }

    return new Response(JSON.stringify({ profile: fullProfile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Edge function final catch:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})