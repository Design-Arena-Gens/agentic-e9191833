import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polygon Area Mapper',
  description: 'Draw and move polygons with constant real-world area',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
