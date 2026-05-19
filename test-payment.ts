import { handlePaymentSuccess } from "./src/lib/payment";

async function test() {
  try {
    const result = await handlePaymentSuccess(9, "alipay");
    console.log("支付处理成功:", result);
  } catch (error) {
    console.error("支付处理失败:", error);
  }
}

test();