import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LinkSuggestion } from "@/services/crawlerService";

interface LinkSuggestionsProps {
  suggestions: LinkSuggestion[];
}

export const LinkSuggestions = ({ suggestions }: LinkSuggestionsProps) => {
  console.log("Rendering suggestions:", suggestions);

  if (!Array.isArray(suggestions)) {
    console.error("Invalid suggestions data:", suggestions);
    return null;
  }

  const getRelevanceColor = (score: number) => {
    if (score >= 0.9) return "text-green-600";
    if (score >= 0.7) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Suggested Anchor Text</TableHead>
            <TableHead>Match Type</TableHead>
            <TableHead>Relevance</TableHead>
            <TableHead>Suggested Context</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suggestions.map((suggestion, index) => (
            <TableRow key={index}>
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