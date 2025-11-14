import express, { Request, Response } from 'express'
import { supabaseAdmin } from '../../supabase/server.ts'
import { generateConfirmationEmailHTML } from '../utils/emailTemplates.ts'

const router = express.Router()

router.post('/', async (req: Request, res: Response) => {
  try {
    const { to, name = 'Teste' } = req.body || {}
    const apiKey = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
    if (!apiKey) return res.status(500).json({ success: false, error: 'BREVO_API_KEY ausente' })
    if (!to) return res.status(400).json({ success: false, error: 'Parâmetro to é obrigatório' })

    let outboxId: number | null = null
    try {
      const ins = await supabaseAdmin
        .from('email_outbox')
        .insert({ recipient: to, subject: 'Teste de Envio - Natureza Brindes', template: 'test', payload: { to, name }, status: 'queued' })
        .select('id')
        .single()
      outboxId = ins.data?.id || null
    } catch {}

    const htmlContent = generateConfirmationEmailHTML({
      clientName: name,
      clientEmail: to,
      clientPhone: '',
      clientCompany: '',
      subject: 'RECEBEMOS SUA SOLICITAÇÃO DE ORÇAMENTO - Natureza Brindes',
      message: 'Este é um disparo de teste usando o mesmo template da confirmação.'
    })

    const payload = {
      sender: { name: 'Natureza Brindes', email: 'naturezabrindes@naturezabrindes.com.br' },
      to: [{ email: to, name }],
      subject: 'RECEBEMOS SUA SOLICITAÇÃO DE ORÇAMENTO - Natureza Brindes',
      htmlContent,
      textContent: `Olá ${name},\n\nRecebemos sua solicitação de orçamento (teste).\n\nE-mail: ${to}\n\nEquipe Natureza Brindes`,
      replyTo: { email: 'naturezabrindes@naturezabrindes.com.br', name: 'Natureza Brindes' },
      tags: ['quote_confirmation_test']
    }

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(payload)
    })
    const text = await resp.text().catch(() => '')

    try {
      if (outboxId) {
        await supabaseAdmin
          .from('email_outbox')
          .update({ status: resp.ok ? 'sent' : 'error', provider_response: { text }, updated_at: new Date().toISOString() })
          .eq('id', outboxId)
      }
    } catch {}

    return res.status(resp.ok ? 200 : 500).json({ success: resp.ok, status: resp.status, provider_response: text })
  } catch (e) {
    return res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' })
  }
})

export default router