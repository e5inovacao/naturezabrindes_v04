import express, { Request, Response } from 'express';
import { QuoteRequest, QuoteStatus, PaginatedResponse } from '../../shared/types.js';
import { supabaseAdmin } from '../../supabase/server.ts';
// import { createQuoteRequest } from '../../src/services/quotesService.js'; // Removido para evitar erro de import.meta.env

const router = express.Router();

// Função auxiliar para mapear dados do Supabase para o tipo QuoteRequest
function mapSupabaseToQuoteRequest(quoteData: any, itemsData: any[], clienteData?: any): QuoteRequest {
  return {
      id: quoteData.solicitacao_id,
      customerInfo: {
        name: clienteData?.nome || '',
        email: clienteData?.email || '',
        phone: clienteData?.telefone || '',
        company: clienteData?.empresa || '',
        cnpj: clienteData?.cnpj || ''
      },
    items: itemsData.map(item => ({
      productId: item.product_id || item.id,
      productName: item.produto_nome || item.product_name || 'Produto',
      quantity: item.quantidade || item.quantity || 1,
      unitPrice: item.valor_unitario_estimado || item.unit_price || 0,
      customizations: item.personalizacoes || item.customizations || {},
      notes: item.notes || ''
    })),
    notes: quoteData.observacoes || '',
    status: quoteData.status || 'pendente',
    totalEstimated: quoteData.valor_total_estimado || 0,
    createdAt: new Date(quoteData.created_at),
    updatedAt: new Date(quoteData.updated_at || quoteData.created_at)
  };
}

