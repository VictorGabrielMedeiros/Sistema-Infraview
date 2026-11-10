import { useMutation, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { Loader2, Radar } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { runDiscovery } from "@/lib/api"

export function DiscoveryButton({ className }: { className?: string }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: runDiscovery,
    onSuccess: (data) => {
      queryClient.invalidateQueries()
      if (data.status === "completed") {
        toast.success(`Descoberta concluída: ${data.devices_found} devices, ${data.links_found} links`)
        if (data.error_message) toast.warning(data.error_message)
      } else {
        toast.error(data.error_message ?? "Descoberta falhou")
      }
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.warning("Já existe uma descoberta em andamento")
        return
      }
      toast.error("Erro ao conectar com a API")
    },
  })

  return (
    <Button
      className={cn("w-full sm:w-auto", className)}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Radar className="h-4 w-4" />
      )}
      Executar descoberta
    </Button>
  )
}
