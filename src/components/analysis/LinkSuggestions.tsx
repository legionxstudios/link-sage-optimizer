import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LinkSuggestion {
  sourceUrl: string;
  targetUrl: string;
  suggestedAnchorText: string;
  matchType: string;
  relevanceScore: number;
  context: string;
}

interface LinkSuggestionsProps {
  suggestions: LinkSuggestion[];
}

export const LinkSuggestions = ({ suggestions }: LinkSuggestionsProps) => {
  console.log("Rendering suggestions:", suggestions);

  const getRelevanceColor = (score: number) => {
    if (score >= 0.9) return "text-green-600";
    if (score >= 0.7) return "text-yellow-600";
    return "text-red-600";
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return `${urlObj.pathname}${urlObj.search}`;
    } catch (e) {
      return url;
    }
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Target Page</TableHead>
            <TableHead>Suggested Anchor Text</TableHead>
            <TableHead>Match Type</TableHead>
            <TableHead>Relevance</TableHead>
            <TableHead>Suggested Context</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suggestions.map((suggestion, index) => (
            <TableRow key={index}>
              <TableCell className="max-w-[200px] truncate">
                <Tooltip>
                  <TooltipTrigger className="cursor-help">
                    {formatUrl(suggestion.targetUrl)}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Full URL: {suggestion.targetUrl}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{suggestion.suggestedAnchorText}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{suggestion.matchType}</Badge>
              </TableCell>
              <TableCell>
                <span className={getRelevanceColor(suggestion.relevanceScore)}>
                  {Math.round(suggestion.relevanceScore * 100)}%
                </span>
              </TableCell>
              <TableCell className="max-w-[400px]">
                <Tooltip>
                  <TooltipTrigger className="cursor-help text-left">
                    <span className="line-clamp-3 whitespace-pre-wrap">{suggestion.context}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[500px]">
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