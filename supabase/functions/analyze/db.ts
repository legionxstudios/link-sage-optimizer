import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function savePageAnalysis(url: string, analysis: any) {
  try {
    const { error } = await supabase
      .from('page_analysis')
      .upsert({
        url,
        title: analysis.title,
        content: analysis.content,
        main_keywords: analysis.keywords.exact_match,
        suggestions: analysis.outboundSuggestions,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'url'
      });

    if (error) {
      console.error('Error saving analysis:', error);
    }
  } catch (error) {
    console.error('Database error:', error);
  }
}