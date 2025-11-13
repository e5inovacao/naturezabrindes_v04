import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  console.log(`[${new Date().toISOString()}] Disabling products containing "Churrasco" in title or description`)

  const { data: updatedChurrasco, error: errorChurrasco } = await supabase
    .from('ecologic_products_site')
    .update({ status_active: false })
    .ilike('titulo', '%churrasco%')
    .select('id, codigo, titulo, status_active')

  if (errorChurrasco) {
    console.error('Churrasco update failed:', errorChurrasco.message)
    process.exit(1)
  }

  console.log(`Churrasco updated rows: ${updatedChurrasco?.length || 0}`)
  if (updatedChurrasco && updatedChurrasco.length) {
    updatedChurrasco.slice(0, 10).forEach(row => {
      console.log(`- ${row.codigo || row.id}: ${row.titulo} -> status_active=${row.status_active}`)
    })
    if (updatedChurrasco.length > 10) {
      console.log(`...and ${updatedChurrasco.length - 10} more`)
    }
  }

  console.log(`[${new Date().toISOString()}] Disabling products containing "Queijo" in title or description`)

  const { data: updatedQueijo, error: errorQueijo } = await supabase
    .from('ecologic_products_site')
    .update({ status_active: false })
    .ilike('titulo', '%queijo%')
    .select('id, codigo, titulo, status_active')

  if (errorQueijo) {
    console.error('Queijo update failed:', errorQueijo.message)
    process.exit(1)
  }

  console.log(`Queijo updated rows: ${updatedQueijo?.length || 0}`)
  if (updatedQueijo && updatedQueijo.length) {
    updatedQueijo.slice(0, 10).forEach(row => {
      console.log(`- ${row.codigo || row.id}: ${row.titulo} -> status_active=${row.status_active}`)
    })
    if (updatedQueijo.length > 10) {
      console.log(`...and ${updatedQueijo.length - 10} more`)
    }
  }

  const { data: updatedQueijRoot, error: errorQueijRoot } = await supabase
    .from('ecologic_products_site')
    .update({ status_active: false })
    .ilike('titulo', '%queij%')
    .select('id, codigo, titulo, status_active')

  if (errorQueijRoot) {
    console.error('Queij* update failed:', errorQueijRoot.message)
    process.exit(1)
  }

  console.log(`Queij* updated rows: ${updatedQueijRoot?.length || 0}`)

  console.log('Done')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
