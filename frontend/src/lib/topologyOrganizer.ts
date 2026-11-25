import type { Edge, Node } from "@xyflow/react"
import type { DeviceNodeData } from "@/components/DeviceNode"
import type { SegmentGroupNodeData } from "@/components/SegmentGroupNode"
import type { TopologyEdge, TopologyNode } from "@/lib/api"

export type SegmentKey = "infra" | "endpoints" | "unknown"

const INFRA_TYPES = new Set(["firewall", "router", "switch", "access_point", "server"])
const ENDPOINT_TYPES = new Set(["computer", "phone", "printer", "tv", "camera"])

const INFRA_TIER_ORDER: Record<string, number> = {
  firewall: 0,
  router: 0,
  switch: 1,
  access_point: 2,
  server: 2,
}

const ENDPOINT_ORDER: Record<string, number> = {
  computer: 0,
  phone: 1,
  printer: 2,
  tv: 3,
  camera: 4,
}

const CARD_WIDTH = 210
const CARD_HEIGHT = 104
const H_GAP = 44
const V_GAP = 42
const GROUP_PADDING_X = 36
const GROUP_HEADER_HEIGHT = 64
const GROUP_PADDING_BOTTOM = 32
const SEGMENT_GAP_Y = 54
const MAX_COLS = 5

/**
 * Classifies a device using manual override first, then existing auto classification,
 * then heuristic analysis over hostname, display_name, vendor, MAC, and sources.
 */
export function resolveEffectiveCategory(node: TopologyNode): string {
  // 1. Manual classification always has strict priority
  if (node.is_manual_type && node.type) {
    return node.type
  }

  // 2. Existing non-unknown classification from discovery (LLDP/SNMP/NetBIOS/DNS)
  if (node.type && node.type !== "unknown") {
    return node.type
  }

  // 3. Heuristic classification from collected metadata
  const text = [node.hostname, node.display_name, node.label, node.vendor]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const sources = new Set((node.sources || []).map((s) => s.toLowerCase()))

  if (/(firewall|pfsense|opnsense|fortigate|fortinet|sophos|sonicwall|watchguard|palo\s?alto)/i.test(text)) {
    return "firewall"
  }
  if (/(router|roteador|mikrotik|routerboard|gateway|cisco\s+ios|juniper|edge\s?router)/i.test(text)) {
    return "router"
  }
  if (/(switch|catalyst|procurve|usw-|tl-sg|dgs-|unifi\s+switch|aruba\s+\d)/i.test(text)) {
    return "switch"
  }
  if (/(access\s?point|unifi|uap-|u6-|aironet|omada|eap\d|ruckus|wifi|\bap[-_])/i.test(text)) {
    return "access_point"
  }
  if (/(server|servidor|proxmox|esxi|vmware|hyper-v|poweredge|proliant|synology|qnap|truenas|\bnas\b)/i.test(text)) {
    return "server"
  }
  if (/(printer|impressora|laserjet|deskjet|ecotank|epson|brother|canon|xerox|ricoh|kyocera|lexmark|zebra|konica|hewlett)/i.test(text)) {
    return "printer"
  }
  if (/(camera|ipcam|\bcam[-_]|dvr|nvr|hikvision|dahua|intelbras|axis|vivotek|reolink|ezviz)/i.test(text)) {
    return "camera"
  }
  if (/(smarttv|smart\s?tv|samsung-tv|lg-tv|bravia|roku|chromecast|apple\s?tv|fire\s?tv|webos|\btv[-_])/i.test(text)) {
    return "tv"
  }
  if (/(voip|\bsip\b|yealink|grandstream|polycom|fanvil|iphone|android|xiaomi|galaxy|motorola|telefone)/i.test(text)) {
    return "phone"
  }
  if (
    /(desktop|notebook|laptop|workstation|macbook|imac|\bpc[-_]|dell|lenovo|asus|acer)/i.test(text) ||
    sources.has("netbios")
  ) {
    return "computer"
  }

  return "unknown"
}

export function getSegmentForCategory(category: string): SegmentKey {
  if (INFRA_TYPES.has(category)) return "infra"
  if (ENDPOINT_TYPES.has(category)) return "endpoints"
  return "unknown"
}

interface PositionedGroup {
  segment: SegmentKey
  title: string
  subtitle: string
  width: number
  height: number
  childNodes: Node[]
}

