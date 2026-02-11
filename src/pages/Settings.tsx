import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuildingsContent } from "./Buildings";
import { CodesContent } from "./Codes";
import { InspectorsContent } from "./Inspectors";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage buildings, codes, and inspectors</p>
      </div>

      <Tabs defaultValue="buildings">
        <TabsList>
          <TabsTrigger value="buildings">Buildings</TabsTrigger>
          <TabsTrigger value="codes">Codes</TabsTrigger>
          <TabsTrigger value="inspectors">Inspectors</TabsTrigger>
        </TabsList>
        <TabsContent value="buildings">
          <BuildingsContent />
        </TabsContent>
        <TabsContent value="codes">
          <CodesContent />
        </TabsContent>
        <TabsContent value="inspectors">
          <InspectorsContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
