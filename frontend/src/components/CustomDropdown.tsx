import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Star } from "lucide-react";
import "./CustomDropdown.css";

export interface DropdownOption<T extends string | number = string | number> {
  id: T;
  name: string;
  urduName?: string;
  sub?: string;
  lang?: string;
  recommended?: boolean;
  disabled?: boolean;
}

interface CustomDropdownProps<T extends string | number> {
  id?: string;
  label?: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (val: T) => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  placeholder?: string;
}

export default function CustomDropdown<T extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
  icon: Icon,
  placeholder = "Select an option",
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => String(o.id) === String(value));

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optionId: T) => {
    onChange(optionId);
    setIsOpen(false);
  };

  return (
    <div className={`c-dropdown ${isOpen ? "is-open" : ""}`} ref={containerRef} id={id}>
      <button
        type="button"
        className="c-dropdown-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label}
      >
        <div className="c-dropdown-trigger-content">
          {Icon && (
            <span className="c-dropdown-icon">
              <Icon size={18} />
            </span>
          )}
          <div className="c-dropdown-trigger-text">
            {selectedOption ? (
              <>
                <div className="c-dropdown-selected-title">
                  {selectedOption.recommended && (
                    <span className="c-dropdown-star-badge" title="Recommended">
                      <Star size={12} fill="#e0b84f" stroke="#c99a2e" />
                      <span>Recommended</span>
                    </span>
                  )}
                  {selectedOption.lang && (
                    <span className="c-dropdown-lang-tag">[{selectedOption.lang}]</span>
                  )}
                  <span className="c-dropdown-selected-name">
                    {selectedOption.name}
                    {selectedOption.urduName && (
                      <> <span className="urdu-text" lang="ur" dir="rtl">{selectedOption.urduName}</span></>
                    )}
                  </span>
                </div>
                {selectedOption.sub && (
                  <span className="c-dropdown-selected-sub">{selectedOption.sub}</span>
                )}
              </>
            ) : (
              <span className="c-dropdown-placeholder">{placeholder}</span>
            )}
          </div>
        </div>

        <span className={`c-dropdown-chevron ${isOpen ? "is-open" : ""}`}>
          <ChevronDown size={18} />
        </span>
      </button>

      {isOpen && (
        <div className="c-dropdown-menu" role="listbox">
          <div className="c-dropdown-options-list">
            {options.map((option) => {
              const isSelected = String(option.id) === String(value);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  className={`c-dropdown-item ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handleSelect(option.id)}
                >
                  <div className="c-dropdown-item-content">
                    <div className="c-dropdown-item-header">
                      {option.recommended && (
                        <span className="c-dropdown-star-badge">
                          <Star size={11} fill="#e0b84f" stroke="#c99a2e" />
                          <span>Recommended</span>
                        </span>
                      )}
                      {option.lang && (
                        <span className="c-dropdown-lang-tag">[{option.lang}]</span>
                      )}
                      <span className="c-dropdown-item-name">
                        {option.name}
                        {option.urduName && (
                          <> <span className="urdu-text" lang="ur" dir="rtl">{option.urduName}</span></>
                        )}
                      </span>
                    </div>
                    {option.sub && (
                      <span className="c-dropdown-item-sub">{option.sub}</span>
                    )}
                  </div>

                  {isSelected && (
                    <span className="c-dropdown-check">
                      <Check size={16} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
