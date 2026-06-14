import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from "react";
import AnalyzeButton from "./components/AnalyzeButton";
import AboutView from "./components/AboutView";
import DashboardPanel from "./components/DashboardPanel";
import InputAttachments from "./components/InputAttachments";
import ModelSelector from "./components/ModelSelector";
import PromptInput from "./components/PromptInput";
import ReasoningModeInput from "./components/ReasoningModeInput";
import SweepView from "./components/SweepView";
import TopNav from "./components/TopNav";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { analyzePrompt, fetchModels } from "./lib/api";
import { estimateAttachment } from "./lib/attachmentEstimator";
import { countTokens } from "./lib/tokenCounter";

const MODEL_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const SWEEP_STORAGE_KEY = "tokenoptimizer-sweep-payload";


export default function App() {
  const [activeView, setActiveView] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "sweep") return "sweep";
    if (hash === "optimizer") return "optimizer";
    return "about";
  });

  const [prompt, setPrompt] = useState("");
  const [modelOptions, setModelOptions] = useState([]);
  const [modelsState, setModelsState] = useState("loading");
  const [modelsError, setModelsError] = useState("");
  const [modelsLastRefreshedAt, setModelsLastRefreshedAt] = useState("");
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [reasoningMode, setReasoningMode] = useState("");
  const [promptTokens, setPromptTokens] = useState(0);

  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isEstimatingAttachments, setIsEstimatingAttachments] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [analysisState, setAnalysisState] = useState("idle");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisErrorMessage, setAnalysisErrorMessage] = useState("");
  const [activeAction, setActiveAction] = useState("");
  const modelOptionsRef = useRef([]);

  const deferredPrompt = useDeferredValue(prompt);
  const debouncedPrompt = useDebouncedValue(deferredPrompt, 300);
  const selectedModel =
    modelOptions.find((model) => model.id === selectedModelId) ?? null;
  const attachmentTokens = attachments.reduce(
    (total, attachment) => total + Number(attachment.token_estimate ?? 0),
    0
  );
  const inputTokens = promptTokens + attachmentTokens;
  const hasImageAttachment = attachments.some(
    (attachment) => attachment.type === "image"
  );


  useEffect(() => {
    modelOptionsRef.current = modelOptions;
  }, [modelOptions]);

  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.replace("#", "");
      if (hash === "sweep") {
        setActiveView("sweep");
      } else if (hash === "optimizer") {
        setActiveView("optimizer");
      } else {
        setActiveView("about");
      }
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);


  function handleChangeView(view) {
    setActiveView(view);
    if (view === "about") {
      window.location.hash = "about";
    } else if (view === "sweep") {
      window.location.hash = "sweep";
    } else {
      window.location.hash = "optimizer";
    }
  }


  function handleOpenRankingGuide() {
    setActiveView("about");
    window.location.hash = "ranking-guide";
  }

  function resetAnalysis() {
    startTransition(() => {
      setAnalysisState("idle");
      setAnalysisResult(null);
      setAnalysisErrorMessage("");
      setActiveAction("");
    });
  }

  const loadModels = useCallback(
    async ({ keepExistingOnError = false, background = false } = {}) => {
      const hasExistingModels = modelOptionsRef.current.length > 0;

      if (!background && !hasExistingModels) {
        setModelsState("loading");
      }

      if (background || hasExistingModels) {
        setIsRefreshingModels(true);
      }

      try {
        const { models, refreshedAt } = await fetchModels();

        startTransition(() => {
          setModelOptions(models);
          setModelsState("success");
          setModelsError("");
          setModelsLastRefreshedAt(refreshedAt);
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load models right now.";

        startTransition(() => {
          if (keepExistingOnError && hasExistingModels) {
            setModelsState("success");
            setModelsError(
              `Refresh failed: ${message}. Showing the last loaded catalog.`
            );
            return;
          }

          setModelOptions([]);
          setModelsState("error");
          setModelsError(message);
        });
      } finally {
        setIsRefreshingModels(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadModels({ keepExistingOnError: true, background: true });
    }, MODEL_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadModels]);

  useEffect(() => {
    if (!debouncedPrompt.trim()) {
      setPromptTokens(0);
      setTokenError("");
      return;
    }

    let isCurrent = true;

    async function syncTokenCount() {
      try {
        const totalTokens = await countTokens(debouncedPrompt, selectedModelId);

        if (!isCurrent) {
          return;
        }

        setPromptTokens(totalTokens);
        setTokenError("");
      } catch {
        if (!isCurrent) {
          return;
        }

        setTokenError("Token counting is temporarily unavailable.");
      }
    }

    void syncTokenCount();

    return () => {
      isCurrent = false;
    };
  }, [debouncedPrompt, selectedModelId]);

  useEffect(() => {
    if (!selectedModelId) {
      return;
    }

    if (!selectedModel) {
      setSelectedModelId("");
    }
  }, [selectedModel, selectedModelId]);

  useEffect(() => {
    if (!prompt.trim()) {
      startTransition(() => {
        setAnalysisState("idle");
        setAnalysisResult(null);
        setAnalysisErrorMessage("");
        setActiveAction("");
      });
    }
  }, [prompt]);

  function modelSupportsInputAttachments(model) {
    if (!hasImageAttachment) {
      return true;
    }

    return (model?.input_modalities ?? []).includes("image");
  }

  function getModelCompatibilityWarning() {
    if (!selectedModel) {
      return "";
    }

    if (!modelSupportsInputAttachments(selectedModel)) {
      return "Catalog note: this model does not advertise image input in the loaded metadata.";
    }

    return "";
  }

  async function handleAddFiles(files) {
    setAttachmentError("");
    setIsEstimatingAttachments(true);

    try {
      const estimatedAttachments = [];

      for (const file of files) {
        estimatedAttachments.push(await estimateAttachment(file, selectedModelId));
      }

      setAttachments((currentAttachments) => [
        ...currentAttachments,
        ...estimatedAttachments
      ]);
      resetAnalysis();
    } catch (error) {
      setAttachmentError(
        error instanceof Error
          ? error.message
          : "Unable to estimate one of the attachments."
      );
    } finally {
      setIsEstimatingAttachments(false);
    }
  }

  function handleRemoveAttachment(attachmentId) {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId)
    );
    resetAnalysis();
  }

  function handleSelectModel(modelId) {
    setSelectedModelId(modelId);
    resetAnalysis();
  }

  function handleRefreshModels() {
    void loadModels({ keepExistingOnError: true, background: true });
  }

  function handleReasoningModeChange(nextValue) {
    setReasoningMode(nextValue);
    resetAnalysis();
  }

  function buildRequestPayload() {
    return {
      prompt: prompt.trim(),
      model: selectedModel.id,
      reasoning_mode: reasoningMode.trim(),
      input_tokens: inputTokens,
      prompt_tokens: promptTokens,
      attachment_tokens: attachmentTokens,
      input_attachments: attachments.map((attachment) => ({
        type: attachment.type,
        name: attachment.name,
        size_bytes: attachment.size_bytes,
        mime_type: attachment.mime_type,
        pages: attachment.pages,
        width: attachment.width,
        height: attachment.height,
        token_estimate: attachment.token_estimate,
        confidence: attachment.confidence,
        method: attachment.method
      })),
      input_price: selectedModel.input_price,
      output_price: selectedModel.output_price,
      input_modalities: selectedModel.input_modalities ?? [],
      output_modalities: selectedModel.output_modalities ?? [],
      candidate_models: modelOptions.map((model) => ({
        id: model.id,
        name: model.name,
        input_price: model.input_price,
        output_price: model.output_price,
        created: model.created,
        canonical_slug: model.canonical_slug,
        description: model.description,
        supported_parameters: model.supported_parameters,
        default_parameters: model.default_parameters,
        pricing: model.pricing,
        top_provider: model.top_provider,
        expiration_date: model.expiration_date,
        context_length: model.context_length,
        input_modalities: model.input_modalities,
        output_modalities: model.output_modalities
      }))
    };
  }

  async function handleAnalyze() {
    if (!prompt.trim() || !selectedModel) {
      return;
    }

    setAnalysisState("loading");
    setActiveAction("estimate");
    setAnalysisErrorMessage("");

    try {
      const data = await analyzePrompt(buildRequestPayload());

      startTransition(() => {
        setAnalysisResult(data);
        setAnalysisState("success");
        setActiveAction("");
      });
    } catch (error) {
      startTransition(() => {
        setAnalysisResult(null);
        setAnalysisState("error");
        setActiveAction("estimate");
        setAnalysisErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to estimate the prompt right now."
        );
      });
    }
  }

  async function handleQualitySweep() {
    if (!prompt.trim() || !selectedModel) {
      return;
    }

    const payload = buildRequestPayload();

    try {
      localStorage.setItem(SWEEP_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage may be unavailable; proceed anyway.
    }

    window.open("/#sweep", "_blank", "noopener,noreferrer");
  }


  function handleUseRecommendation(recommendation) {
    if (typeof recommendation?.optimized_prompt === "string") {
      setPrompt(recommendation.optimized_prompt);
    }

    if (
      typeof recommendation?.model_id === "string" &&
      modelOptions.some((model) => model.id === recommendation.model_id)
    ) {
      setSelectedModelId(recommendation.model_id);
    }

    if (typeof recommendation?.recommended_reasoning_mode === "string") {
      setReasoningMode(recommendation.recommended_reasoning_mode);
    }

    startTransition(() => {
      setAnalysisState("idle");
      setAnalysisResult(null);
      setAnalysisErrorMessage("");
      setActiveAction("");
    });
  }

  const isBusy = analysisState === "loading";
  const modelCompatibilityWarning = getModelCompatibilityWarning();
  const isEstimateDisabled =
    !prompt.trim() ||
    !selectedModel ||
    isBusy ||
    isEstimatingAttachments ||
    modelsState !== "success";
  const isSweepDisabled = isEstimateDisabled;

  return (
    <div className="min-h-screen bg-shell-glow">
      <TopNav activeView={activeView} onChangeView={handleChangeView} />


      {activeView === "sweep" ? (
        <SweepView />
      ) : activeView === "about" ? (
        <AboutView onOpenOptimizer={() => handleChangeView("optimizer")} />
      ) : (
        <main className="mx-auto max-w-[1480px] px-3 py-4 sm:px-5 lg:px-6 xl:px-8">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                Optimizer workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-ink lg:text-3xl">
                Estimate cost before scaling usage.
              </h1>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              Estimate prompt cost with live model pricing and optimization
              guidance before you execute.
            </p>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(420px,0.88fr)_minmax(0,1.35fr)] 2xl:grid-cols-[minmax(500px,0.9fr)_minmax(0,1.35fr)]">
            <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
              <div className="space-y-3">
                <PromptInput
                  prompt={prompt}
                  inputTokens={promptTokens}
                  onPromptChange={setPrompt}
                  tokenError={tokenError}
                  tokenLabel="Prompt tokens"
                />

                <InputAttachments
                  attachments={attachments}
                  isEstimating={isEstimatingAttachments}
                  errorMessage={attachmentError}
                  onAddFiles={handleAddFiles}
                  onRemoveAttachment={handleRemoveAttachment}
                />

                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <ModelSelector
                    modelOptions={modelOptions}
                    selectedModelId={selectedModelId}
                    selectedModel={selectedModel}
                    onChange={handleSelectModel}
                    isLoading={modelsState === "loading"}
                    isRefreshing={isRefreshingModels}
                    lastRefreshedAt={modelsLastRefreshedAt}
                    onRefresh={handleRefreshModels}
                    errorMessage={modelsError}
                    warningMessage={modelCompatibilityWarning}
                  />
                  <ReasoningModeInput
                    value={reasoningMode}
                    onChange={handleReasoningModeChange}
                  />
                </div>

                <div className="grid gap-2 pt-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <AnalyzeButton
                    disabled={isEstimateDisabled}
                    isLoading={analysisState === "loading" && activeAction === "estimate"}
                    onClick={handleAnalyze}
                    label="Estimate cost"
                    loadingLabel="Estimating..."
                  />
                  <AnalyzeButton
                    disabled={isSweepDisabled}
                    isLoading={false}
                    onClick={handleQualitySweep}
                    label="Run quality sweep"
                    loadingLabel="Opening sweep..."
                    variant="secondary"
                  />
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  Quality Sweep opens in a new window where you can enter your
                  OpenRouter key and run a measured comparison.
                </p>
              </div>
            </section>

            <DashboardPanel
              state={analysisState}
              inputTokens={inputTokens}
              inputBreakdown={{
                prompt_tokens: promptTokens,
                attachment_tokens: attachmentTokens,
                input_attachments: attachments
              }}
              result={analysisResult}
              errorMessage={analysisErrorMessage}
              selectedModel={selectedModel}
              onUseRecommendation={handleUseRecommendation}
              onOpenRankingGuide={handleOpenRankingGuide}
              activeAction={activeAction}
            />
          </div>
        </main>
      )}
    </div>
  );
}
