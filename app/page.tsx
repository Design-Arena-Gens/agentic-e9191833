'use client'

import dynamic from 'next/dynamic'

const MapComponent = dynamic(() => import('./components/Map'), {
  ssr: false,
})

export default function Home() {
  return (
    <main>
      <MapComponent />
    </main>
  )
}
