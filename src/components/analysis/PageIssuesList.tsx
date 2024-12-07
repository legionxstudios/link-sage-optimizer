import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PageIssue {
  url: string;
  issueType: string;
  description: string;
  impact: "High" | "Medium" | "Low";
  suggestedFix: string;
}

interface PageIssuesListProps {
  issues: PageIssue[];
}

const getImpactColor = (impact: string) => {
  switch (impact.toLowerCase()) {
    case "high":
      return "text-red-600";
    case "medium":
      return "text-yellow-600";
    case "low":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
};

export const PageIssuesList = ({ issues }: PageIssuesListProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Page URL</TableHead>
          <TableHead>Issue</TableHead>
          <TableHead>Impact</TableHead>
          <TableHead>Suggested Fix</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue, index) => (
          <TableRow key={index}>
            <TableCell className="max-w-[200px] truncate">
              <Tooltip>
                <TooltipTrigger className="cursor-help">
                  {issue.url}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{issue.description}</p>
                </TooltipContent>
              </Tooltip>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{issue.issueType}</Badge>
            </TableCell>
            <TableCell>
              <span className={getImpactColor(issue.impact)}>{issue.impact}</span>
            </TableCell>
            <TableCell className="max-w-[200px]">
              <Tooltip>
                <TooltipTrigger className="cursor-help text-left">
                  <span className="line-clamp-2">{issue.suggestedFix}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{issue.suggestedFix}</p>
                </TooltipContent>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};