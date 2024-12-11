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
      case 'high_relevance':
        return <Badge variant="default">High Relevance</Badge>;
      case 'medium_relevance':
        return <Badge variant="secondary">Medium Relevance</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Suggested Link</TableHead>
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