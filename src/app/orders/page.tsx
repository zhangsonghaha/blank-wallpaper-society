import type { Metadata } from "next";
import dynamic from "next/dynamic";

const OrdersClient = dynamic(() => import("./OrdersClient"), {
  loading: () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col gap-4">
        <div className="w-32 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-full h-20 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="w-full h-20 rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "我的订单",
  description: "查看你的购买记录和订单状态。",
};

export default function OrdersPage() {
  return <OrdersClient />;
}