import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  User,
  Mic,
  Loader2,
  Filter,
  X
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SingleSelect } from "@/components/ui/single-select"
import { useUsers } from "@/hooks/useUsers"
import { User as UserType } from "@/services/userService"

const Usuarios = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTagsFilter, setSelectedTagsFilter] = useState<string[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [submittingCreate, setSubmittingCreate] = useState(false)
  const [submittingUpdate, setSubmittingUpdate] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    description: "",
    tags: [] as string[],
  })
  const [originalData, setOriginalData] = useState({
    name: "",
    phone: "",
    email: "",
    description: "",
    tags: [] as string[],
  })

  // Phone validation and country
  const [phoneCountry, setPhoneCountry] = useState<'BR'>("BR")
  const [phoneError, setPhoneError] = useState<string>("")
  const [emailError, setEmailError] = useState<string>("")
  const [emailSuggestion, setEmailSuggestion] = useState<string>("")

  const { users, loading, createUser, updateUser, deleteUser } = useUsers()

  // Get all unique tags from users
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    users.forEach(user => {
      user.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [users])

  const filteredUsers = users.filter(user => {
    // Text search filter
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.description && user.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      user.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    // Tag filter
    const matchesTags = selectedTagsFilter.length === 0 || 
      selectedTagsFilter.some(filterTag => user.tags.includes(filterTag))
    
    return matchesSearch && matchesTags
  })

  const toggleTagFilter = (tag: string) => {
    setSelectedTagsFilter(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const clearTagFilters = () => {
    setSelectedTagsFilter([])
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default"
      case "inactive": return "secondary"
      default: return "outline"
    }
  }

  // Helpers
  const digitsOnly = (s: string) => s.replace(/\D+/g, "")
  const formatBrazilPhone = (digits: string) => {
    // Expect 11 digits (2 DDD + 9 number)
    const d = digits.slice(0, 11)
    const part1 = d.slice(0, 2)
    const part2 = d.slice(2, 7)
    const part3 = d.slice(7, 11)
    let out = ""
    if (part1) out += `(${part1}`
    if (part1 && part1.length === 2) out += ") "
    if (part2) out += part2
    if (part3) out += `-${part3}`
    return out
  }

  const validateBrazilPhone = (masked: string) => {
    const nonDigit = /[^\d()\s-]/.test(masked)
    if (nonDigit) return "Caracteres não numéricos"
    const d = digitsOnly(masked)
    if (d.length === 0) return ""
    if (d.length < 11) return "Número incompleto"
    if (!/^\d{11}$/.test(d)) return "Formato inválido"
    return ""
  }

  const onPhoneInput = (value: string, isCreate: boolean) => {
    // Only BR for now
    const d = digitsOnly(value)
    const formatted = phoneCountry === 'BR' ? formatBrazilPhone(d) : value
    const err = phoneCountry === 'BR' ? validateBrazilPhone(formatted) : ""
    setPhoneError(err)
    setFormData(prev => ({ ...prev, phone: formatted }))
  }

  const validateEmail = (value: string) => {
    const trimmed = value.trim()
    setEmailSuggestion("")
    if (!trimmed) { setEmailError(""); return }
    if (/[\s]/.test(trimmed)) { setEmailError("Email não pode conter espaços"); return }
    if (!trimmed.includes("@")) { setEmailError("Falta @ no email"); return }
    const parts = trimmed.split("@")
    if (parts.length !== 2 || !parts[1]) { setEmailError("Falta domínio após @"); return }
    if (trimmed.includes(",")) {
      setEmailSuggestion("Substituir ',' por '.'")
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    if (!emailRegex.test(trimmed)) { setEmailError("Formato de email inválido"); return }
    setEmailError("")
  }

  // Dirty check for update button
  const isDirty = useMemo(() => {
    const a = formData
    const b = originalData
    const tagsEqual = a.tags.length === b.tags.length && a.tags.every((t, i) => t === b.tags[i])
    return (
      a.name !== b.name ||
      a.phone !== b.phone ||
      a.email !== b.email ||
      a.description !== b.description ||
      !tagsEqual
    )
  }, [formData, originalData])

  const canCreate = useMemo(() => {
    const nameOk = !!formData.name.trim()
    const phoneOk = phoneError === ""
    const emailOk = emailError === ""
    return nameOk && phoneOk && emailOk
  }, [formData.name, phoneError, emailError])

  const canUpdate = useMemo(() => {
    const nameOk = !!formData.name.trim()
    const phoneOk = phoneError === ""
    const emailOk = emailError === ""
    return isDirty && nameOk && phoneOk && emailOk
  }, [isDirty, formData.name, phoneError, emailError])

  const handleCreateUser = async () => {
    if (!canCreate || submittingCreate) return
    try {
      setSubmittingCreate(true)
      const success = await createUser({
        name: formData.name,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        description: formData.description || undefined,
        tags: formData.tags,
      })
      if (success) {
        setIsCreateDialogOpen(false)
        setFormData({
          name: "",
          phone: "",
          email: "",
          description: "",
          tags: [],
        })
      }
    } finally {
      setSubmittingCreate(false)
    }
  }

  const handleEditUser = (user: UserType) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      phone: user.phone || "",
      email: user.email || "",
      description: user.description || "",
      tags: user.tags,
    })
    setOriginalData({
      name: user.name,
      phone: user.phone || "",
      email: user.email || "",
      description: user.description || "",
      tags: [...user.tags],
    })
    setPhoneError("")
    setEmailError("")
    setIsEditDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!editingUser || !canUpdate || submittingUpdate) return
    try {
      setSubmittingUpdate(true)
      const success = await updateUser(editingUser.id, {
        name: formData.name,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        description: formData.description || undefined,
        tags: formData.tags,
      })
      if (success) {
        setIsEditDialogOpen(false)
        setEditingUser(null)
        setFormData({
          name: "",
          phone: "",
          email: "",
          description: "",
          tags: [],
        })
      }
    } finally {
      setSubmittingUpdate(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    await deleteUser(userId)
  }

  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }))
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie aqui sua equipe
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                Cadastre um novo membro da equipe
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Nome Completo</Label>
                <Input 
                  id="create-name" 
                  placeholder="Digite o nome completo"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={submittingCreate}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-phone">Número de Celular</Label>
                <div className="flex gap-2">
                  <div className="w-44">
                    <Select value={phoneCountry} onValueChange={(v) => setPhoneCountry(v as 'BR')}>
                      <SelectTrigger aria-label="Selecionar país">
                        <SelectValue placeholder="País" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BR">Brasil (+55)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input 
                    id="create-phone" 
                    type="tel"
                    aria-invalid={!!phoneError}
                    aria-describedby="create-phone-error"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => onPhoneInput(e.target.value, true)}
                    disabled={submittingCreate}
                  />
                </div>
                {phoneError && (
                  <p id="create-phone-error" className="text-sm font-medium text-destructive">{phoneError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email (opcional)</Label>
                <Input 
                  id="create-email" 
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  aria-invalid={!!emailError}
                  aria-describedby="create-email-error create-email-suggestion"
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  onBlur={(e) => validateEmail(e.target.value)}
                  disabled={submittingCreate}
                />
                {emailError && (
                  <p id="create-email-error" className="text-sm font-medium text-destructive">{emailError}</p>
                )}
                {!emailError && emailSuggestion && (
                  <p id="create-email-suggestion" className="text-xs text-muted-foreground">{emailSuggestion}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-description">Descrição</Label>
                <Textarea 
                  id="create-description" 
                  placeholder="Descreva a experiência e responsabilidades"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={submittingCreate}
                />
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
                <Input 
                  placeholder="Digite uma tag e pressione Enter"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag(e.currentTarget.value)
                      e.currentTarget.value = ''
                    }
                  }}
                  disabled={submittingCreate}
                />
              </div>
              <Button className="w-full" onClick={handleCreateUser} disabled={!canCreate || submittingCreate}>
                {submittingCreate ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cadastrando...
                  </span>
                ) : (
                  "Cadastrar Usuário"
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
              placeholder="Buscar por nome ou função..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtrar por tags</span>
                </div>
                {selectedTagsFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearTagFilters}
                    className="h-8 px-2 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTagsFilter.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80 transition-colors"
                    onClick={() => toggleTagFilter(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              {selectedTagsFilter.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''} encontrado{filteredUsers.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Carregando usuários...</span>
        </div>
      )}

      {/* Users Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{user.name}</CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={getStatusColor(user.status)} className="text-xs">
                          {user.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleEditUser(user)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o usuário "{user.name}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {user.description && (
                  <CardDescription className="mb-3">
                    {user.description}
                  </CardDescription>
                )}
                {user.phone && (
                  <p className="text-sm text-muted-foreground mb-2">
                    📱 {user.phone}
                  </p>
                )}
                {user.email && (
                  <p className="text-sm text-muted-foreground mb-3">
                    ✉️ {user.email}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {user.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredUsers.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum usuário encontrado</h3>
            <p className="text-muted-foreground">
              Tente ajustar os termos de busca ou adicione um novo usuário.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome Completo</Label>
              <Input 
                id="edit-name" 
                placeholder="Digite o nome completo"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={submittingUpdate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Número de Celular</Label>
              <div className="flex gap-2">
                <div className="w-44">
                  <Select value={phoneCountry} onValueChange={(v) => setPhoneCountry(v as 'BR')}>
                    <SelectTrigger aria-label="Selecionar país">
                      <SelectValue placeholder="País" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BR">Brasil (+55)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input 
                  id="edit-phone" 
                  type="tel"
                  aria-invalid={!!phoneError}
                  aria-describedby="edit-phone-error"
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={(e) => onPhoneInput(e.target.value, false)}
                  disabled={submittingUpdate}
                />
              </div>
              {phoneError && (
                <p id="edit-phone-error" className="text-sm font-medium text-destructive">{phoneError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email (opcional)</Label>
              <Input 
                id="edit-email" 
                type="email"
                placeholder="email@exemplo.com"
                value={formData.email}
                aria-invalid={!!emailError}
                aria-describedby="edit-email-error edit-email-suggestion"
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                onBlur={(e) => validateEmail(e.target.value)}
                disabled={submittingUpdate}
              />
              {emailError && (
                <p id="edit-email-error" className="text-sm font-medium text-destructive">{emailError}</p>
              )}
              {!emailError && emailSuggestion && (
                <p id="edit-email-suggestion" className="text-xs text-muted-foreground">{emailSuggestion}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea 
                id="edit-description" 
                placeholder="Descreva a experiência e responsabilidades"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                disabled={submittingUpdate}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
              <Input 
                placeholder="Digite uma tag e pressione Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag(e.currentTarget.value)
                    e.currentTarget.value = ''
                  }
                }}
                disabled={submittingUpdate}
              />
            </div>
            <Button className="w-full" onClick={handleUpdateUser} disabled={!canUpdate || submittingUpdate}>
              {submittingUpdate ? (
                <span className="inline-flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando...
                </span>
              ) : (
                "Atualizar Usuário"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Usuarios