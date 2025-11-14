export interface ConfirmationTemplateData {
  clientName: string
  clientEmail: string
  clientPhone?: string
  clientCompany?: string
  subject?: string
  message?: string
}

export function generateConfirmationEmailHTML(data: ConfirmationTemplateData): string {
  const currentYear = new Date().getFullYear()
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmação de Solicitação - Natureza Brindes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; background-color: #f8f9fa; padding: 20px; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #2CB20B 0%, #25A009 100%); padding: 40px 30px; text-align: center; color: white; }
    .logo { font-size: 32px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .tagline { font-size: 16px; opacity: 0.9; font-weight: 300; }
    .main-content { padding: 40px 30px; }
    .title { color: #2d3748; font-size: 24px; font-weight: 600; text-align: center; margin-bottom: 30px; letter-spacing: 0.5px; }
    .greeting { font-size: 18px; margin-bottom: 25px; color: #4a5568; }
    .message { font-size: 16px; line-height: 1.7; color: #4a5568; margin-bottom: 30px; }
    .data-section { background-color: #f7fafc; border-left: 4px solid #2CB20B; padding: 25px; border-radius: 8px; margin: 30px 0; }
    .data-title { color: #2CB20B; font-size: 18px; font-weight: 600; margin-bottom: 20px; }
    .data-item { display: flex; margin-bottom: 12px; font-size: 15px; }
    .data-label { font-weight: 600; color: #2d3748; min-width: 120px; margin-right: 10px; }
    .data-value { color: #4a5568; flex: 1; }
    .contact-section { background-color: #2CB20B; color: white; padding: 30px; text-align: center; margin-top: 40px; }
    .contact-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
    .footer { background-color: #2d3748; color: #a0aec0; padding: 25px 30px; text-align: center; font-size: 13px; }
    .footer-brand { color: #ffffff; font-weight: 600; margin-bottom: 5px; }
  </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="header">
        <div class="logo">
          <img src="/favicon_branco.webp" alt="Natureza Brindes" style="width:60px;height:60px;object-fit:contain;margin-bottom:8px;" />
          <div style="font-size:32px;font-weight:700;margin-bottom:8px;letter-spacing:-0.5px;">Natureza Brindes</div>
        </div>
        <div class="tagline">Sua marca para todo mundo ver</div>
      </div>
      <div class="main-content">
        <h1 class="title">RECEBEMOS SUA SOLICITAÇÃO DE ORÇAMENTO</h1>
        <div class="greeting">Olá <strong>${data.clientName}</strong>,</div>
        <div class="message">
          <p>Recebemos sua solicitação de orçamento e nossa equipe já está trabalhando para preparar a melhor proposta para você.</p>
          ${data.message ? `<p>${data.message}</p>` : ''}
        </div>
        <div class="data-section">
          <div class="data-title">Seus dados:</div>
          <div class="data-item"><span class="data-label">Empresa:</span><span class="data-value">${data.clientCompany || ''}</span></div>
          <div class="data-item"><span class="data-label">Nome:</span><span class="data-value">${data.clientName}</span></div>
          <div class="data-item"><span class="data-label">Telefone:</span><span class="data-value">${data.clientPhone || ''}</span></div>
          <div class="data-item"><span class="data-label">E-mail:</span><span class="data-value">${data.clientEmail}</span></div>
          ${data.subject ? `<div class="data-item"><span class="data-label">Assunto:</span><span class="data-value">${data.subject}</span></div>` : ''}
        </div>
      </div>
      <div class="contact-section">
        <div class="contact-title">Atenciosamente</div>
        <div class="contact-info">
          <strong>(27) 99958-6250</strong><br />
          Rua Porto Alegre, 590<br />
          Altercosas - CEP: 29167-036<br />
          Serra - ES<br /><br />
          <strong>Equipe Natureza Brindes</strong><br />
          naturezabrindes@naturezabrindes.com.br
        </div>
      </div>
      <div class="footer">
        <div class="footer-brand">COPYRIGHT © ${currentYear} Natureza Brindes</div>
        <div>Desenvolvimento E5 Inovação</div>
      </div>
    </div>
  </body>
</html>
`
}