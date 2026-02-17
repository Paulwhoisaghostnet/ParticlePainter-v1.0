import React, { useState, useRef, useEffect } from 'react';

interface AccordionItemProps {
  value: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({ value, trigger, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);

  useEffect(() => {
    if (isOpen) {
      const h = contentRef.current?.scrollHeight;
      setHeight(h);
    } else {
      setHeight(0);
    }
  }, [isOpen, children]);

  return (
    <div className="accordionItem" data-state={isOpen ? 'open' : 'closed'}>
      <button 
        className="accordionTrigger" 
        onClick={() => setIsOpen(!isOpen)}
        data-state={isOpen ? 'open' : 'closed'}
        type="button"
      >
        <span>{trigger}</span>
        <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </button>
      <div 
        className="accordionContent" 
        style={{ height: isOpen ? height : 0 }}
      >
        <div className="accordionBody" ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  );
};

export const Accordion: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`accordion ${className}`}>
      {children}
    </div>
  );
};
