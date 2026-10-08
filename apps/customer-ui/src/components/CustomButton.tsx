import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type CustomButtonProps = {
  href?: string;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
};

const CustomButton = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  CustomButtonProps
>(
  (
    {
      href,
      variant = "secondary",
      children,
      className,
      disabled = false,
      isLoading = false,
      type = "submit",
      onClick,
    },
    ref
  ) => {
    const baseClass = cn(
      "rounded-[8px] py-2.5 px-6 md:px-[18px] transition relative",
      variant === "primary"
        ? "text-[#475467] bg-white hover:bg-[#1129290D]"
        : "text-white bg-[#112929] hover:opacity-75",
      className
    );

    if (href) {
      return (
        <Link
          to={href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          onClick={onClick}
          className={baseClass}
        >
          {isLoading && <span className="absolute top-1/2 -translate-y-1/2 left-3 animate-spin"><Loader2 className="size-4" /></span>}
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          baseClass,
          "cursor-pointer disabled:opacity-55 disabled:pointer-events-none disabled:cursor-not-allowed"
        )}
      >
        {isLoading && <span className="absolute top-1/2 -translate-y-1/2 left-3 animate-spin"><Loader2 className="size-4" /></span>}
        {children}
      </button>
    );
  }
);

CustomButton.displayName = "CustomButton";
export default CustomButton;
