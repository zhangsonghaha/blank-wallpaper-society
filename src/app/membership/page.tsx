import { Metadata } from "next";
import MembershipClient from "./MembershipClient";

export const metadata: Metadata = {
  title: "会员中心",
  description: "查看你的会员特权、额度使用和到期信息。",
};

export default function MembershipPage() {
  return <MembershipClient />;
}