import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function Clients() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Badge variant="secondary">Coming Soon</Badge>
      </div>
      <Card><CardContent className="p-12 text-center text-muted-foreground">This feature is under development.</CardContent></Card>
    </div>
  );
}
