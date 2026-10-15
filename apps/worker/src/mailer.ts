import nodemailer, { Transporter } from 'nodemailer';
import type { Sender } from '@reachinbox/shared';

let cachedEtherealTransporter: Transporter | null = null;

export interface SendEmailOptions {
  from?: string;
  to: string;
  subject: string;
  body: string;
  sender?: Sender | null;
}

export interface SendEmailResult {
  messageId: string;
  etherealPreviewUrl: string | null;
}

export class MailerService {
  /**
   * Resolves or creates a Nodemailer transporter.
   */
  async getTransporter(sender?: Sender | null): Promise<Transporter> {
    if (sender && sender.smtpUser && sender.smtpPass) {
      return nodemailer.createTransport({
        host: sender.smtpHost || 'smtp.ethereal.email',
        port: sender.smtpPort || 587,
        secure: sender.smtpSecure || false,
        auth: {
          user: sender.smtpUser,
          pass: sender.smtpPass,
        },
      });
    }

    if (cachedEtherealTransporter) {
      return cachedEtherealTransporter;
    }

    // Check environment variables first
    if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
      cachedEtherealTransporter = nodemailer.createTransport({
        host: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.ETHEREAL_PORT || '587', 10),
        secure: process.env.ETHEREAL_SECURE === 'true',
        auth: {
          user: process.env.ETHEREAL_USER,
          pass: process.env.ETHEREAL_PASS,
        },
      });
      return cachedEtherealTransporter;
    }

    // Dynamically generate a real Ethereal test account if credentials are not present
    console.log('[MailerService] Creating on-demand Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    console.log(`[MailerService] Ethereal account created: ${testAccount.user}`);

    cachedEtherealTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    return cachedEtherealTransporter;
  }

  async sendMail(options: SendEmailOptions): Promise<SendEmailResult> {
    const transporter = await this.getTransporter(options.sender);

    const fromAddress = options.from || options.sender?.email || 'reachinbox@ethereal.email';
    const isHtml = options.body.includes('<') && options.body.includes('>');

    const info = await transporter.sendMail({
      from: `"${options.sender?.name || 'ReachInbox'}" <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      text: isHtml ? undefined : options.body,
      html: isHtml ? options.body : undefined,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    const etherealPreviewUrl = typeof previewUrl === 'string' ? previewUrl : null;

    return {
      messageId: info.messageId,
      etherealPreviewUrl,
    };
  }
}
