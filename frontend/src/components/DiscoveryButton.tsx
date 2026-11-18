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
        toast.success(`Descoberta concluída: ${data.devices_found} dispositivos, ${data.links_found} conexões`)
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
      className={cn(
        "w-full sm:w-auto gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 active:scale-98 font-semibold",
        className
      )}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-white" />
      ) : (
        <Radar className="h-4 w-4 text-cyan-200" />
      )}
      <span>Executar descoberta</span>
    </Button>
  )
}
