import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, DollarSign, Search } from "lucide-react";
import { formatPrice } from "../lib/formatters";

const MAX_VISIBLE_MODELS = 80;

export default function ModelSelector({
  modelOptions,
  selectedModelId,
  selectedModel,
  onChange,
  isLoading,
  errorMessage,
  warningMessage
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return modelOptions.slice(0, MAX_VISIBLE_MODELS);
    }

    return modelOptions
      .filter((model) => {
        const name = model.name.toLowerCase();
        const id = model.id.toLowerCase();
        return name.includes(normalizedQuery) || id.includes(normalizedQuery);
      })
      .slice(0, MAX_VISIBLE_MODELS);
  }, [modelOptions, query]);

  useEffect(() => {
    if (selectedModel) {
      setQuery(selectedModel.name);
    }
  }, [selectedModel]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  function selectModel(model) {
    onChange(model.id);
    setQuery(model.name);
    setIsOpen(false);
  }

  function handleQueryChange(event) {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setIsOpen(true);

    if (selectedModelId) {
      onChange("");
    }
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) =>
        filteredModels.length === 0
          ? 0
          : Math.min(currentIndex + 1, filteredModels.length - 1)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === "Enter" && isOpen && filteredModels[activeIndex]) {
      event.preventDefault();
      selectModel(filteredModels[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  const showResults = isOpen && !isLoading && modelOptions.length > 0;

  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Model</p>
        <p className="mt-1 text-sm text-slate-500">
          Search the live OpenRouter catalog.
        </p>
      </div>

      <div className="space-y-3">
        <label className="sr-only" htmlFor="model-selector">
          Model selector
        </label>
        <div ref={rootRef} className="relative">
          <div className="flex min-w-0 items-center rounded-lg border border-border bg-white px-3 py-3 text-sm text-ink transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 sm:px-4">
            <Search className="mr-3 h-4 w-4 shrink-0 text-slate-400" />
            <input
              id="model-selector"
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || modelOptions.length === 0}
              placeholder={
                isLoading ? "Loading OpenRouter models..." : "Search model name"
              }
              role="combobox"
              aria-expanded={showResults}
              aria-controls="model-selector-results"
              aria-autocomplete="list"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setIsOpen((currentValue) => !currentValue)}
              disabled={isLoading || modelOptions.length === 0}
              className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 transition hover:bg-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Toggle model options"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {showResults ? (
            <div
              id="model-selector-results"
              role="listbox"
              className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-white py-2 shadow-xl"
            >
              {filteredModels.length > 0 ? (
                filteredModels.map((model, index) => {
                  const isSelected = model.id === selectedModelId;
                  const isActive = index === activeIndex;

                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectModel(model);
                      }}
                      className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm transition ${
                        isActive ? "bg-soft text-ink" : "text-slate-700"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {model.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {model.id}
                        </span>
                      </span>
                      {isSelected ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  );
                })
              ) : (
                <p className="px-4 py-3 text-sm text-slate-500">
                  No matching models found.
                </p>
              )}
            </div>
          ) : null}
        </div>

        {errorMessage ? (
          <p className="text-sm font-medium text-rose-600">{errorMessage}</p>
        ) : null}
        {!errorMessage && warningMessage ? (
          <p className="text-sm font-medium text-amber-700">{warningMessage}</p>
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-soft px-3 py-1.5 font-medium text-slate-600">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            Input {selectedModel ? formatPrice(selectedModel.input_price) : "--"}
            <span className="text-slate-400">/1K</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-soft px-3 py-1.5 font-medium text-slate-600">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            Output{" "}
            {selectedModel ? formatPrice(selectedModel.output_price) : "--"}
            <span className="text-slate-400">/1K</span>
          </span>
        </div>
      </div>
    </section>
  );
}
