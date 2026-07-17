export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export interface IEmailProvider {
  sendMail(options: SendMailOptions): Promise<boolean>;
}
