import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react"
import { toPng } from "html-to-image"
import { jsPDF } from "jspdf"

export interface ExportPdfOptions {
  nodes: Node[]
  networkName: string
  deviceCount: number
  edgeCount: number
  isOrganized: boolean
  isDark: boolean
}

/**
 * Captures the entire React Flow topology bounds (even nodes off-screen)
 * and exports it into a high-resolution landscape A4 PDF with header & legend.
 */
export async function exportTopologyToPdf({
  nodes,
  networkName,
  deviceCount,
  edgeCount,
  isOrganized,
  isDark,
}: ExportPdfOptions): Promise<void> {
  const viewportEl = document.querySelector(".react-flow__viewport") as HTMLElement | null
  if (!viewportEl) {
    throw new Error("Área da topologia não encontrada para exportação.")
  }
  if (nodes.length === 0) {
    throw new Error("Não há dispositivos na topologia para exportar.")
  }

  // Compute bounding box of ALL nodes (segments + devices)
  const nodesBounds = getNodesBounds(nodes)
  const padding = 60
  const boundsWidth = Math.max(800, Math.ceil(nodesBounds.width + padding * 2))
  const boundsHeight = Math.max(500, Math.ceil(nodesBounds.height + padding * 2))

  // Cap max canvas dimensions to avoid browser memory/size limits while keeping crispness
  const maxDim = 3200
  const scaleDown = Math.min(1, maxDim / Math.max(boundsWidth, boundsHeight))
  const imageWidth = Math.round(boundsWidth * scaleDown)
  const imageHeight = Math.round(boundsHeight * scaleDown)

  const viewport = getViewportForBounds(
    nodesBounds,
    imageWidth,
    imageHeight,
    0.05,
    2,
    0.06,
  )

  const bgColor = isDark ? "#020617" : "#ffffff"

  const dataUrl = await toPng(viewportEl, {
    backgroundColor: bgColor,
    width: imageWidth,
    height: imageHeight,
    pixelRatio: 2,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  })

  // Create Landscape A4 PDF (297 x 210 mm)
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10

  // Header background bar
  pdf.setFillColor(15, 23, 42) // slate-900
  pdf.rect(0, 0, pageWidth, 22, "F")

  // Header Title & Metadata
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(14)
  pdf.text("Topologia de Rede — InfraView", margin, 10)

  const nowStr = new Date().toLocaleString("pt-BR")
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.setTextColor(203, 213, 225) // slate-300
  pdf.text(
    `Rede: ${networkName}   |   Equipamentos: ${deviceCount}   |   Conexões: ${edgeCount}   |   Modo: ${isOrganized ? "Organizada por Segmentos" : "Layout Padrão"}`,
    margin,
    17,
  )

  pdf.setTextColor(148, 163, 184) // slate-400
  pdf.text(`Exportado em: ${nowStr}`, pageWidth - margin, 10, { align: "right" })

  // Printable area for the topology image
  const topOffset = 25
  const footerHeight = 14
  const availW = pageWidth - margin * 2
  const availH = pageHeight - topOffset - footerHeight - 2

  const imgRatio = imageWidth / imageHeight
  const boxRatio = availW / availH

  let drawW = availW
  let drawH = availW / imgRatio
  if (imgRatio < boxRatio) {
    drawH = availH
    drawW = availH * imgRatio
  }

  const drawX = margin + (availW - drawW) / 2
  const drawY = topOffset + (availH - drawH) / 2

  // Subtle frame around topology
  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(0.3)
  pdf.rect(margin, topOffset, availW, availH)

  pdf.addImage(dataUrl, "PNG", drawX, drawY, drawW, drawH, undefined, "FAST")

  // Footer with legend
  const footerY = pageHeight - 7
  pdf.setDrawColor(226, 232, 240)
  pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

  pdf.setFontSize(8)
  pdf.setTextColor(71, 85, 105)
  pdf.setFont("helvetica", "bold")
  pdf.text("Legenda:", margin, footerY)

  pdf.setFont("helvetica", "normal")
  const legendItems = [
    { label: "Infraestrutura (Roteador/Firewall/Switch/AP/Servidor)", color: [37, 99, 235] as const },
    { label: "Dispositivos Finais (PC/Tel/Impressora/TV/Câmera)", color: [8, 145, 178] as const },
    { label: "Não Identificados", color: [217, 119, 6] as const },
    { label: "Conexão LLDP / L2", color: [59, 130, 246] as const },
  ]

  let lx = margin + 16
  for (const item of legendItems) {
    pdf.setFillColor(item.color[0], item.color[1], item.color[2])
    pdf.circle(lx, footerY - 1, 1.4, "F")
    pdf.text(item.label, lx + 3, footerY)
    lx += pdf.getTextWidth(item.label) + 10
  }

  const safeSlug = networkName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
  const dateStamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")
  pdf.save(`topologia-${safeSlug || "rede"}-${dateStamp}.pdf`)
}
