import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    console.log('Analyzing URL:', url)

    if (!url) {
      throw new Error('URL is required')
    }

    // Create a Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl!, supabaseKey!)

    // Mock analysis results for now
    const mockSuggestions = [
      {
        sourceUrl: url + '/blog',
        targetUrl: url + '/products',
        suggestedAnchorText: 'View our products',
        relevanceScore: 0.95,
        context: 'This blog post discusses features that are available in our product lineup.'
      },
      {
        sourceUrl: url + '/about',
        targetUrl: url + '/contact',
        suggestedAnchorText: 'Contact us',
        relevanceScore: 0.85,
        context: 'Learn more about our team and get in touch with us.'
      }
    ]

    // Store analysis results in the database
    const { data, error } = await supabase
      .from('page_analysis')
      .insert({
        url,
        title: 'Sample Page Title',
        content: 'Sample page content...',
        main_keywords: ['sample', 'keywords'],
        suggestions: mockSuggestions
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        totalLinks: 15,
        issues: 3,
        status: 'complete',
        suggestions: mockSuggestions
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})