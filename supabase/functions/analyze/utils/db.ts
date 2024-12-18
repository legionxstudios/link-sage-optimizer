import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "./logger.ts";

export async function saveAnalysisResults(url: string, title: string, content: string, keywords: any, suggestions: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: analysisError } = await supabase
      .from('page_analysis')
      .upsert({
        url,
        title,
        content,
        main_keywords: keywords.exact_match,
        seo_keywords: keywords,
        suggestions,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'url'
      });

    if (analysisError) {
      throw analysisError;
    }

    logger.info('Analysis results saved successfully');
  } catch (error) {
    logger.error('Error saving analysis results:', error);
    throw error;
  }
}