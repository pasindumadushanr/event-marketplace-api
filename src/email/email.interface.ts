export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  fromName?: string;
}

export interface IEmailProvider {
  sendMail(options: SendMailOptions): Promise<boolean>;
}