// Função createQuoteRequest para backend usando supabaseAdmin
async function createQuoteRequest(customerData: any, items: any[], notes?: string) {
  console.log(`[${new Date().toISOString()}] [QUOTES] 🚀 Iniciando createQuoteRequest no backend...`);
  
  // Primeiro, criar ou buscar cliente
  let clienteId: string;
  
  // Buscar cliente existente por email
  const { data: existingClient, error: searchError } = await supabaseAdmin
    .from('usuarios_clientes')
    .select('id')
    .eq('email', customerData.email.toLowerCase().trim())
    .single();
  
  if (searchError && searchError.code !== 'PGRST116') {
    console.error(`[${new Date().toISOString()}] [QUOTES] ❌ Erro ao buscar cliente:`, searchError);
    throw searchError;
  }
  
  if (existingClient) {
    clienteId = existingClient.id;
    console.log(`[${new Date().toISOString()}] [QUOTES] ✅ Cliente existente encontrado:`, clienteId);
  } else {
    // Criar novo cliente
    const { data: newClient, error: createError } = await supabaseAdmin
      .from('usuarios_clientes')
      .insert({
        nome: customerData.name.trim(),
        email: customerData.email.toLowerCase().trim(),
        telefone: customerData.phone || '',
        empresa: customerData.company || ''
      })
      .select('id')
      .single();
    
    if (createError) {
      console.error(`[${new Date().toISOString()}] [QUOTES] ❌ Erro ao criar cliente:`, createError);
      throw createError;
    }
    
    clienteId = newClient.id;
    console.log(`[${new Date().toISOString()}] [QUOTES] ✅ Novo cliente criado:`, clienteId);
  }
  
  // Gerar número da solicitação
  const numeroSolicitacao = `SOL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  // Criar solicitação de orçamento
  const { data: solicitacao, error: solicitacaoError } = await supabaseAdmin
    .from('solicitacao_orcamentos')
    .insert({
      user_id: clienteId,
      numero_solicitacao: numeroSolicitacao,
      observacoes: notes || '',
      status: 'pendente'
    })
    .select()
    .single();
    
  if (solicitacaoError) {
    console.error(`[${new Date().toISOString()}] [QUOTES] ❌ Erro ao criar solicitação:`, solicitacaoError);
    throw solicitacaoError;
  }
  
  console.log(`[${new Date().toISOString()}] [QUOTES] ✅ Solicitação criada:`, solicitacao.solicitacao_id);
  
  // Criar itens da solicitação
  const itensData = items.map(item => ({
    solicitacao_id: solicitacao.solicitacao_id,
    produto_nome: item.name || item.productName,
    quantidade: item.quantity,
    valor_unitario_estimado: item.unitPrice || 0,
    subtotal_estimado: (item.quantity * (item.unitPrice || 0)),
    personalizacoes: item.customizations || {}
  }));
  
  const { data: itens, error: itensError } = await supabaseAdmin
    .from('products_solicitacao')
    .insert(itensData)
    .select();
    
  if (itensError) {
    console.error(`[${new Date().toISOString()}] [QUOTES] ❌ Erro ao criar itens:`, itensError);
    throw itensError;
  }
  
  console.log(`[${new Date().toISOString()}] [QUOTES] ✅ Itens criados:`, itens.length);

  return solicitacao;
}

// Dados mockados removidos - agora usando Supabase

// POST /api/quotes/v2 - Nova versão que usa quotesService com products_solicitacao
router.post('/v2', async (req: Request, res: Response) => {
  const requestId = `req_v2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] Iniciando criação de orçamento v2 com products_solicitacao`);
  
  try {
    const {
      customerData,
      items,
      notes
    } = req.body;

    console.log(`[${requestId}] Dados recebidos:`, {
      customerData: customerData ? { name: customerData.name, email: customerData.email } : null,
      itemsCount: items ? items.length : 0,
      hasNotes: !!notes
    });

    // Validação básica
    if (!customerData || !customerData.name || !customerData.email) {
      return res.status(400).json({
        success: false,
        error: 'Dados do cliente são obrigatórios (name, email)',
        code: 'MISSING_CUSTOMER_DATA'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Pelo menos um item deve ser incluído no orçamento',
        code: 'NO_ITEMS'
      });
    }

    // Usar o quotesService modificado
    console.log(`[${requestId}] Chamando createQuoteRequest do quotesService...`);
    const result = await createQuoteRequest(customerData, items, notes);
    
    console.log(`[${requestId}] Orçamento criado com sucesso:`, {
      id: result.solicitacao_id,
      numero: result.numero_solicitacao
    });

    // Enviar e-mail de confirmação
    await sendBrevoConfirmationEmail(customerData);

    return res.status(201).json({
      success: true,
      data: {
        id: result.solicitacao_id,
        numero_solicitacao: result.numero_solicitacao,
        status: result.status,
        created_at: result.created_at
      },
      message: 'Orçamento criado com sucesso usando products_solicitacao'
    });

  } catch (error: any) {
    console.error(`[${requestId}] Erro ao criar orçamento v2:`, error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao criar orçamento',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/quotes - Criar nova solicitação de orçamento (versão original)
router.post('/', async (req: Request, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] Iniciando criação de orçamento`);
  
  try {
    const {
      customerData,
      items,
      notes
    } = req.body;

    console.log(`[${requestId}] Dados recebidos:`, {
      customerData: customerData ? { name: customerData.name, email: customerData.email } : null,
      itemsCount: items ? items.length : 0,
      hasNotes: !!notes
    });

    // Validação básica aprimorada
    if (!customerData) {
      console.warn(`[${requestId}] Erro de validação: customerData não fornecido`);
      return res.status(400).json({
        success: false,
        error: 'Informações do cliente são obrigatórias',
        code: 'MISSING_CUSTOMER_DATA'
      });
    }

    if (!customerData.name || customerData.name.trim().length < 2) {
      console.warn(`[${requestId}] Erro de validação: nome inválido`);
      return res.status(400).json({
        success: false,
        error: 'Nome do cliente deve ter pelo menos 2 caracteres',
        code: 'INVALID_NAME'
      });
    }

    if (!customerData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) {
      console.warn(`[${requestId}] Erro de validação: email inválido`);
      return res.status(400).json({
        success: false,
        error: 'Email válido é obrigatório',
        code: 'INVALID_EMAIL'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.warn(`[${requestId}] Erro de validação: itens inválidos`);
      return res.status(400).json({
        success: false,
        error: 'Pelo menos um item deve ser incluído no orçamento',
        code: 'NO_ITEMS'
      });
    }

    // Validar cada item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.quantity || item.quantity <= 0) {
        console.warn(`[${requestId}] Erro de validação: quantidade inválida no item ${i}`);
        return res.status(400).json({
          success: false,
          error: `Item ${i + 1}: quantidade deve ser maior que zero`,
          code: 'INVALID_QUANTITY'
        });
      }
      if (!item.productName && !item.name) {
        console.warn(`[${requestId}] Erro de validação: nome do produto ausente no item ${i}`);
        return res.status(400).json({
          success: false,
          error: `Item ${i + 1}: nome do produto é obrigatório`,
          code: 'MISSING_PRODUCT_NAME'
        });
      }
    }

    // Primeiro, criar ou buscar cliente usando consultas diretas
    console.log(`[${requestId}] Criando/buscando cliente:`, {
      nome: customerData.name,
      email: customerData.email,
      telefone: customerData.phone || 'não informado',
      empresa: customerData.company || 'não informada'
    });
    
    let clienteId: string;
    
    // Buscar cliente existente por email
    const { data: existingClient, error: searchError } = await supabaseAdmin
      .from('usuarios_clientes')
      .select('id')
      .eq('email', customerData.email.toLowerCase().trim())
      .single();
    
    if (searchError && searchError.code !== 'PGRST116') {
      console.error(`[${requestId}] Erro ao buscar cliente:`, searchError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar dados do cliente',
        code: 'CLIENT_ERROR',
        details: process.env.NODE_ENV === 'development' ? searchError.message : undefined
      });
    }
    
    if (existingClient) {
      // Cliente encontrado
      clienteId = existingClient.id;
      console.log(`[${requestId}] Cliente existente encontrado - ID:`, clienteId);
    } else {
      // Criar novo cliente
      const { data: newClient, error: createError } = await supabaseAdmin
        .from('usuarios_clientes')
        .insert({
          nome: customerData.name.trim(),
          email: customerData.email.toLowerCase().trim(),
          telefone: customerData.phone || '',
          empresa: customerData.company || ''
        })
        .select('id')
        .single();
      
      if (createError) {
        console.error(`[${requestId}] Erro ao criar cliente:`, createError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao processar dados do cliente',
          code: 'CLIENT_ERROR',
          details: process.env.NODE_ENV === 'development' ? createError.message : undefined
        });
      }
      
      if (!newClient) {
        console.error(`[${requestId}] Cliente não foi criado - dados nulos`);
        return res.status(500).json({
          success: false,
          error: 'Falha ao processar dados do cliente',
          code: 'CLIENT_NOT_FOUND'
        });
      }
      
      clienteId = newClient.id;
      console.log(`[${requestId}] Novo cliente criado - ID:`, clienteId);
    }

    // Criar orçamento
    console.log(`[${requestId}] Criando orçamento para cliente ID:`, clienteId);
    
    // Gerar número da solicitação
    const numeroSolicitacao = `SOL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const { data: quoteData, error: quoteError } = await supabaseAdmin
      .from('solicitacao_orcamentos')
      .insert({
        user_id: clienteId,
        numero_solicitacao: numeroSolicitacao,
        observacoes: notes ? notes.trim() : '',
        status: 'pendente'
      })
      .select('solicitacao_id, numero_solicitacao')
      .single();

    if (quoteError) {
      console.error(`[${requestId}] Erro ao criar orçamento:`, {
        error: quoteError,
        message: quoteError.message,
        details: quoteError.details,
        hint: quoteError.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar solicitação de orçamento',
        code: 'QUOTE_CREATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? quoteError.message : undefined
      });
    }

    if (!quoteData) {
      console.error(`[${requestId}] Orçamento não foi criado - dados nulos`);
      return res.status(500).json({
        success: false,
        error: 'Falha ao criar orçamento',
        code: 'QUOTE_NOT_CREATED'
      });
    }

    console.log(`[${requestId}] Orçamento criado com sucesso:`, {
      id: quoteData.solicitacao_id,
      numero: quoteData.numero_solicitacao
    });

    // Criar itens do orçamento
    const quoteItems = items.map((item: any) => ({
      solicitacao_id: quoteData.solicitacao_id,
      products_id: null, // Não vincular a produtos específicos por enquanto
      products_quantidade_01: item.quantity || 1,
      customizations: item.name ? JSON.stringify({ name: item.name, id: item.id }) : JSON.stringify({ id: item.id })
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('products_solicitacao')
      .insert(quoteItems);

    if (itemsError) {
      console.error(`[${new Date().toISOString()}] [QUOTES] Erro ao criar itens da solicitação:`, itemsError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar itens da solicitação'
      });
    }

    // Buscar o orçamento criado com todos os dados
    const { data: fullQuoteData } = await supabaseAdmin
      .from('solicitacao_orcamentos')
      .select('*')
      .eq('solicitacao_id', quoteData.solicitacao_id)
      .single();

    const { data: fullItemsData } = await supabaseAdmin
      .from('products_solicitacao')
      .select('*')
      .eq('solicitacao_id', quoteData.solicitacao_id);

    // Buscar dados do cliente
    const { data: clienteData } = await supabaseAdmin
      .from('usuarios_clientes')
      .select('*')
      .eq('id', clienteId)
      .single();

    const newQuote = mapSupabaseToQuoteRequest(fullQuoteData, fullItemsData || [], clienteData);

    // Enviar e-mail de confirmação
    await sendBrevoConfirmationEmail(customerData);

    res.status(201).json({
      success: true,
      data: newQuote,
      message: 'Solicitação de orçamento criada com sucesso'
    });
  } catch (error) {
    console.error(`[${requestId}] Erro inesperado ao criar orçamento:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
      requestId: process.env.NODE_ENV === 'development' ? requestId : undefined
    });
  }
});

