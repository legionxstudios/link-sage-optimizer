interface PageContent {
  url: string;
  title: string;
  content: string;
  mainKeywords: string[];
}

interface LinkSuggestion {
  sourceUrl: string;
  targetUrl: string;
  suggestedAnchorText: string;
  relevanceScore: number;
  context: string;
}

interface AnalysisResponse {
  pageContents: PageContent[];
  suggestions: LinkSuggestion[];
}

const API_URL = "http://localhost:8000";

export const analyzePage = async (url: string): Promise<AnalysisResponse> => {
  console.log("Starting page analysis for:", url);
  
  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Server error:", errorData);
      throw new Error(`Server error: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    console.log("Analysis results:", data);
    return data;
  } catch (error) {
    console.error("Error in page analysis:", error);
    throw error;
  }
};