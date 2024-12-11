import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WebsiteRecord, PageRecord } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getOrCreateWebsite(domain: string): Promise<WebsiteRecord> {
  const { data: website, error: websiteError } = await supabase
    .from('websites')
    .upsert({
      domain,
      last_crawled_at: new Date().toISOString()
    }, {
      onConflict: 'domain'
    })
    .select()
    .single();

  if (websiteError) {
    console.error('Error creating/updating website:', websiteError);
    throw new Error(`Failed to create/update website: ${websiteError.message}`);
  }

  return website;
}

export async function savePage(websiteId: string, url: string, title: string, content: string): Promise<PageRecord> {
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .upsert({
      website_id: websiteId,
      url,
      title,
      content,
      last_crawled_at: new Date().toISOString()
    }, {
      onConflict: 'url'
    })
    .select()
    .single();

  if (pageError) {
    console.error('Error saving page:', pageError);
    throw new Error(`Failed to save page: ${pageError.message}`);
  }

  return page;
}

export async function savePageAnalysis(url: string, analysis: any) {
  const { error: analysisError } = await supabase
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

  if (analysisError) {
    console.error('Error saving analysis:', analysisError);
    throw new Error(`Failed to save analysis: ${analysisError.message}`);
  }
}