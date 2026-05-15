import type { Metadata } from "next";
import AiGenerateClient from "./AiGenerateClient";

export const metadata: Metadata = {
  title: "AI壁纸生成",
  description: "使用AI生成独一无二的壁纸，支持多种风格选择。",
};

export default function AiGeneratePage() {
  return <AiGenerateClient />;
}