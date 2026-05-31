import MessagesClient from "./MessagesClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "私信 - Blank Wallpaper Society",
  description: "与其他用户进行私密对话",
};

export default function MessagesPage() {
  return <MessagesClient />;
}