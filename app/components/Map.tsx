'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polygon, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getUTMZone, reprojectToUTM, reprojectFromUTM, calculateCentroid, adjustPolygonToArea, calculateAreaFromUTM } from '../utils/projection'

interface PolygonData {
  id: number
  positions: [number, number][]
  originalArea: number
  utmZone: number
  isNorth: boolean
}

function DrawingHandler({
  isDrawing,
  onPolygonComplete
}: {
  isDrawing: boolean
  onPolygonComplete: (positions: [number, number][]) => void
}) {
  const [tempPoints, setTempPoints] = useState<[number, number][]>([])

  useMapEvents({
    click: (e) => {
      if (!isDrawing) return

      const point: [number, number] = [e.latlng.lat, e.latlng.lng]
      const newPoints = [...tempPoints, point]
      setTempPoints(newPoints)

      if (newPoints.length >= 3) {
        onPolygonComplete(newPoints)
        setTempPoints([])
      }
    },
  })

  if (tempPoints.length > 0) {
    return <Polygon positions={tempPoints} pathOptions={{ color: 'blue', dashArray: '5, 5' }} />
  }

  return null
}

function DraggablePolygon({
  polygon,
  onDragEnd
}: {
  polygon: PolygonData
  onDragEnd: (id: number, newPositions: [number, number][]) => void
}) {
  const polygonRef = useRef<L.Polygon>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const poly = polygonRef.current
    if (!poly) return

    const leafletPolygon = (poly as any)._polygon || poly

    if (leafletPolygon.dragging) {
      leafletPolygon.dragging.enable()
    }

    const handleDragStart = () => {
      setIsDragging(true)
    }

    const handleDragEnd = () => {
      setIsDragging(false)
      const latlngs = leafletPolygon.getLatLngs()[0] as L.LatLng[]
      const positions: [number, number][] = latlngs.map(ll => [ll.lat, ll.lng])
      onDragEnd(polygon.id, positions)
    }

    leafletPolygon.on('dragstart', handleDragStart)
    leafletPolygon.on('dragend', handleDragEnd)

    return () => {
      leafletPolygon.off('dragstart', handleDragStart)
      leafletPolygon.off('dragend', handleDragEnd)
      if (leafletPolygon.dragging) {
        leafletPolygon.dragging.disable()
      }
    }
  }, [polygon.id, onDragEnd])

  return (
    <Polygon
      ref={polygonRef}
      positions={polygon.positions}
      pathOptions={{
        color: isDragging ? 'orange' : 'green',
        fillColor: isDragging ? 'lightyellow' : 'lightgreen',
        fillOpacity: 0.4,
        weight: 2
      }}
      eventHandlers={{
        add: (e) => {
          const target = e.target as any
          if (target.dragging) {
            target.dragging.enable()
          }
        }
      }}
    />
  )
}

export default function Map() {
  const [polygons, setPolygons] = useState<PolygonData[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [nextId, setNextId] = useState(1)
  const [selectedPolygon, setSelectedPolygon] = useState<PolygonData | null>(null)

  const handlePolygonComplete = (positions: [number, number][]) => {
    const centroid = calculateCentroid(positions)
    const { zone, isNorth } = getUTMZone(centroid[1], centroid[0])

    const utmPositions = positions.map(pos =>
      reprojectToUTM(pos[1], pos[0], zone, isNorth)
    )

    const area = calculateAreaFromUTM(utmPositions)

    const newPolygon: PolygonData = {
      id: nextId,
      positions,
      originalArea: area,
      utmZone: zone,
      isNorth,
    }

    setPolygons([...polygons, newPolygon])
    setNextId(nextId + 1)
    setIsDrawing(false)
    setSelectedPolygon(newPolygon)
  }

  const handleDragEnd = (id: number, newPositions: [number, number][]) => {
    const polygon = polygons.find(p => p.id === id)
    if (!polygon) return

    const newCentroid = calculateCentroid(newPositions)
    const { zone, isNorth } = getUTMZone(newCentroid[1], newCentroid[0])

    const adjustedPositions = adjustPolygonToArea(
      newPositions,
      polygon.originalArea,
      zone,
      isNorth
    )

    const updatedPolygon = {
      ...polygon,
      positions: adjustedPositions,
      utmZone: zone,
      isNorth,
    }

    setPolygons(polygons.map(p => p.id === id ? updatedPolygon : p))
    setSelectedPolygon(updatedPolygon)
  }

  const handleClearAll = () => {
    setPolygons([])
    setSelectedPolygon(null)
  }

  return (
    <div className="map-container">
      <MapContainer
        center={[51.505, -0.09]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <DrawingHandler
          isDrawing={isDrawing}
          onPolygonComplete={handlePolygonComplete}
        />

        {polygons.map(polygon => (
          <DraggablePolygon
            key={polygon.id}
            polygon={polygon}
            onDragEnd={handleDragEnd}
          />
        ))}
      </MapContainer>

      <div className="controls">
        <button
          className={isDrawing ? 'active' : ''}
          onClick={() => setIsDrawing(!isDrawing)}
        >
          {isDrawing ? 'Drawing... (click 3+ points)' : 'Draw Polygon'}
        </button>
        <button onClick={handleClearAll}>
          Clear All
        </button>
      </div>

      {selectedPolygon && (
        <div className="info-panel">
          <h3>Polygon #{selectedPolygon.id}</h3>
          <p><strong>Area:</strong> {selectedPolygon.originalArea.toFixed(2)} m²</p>
          <p><strong>Area (ha):</strong> {(selectedPolygon.originalArea / 10000).toFixed(4)} ha</p>
          <p><strong>UTM Zone:</strong> {selectedPolygon.utmZone}{selectedPolygon.isNorth ? 'N' : 'S'}</p>
          <p style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
            Drag polygon to move. Area stays constant via UTM reprojection.
          </p>
        </div>
      )}
    </div>
  )
}
