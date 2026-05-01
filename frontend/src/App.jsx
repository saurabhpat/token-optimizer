import { startTransition, useDeferredValue, useEffect, useState } from "react";
import AnalyzeButton from "./components/AnalyzeButton";
import AboutView from "./components/AboutView";
import DashboardPanel from "./components/DashboardPanel";
import InputAttachments from "./components/InputAttachments";
import ModelSelector from "./components/ModelSelector";
import OutputGoalSelector from "./components/OutputGoalSelector";
import PromptInput from "./components/PromptInput";
import TopNav from "./components/TopNav";
import { OUTPUT_GOAL_OPTIONS } from "./constants/outputGoals";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { analyzePrompt, fetchModels } from "./lib/api";
import { estimateAttachment } from "./lib/attachmentEstimator";
import { countTokens } from "./lib/tokenCounter";

export default function App() {
  const [activeView, setActiveView] = useState(() =>
    window.location.hash === "#about" ? "about" : "optimizer"
  );
  const [prompt, setPrompt] = useState("");
  const [modelOptions, setModelOptions] = useState([]);
  const [modelsState, setModelsState] = useState("loading");
  const [modelsError, setModelsError] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedOutputGoal, setSelectedOutputGoal] = useState(
    OUTPUT_GOAL_OPTIONS[0]
  );
  const [promptTokens, setPromptTokens] = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isEstimatingAttachments, setIsEstimatingAttachments] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [analysisState, setAnalysisState] = useState("idle");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisErrorMessage, setAnalysisErrorMessage] = useState("");

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
    function handleHashChange() {
      setActiveView(window.location.hash === "#about" ? "about" : "optimizer");
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  function handleChangeView(view) {
    setActiveView(view);
    window.location.hash = view === "about" ? "about" : "optimizer";
  }

  function resetAnalysis() {
    startTransition(() => {
      setAnalysisState("idle");
      setAnalysisResult(null);
      setAnalysisErrorMessage("");
    });
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadModels() {
      try {
        const models = await fetchModels();

        if (!isCurrent) {
          return;
        }

        setModelOptions(models);
        setModelsState("success");
        setModelsError("");
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setModelOptions([]);
        setModelsState("error");
        setModelsError(
          error instanceof Error
            ? error.message
            : "Unable to load models right now."
        );
      }
    }

    void loadModels();

    return () => {
      isCurrent = false;
    };
  }, []);

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
      });
    }
  }, [prompt]);

  function modelSupportsOutputType(model, outputType) {
    const outputModalities = model?.output_modalities ?? [];

    if (outputType === "Image") {
      return outputModalities.includes("image");
    }

    if (outputType === "Video") {
      return outputModalities.includes("video");
    }

    if (outputType === "Audiobook") {
      return (
        outputModalities.includes("audio") ||
        outputModalities.includes("speech")
      );
    }

    return outputModalities.includes("text");
  }

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

    if (!modelSupportsOutputType(selectedModel, selectedOutputGoal)) {
      return `Selected model does not advertise ${selectedOutputGoal.toLowerCase()} output support.`;
    }

    if (!modelSupportsInputAttachments(selectedModel)) {
      return "Selected model does not advertise image input support.";
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

  function handleSelectOutputGoal(outputGoal) {
    setSelectedOutputGoal(outputGoal);
    resetAnalysis();
  }

  function handleSelectModel(modelId) {
    setSelectedModelId(modelId);
    resetAnalysis();
  }

  function buildRequestPayload() {
    return {
      prompt: prompt.trim(),
      model: selectedModel.id,
      intent: selectedOutputGoal,
      output_type: selectedOutputGoal,
      input_tokens: inputTokens,
      prompt_tokens: promptTokens,
      attachment_tokens: attachmentTokens,
      input_attachments: attachments.map((attachment) => ({
        type: attachment.type,
        name: attachment.name,
        size_bytes: attachment.size_bytes,
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
    setAnalysisErrorMessage("");

    try {
      const data = await analyzePrompt(buildRequestPayload());

      startTransition(() => {
        setAnalysisResult(data);
        setAnalysisState("success");
      });
    } catch (error) {
      startTransition(() => {
        setAnalysisResult(null);
        setAnalysisState("error");
        setAnalysisErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to estimate the prompt right now."
        );
      });
    }
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

    if (
      typeof recommendation?.output_type === "string" &&
      OUTPUT_GOAL_OPTIONS.includes(recommendation.output_type)
    ) {
      setSelectedOutputGoal(recommendation.output_type);
    } else if (
      typeof recommendation?.intent === "string" &&
      OUTPUT_GOAL_OPTIONS.includes(recommendation.intent)
    ) {
      setSelectedOutputGoal(recommendation.intent);
    }

    startTransition(() => {
      setAnalysisState("idle");
      setAnalysisResult(null);
      setAnalysisErrorMessage("");
    });
  }

  const isBusy = analysisState === "loading";
  const modelCompatibilityWarning = getModelCompatibilityWarning();
  const isActionDisabled =
    !prompt.trim() ||
    !selectedModel ||
    Boolean(modelCompatibilityWarning) ||
    isBusy ||
    isEstimatingAttachments ||
    modelsState !== "success";

  return (
    <div className="min-h-screen bg-shell-glow">
      <TopNav activeView={activeView} onChangeView={handleChangeView} />

      {activeView === "about" ? (
        <AboutView onOpenOptimizer={() => handleChangeView("optimizer")} />
      ) : (
        <main className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5 lg:px-6 xl:px-8 xl:py-8">
          <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">
                Optimizer workspace
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-ink">
                Estimate cost before scaling usage.
              </h1>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Estimate prompt cost with live model pricing and optimization
              guidance before you execute.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.92fr)_minmax(0,1.3fr)] 2xl:grid-cols-[minmax(520px,0.95fr)_minmax(0,1.25fr)]">
            <section className="rounded-lg border border-border bg-white p-4 shadow-panel sm:p-5 xl:sticky xl:top-20 xl:self-start">
              <div className="space-y-5">
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

                <div className="grid gap-4 2xl:grid-cols-2">
                  <ModelSelector
                    modelOptions={modelOptions}
                    selectedModelId={selectedModelId}
                    selectedModel={selectedModel}
                    onChange={handleSelectModel}
                    isLoading={modelsState === "loading"}
                    errorMessage={modelsError}
                    warningMessage={modelCompatibilityWarning}
                  />

                  <div className="space-y-4">
                    <OutputGoalSelector
                      selectedGoal={selectedOutputGoal}
                      onSelectGoal={handleSelectOutputGoal}
                    />

                    <div className="space-y-3">
                      <AnalyzeButton
                        disabled={isActionDisabled}
                        isLoading={analysisState === "loading"}
                        onClick={handleAnalyze}
                        label="Estimate cost"
                        loadingLabel="Estimating..."
                      />
                    </div>
                  </div>
                </div>
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
              selectedOutputType={selectedOutputGoal}
              onUseRecommendation={handleUseRecommendation}
            />
          </div>
        </main>
      )}
    </div>
  );
}
