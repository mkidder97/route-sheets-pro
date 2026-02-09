import { Calendar, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Schedules() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Schedules</h1>
        <p className="text-muted-foreground mt-1">
          Generated inspector route documents
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">No schedules generated yet</h2>
          <p className="text-muted-foreground mt-2 text-center max-w-md">
            Upload a spreadsheet and run the route optimizer to generate inspector
            documents. Each document will contain a 2-week schedule with daily route
            clusters.
          </p>
          <div className="flex items-center gap-3 mt-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span>PDF export</span>
            </div>
            <span>•</span>
            <span>Route optimization</span>
            <span>•</span>
            <span>Daily clusters</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
