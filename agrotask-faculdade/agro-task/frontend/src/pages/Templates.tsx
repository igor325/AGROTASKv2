import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  MessageSquare,
  Copy,
  Loader2
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import templateService from "@/services/templateService"
import type { MessageTemplate } from "@/services/templateService"

const Templates = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
  const [templateToDelete, setTemplateToDelete] = useState<MessageTemplate | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [templateName, setTemplateName] = useState("")
  const [templateCategory, setTemplateCategory] = useState("")
  const [templateBody, setTemplateBody] = useState("")
  
  const { toast } = useToast()

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const data = await templateService.getAll()
      setTemplates(data)
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar templates",
        variant: "destructive"
      })
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTemplateName("")
    setTemplateCategory("")
    setTemplateBody("")
    setSelectedTemplate(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (template: MessageTemplate) => {
    setSelectedTemplate(template)
    setTemplateName(template.name)
    setTemplateCategory(template.category)
    setTemplateBody(template.templateBody)
    setIsDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!templateName.trim() || !templateCategory.trim() || !templateBody.trim()) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSubmitting(true)
      
      if (selectedTemplate) {
        // Update
        await templateService.update(selectedTemplate.id, {
          name: templateName,
          category: templateCategory,
          templateBody: templateBody
        })
        toast({
          title: "Sucesso",
          description: "Template atualizado com sucesso"
        })
      } else {
        // Create
        await templateService.create({
          name: templateName,
          category: templateCategory,
          templateBody: templateBody
        })
        toast({
          title: "Sucesso",
          description: "Template criado com sucesso"
        })
      }

      setIsDialogOpen(false)
      resetForm()
      await loadTemplates()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar template",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopy = (template: MessageTemplate) => {
    navigator.clipboard.writeText(template.templateBody)
    toast({
      title: "Copiado",
      description: "Template copiado para a área de transferência"
    })
  }

  const openDeleteDialog = (template: MessageTemplate) => {
    setTemplateToDelete(template)
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!templateToDelete) return

    try {
      await templateService.delete(templateToDelete.id)
      toast({
        title: "Sucesso",
        description: "Template deletado com sucesso"
      })
      setIsDeleteDialogOpen(false)
      setTemplateToDelete(null)
      await loadTemplates()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar template",
        variant: "destructive"
      })
    }
  }

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "geral": return "default"
      case "urgente": return "destructive"
      case "lembrete": return "secondary"
      default: return "outline"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Templates WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie os templates de mensagem para as tarefas
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedTemplate ? "Editar Template" : "Criar Novo Template"}
              </DialogTitle>
              <DialogDescription>
                {selectedTemplate 
                  ? "Edite o template selecionado" 
                  : "Crie um template personalizado para suas mensagens"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Nome do Template</Label>
                <Input 
                  id="template-name" 
                  placeholder="Ex: Template Manhã"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-category">Categoria</Label>
                <Input 
                  id="template-category" 
                  placeholder="Ex: Geral, Urgente, Lembrete"
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-content">Conteúdo da Mensagem</Label>
                <Textarea 
                  id="template-content" 
                  placeholder="Digite o conteúdo do template usando {{NOME}}, {{TAREFA}}, {{DATA}}, {{HORARIO}}"
                  rows={8}
                  className="font-mono"
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                />
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Variáveis disponíveis:</strong>
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>{"{{NOME}}"} - Nome do funcionário</span>
                  <span>{"{{TAREFA}}"} - Título e descrição da tarefa</span>
                  <span>{"{{DATA}}"} - Data da tarefa</span>
                  <span>{"{{HORARIO}}"} - Horário da tarefa</span>
                </div>
              </div>
              <Button 
                className="w-full" 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : selectedTemplate ? (
                  "Atualizar Template"
                ) : (
                  "Criar Template"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">
                      {template.name}
                    </CardTitle>
                    <Badge variant={getCategoryColor(template.category)} className="text-xs mt-1">
                      {template.category}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => handleCopy(template)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => openEditDialog(template)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => openDeleteDialog(template)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded-lg">
                <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                  {template.templateBody}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum template encontrado</h3>
            <p className="text-muted-foreground">
              {templates.length === 0 
                ? "Crie seu primeiro template clicando no botão acima."
                : "Tente ajustar os termos de busca."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o template "{templateToDelete?.name}"? 
              Esta ação não pode ser desfeita.
              {templateToDelete && (
                <span className="block mt-2 text-sm text-destructive">
                  Nota: Se este template estiver sendo usado por alguma atividade, a exclusão será bloqueada.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Templates