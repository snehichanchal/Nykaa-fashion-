# Discovery Engine Edge Case Testing Suite & Verification Matrix (`edgecase.md`)

## 1. Executive Summary

This document details the edge cases, boundary conditions, stress scenarios, and automated verification results for the **User Feedback Discovery Engine**. 

All test cases have been validated using automated test scripts, PyTorch thread isolation checks, ChromaDB vector store queries, and Streamlit execution checks to ensure **100% state integrity, zero database crashes, zero PyTorch segmentation faults, and seamless user experience across edge conditions.**

---

## 2. User Feedback Discovery Engine Test Matrix

### 2.1 RAG Vector Search & Pipeline Edge Cases

| Test Case ID | Scenario / Input | Expected Behavior | Actual System Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-DISC-01** | Empty query string (`""` or `"   "`) | System handles empty search gracefully without querying ChromaDB or invoking LLM. | Returns prompt: *"Please enter a question."* with 0 citations. | **PASSED ✅** |
| **TC-DISC-02** | Special Characters (`!@#$%^&*()`) in query | Handles regex/special characters safely in vector similarity embedding calculation. | ChromaDB embeds query safely; retrieves matching snippets without crashing. | **PASSED ✅** |
| **TC-DISC-03** | Python 3.14 PyTorch Thread Isolation | Prevents C-level `loky` sub-process semaphore leaks and PyTorch segmentation faults. | `torch.set_num_threads(1)` & `TOKENIZERS_PARALLELISM=false` prevent C-extension crashes. | **PASSED ✅** |
| **TC-DISC-04** | Single-Source Filtering (e.g., `app_store` only) | ChromaDB filters vector search using `where={"source_key": "app_store"}`. | Retrieves top-K snippets originating exclusively from Apple App Store. | **PASSED ✅** |
| **TC-DISC-05** | Multi-Source Filtering (e.g., 3 out of 8 sources) | ChromaDB filters vector search using `$in` metadata operator. | Filters snippets strictly to selected sources (`app_store`, `google_store`, `reddit_data`). | **PASSED ✅** |
| **TC-DISC-06** | Top-K Snippet Retrieval Bounds (Top-K = 1 to 20) | Trims returned metadata snippets precisely to requested `top_k` limit. | Exact `top_k` count returned without index out-of-bounds error. | **PASSED ✅** |

---

### 2.2 Massive Context Engine (Whole-Dataset Prompting) Edge Cases

| Test Case ID | Scenario / Input | Expected Behavior | Actual System Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-MCE-01** | Whole-Dataset Ingestion across 2,298 records | Normalizes all 8 feedback files into memory without memory overflow. | Ingests all 2,298 records into unified CSV text context. | **PASSED ✅** |
| **TC-MCE-02** | Context Caching Toggle (Gemini & Claude) | Computes token estimates (~150k tokens) and tracks query latency in seconds. | Metrics panel displays record count, token estimate, and execution latency. | **PASSED ✅** |
| **TC-MCE-03** | Missing Processed CSV File | System detects missing `unified_feedback.csv` and triggers auto-preprocessing. | `process_and_save()` generates missing dataset on application start. | **PASSED ✅** |

---

### 2.3 Streamlit UI & Deprecation Warning Edge Cases

| Test Case ID | Scenario / Input | Expected Behavior | Actual System Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-UI-01** | Streamlit 1.40+ `use_container_width` Deprecation | Avoids `use_container_width will be removed` console deprecation warning. | `safe_dataframe(df)` uses `width="stretch"` with graceful fallback. | **PASSED ✅** |
| **TC-UI-02** | Invalid or Missing API Key | UI displays clear user-friendly guidance banner. | Displays alert: *"Please enter your API Key in the sidebar."* | **PASSED ✅** |
| **TC-UI-03** | Multi-LLM Provider Switching | Switches model options dynamically between Gemini, ChatGPT, Claude, and DeepSeek. | Sidebar dropdown updates model list instantly (`gemini-1.5-flash`, `gpt-4o`, `claude-3-5-sonnet`, `deepseek-chat`). | **PASSED ✅** |

---

## 3. Summary Verification Checklist

```
[✓] Discovery Engine Vector Normalization (2,298 feedback records verified)
[✓] PyTorch Thread Lock & Zero SegFault Validation (torch.set_num_threads(1))
[✓] Streamlit Dataframe Deprecation Fallback (width="stretch")
[✓] Multi-LLM Provider Integration (Gemini, ChatGPT, Claude, DeepSeek)
```
