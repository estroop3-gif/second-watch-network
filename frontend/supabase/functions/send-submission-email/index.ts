import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

// NOTE: You need to add and verify 'secondwatch.network' as a domain in your Resend account.
// The RESEND_API_KEY secret is already configured for you.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = "secondwatchnetwork@gmail.com" 
const FROM_EMAIL = "noreply@secondwatch.network" // This must be a verified domain in Resend

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const submission = await req.json()

    const emailHtml = `
      <h1>New Submission Received</h1>
      <p>A new project has been submitted to Second Watch Network.</p>
      <ul>
        <li><strong>Project Title:</strong> ${submission.project_title}</li>
        <li><strong>Submitter:</strong> ${submission.name} (${submission.email})</li>
        <li><strong>Type:</strong> ${submission.project_type}</li>
        <li><strong>Logline:</strong> ${submission.logline}</li>
        <li><strong>Description:</strong> ${submission.description}</li>
        <li><strong>YouTube Link:</strong> <a href="${submission.youtube_link}">${submission.youtube_link}</a></li>
      </ul>
      <p>Please log in to the admin panel to review it.</p>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Second Watch Network <${FROM_EMAIL}>`,
        to: [ADMIN_EMAIL],
        subject: `New Submission: ${submission.project_title}`,
        html: emailHtml,
      }),
    })

    if (!res.ok) {
      const errorBody = await res.json();
      console.error('Failed to send email:', errorBody);
      throw new Error(`Resend API Error: ${errorBody.message}`);
    }

    return new Response(JSON.stringify({ message: "Email sent successfully" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})