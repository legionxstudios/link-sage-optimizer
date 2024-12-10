import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LinkSuggestion {
  sourceUrl: string;
  targetUrl: string;
  suggestedAnchorText: string;
  relevanceScore: number;
  context: string;
}

interface LinkSuggestionsProps {
  suggestions: LinkSuggestion[];
}

export const LinkSuggestions = ({ suggestions }: LinkSuggestionsProps) => {
  const getRelevanceColor = (score: number) => {
    if (score >= 0.9) return "text-green-600";
    if (score >= 0.7) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Link Suggestions</h3>
        <p className="text-sm text-muted-foreground">
          AI-powered suggestions for internal linking opportunities
        </p>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source Page</TableHead>
              <TableHead>Suggested Anchor Text</TableHead>
              <TableHead>Relevance</TableHead>
              <TableHead>Context</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suggestions.map((suggestion, index) => (
              <TableRow key={index}>
                <TableCell className="max-w-[200px] truncate">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      {suggestion.sourceUrl}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This page should link to your target page</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{suggestion.suggestedAnchorText}</Badge>
                </TableCell>
                <TableCell>
                  <span className={getRelevanceColor(suggestion.relevanceScore)}>
                    {Math.round(suggestion.relevanceScore * 100)}%
                  </span>
                </TableCell>
                <TableCell className="max-w-[300px]">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help text-left">
                      <span className="line-clamp-2">{suggestion.context}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{suggestion.context}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};