import type { Metadata } from "next";
import OrdersClient from "./OrdersClient";

export const metadata: Metadata = {
  title: "我的订单",
  description: "查看你的购买记录和订单状态。",
};

export default function OrdersPage() {
  return <OrdersClient />;
}