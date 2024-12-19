import { logger } from "./logger.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface ExistingPage {
  url: string;
  title?: string;
  content?: string;
}

interface ExistingLink {
  url: string;
  anchorText: string;
}

function extractExistingLinks(content: string): ExistingLink[] {
  const links: ExistingLink[] = [];
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      url: match[1],
      anchorText: match[2].replace(/<[^>]*>/g, '').trim()
    });
  }

  logger.info('Extracted existing links:', links);
  return links;
}

export async function analyzeWithOpenAI(content: string, existingPages: ExistingPage[]) {
  try {
    if (!OPENAI_API_KEY) {
      logger.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    logger.info('Starting OpenAI analysis...');
    
    // Extract existing links from content
    const existingLinks = extractExistingLinks(content);
    logger.info(`Found ${existingLinks.length} existing links in content`);
    
    // Truncate content to avoid token limits
    const truncatedContent = content.substring(0, 3000);
    
    // Create context about existing pages for OpenAI
    const pagesContext = existingPages
      .filter(page => !existingLinks.some(link => link.url === page.url))
      .map(page => ({
        url: page.url,
        title: page.title || '',
        summary: page.content?.substring(0, 200) || ''
      }));

    logger.info('Sending request to OpenAI API with content length:', truncatedContent.length);
    logger.info('Available pages for linking:', pagesContext.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an SEO expert. Your task is to analyze content and suggest internal linking opportunities.
            You must respond with a valid JSON object using this exact structure, with no additional text or explanation.
            IMPORTANT: Only suggest links that don't already exist in the content.
            {
              "keywords": {
                "exact_match": ["keyword1", "keyword2"],
                "broad_match": ["keyword3", "keyword4"],
                "related_match": ["keyword5", "keyword6"]
              },
              "outboundSuggestions": [
                {
                  "suggestedAnchorText": "text",
                  "targetUrl": "url",
                  "context": "text around the suggested link",
                  "relevanceScore": 0.8
                }
              ]
            }`
          },
          {
            role: 'user',
            content: `Analyze this content and suggest relevant internal links. Return ONLY a JSON object matching the specified structure.
            The content already has these links (DO NOT suggest these): ${JSON.stringify(existingLinks)}
            
            Content: ${truncatedContent}
            
            Available pages for linking: ${JSON.stringify(pagesContext)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`OpenAI API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    logger.debug('OpenAI raw response:', data);

    if (!data.choices?.[0]?.message?.content) {
      logger.error('Invalid OpenAI response format:', data);
      throw new Error('Invalid OpenAI response format');
    }

    try {
      const content = data.choices[0].message.content.trim();
      logger.debug('Attempting to parse content:', content);
      
      const parsedResponse = JSON.parse(content);
      
      // Validate response structure
      if (!parsedResponse.keywords || !parsedResponse.outboundSuggestions) {
        logger.error('Invalid response structure:', parsedResponse);
        throw new Error('Response missing required fields');
      }

      // Filter out any suggestions that might still reference existing links
      const filteredSuggestions = parsedResponse.outboundSuggestions.filter(suggestion => 
        !existingLinks.some(link => 
          link.url === suggestion.targetUrl || 
          link.anchorText.toLowerCase() === suggestion.suggestedAnchorText.toLowerCase()
        )
      );

      // Ensure arrays exist and are valid
      const validResponse = {
        keywords: {
          exact_match: Array.isArray(parsedResponse.keywords.exact_match) ? parsedResponse.keywords.exact_match : [],
          broad_match: Array.isArray(parsedResponse.keywords.broad_match) ? parsedResponse.keywords.broad_match : [],
          related_match: Array.isArray(parsedResponse.keywords.related_match) ? parsedResponse.keywords.related_match : []
        },
        outboundSuggestions: filteredSuggestions.map(suggestion => ({
          suggestedAnchorText: String(suggestion.suggestedAnchorText || ''),
          targetUrl: String(suggestion.targetUrl || ''),
          context: String(suggestion.context || ''),
          relevanceScore: Number(suggestion.relevanceScore) || 0
        }))
      };

      logger.info('Successfully parsed and validated OpenAI response');
      logger.info(`Filtered out ${parsedResponse.outboundSuggestions.length - filteredSuggestions.length} duplicate suggestions`);
      return validResponse;

    } catch (parseError) {
      logger.error('Error parsing OpenAI response:', parseError);
      logger.error('Raw response content:', data.choices[0].message.content);
      throw new Error('Failed to parse OpenAI response as JSON');
    }

  } catch (error) {
    logger.error('OpenAI analysis failed:', error);
    throw error;
  }
}