function buildGridGroup(
  segment: SegmentKey,
  title: string,
  subtitle: string,
  items: { apiNode: TopologyNode; category: string }[],
  searchFilter: string,
  parentId: string,
): PositionedGroup {
  const lowerSearch = searchFilter.trim().toLowerCase()
  const cols = Math.min(MAX_COLS, Math.max(1, Math.ceil(Math.sqrt(items.length * 1.4))))
  const rows = Math.ceil(items.length / cols)

  const width = GROUP_PADDING_X * 2 + cols * CARD_WIDTH + Math.max(0, cols - 1) * H_GAP
  const height =
    GROUP_HEADER_HEIGHT +
    GROUP_PADDING_BOTTOM +
    rows * CARD_HEIGHT +
    Math.max(0, rows - 1) * V_GAP

  const childNodes: Node[] = items.map((item, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const x = GROUP_PADDING_X + col * (CARD_WIDTH + H_GAP)
    const y = GROUP_HEADER_HEIGHT + 18 + row * (CARD_HEIGHT + V_GAP)

    const n = item.apiNode
    const isMatch =
      lowerSearch.length > 0 &&
      Boolean(
        (n.label && n.label.toLowerCase().includes(lowerSearch)) ||
          (n.ip && n.ip.toLowerCase().includes(lowerSearch)) ||
          (n.mac && n.mac.toLowerCase().includes(lowerSearch)) ||
          (n.hostname && n.hostname.toLowerCase().includes(lowerSearch)) ||
          (n.display_name && n.display_name.toLowerCase().includes(lowerSearch)),
      )

    return {
      id: n.id,
      type: "device",
      parentId,
      position: { x, y },
      data: {
        label: n.display_name || n.hostname || n.ip || n.mac || "Dispositivo",
        type: item.category,
        ip: n.ip,
        l2_only: n.l2_only,
        icon_type: n.icon_type,
        display_name: n.display_name,
        isHighlighted: isMatch,
        isManualType: Boolean(n.is_manual_type),
      } satisfies DeviceNodeData,
    }
  })

  return { segment, title, subtitle, width, height, childNodes }
}

function buildInfraHierarchicalGroup(
  items: { apiNode: TopologyNode; category: string }[],
  edges: TopologyEdge[],
  searchFilter: string,
  parentId: string,
): PositionedGroup {
  const lowerSearch = searchFilter.trim().toLowerCase()

  // Group into 3 hierarchical tiers:
  // Tier 0: Firewalls & Routers
  // Tier 1: Switches
  // Tier 2: Access Points & Servers
  const tiers: { apiNode: TopologyNode; category: string }[][] = [[], [], []]
  for (const item of items) {
    const tierIdx = INFRA_TIER_ORDER[item.category] ?? 2
    tiers[tierIdx].push(item)
  }

  // Sort within each tier by degree (more connected first) then label
  const degree = new Map<string, number>()
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1)
    degree.set(e.target, (degree.get(e.target) || 0) + 1)
  }
  for (const tier of tiers) {
    tier.sort((a, b) => {
      const degDiff = (degree.get(b.apiNode.id) || 0) - (degree.get(a.apiNode.id) || 0)
      if (degDiff !== 0) return degDiff
      return (a.apiNode.label || "").localeCompare(b.apiNode.label || "")
    })
  }

  const nonEmptyTiers = tiers.filter((t) => t.length > 0)
  // Split wide tiers into rows of MAX_COLS so there's never excessive horizontal stretching
  const tierRows: { apiNode: TopologyNode; category: string }[][] = []
  for (const tier of nonEmptyTiers) {
    for (let i = 0; i < tier.length; i += MAX_COLS) {
      tierRows.push(tier.slice(i, i + MAX_COLS))
    }
  }

  const maxColsInAnyRow = Math.max(1, ...tierRows.map((r) => r.length))
  const width =
    GROUP_PADDING_X * 2 + maxColsInAnyRow * CARD_WIDTH + Math.max(0, maxColsInAnyRow - 1) * H_GAP
  const height =
    GROUP_HEADER_HEIGHT +
    GROUP_PADDING_BOTTOM +
    tierRows.length * CARD_HEIGHT +
    Math.max(0, tierRows.length - 1) * V_GAP

  const childNodes: Node[] = []
  tierRows.forEach((rowItems, rowIdx) => {
    const rowWidth = rowItems.length * CARD_WIDTH + Math.max(0, rowItems.length - 1) * H_GAP
    const startX = (width - rowWidth) / 2
    const y = GROUP_HEADER_HEIGHT + 18 + rowIdx * (CARD_HEIGHT + V_GAP)

    rowItems.forEach((item, colIdx) => {
      const x = startX + colIdx * (CARD_WIDTH + H_GAP)
      const n = item.apiNode
      const isMatch =
        lowerSearch.length > 0 &&
        Boolean(
          (n.label && n.label.toLowerCase().includes(lowerSearch)) ||
            (n.ip && n.ip.toLowerCase().includes(lowerSearch)) ||
            (n.mac && n.mac.toLowerCase().includes(lowerSearch)) ||
            (n.hostname && n.hostname.toLowerCase().includes(lowerSearch)) ||
            (n.display_name && n.display_name.toLowerCase().includes(lowerSearch)),
        )

      childNodes.push({
        id: n.id,
        type: "device",
        parentId,
        position: { x, y },
        data: {
          label: n.display_name || n.hostname || n.ip || n.mac || "Dispositivo",
          type: item.category,
          ip: n.ip,
          l2_only: n.l2_only,
          icon_type: n.icon_type,
          display_name: n.display_name,
          isHighlighted: isMatch,
          isManualType: Boolean(n.is_manual_type),
        } satisfies DeviceNodeData,
      })
    })
  })

  return {
    segment: "infra",
    title: "Segmento 1 — Infraestrutura de Rede",
    subtitle: "Roteadores, Firewalls, Switches, Access Points e Servidores",
    width,
    height,
    childNodes,
  }
}

