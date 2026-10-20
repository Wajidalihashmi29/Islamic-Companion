import React, { useState, useRef, useEffect, useId } from "react";
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
  translateOptions?: boolean;
}

export default function CustomDropdown<T extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
  icon: Icon,
  placeholder = "Select an option",
  translateOptions = true,
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const menuId = `${id ?? generatedId}-menu`;

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

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
    });
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

  const toggleDropdown = () => {
    if (!isOpen && containerRef.current) {
      const bounds = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - bounds.bottom;
      setOpensUp(spaceBelow < 320 && bounds.top > spaceBelow);
    }
    setIsOpen(previous => !previous);
  };

  return (
    <div className={`c-dropdown ${isOpen ? "is-open" : ""} ${opensUp ? "opens-up" : ""}`} ref={containerRef} id={id}>
      <button
        type="button"
        className={`c-dropdown-trigger ${selectedOption?.sub ? "has-sub" : ""}`}
        onClick={toggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={label}
      >
        <div className="c-dropdown-trigger-content">
          {Icon && (
            <span className="c-dropdown-icon">
              <Icon size={18} />
            </span>
          )}
          <div className="c-dropdown-trigger-text" data-no-translate={translateOptions ? undefined : ""}>
            {selectedOption ? (
              <>
                <div className="c-dropdown-selected-title">
                  <div className="c-dropdown-badges">
                    {selectedOption.recommended && (
                      <span className="c-dropdown-star-badge" title="Recommended">
                        <Star size={12} fill="#e0b84f" stroke="#c99a2e" />
                        <span>Recommended</span>
                      </span>
                    )}
                    {selectedOption.lang && (
                      <span className="c-dropdown-lang-tag">[{selectedOption.lang}]</span>
                    )}
                  </div>
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
        <div className="c-dropdown-menu" role="listbox" id={menuId} aria-label={label} ref={menuRef}>
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
                  className={`c-dropdown-item ${isSelected ? "is-selected" : ""} ${option.sub ? "has-sub" : ""}`}
                  onClick={() => handleSelect(option.id)}
                >
                  <div className="c-dropdown-item-content" data-no-translate={translateOptions ? undefined : ""}>
                    <div className="c-dropdown-item-header">
                      <div className="c-dropdown-badges">
                        {option.recommended && (
                          <span className="c-dropdown-star-badge">
                            <Star size={11} fill="#e0b84f" stroke="#c99a2e" />
                            <span>Recommended</span>
                          </span>
                        )}
                        {option.lang && (
                          <span className="c-dropdown-lang-tag">[{option.lang}]</span>
                        )}
                      </div>
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
