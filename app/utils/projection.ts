import proj4 from 'proj4'

proj4.defs('WGS84', '+proj=longlat +datum=WGS84 +no_defs')

export function getUTMZone(lon: number, lat: number): { zone: number; isNorth: boolean } {
  const zone = Math.floor((lon + 180) / 6) + 1
  const isNorth = lat >= 0
  return { zone, isNorth }
}

export function getUTMProj(zone: number, isNorth: boolean): string {
  const hemisphere = isNorth ? 'north' : 'south'
  return `+proj=utm +zone=${zone} +${hemisphere} +datum=WGS84 +units=m +no_defs`
}

export function reprojectToUTM(
  lon: number,
  lat: number,
  zone: number,
  isNorth: boolean
): [number, number] {
  const utmProj = getUTMProj(zone, isNorth)
  const [x, y] = proj4('WGS84', utmProj, [lon, lat])
  return [x, y]
}

export function reprojectFromUTM(
  x: number,
  y: number,
  zone: number,
  isNorth: boolean
): [number, number] {
  const utmProj = getUTMProj(zone, isNorth)
  const [lon, lat] = proj4(utmProj, 'WGS84', [x, y])
  return [lon, lat]
}

export function calculateCentroid(positions: [number, number][]): [number, number] {
  let sumLat = 0
  let sumLon = 0

  for (const [lat, lon] of positions) {
    sumLat += lat
    sumLon += lon
  }

  return [sumLat / positions.length, sumLon / positions.length]
}

function shoelaceArea(coords: [number, number][]): number {
  let area = 0
  const n = coords.length

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += coords[i][0] * coords[j][1]
    area -= coords[j][0] * coords[i][1]
  }

  return Math.abs(area / 2)
}

export function calculateAreaFromUTM(utmPositions: [number, number][]): number {
  return shoelaceArea(utmPositions)
}

export function adjustPolygonToArea(
  positions: [number, number][],
  targetArea: number,
  zone: number,
  isNorth: boolean
): [number, number][] {
  const centroid = calculateCentroid(positions)
  const centroidUTM = reprojectToUTM(centroid[1], centroid[0], zone, isNorth)

  const utmPositions = positions.map(pos =>
    reprojectToUTM(pos[1], pos[0], zone, isNorth)
  )

  const currentArea = calculateAreaFromUTM(utmPositions)

  if (currentArea <= 0) {
    return positions
  }

  const scaleFactor = Math.sqrt(targetArea / currentArea)

  const scaledUTM = utmPositions.map(([x, y]) => {
    const dx = x - centroidUTM[0]
    const dy = y - centroidUTM[1]
    return [
      centroidUTM[0] + dx * scaleFactor,
      centroidUTM[1] + dy * scaleFactor
    ] as [number, number]
  })

  const newPositions: [number, number][] = scaledUTM.map(([x, y]) => {
    const [lon, lat] = reprojectFromUTM(x, y, zone, isNorth)
    return [lat, lon]
  })

  return newPositions
}
