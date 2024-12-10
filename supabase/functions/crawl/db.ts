import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface Website {
  id: string;
  domain: string;
  last_crawled_at: string;
}

export async function getOrCreateWebsite(domain: string): Promise<Website> {
  console.log('Looking up website for domain:', domain);
  
  try {
    // First try to find existing website
    const { data: existingWebsite, error: fetchError } = await supabase
      .from('websites')
      .select('*')
      .eq('domain', domain)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching website:', fetchError);
      throw new Error(`Database error: ${fetchError.message}`);
    }

    if (existingWebsite) {
      console.log('Found existing website:', existingWebsite);
      
      // Update last_crawled_at
      const { error: updateError } = await supabase
        .from('websites')
        .update({ last_crawled_at: new Date().toISOString() })
        .eq('id', existingWebsite.id);

      if (updateError) {
        console.error('Error updating website:', updateError);
        throw new Error(`Failed to update website: ${updateError.message}`);
      }

      return existingWebsite;
    }

    // Create new website if none exists
    console.log('Creating new website for domain:', domain);
    const { data: newWebsite, error: createError } = await supabase
      .from('websites')
      .insert([{
        domain,
        last_crawled_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError || !newWebsite) {
      console.error('Error creating website:', createError);
      throw new Error(`Failed to create website: ${createError?.message}`);
    }

    console.log('Created new website:', newWebsite);
    return newWebsite;

  } catch (error) {
    console.error('Error in getOrCreateWebsite:', error);
    throw error;
  }
}

export async function savePage(websiteId: string, url: string, title: string, content: string) {
  console.log('Saving page:', { websiteId, url, title });
  
  try {
    const { data: page, error } = await supabase
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

    if (error) {
      console.error('Error saving page:', error);
      throw new Error(`Failed to save page: ${error.message}`);
    }

    return page;
  } catch (error) {
    console.error('Error in savePage:', error);
    throw error;
  }
}

export async function saveLink(
  sourcePageId: string,
  targetUrl: string,
  anchorText: string,
  context: string,
  isInternal: boolean
) {
  console.log('Saving link:', { sourcePageId, targetUrl, anchorText, isInternal });
  
  try {
    const { error } = await supabase
      .from('links')
      .insert({
        source_page_id: sourcePageId,
        anchor_text: anchorText,
        context,
        is_internal: isInternal,
        url: targetUrl
      });

    if (error) {
      console.error('Error saving link:', error);
      // Don't throw here as link saving is not critical
    }
  } catch (error) {
    console.error('Error in saveLink:', error);
    // Don't throw here as link saving is not critical
  }
}