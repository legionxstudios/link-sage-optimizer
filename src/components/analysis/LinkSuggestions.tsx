import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LinkSuggestion } from "@/services/crawlerService";
import { ExternalLink } from "lucide-react";

interface LinkSuggestionsProps {
  suggestions: LinkSuggestion[];
}

export const LinkSuggestions = ({ suggestions }: LinkSuggestionsProps) => {
  console.log("Rendering suggestions:", suggestions);

  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No link suggestions found for this content.
      </div>
    );
  }

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case 'seo_optimized':
        return <Badge variant="default">SEO Optimized</Badge>;
      case 'keyword_based':
        return <Badge variant="secondary">Keyword Based</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatUrl = (url: string) => {
    if (!url) return '#';
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch (e) {
      console.warn('Invalid URL:', url);
      return '#';
    }
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Suggested Link Text</TableHead>
            <TableHead>Target URL</TableHead>
            <TableHead>Match Type</TableHead>
            <TableHead>Relevance</TableHead>
            <TableHead>Context</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suggestions.map((suggestion, index) => (
            <TableRow key={index}>
              <TableCell>
                <span className="font-medium">{suggestion.suggestedAnchorText}</span>
              </TableCell>
              <TableCell>
                {suggestion.targetUrl ? (
                  <a 
                    href={suggestion.targetUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                  >
                    {formatUrl(suggestion.targetUrl)}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">No URL available</span>
                )}
              </TableCell>
              <TableCell>
                {getMatchTypeLabel(suggestion.matchType)}
              </TableCell>
              <TableCell>
                <span className={getRelevanceColor(suggestion.relevanceScore)}>
                  {Math.round(suggestion.relevanceScore * 100)}%
                </span>
              </TableCell>
              <TableCell className="max-w-[400px]">
                <Tooltip>
                  <TooltipTrigger className="cursor-help text-left">
                    <span className="line-clamp-2">{suggestion.context}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[500px] p-4">
                    <p className="whitespace-pre-wrap">{suggestion.context}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};