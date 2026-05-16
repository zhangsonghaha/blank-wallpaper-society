import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clearEmailConfigCache, isEmailConfigured, getEmailConfig } from "@/lib/email";

// POST /api/admin/test-email - 发送测试邮件
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const body = await request.json();
    const { to } = body as { to?: string };

    // 清除缓存，确保使用最新配置
    clearEmailConfigCache();

    // 检查邮件服务是否已配置
    const configured = await isEmailConfigured();
    if (!configured) {
      return NextResponse.json(
        { error: "邮件服务未配置或未启用，请先在设置中配置邮件服务" },
        { status: 400 }
      );
    }

    const config = await getEmailConfig();
    const testTo = to || config.from; // 默认发给自己

    // 动态导入发送
    if (config.provider === "resend") {
      const { Resend } = await import("resend");
      const resend = new Resend(config.resendApiKey);
      await resend.emails.send({
        from: config.from,
        to: testTo,
        subject: "测试邮件 - 壁纸社区",
        html: `
          <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;">
            <div style="text-align:center;margin-bottom:32px;">
              <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
            </div>
            <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
              <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 16px;">邮件服务测试</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
                恭喜！如果您收到这封邮件，说明邮件服务配置正确，可以正常发送邮件。
              </p>
              <div style="background:#f0f9ff;border-radius:6px;padding:16px;margin:16px 0;">
                <p style="margin:0;color:#0369a1;font-size:14px;">
                  <strong>邮件服务商：</strong>${config.provider}<br/>
                  <strong>发件人：</strong>${config.from}<br/>
                  <strong>发送时间：</strong>${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                </p>
              </div>
            </div>
            <p style="text-align:center;color:#999;font-size:12px;margin-top:24px;">
              这是一封系统测试邮件，请勿回复
            </p>
          </div>
        `,
      });
    } else if (config.provider === "smtp") {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });

      await transporter.sendMail({
        from: config.from,
        to: testTo,
        subject: "测试邮件 - 壁纸社区",
        html: `
          <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;">
            <div style="text-align:center;margin-bottom:32px;">
              <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
            </div>
            <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
              <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 16px;">邮件服务测试</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
                恭喜！如果您收到这封邮件，说明邮件服务配置正确，可以正常发送邮件。
              </p>
              <div style="background:#f0f9ff;border-radius:6px;padding:16px;margin:16px 0;">
                <p style="margin:0;color:#0369a1;font-size:14px;">
                  <strong>邮件服务商：</strong>${config.provider}<br/>
                  <strong>SMTP主机：</strong>${config.smtpHost}:${config.smtpPort}<br/>
                  <strong>发件人：</strong>${config.from}<br/>
                  <strong>发送时间：</strong>${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                </p>
              </div>
            </div>
            <p style="text-align:center;color:#999;font-size:12px;margin-top:24px;">
              这是一封系统测试邮件，请勿回复
            </p>
          </div>
        `,
      });
    } else {
      return NextResponse.json(
        { error: `未知的邮件提供商: ${config.provider}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: `测试邮件已发送至 ${testTo}，请检查收件箱（含垃圾邮件）`,
      to: testTo,
    });
  } catch (error: any) {
    console.error("[TestEmail] 发送测试邮件失败:", error);
    return NextResponse.json(
      {
        error: `发送失败: ${error.message}`,
        detail: error.code || error.command || "",
      },
      { status: 500 }
    );
  }
}