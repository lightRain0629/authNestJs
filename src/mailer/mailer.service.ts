import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  fromName?: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;
  private fromAddress: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.setupTransport();
  }

  private setupTransport() {
    const user = this.configService.get<string>('EMAIL');
    const pass = this.configService.get<string>('EMAIL_PASSWORD');
    if (!user || !pass) {
      this.logger.warn(
        'EMAIL or EMAIL_PASSWORD is not configured. Mailer is disabled.',
      );
      return;
    }

    const host = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const port = Number(this.configService.get<string>('SMTP_PORT', '465'));
    const secure =
      this.configService.get<string>('SMTP_SECURE', 'true') === 'true';

    this.transporter = createTransport({
      host,
      port,
      secure,
      service: 'gmail',
      auth: { user, pass },
    });
    this.fromAddress = user;
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    if (!this.transporter || !this.fromAddress) {
      this.logger.warn(
        `Mailer not initialized. Skip sending mail to ${options.to}`,
      );
      return;
    }
    this.logger.log(
      `Sending mail to ${options.to} with subject "${
        options.subject
      }": Credentials used ${
        this.fromAddress
      } User: ${this.configService.get<string>(
        'EMAIL',
      )} Pass: ${this.configService.get<string>('EMAIL_PASSWORD')}`,
    );
    
    const { to, subject, text, html, fromName } = options;

    this.logger.log({
        from: fromName ? `${fromName} <${this.fromAddress}>` : this.fromAddress,
        to,
        subject,
        text: text ?? html?.replace(/<[^>]*>/g, ' '),
        // html,-
      });
    try {
      await this.transporter.sendMail({
        from: fromName ? `${fromName} <${this.fromAddress}>` : this.fromAddress,
        to,
        subject,
        text: text ?? html?.replace(/<[^>]*>/g, ' '),
        // html,
      });
    } catch (error) {
      this.logger.error(`Failed to send mail to ${to}`, error as Error);
    }
  }
}
