"use client";

import { useEffect, ReactNode } from "react";

interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}

export function ModalDialog({ isOpen, onClose, wide = false, children }: ModalDialogProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal-box ${wide ? "wide" : ""}`}>
        {children}
      </div>
    </div>
  );
}
