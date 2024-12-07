import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";

interface AnalysisMetricCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  tooltip: string;
}

export const AnalysisMetricCard = ({ icon: Icon, title, value, tooltip }: AnalysisMetricCardProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="p-4 space-y-2 cursor-help">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="w-4 h-4" />
            {title}
          </div>
          <div className="text-2xl font-bold">{value}</div>
        </Card>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
};