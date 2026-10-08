import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"

import AccordionOpenIcon from "@/assets/main-pages/AccordionOpenIcon.png"
import AccordionCloseIcon from "@/assets/main-pages/AccordionCloseIcon.png"

import { cn } from "@/lib/utils"

interface WithIsOpenProp {
  isOpen: boolean
}

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  className,
  value,
  children,
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <AccordionPrimitive.Item
      data-state={isOpen ? "open" : "closed"}
      value={value}
      className={cn("border-b last:border-b-0 border-[#EAECF0]", className)}
      onClick={() => setIsOpen(!isOpen)}
    >
    {React.Children.map(children, (child) => {
      if (React.isValidElement<WithIsOpenProp>(child)) {
        return React.cloneElement(child, { isOpen })
      }
      return child
    })}
    </AccordionPrimitive.Item>
  )
}

function AccordionTrigger({
  className,
  children,
  isOpen,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  isOpen?: boolean
}) {
  return (
    <AccordionPrimitive.Header className="flex w-full">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-lg text-[#101828] font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          className
        )}
        {...props}
      >
        <span>{children}</span>

        <img
          src={isOpen ? AccordionCloseIcon : AccordionOpenIcon}
          alt="accordion toggle"
          className="w-5 h-5 shrink-0"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-[#475467]"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
