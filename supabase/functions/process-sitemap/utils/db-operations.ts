import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const processUrlsInDatabase = async (
  domain: string, 
  urls: { url: string; lastModified: string | null }[]
) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Create/update website record
  const { data: website, error: websiteError } = await supabase
    .from('websites')
    .upsert(
      {
        domain,
        last_crawled_at: new Date().toISOString()
      },
      { onConflict: 'domain' }
    )
    .select()
    .single();

  if (websiteError) {
    throw new Error(`Database error while processing website: ${websiteError.message}`);
  }

  console.log('Website record created/updated:', website);

  // Process URLs
  const processedUrls = [];
  for (const pageUrl of urls) {
    try {
      const { error: pageError } = await supabase
        .from('pages')
        .upsert({
          website_id: website.id,
          url: pageUrl.url,
          last_crawled_at: null
        }, {
          onConflict: 'url'
        });

      if (pageError) {
        console.error(`Error upserting page ${pageUrl.url}:`, pageError);
      } else {
        console.log(`Successfully queued page for crawling: ${pageUrl.url}`);
        processedUrls.push(pageUrl.url);
      }
    } catch (error) {
      console.error(`Error processing URL ${pageUrl.url}:`, error);
    }
  }

  return processedUrls;
};