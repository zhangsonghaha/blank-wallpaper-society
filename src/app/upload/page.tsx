import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const UploadClient = dynamic(() => import("./UploadClient"), {
  loading: () => (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="w-64 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-full h-48 rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export default async function UploadPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/upload");
  }

  return <UploadClient />;
}