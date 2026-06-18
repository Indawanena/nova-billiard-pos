import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  other: {
    'sitemaps': '/sitemap.xml',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
