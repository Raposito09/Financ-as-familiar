import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })
const mono = JetBrains_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Finança Familiar',
  description: 'Controle financeiro da sua família',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Finança Familiar' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f0f0f' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
