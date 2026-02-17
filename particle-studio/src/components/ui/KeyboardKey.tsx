import { ReactNode } from "react";

interface KeyboardKeyProps {
  children?: ReactNode;
  label?: string;
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
}

export function KeyboardKey({ children, label, size = "md", className = "", onClick }: KeyboardKeyProps) {
  const content = label || children;
  
  return (
    <span 
      className={`keyboard-key ${size === "sm" ? "sm" : ""} ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      {content}
    </span>
  );
}
