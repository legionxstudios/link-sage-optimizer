import { SupabaseClient } from "@supabase/supabase-js";

interface PageData {
  url: string;
  title: string;
  content: string;
  keywords: {
    exact_match: string[];
    broad_match: string[];
    related_match: string[];
  };
  suggestions: any[];
}

export async function savePageData(
  supabase: SupabaseClient,
  data: PageData
) {
  console.log('Saving page data for:', data.url);

  try {
    // First, get or create website record
    const domain = new URL(data.url).hostname;
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

    if (websiteError) throw websiteError;
    console.log('Website record saved:', website);

    // Save page record
    const { data: page, error: pageError } = await supabase
      .from('pages')
      .upsert({
        website_id: website.id,
        url: data.url,
        title: data.title,
        content: data.content,
        last_crawled_at: new Date().toISOString()
      }, {
        onConflict: 'url'
      })
      .select()
      .single();

    if (pageError) throw pageError;
    console.log('Page record saved:', page);

    // Save page analysis
    const { error: analysisError } = await supabase
      .from('page_analysis')
      .upsert({
        url: data.url,
        title: data.title,
        content: data.content,
        main_keywords: data.keywords.exact_match,
        seo_keywords: data.keywords,
        suggestions: data.suggestions,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'url'
      });

    if (analysisError) throw analysisError;
    console.log('Page analysis saved successfully');

  } catch (error) {
    console.error('Error saving page data:', error);
    throw error;
  }
}