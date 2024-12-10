import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export interface Website {
  id: string;
  domain: string;
  last_crawled_at: string;
}

export async function getOrCreateWebsite(domain: string): Promise<Website> {
  // First try to find existing website
  const { data: existing, error: fetchError } = await supabase
    .from('websites')
    .select('*')
    .eq('domain', domain)
    .single();

  if (existing) {
    // Update last crawled timestamp
    const { error: updateError } = await supabase
      .from('websites')
      .update({ last_crawled_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`Failed to update website timestamp: ${updateError.message}`);
    }
    
    return existing;
  }

  // Create new website if none exists
  const { data: newWebsite, error: createError } = await supabase
    .from('websites')
    .insert({
      domain,
      last_crawled_at: new Date().toISOString()
    })
    .select()
    .single();

  if (createError || !newWebsite) {
    throw new Error(`Failed to create website record: ${createError?.message}`);
  }

  return newWebsite;
}

export async function savePage(websiteId: string, url: string, title: string, content: string) {
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .upsert({
      website_id: websiteId,
      url,
      title,
      content,
      last_crawled_at: new Date().toISOString()
    })
    .select()
    .single();

  if (pageError) {
    throw new Error(`Failed to save page: ${pageError.message}`);
  }

  return page;
}

export async function saveLink(sourcePageId: string, targetUrl: string, anchorText: string, context: string, isInternal: boolean) {
  const { error: linkError } = await supabase
    .from('links')
    .upsert({
      source_page_id: sourcePageId,
      anchor_text: anchorText,
      context,
      is_internal: isInternal,
      url: targetUrl
    });

  if (linkError) {
    console.error('Failed to save link:', linkError);
    // Don't throw here as link saving is not critical
  }
}