import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const AdminClient = dynamic(() => import("./AdminClient"), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        <div className="w-32 h-4 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export default async function AdminPage() {
  const session = await auth();

  // 检查是否已登录
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  // 检查是否为管理员或审核员
  const role = (session.user as any)?.role;
  if (role !== "admin" && role !== "moderator") {
    redirect("/");
  }

  return <AdminClient />;
}