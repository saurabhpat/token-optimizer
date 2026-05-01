# TokenOptimizer Product One-Pager

## 1. Executive Summary

TokenOptimizer is a full-stack web application that helps teams estimate LLM usage cost before running a prompt. It combines local token counting, live OpenRouter model pricing, n8n-based estimation, and model/prompt recommendations so users can choose the right model and reduce spend before execution.

## 2. What Problem It Solves

LLM costs are hard to predict before a request is sent, especially when prompts include long instructions, PDFs, images, or different output goals like apps, reports, agents, websites, images, video, or audio. Builders often pick models without knowing token impact, output cost, or whether a cheaper model could produce a good-enough result.

## 3. Why It Is Important

As AI usage scales, small prompt and model choices can create meaningful cost differences. TokenOptimizer gives users cost visibility before execution, helping avoid surprise spend, compare model economics, and optimize prompts earlier in the workflow. This is especially useful for teams building AI products, agents, internal tools, and multimodal generation workflows.

## 4. Solution Idea

TokenOptimizer acts as a pre-flight cost decision layer for LLM work. A user enters a prompt, optionally adds local PDFs or images, selects an output goal and model, then receives estimated usage, cost, optimization guidance, and cheaper compatible model alternatives.

## 5. How It Works

The React frontend counts prompt tokens locally with `tiktoken` and estimates PDF/image attachment token impact without uploading file contents. The backend fetches live OpenRouter model pricing and securely proxies analysis requests to an n8n workflow. n8n calls an estimator model through OpenRouter and returns predicted output, estimated cost, and optimization guidance. The UI then presents the result, top model alternatives, and optimized prompt suggestions.

## 6. Features

| Feature | Description |
| --- | --- |
| Live Token Counting | Counts prompt tokens in real time so users understand input size before analysis. |
| Local Attachment Estimation | Estimates token impact for PDFs and images locally; file bytes are not sent to the backend. |
| Live Model Catalog | Loads searchable OpenRouter models with input/output pricing. |
| Unified Output Goal Selector | Supports Chat, Agent, App, Website, MCP, Report/Document, Image, Video, and Audiobook goals. |
| Cost Estimate Dashboard | Shows input tokens, predicted output, estimated cost, and calculation context. |
| Modality-Safe Recommendations | Recommends compatible models only, such as image models for Image output or text models for App/Report output. |
| Top 5 Optimization Options | Compares cheaper model alternatives with savings, confidence, and prompt strategy. |
| Optimized Prompt Suggestions | Provides model-specific prompt changes to reduce cost or improve output structure. |
| Secure Backend Proxy | Keeps n8n webhook URLs and OpenRouter credentials out of the frontend. |
| Importable n8n Workflow | Includes a sanitized n8n workflow template that can be imported and configured with private credentials. |
