# TokenOptimizer Product One-Pager

## 1. Executive Summary

TokenOptimizer is a full-stack web application that helps teams estimate LLM usage cost before running a prompt. It combines local token counting, live OpenRouter model pricing, n8n-based estimation, and model/prompt recommendations so users can choose the right model and reduce spend before execution.

## 2. What Problem It Solves

LLM costs are hard to predict before a request is sent, especially when prompts include long instructions, local attachments, or different output modalities like text, files, images, video, or audio. Builders often pick models without knowing token impact, output cost, or whether a cheaper model could produce a good-enough result.

## 3. Why It Is Important

As AI usage scales, small prompt and model choices can create meaningful cost differences. TokenOptimizer gives users cost visibility before execution, helping avoid surprise spend, compare model economics, and optimize prompts earlier in the workflow. This is especially useful for teams building AI products, agents, internal tools, and multimodal generation workflows.

## 4. Solution Idea

TokenOptimizer acts as a pre-flight cost decision layer for LLM work. A user enters a prompt, optionally adds local files, selects an output modality and model, then receives estimated usage, cost, optimization guidance, and cheaper compatible model alternatives.

## 5. How It Works

The React frontend counts prompt tokens locally with `tiktoken` and estimates attachment token impact without uploading file contents. Text files are counted directly, PDFs and images use specialized local estimators, and other file types use a low-confidence size-based estimate. The backend fetches live OpenRouter model pricing and securely proxies analysis requests to an n8n workflow. n8n calls an estimator model through OpenRouter and returns predicted output, estimated cost, and optimization guidance. The UI then presents the result, top model alternatives, and optimized prompt suggestions.

## 6. Features

| Feature | Description |
| --- | --- |
| Live Token Counting | Counts prompt tokens in real time so users understand input size before analysis. |
| Local Attachment Estimation | Estimates token impact for text files, PDFs, images, media, and generic files locally; file bytes are not sent to the backend. |
| Live Model Catalog | Loads searchable OpenRouter models with input/output pricing. |
| Modality-First Output Goal Selector | Supports Text, File, Image, Audio, and Video goals aligned with OpenRouter model metadata. |
| Cost Estimate Dashboard | Shows input tokens, predicted output, estimated cost, and calculation context. |
| Cost-Based Recommendations | Compares lower-cost model alternatives with confidence and prompt strategy, without hiding options solely because catalog modality metadata is incomplete. |
| Top 5 Optimization Options | Compares cheaper model alternatives with savings, confidence, and prompt strategy. |
| Optimized Prompt Suggestions | Provides model-specific prompt changes to reduce cost or improve output structure. |
| Secure Backend Proxy | Keeps n8n webhook URLs and OpenRouter credentials out of the frontend. |
| Importable n8n Workflow | Includes a sanitized n8n workflow template that can be imported and configured with private credentials. |
