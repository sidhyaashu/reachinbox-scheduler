import axios from 'axios';
import nodemailer, { Transporter } from 'nodemailer';
import { SenderRepository } from '@reachinbox/database';
import type { Sender } from '@reachinbox/shared';

let cachedEtherealTransporter: Transporter | null = null;

export interface SendEmailOptions {
  from?: string;
  to: string;
  subject: string;
  body: string;
  sender?: Sender | null;
  attachments?: {
    filename: string;
    contentType?: string;
    content: string; // base64 string
    size?: number;
  }[];
}

export interface SendEmailResult {
  messageId: string;
  etherealPreviewUrl: string | null;
}

export class MailerService {
  constructor(
    private readonly senderRepo: SenderRepository = new SenderRepository()
  ) {}

  private formatNodemailerAttachments(attachments?: SendEmailOptions['attachments']) {
    if (!attachments || attachments.length === 0) return undefined;
    return attachments.map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.contentType,
    }));
  }

  /**
   * Obtains a valid Google OAuth2 access token using the sender's refresh token.
   */
  async getGoogleAccessToken(sender: Sender): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in worker environment. Required for Gmail OAuth2 sending.'
      );
    }

    if (!sender.googleRefreshToken) {
      if (sender.googleAccessToken) {
        return sender.googleAccessToken;
      }
      throw new Error('Sender does not have a Google refresh token.');
    }

    try {
      const res = await axios.post<{ access_token: string; refresh_token?: string }>(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: sender.googleRefreshToken,
          grant_type: 'refresh_token',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        }
      );

      const newAccessToken = res.data.access_token;
      if (newAccessToken && sender.id) {
        try {
          await this.senderRepo.updateGoogleTokens(sender.id, newAccessToken, res.data.refresh_token);
        } catch (dbErr: any) {
          console.warn('[MailerService] Failed to cache refreshed Google token in DB:', dbErr.message);
        }
      }
      return newAccessToken;
    } catch (err: any) {
      const errBody = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      if (sender.googleAccessToken) {
        console.warn(
          `[MailerService] Google token refresh failed (${errBody}), falling back to cached access token.`
        );
        return sender.googleAccessToken;
      }
      throw new Error(`Google OAuth token refresh failed: ${errBody}`);
    }
  }

  /**
   * Compiles the email options into a standard RFC 2822 base64url-encoded string.
   */
  async compileMimeMessage(options: SendEmailOptions): Promise<string> {
    const fromAddress = options.from || options.sender?.email || 'reachinbox@ethereal.email';
    const fromName = options.sender?.name || 'ReachInbox';
    const isHtml = options.body.includes('<') && options.body.includes('>');

    const compiler = nodemailer.createTransport({
      streamTransport: true,
      newline: 'windows',
    });

    const info = await compiler.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      text: isHtml ? undefined : options.body,
      html: isHtml ? options.body : undefined,
      attachments: this.formatNodemailerAttachments(options.attachments),
    });

    if (Buffer.isBuffer(info.message)) {
      return (info.message as Buffer).toString('base64url');
    }

    const messageStream = info.message as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    return new Promise<string>((resolve, reject) => {
      messageStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      messageStream.on('end', () => {
        const raw = Buffer.concat(chunks).toString('base64url');
        resolve(raw);
      });
      messageStream.on('error', reject);
    });
  }

  /**
   * Sends an email via the official Gmail REST API using OAuth2 (https://www.googleapis.com/auth/gmail.send).
   */
  async sendViaGmailRest(options: SendEmailOptions): Promise<SendEmailResult> {
    const sender = options.sender!;
    const accessToken = await this.getGoogleAccessToken(sender);
    const raw = await this.compileMimeMessage(options);

    try {
      const res = await axios.post<{ id: string; threadId: string }>(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        { raw },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      console.log(
        `[MailerService] Successfully sent email to ${options.to} via Gmail REST API. Message ID: ${res.data.id}`
      );

      return {
        messageId: res.data.id,
        etherealPreviewUrl: null,
      };
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error(`[MailerService] Gmail REST API delivery failed (HTTP ${status || 'ERR'}):`, data);
      throw new Error(`Gmail API delivery error (${status || 'UNKNOWN'}): ${data}`);
    }
  }

  /**
   * Resolves or creates a Nodemailer transporter.
   */
  async getTransporter(sender?: Sender | null): Promise<Transporter> {
    // 1. Check if sender has linked Google OAuth2 credentials for passwordless Gmail sending
    if (sender && (sender.authType === 'oauth2_google' || sender.googleRefreshToken) && sender.googleRefreshToken) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error('[MailerService] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment for Gmail OAuth transport');
      }
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: sender.email,
          clientId,
          clientSecret,
          refreshToken: sender.googleRefreshToken,
          accessToken: sender.googleAccessToken || undefined,
        },
      });
    }

    if (sender && sender.smtpUser && sender.smtpPass) {
      const port = Number(sender.smtpPort) || 587;
      // Port 465 is always implicit SSL (secure: true).
      // Port 587 is always explicit STARTTLS (secure: false).
      const secure = port === 465 ? true : (port === 587 ? false : Boolean(sender.smtpSecure));
      return nodemailer.createTransport({
        host: sender.smtpHost || 'smtp.ethereal.email',
        port,
        secure,
        auth: {
          user: sender.smtpUser,
          pass: sender.smtpPass,
        },
      });
    }

    if (cachedEtherealTransporter) {
      return cachedEtherealTransporter;
    }

    // Check if custom / real SMTP credentials (e.g. Gmail App Password, SES, SendGrid) are provided in environment
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    // Check environment variables first for Ethereal
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

  async sendViaEtherealFallback(options: SendEmailOptions, reason: string): Promise<SendEmailResult> {
    const transporter = await this.getTransporter(null);
    const fromAddress = options.sender?.email || 'reachinbox@ethereal.email';
    const isHtml = options.body.includes('<') && options.body.includes('>');
    const notice = `[Sandbox Relay Notice: Direct Gmail API delivery failed (${reason}). Captured in Ethereal sandbox.]`;

    const info = await transporter.sendMail({
      from: `"${options.sender?.name || 'ReachInbox'}" <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      text: isHtml ? undefined : `${notice}\n\n${options.body}`,
      html: isHtml
        ? `<div style="padding: 10px; margin-bottom: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-size: 13px; color: #92400e;"><strong>${notice}</strong></div>${options.body}`
        : undefined,
      attachments: this.formatNodemailerAttachments(options.attachments),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    const etherealPreviewUrl = typeof previewUrl === 'string' ? previewUrl : null;

    return {
      messageId: info.messageId,
      etherealPreviewUrl,
    };
  }

  async sendMail(options: SendEmailOptions): Promise<SendEmailResult> {
    // 1. Deliver via Gmail REST API for Google OAuth2 senders
    if (
      options.sender &&
      (options.sender.authType === 'oauth2_google' || options.sender.googleRefreshToken) &&
      options.sender.googleRefreshToken
    ) {
      try {
        return await this.sendViaGmailRest(options);
      } catch (gmailErr: any) {
        // Fallback to Ethereal sandbox if explicitly enabled or in development/evaluation
        if (process.env.ALLOW_SANDBOX_FALLBACK === 'true') {
          console.warn(
            `[MailerService] Gmail API delivery failed (${gmailErr.message}). Falling back to Ethereal sandbox relay.`
          );
          return this.sendViaEtherealFallback(options, gmailErr.message);
        }
        throw gmailErr;
      }
    }

    // 2. Deliver via SMTP (Custom SMTP or Ethereal sandbox)
    const transporter = await this.getTransporter(options.sender);

    const fromAddress = options.from || options.sender?.email || 'reachinbox@ethereal.email';
    const isHtml = options.body.includes('<') && options.body.includes('>');

    const info = await transporter.sendMail({
      from: `"${options.sender?.name || 'ReachInbox'}" <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      text: isHtml ? undefined : options.body,
      html: isHtml ? options.body : undefined,
      attachments: this.formatNodemailerAttachments(options.attachments),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    const etherealPreviewUrl = typeof previewUrl === 'string' ? previewUrl : null;

    return {
      messageId: info.messageId,
      etherealPreviewUrl,
    };
  }
}
