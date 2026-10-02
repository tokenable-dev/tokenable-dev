import { AppPageState } from "@/components/ui/AppPageState";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black px-4 py-16 text-white">
      <AppPageState kind="not_found" />
    </div>
  );
}
