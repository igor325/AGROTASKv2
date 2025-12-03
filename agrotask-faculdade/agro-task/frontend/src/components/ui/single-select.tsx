import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Option {
  label: string
  value: string
}

interface SingleSelectProps {
  options: Option[]
  selected?: string
  onChange: (selected: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  onCreateNew?: (value: string) => void
}

export function SingleSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecionar opção...",
  searchPlaceholder = "Pesquisar...",
  className = "",
  onCreateNew
}: SingleSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const handleSelect = (value: string) => {
    onChange(value)
    setOpen(false)
    setInputValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim() && onCreateNew) {
      const exists = options.some(option => 
        option.label.toLowerCase() === inputValue.trim().toLowerCase()
      )
      if (!exists) {
        onCreateNew(inputValue.trim())
        handleSelect(inputValue.trim())
      }
    }
  }

  const selectedOption = options.find(option => option.value === selected)

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={handleKeyDown}
          />
          <CommandEmpty className="p-2 text-sm text-muted-foreground">
            {onCreateNew && inputValue.trim() ? (
              <div>
                Pressione Enter para criar "{inputValue.trim()}"
              </div>
            ) : (
              "Nenhuma opção encontrada."
            )}
          </CommandEmpty>
          <CommandGroup className="max-h-60 overflow-auto">
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option.value)}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}