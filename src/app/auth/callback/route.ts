import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Supabase redireciona para cá após confirmação de email (PKCE flow)
// Troca o ?code= por uma sessão válida e redireciona para /dashboard
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Se falhar ou não tiver code, redireciona para login
  return NextResponse.redirect(new URL('/login', request.url))
}
