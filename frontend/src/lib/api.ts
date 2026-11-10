import axios from "axios"

export const api = axios.create({ baseURL: "/api" })

export interface TopologyNode {
  id: string
  label: string
  type: string
  ip: string | null
  mac: string | null
  hostname: string | null
  display_name: string | null
  icon_type: string | null
  vendor: string | null
  sources: string[]
  l2_only: boolean
}

export interface TopologyEdge {
  id: string
  source: string
  target: string
  label: string
}

export interface TopologyResponse {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

export interface DeviceDetail {
  id: string
  mac_address: string | null
  ip_address: string | null
  hostname: string | null
  display_name: string | null
  device_type: string
  icon_type: string | null
  vendor: string | null
  model: string | null
  chassis_id: string | null
  mgmt_ip: string | null
  sources: string[]
  first_seen: string
  last_seen: string
  is_active: boolean
  connected_ports: string[]
}

export interface DeviceRead {
  id: string
  mac_address: string | null
  ip_address: string | null
  hostname: string | null
  display_name: string | null
  device_type: string
  icon_type: string | null
  vendor: string | null
  model: string | null
  sources: string[]
  last_seen: string
}

export interface DeviceUpdate {
  display_name?: string | null
  icon_type?: string | null
  device_type?: string | null
}

export interface PaginatedDevices {
  items: DeviceRead[]
  total: number
  page: number
  size: number
  pages: number
}

export interface MetricsResponse {
  total_devices: number
  total_links: number
  l2_only_devices: number
  devices_by_type: Record<string, number>
  devices_by_source: Record<string, number>
  last_scan: string | null
}

export interface DiscoveryRunResponse {
  id: string
  status: string
  devices_found: number
  links_found: number
  started_at: string
  completed_at: string | null
  error_message: string | null
}

export interface SystemInfo {
  app_name: string
  version: string
  platform: string
  platform_release: string
  python_version: string
  lldpd_installed: boolean
  lldpd_running: boolean
  ip_command: boolean
  ping_enabled: boolean
  scan_subnet?: string | null
  snmp_community_configured: boolean
}

export const fetchTopology = () => api.get<TopologyResponse>("/topology").then((r) => r.data)
export const fetchDevice = (id: string) => api.get<DeviceDetail>(`/devices/${id}`).then((r) => r.data)
export const updateDevice = (id: string, payload: DeviceUpdate) =>
  api.patch<DeviceDetail>(`/devices/${id}`, payload).then((r) => r.data)
export const deleteDevice = (id: string) =>
  api.delete<{ status: string; message: string }>(`/devices/${id}`).then((r) => r.data)
export const fetchDevices = (page = 1, size = 20, search = "") =>
  api.get<PaginatedDevices>("/devices", { params: { page, size, search: search || undefined } }).then((r) => r.data)
export const fetchMetrics = () => api.get<MetricsResponse>("/metrics").then((r) => r.data)
export const runDiscovery = () => api.post<DiscoveryRunResponse>("/discovery/run").then((r) => r.data)
export const fetchDiscoveryRuns = () => api.get<DiscoveryRunResponse[]>("/discovery/runs").then((r) => r.data)
export const fetchSystemInfo = () => api.get<SystemInfo>("/system/info").then((r) => r.data)
export const fetchHealth = () => api.get<{ status: string; app: string; version: string }>("/health").then((r) => r.data)
export const exportDevicesCsv = () => api.get("/export/devices.csv", { responseType: "blob" })
export const clearDevices = () => api.delete<{ status: string; message: string }>("/devices/clear").then((r) => r.data)
export const clearDiscoveryRuns = () => api.delete<{ status: string; message: string }>("/discovery/runs/clear").then((r) => r.data)
