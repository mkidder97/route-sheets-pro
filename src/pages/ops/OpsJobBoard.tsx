import CMJobsBoard from "@/components/ops/CMJobsBoard";

export default function OpsJobBoard() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">CM Jobs</h1>
      <CMJobsBoard />
    </div>
  );
}
