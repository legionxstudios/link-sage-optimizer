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
      .select()
      .eq('domain', domain)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching website:', fetchError);
      throw new Error(`Database error: ${fetchError.message}`);
    }

    if (existingWebsite) {
      console.log('Found existing website:', existingWebsite);
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
  console.log('Saving page:', { websiteId, url, title, contentLength: content.length });
  
  try {
    // First try to find existing page
    const { data: existingPage, error: fetchError } = await supabase
      .from('pages')
      .select()
      .eq('url', url)
      .single();

    if (existingPage) {
      // Update existing page
      const { data: updatedPage, error: updateError } = await supabase
        .from('pages')
        .update({
          title,
          content,
          last_crawled_at: new Date().toISOString()
        })
        .eq('id', existingPage.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating page:', updateError);
        throw new Error(`Failed to update page: ${updateError.message}`);
      }

      console.log('Updated existing page:', updatedPage);
      return updatedPage;
    }

    // Create new page
    const { data: newPage, error: createError } = await supabase
      .from('pages')
      .insert([{
        website_id: websiteId,
        url,
        title,
        content,
        last_crawled_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating page:', createError);
      throw new Error(`Failed to create page: ${createError.message}`);
    }

    console.log('Created new page:', newPage);
    return newPage;
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
        is_internal: isInternal
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

export async function savePageAnalysis(
  url: string,
  title: string,
  content: string,
  mainKeywords: string[],
  outboundLinksCount: number,
  inboundLinksCount: number
) {
  console.log('Saving page analysis:', { 
    url, 
    title, 
    contentLength: content.length,
    outboundLinksCount, 
    inboundLinksCount 
  });
  
  try {
    const { data, error } = await supabase
      .from('page_analysis')
      .insert([{
        url,
        title,
        content,
        main_keywords: mainKeywords,
        outbound_links_count: outboundLinksCount,
        inbound_links_count: inboundLinksCount,
        link_score: calculateLinkScore(outboundLinksCount, inboundLinksCount)
      }])
      .select()
      .single();

    if (error) {
      console.error('Error saving page analysis:', error);
      throw new Error(`Failed to save page analysis: ${error.message}`);
    }

    console.log('Saved page analysis:', data);
    return data;
  } catch (error) {
    console.error('Error in savePageAnalysis:', error);
    throw error;
  }
}

function calculateLinkScore(outbound: number, inbound: number): number {
  // Simple scoring algorithm - can be made more sophisticated
  const balance = Math.min(outbound, inbound) / Math.max(outbound, inbound);
  const quantity = Math.min((outbound + inbound) / 20, 1); // Assume 20 links is "good"
  return (balance * 0.6 + quantity * 0.4) * 5; // Score out of 5
}