import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import UploadClient from "./UploadClient";

export default async function UploadPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/upload");
  }

  return <UploadClient />;
}