// GET /api/quotes - Listar todas as solicitações de orçamento
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      status,
      page = '1',
      limit = '10',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Construir query base
    let query = supabaseAdmin
      .from('orcamentos_sistema')
      .select(`
        *,
        usuarios_cliente!usuario_id(*)
      `, { count: 'exact' });

    // Filtrar por status se especificado
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Ordenação
    const orderColumn = sortBy === 'createdAt' ? 'created_at' : sortBy as string;
    query = query.order(orderColumn, { ascending: sortOrder === 'asc' });

    // Paginação
    query = query.range(offset, offset + limitNum - 1);

    const { data: quotesData, error: quotesError, count } = await query;

    if (quotesError) {
      console.error(`[${new Date().toISOString()}] [QUOTES] Erro ao buscar orçamentos:`, quotesError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar orçamentos'
      });
    }

    // Buscar itens para cada orçamento
    const quotesWithItems = await Promise.all(
      (quotesData || []).map(async (quote) => {
        const { data: itemsData } = await supabaseAdmin
          .from('itens_orcamento_sistema')
          .select(`
            *,
            produtos_ecologicos!produto_ecologico_id(*)
          `)
          .eq('orcamento_id', quote.id);

        return mapSupabaseToQuoteRequest(quote, itemsData || []);
      })
    );

    const totalQuotes = count || 0;
    const totalPages = Math.ceil(totalQuotes / limitNum);

    res.json({
      success: true,
      data: {
        quotes: quotesWithItems,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalQuotes,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [QUOTES] Erro ao buscar orçamentos:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/quotes/:id - Buscar orçamento por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Buscar orçamento
    const { data: quoteData, error: quoteError } = await supabaseAdmin
      .from('orcamentos_sistema')
      .select(`
        *,
        usuarios_cliente!usuario_id(*)
      `)
      .eq('id', id)
      .single();

    if (quoteError || !quoteData) {
      return res.status(404).json({
        success: false,
        error: 'Orçamento não encontrado'
      });
    }

    // Buscar itens do orçamento
    const { data: itemsData } = await supabaseAdmin
      .from('itens_orcamento_sistema')
      .select(`
        *,
        produtos_ecologicos!produto_ecologico_id(*)
      `)
      .eq('orcamento_id', id);

    const quote = mapSupabaseToQuoteRequest(quoteData, itemsData || []);

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [QUOTES] Erro ao buscar orçamento:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// PUT /api/quotes/:id/status - Atualizar status do orçamento
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses: QuoteStatus[] = ['pending', 'approved', 'rejected', 'completed'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido. Use: pending, approved, rejected ou completed'
      });
    }

    // Atualizar status no Supabase
    const { data: updatedQuote, error: updateError } = await supabaseAdmin
      .from('solicitacao_orcamentos')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updatedQuote) {
      return res.status(404).json({
        success: false,
        error: 'Orçamento não encontrado'
      });
    }

    // Buscar itens do orçamento
    const { data: itemsData } = await supabaseAdmin
      .from('products_solicitacao')
      .select('*')
      .eq('solicitacao_id', id);

    const quote = mapSupabaseToQuoteRequest(updatedQuote, itemsData || []);

    res.json({
      success: true,
      data: quote,
      message: 'Status do orçamento atualizado com sucesso'
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [QUOTES] Erro ao atualizar status do orçamento:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/quotes/:id - Excluir orçamento
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Buscar orçamento antes de excluir para retornar os dados
    const { data: quoteData, error: fetchError } = await supabaseAdmin
      .from('solicitacao_orcamentos')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !quoteData) {
      return res.status(404).json({
        success: false,
        error: 'Orçamento não encontrado'
      });
    }

    // Buscar itens do orçamento
    const { data: itemsData } = await supabaseAdmin
      .from('products_solicitacao')
      .select('*')
      .eq('solicitacao_id', id);

    const quote = mapSupabaseToQuoteRequest(quoteData, itemsData || []);

    // Excluir itens do orçamento primeiro (devido à foreign key)
    const { error: deleteItemsError } = await supabaseAdmin
      .from('products_solicitacao')
      .delete()
      .eq('solicitacao_id', id);

    if (deleteItemsError) {
      console.error(`[${new Date().toISOString()}] [QUOTES] Erro ao excluir itens do orçamento:`, deleteItemsError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir itens do orçamento'
      });
    }

    // Excluir orçamento
    const { error: deleteQuoteError } = await supabaseAdmin
      .from('solicitacao_orcamentos')
      .delete()
      .eq('id', id);

    if (deleteQuoteError) {
      console.error(`[${new Date().toISOString()}] [QUOTES] Erro ao excluir orçamento:`, deleteQuoteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir orçamento'
      });
    }

    res.json({
      success: true,
      data: quote,
      message: 'Orçamento excluído com sucesso'
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [QUOTES] Erro ao excluir orçamento:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/quotes/stats/dashboard - Estatísticas para dashboard
router.get('/stats/dashboard', async (req: Request, res: Response) => {
  try {
    // Buscar total de orçamentos
    const { count: totalQuotes } = await supabaseAdmin
      .from('solicitacao_orcamentos')
      .select('*', { count: 'exact', head: true });

    // Buscar orçamentos por status
    const { data: allQuotes } = await supabaseAdmin
      .from('solicitacao_orcamentos')
      .select('status');

    const pendingQuotes = allQuotes?.filter(q => q.status === 'pending').length || 0;
    const approvedQuotes = allQuotes?.filter(q => q.status === 'approved').length || 0;
    const rejectedQuotes = allQuotes?.filter(q => q.status === 'rejected').length || 0;
    const completedQuotes = allQuotes?.filter(q => q.status === 'completed').length || 0;

    // Buscar orçamentos recentes (últimos 5)
    const { data: recentQuotesData } = await supabaseAdmin
      .from('solicitacao_orcamentos')
      .select('id, status, created_at, nome_cliente, empresa_cliente')
      .order('created_at', { ascending: false })
      .limit(5);

    const recentQuotes = recentQuotesData?.map(quote => ({
      id: quote.id,
      customerName: quote.nome_cliente || '',
      company: quote.empresa_cliente || '',
      status: quote.status,
      totalEstimated: 0,
      createdAt: new Date(quote.created_at)
    })) || [];

    res.json({
      success: true,
      data: {
        summary: {
          totalQuotes: totalQuotes || 0,
          pendingQuotes,
          approvedQuotes,
          rejectedQuotes,
          completedQuotes,
          totalValue: 0 // TODO: Implementar cálculo de valor total quando houver preços
        },
        recentQuotes
      }
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [QUOTES] Erro ao buscar estatísticas:`, error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;
import { generateConfirmationEmailHTML } from '../utils/emailTemplates.ts';

// Serviço de envio de e-mail via Brevo (server-side)
async function sendBrevoConfirmationEmail(customerData: any, options: { subject?: string; message?: string } = {}) {
  try {
    const apiKey = process.env.VITE_BREVO_API_KEY || process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.warn('[QUOTES] BREVO API key ausente no ambiente');
      return false;
    }

    const sender = {
      name: 'Natureza Brindes',
      email: 'naturezabrindes@naturezabrindes.com.br'
    };

    const htmlContent = generateConfirmationEmailHTML({
      clientName: customerData.name,
      clientEmail: customerData.email,
      clientPhone: customerData.phone,
      clientCompany: customerData.company,
      subject: options.subject,
      message: options.message,
    });

    const payload = {
      sender,
      to: [{ email: customerData.email, name: customerData.name }],
      subject: options.subject || 'RECEBEMOS SUA SOLICITAÇÃO DE ORÇAMENTO - Natureza Brindes',
      htmlContent,
      textContent: `Olá ${customerData.name},\n\nRecebemos sua solicitação de orçamento e nossa equipe já está preparando a melhor proposta.\n\nSeus dados:\n- E-mail: ${customerData.email}\n- Telefone: ${customerData.phone || 'Não informado'}\n- Empresa: ${customerData.company || 'Não informado'}\n\nAtenciosamente,\nEquipe Natureza Brindes`,
      replyTo: { email: 'naturezabrindes@naturezabrindes.com.br', name: 'Natureza Brindes' },
      tags: ['quote_confirmation']
    };

    let outboxId: number | null = null;
    try {
      const ins = await supabaseAdmin
        .from('email_outbox')
        .insert({
          recipient: customerData.email,
          subject: options.subject || 'RECEBEMOS SUA SOLICITAÇÃO DE ORÇAMENTO - Natureza Brindes',
          template: 'quote_confirmation',
          payload: { customerData, message: options.message },
          status: 'queued',
        })
        .select('id')
        .single();
      outboxId = ins.data?.id || null;
    } catch (logErr) {}

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      try {
        if (outboxId) {
          await supabaseAdmin
            .from('email_outbox')
            .update({ status: 'error', provider_response: { text: txt }, updated_at: new Date().toISOString() })
            .eq('id', outboxId);
        }
      } catch {}
      console.error('[QUOTES] Falha ao enviar e-mail (Brevo):', txt);
      return false;
    }
    try {
      const okText = await resp.text().catch(() => '');
      if (outboxId) {
        await supabaseAdmin
          .from('email_outbox')
          .update({ status: 'sent', provider_response: { text: okText }, updated_at: new Date().toISOString() })
          .eq('id', outboxId);
      }
    } catch {}
    console.log('[QUOTES] E-mail de confirmação enviado com sucesso');
    return true;
  } catch (e) {
    console.error('[QUOTES] Erro no envio de e-mail (Brevo):', e instanceof Error ? e.message : String(e));
    return false;
  }
}