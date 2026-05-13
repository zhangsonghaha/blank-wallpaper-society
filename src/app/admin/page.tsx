import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const session = await auth();

  // 检查是否已登录
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  // 检查是否为管理员
  const role = (session.user as any)?.role;
  if (role !== "admin") {
    redirect("/");
  }

  return <AdminClient />;
}