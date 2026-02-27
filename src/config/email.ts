import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import config from './index.js';
import { logger } from './logger.js';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

function isLikelyPlaceholder(value: string): boolean {
  return /your-|your_|change|placeholder|example|dummy|test/i.test(value.trim());
}

function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 1) {
    return '***';
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) {
    return `${local[0]}***`;
  }

  return `${local[0]}***@${domain}`;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor() {
    this.initTransporter();
    this.loadTemplates();
  }

  private initTransporter(): void {
    const host = config.email.host?.trim() || '';
    const user = config.email.user?.trim() || '';
    const password = config.email.password?.trim() || '';

    if (!host || !user || !password) {
      logger.warn(
        {
          hasHost: !!host,
          hasUser: !!user,
          hasPassword: !!password,
        },
        'Email not configured'
      );
      return;
    }

    if (isLikelyPlaceholder(user) || isLikelyPlaceholder(password)) {
      logger.warn('Email credentials look like placeholders, transporter disabled');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user,
        pass: password,
      },
    });

    logger.info('Email transporter initialized');
  }

  private loadTemplates(): void {
    const templatesDir = path.join(process.cwd(), 'src', 'templates', 'emails');
    
    if (!fs.existsSync(templatesDir)) {
      logger.debug({ templatesDir }, 'Email templates directory not found');
      return;
    }

    const templateFiles = fs.readdirSync(templatesDir);
    
    for (const file of templateFiles) {
      if (file.endsWith('.html')) {
        const templateName = file.replace('.html', '');
        const templatePath = path.join(templatesDir, file);
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        this.templates.set(templateName, handlebars.compile(templateContent));
        logger.debug({ templateName }, 'Email template loaded');
      }
    }
  }

  private extractErrorDetails(error: unknown): { message: string; code?: string } {
    if (error instanceof Error) {
      const maybe = error as Error & { code?: string };
      return {
        message: error.message,
        code: typeof maybe.code === 'string' ? maybe.code : undefined,
      };
    }

    if (typeof error === 'string') {
      return { message: error };
    }

    return { message: 'Unknown SMTP error' };
  }

  async send(options: EmailOptions): Promise<boolean> {
    const mailOptions = {
      from: config.email.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    if (!this.transporter) {
      logger.warn(
        { recipient: maskEmail(options.to), subject: options.subject },
        'Email send skipped because transporter is not configured'
      );
      return false;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info({ recipient: maskEmail(options.to), subject: options.subject }, 'Email sent successfully');
      return true;
    } catch (error) {
      const details = this.extractErrorDetails(error);
      logger.error({ recipient: maskEmail(options.to), ...details }, 'Failed to send email');
      return false;
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<boolean> {
    const verificationUrl = `${config.app.frontendUrl}/auth/verify-email?token=${token}`;
    
    const template = this.templates.get('verification');
    const html = template ? template({ url: verificationUrl }) : `
      <h1>Verify Your Email</h1>
      <p>Click the link below to verify your email:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>This link expires in 24 hours.</p>
    `;

    return this.send({
      to,
      subject: 'Verify your Debate account',
      html,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    const resetUrl = `${config.app.frontendUrl}/auth/reset-password?token=${token}`;
    
    const template = this.templates.get('password-reset');
    const html = template ? template({ url: resetUrl }) : `
      <h1>Reset Your Password</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;

    return this.send({
      to,
      subject: 'Reset your Debate password',
      html,
    });
  }

  async sendInvitationEmail(to: string, roomName: string, inviterName: string, token: string): Promise<boolean> {
    const inviteUrl = `${config.app.frontendUrl}/room/invite?token=${token}`;
    
    const template = this.templates.get('room-invite');
    const html = template ? template({ roomName, inviterName, url: inviteUrl }) : `
      <h1>Room Invitation</h1>
      <p>${inviterName} has invited you to join "${roomName}"</p>
      <a href="${inviteUrl}">Join Room</a>
      <p>This invitation expires in 1 hour.</p>
    `;

    return this.send({
      to,
      subject: `${inviterName} invited you to join ${roomName}`,
      html,
    });
  }

  isConfigured(): boolean {
    return !!this.transporter;
  }

  async verifyConnection(timeoutMs = 5000): Promise<{ ok: boolean; error?: string }> {
    if (!this.transporter) {
      return { ok: false, error: 'Email transporter is not configured' };
    }

    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`SMTP verification timeout (${timeoutMs}ms)`)), timeoutMs);
      });

      await Promise.race([
        this.transporter.verify(),
        timeout,
      ]);

      return { ok: true };
    } catch (error) {
      const details = this.extractErrorDetails(error);
      logger.error(details, 'SMTP connectivity verification failed');
      return { ok: false, error: details.message };
    }
  }
}

export const emailService = new EmailService();
export default emailService;