/**
 * Organizes topology nodes into 3 visual React Flow segments without overlap,
 * respecting manual classifications and preserving all connections.
 */
export function buildOrganizedTopology(
  apiNodes: TopologyNode[],
  apiEdges: TopologyEdge[],
  searchFilter: string,
  isDark: boolean,
): { nodes: Node[]; edges: Edge[]; stats: { infra: number; endpoints: number; unknown: number } } {
  const infraItems: { apiNode: TopologyNode; category: string }[] = []
  const endpointItems: { apiNode: TopologyNode; category: string }[] = []
  const unknownItems: { apiNode: TopologyNode; category: string }[] = []

  for (const n of apiNodes) {
    const category = resolveEffectiveCategory(n)
    const seg = getSegmentForCategory(category)
    if (seg === "infra") infraItems.push({ apiNode: n, category })
    else if (seg === "endpoints") endpointItems.push({ apiNode: n, category })
    else unknownItems.push({ apiNode: n, category })
  }

  endpointItems.sort((a, b) => {
    const orderDiff = (ENDPOINT_ORDER[a.category] ?? 99) - (ENDPOINT_ORDER[b.category] ?? 99)
    if (orderDiff !== 0) return orderDiff
    return (a.apiNode.label || "").localeCompare(b.apiNode.label || "")
  })

  unknownItems.sort((a, b) => (a.apiNode.label || "").localeCompare(b.apiNode.label || ""))

  const groups: PositionedGroup[] = []
  if (infraItems.length > 0) {
    groups.push(
      buildInfraHierarchicalGroup(infraItems, apiEdges, searchFilter, "segment-infra"),
    )
  }
  if (endpointItems.length > 0) {
    groups.push(
      buildGridGroup(
        "endpoints",
        "Segmento 2 — Dispositivos Finais",
        "Computadores, Notebooks, Telefones IP, Impressoras, TVs e Câmeras",
        endpointItems,
        searchFilter,
        "segment-endpoints",
      ),
    )
  }
  if (unknownItems.length > 0) {
    groups.push(
      buildGridGroup(
        "unknown",
        "Segmento 3 — Dispositivos Não Identificados",
        "Equipamentos sem categoria confirmada",
        unknownItems,
        searchFilter,
        "segment-unknown",
      ),
    )
  }

  const maxGroupWidth = Math.max(480, ...groups.map((g) => g.width))
  const finalNodes: Node[] = []
  let currentY = 0

  for (const g of groups) {
    const groupId = `segment-${g.segment}`
    // Center group horizontally relative to widest group, and center children if group expanded
    const extraW = maxGroupWidth - g.width
    const shiftedChildren =
      extraW > 0
        ? g.childNodes.map((child) => ({
            ...child,
            position: { x: child.position.x + extraW / 2, y: child.position.y },
          }))
        : g.childNodes

    finalNodes.push({
      id: groupId,
      type: "segmentGroup",
      position: { x: 0, y: currentY },
      dragHandle: ".segment-drag-handle",
      selectable: false,
      connectable: false,
      zIndex: -10,
      style: { width: maxGroupWidth, height: g.height },
      data: {
        title: g.title,
        subtitle: g.subtitle,
        segment: g.segment,
        count: g.childNodes.length,
        width: maxGroupWidth,
        height: g.height,
      } satisfies SegmentGroupNodeData,
    })

    finalNodes.push(...shiftedChildren)
    currentY += g.height + SEGMENT_GAP_Y
  }

  const finalEdges: Edge[] = apiEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    animated: true,
    style: { stroke: "#3b82f6", strokeWidth: 2 },
    labelStyle: { fontSize: 10, fill: isDark ? "#94a3b8" : "#475569", fontWeight: 600 },
    labelBgStyle: { fill: isDark ? "#0f172a" : "#ffffff", fillOpacity: 0.95 },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 6,
  }))

  return {
    nodes: finalNodes,
    edges: finalEdges,
    stats: {
      infra: infraItems.length,
      endpoints: endpointItems.length,
      unknown: unknownItems.length,
    },
  }
}
