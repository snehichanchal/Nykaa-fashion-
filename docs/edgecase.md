# Project Edge Case Testing Suite & Verification Matrix (`edgecase.md`)

## 1. Executive Summary

This document details the edge cases, boundary conditions, stress scenarios, and automated verification results for both the **User Feedback Discovery Engine** and the **Nykaa Fashion E-Commerce Platform**. 

All test cases have been validated using automated test scripts, PyTorch thread isolation checks, ChromaDB vector store queries, and browser subagent validation checks to ensure **100% state integrity, zero database crashes, zero PyTorch segmentation faults, and seamless user experience across edge conditions.**

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

## 3. Nykaa Fashion E-Commerce Website Test Matrix

### 3.1 Search & Filter Engine Edge Cases

| Test Case ID | Scenario / Input | Expected Behavior | Actual System Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-SRCH-01** | Special Characters (`!@#$%^&*()`) in search bar | System handles special regex characters safely without crashing SQL queries or frontend rendering. | Renders clean empty state: *"No products found matching your active search/filters."* with a **`Reset Filters`** button. | **PASSED ✅** |
| **TC-SRCH-02** | Whitespace-only query (`"   "`) | Treated as empty search query. | Displays full catalog listing without applying empty search filter. | **PASSED ✅** |
| **TC-SRCH-03** | Mixed-case & partial matches (`"pUrVAja"`, `"dReSS"`) | Case-insensitive match across `title`, `brand_name`, `description`, and `category_slug`. | Successfully retrieves and renders matching products regardless of casing. | **PASSED ✅** |
| **TC-SRCH-04** | Search query matching 0 wishlist items | Suppresses the `❤️ From Your Wishlist` block and displays normal search results grid. | Wishlist block is automatically hidden; results grid renders standard matching items. | **PASSED ✅** |
| **TC-SRCH-05** | Search query matching 1+ wishlist items | Displays `❤️ From Your Wishlist (Matching Category for "<query>")` block at top with pink cards and `MOVE TO BAG 🛍️` CTA. | Wishlisted matching items rendered at 1st position with pink glowing borders and CTA buttons. | **PASSED ✅** |

---

### 3.2 Wishlist & Cart Synchronization Edge Cases

| Test Case ID | Scenario / Input | Expected Behavior | Actual System Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-CART-01** | Adding a wishlisted product to Cart | Product stays saved in Wishlist, gets added to Cart drawer, and updates header Cart superscript badge. | Cart item count increments; Wishlist icon keeps active pink dot indicator. | **PASSED ✅** |
| **TC-CART-02** | Moving item from Cart to Wishlist when ALREADY wishlisted | Handles database UNIQUE constraint gracefully without throwing SQLite errors or duplicating records. | Item is retained in `wishlist_items`, cleanly deleted from `cart_items`, and UI refreshes dynamically. | **PASSED ✅** |
| **TC-CART-03** | Both Cart & Wishlist have items | Wishlist icon displays pink dot (`#wishlistDot`) AND Cart icon displays superscript badge (`#cartCount`). | Both header indicators active simultaneously as per design rules. | **PASSED ✅** |
| **TC-CART-04** | Opening empty Shopping Bag | Displays empty state graphic 🛍️ with message *"Your Shopping Bag is empty"*, while still recommending wishlisted items below. | Empty state renders cleanly alongside Wishlist recommendations (`MOVE TO BAG 🛍️`). | **PASSED ✅** |

---

### 3.3 Remove Cart Item Confirmation Modal ("Are You Sure?") Edge Cases

| Test Case ID | Scenario / Input | Expected Behavior | Actual System Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-MODAL-01** | Clicking `✕` on any Cart Item | Triggers Nykaa-style confirmation modal popup (`#removeCartModal`) instead of deleting immediately. | Popup displays centered thumbnail, `"Are you sure?"`, subtext, `Move to wishlist` button, and `Remove` button. | **PASSED ✅** |
| **TC-MODAL-02** | Clicking top-left `✕` close button on modal | Cancels removal action and closes modal popup. | Modal closes smoothly; Cart items remain unchanged. | **PASSED ✅** |
| **TC-MODAL-03** | Clicking `Move to wishlist` | Product transfers to `wishlist_items`, gets deleted from `cart_items`, closes modal, and updates Cart summary. | Item removed from Cart, added to Wishlist, and drawer totals update in real time. | **PASSED ✅** |
| **TC-MODAL-04** | Clicking `Remove` | Product gets deleted from `cart_items`, closes modal, and updates Cart summary. | Item deleted from Cart drawer; totals update cleanly. | **PASSED ✅** |

---

### 3.4 Homepage Showcase Blocks Edge Cases

| Test Case ID | Scenario / Input | Expected Behavior | Actual System Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-BLOCK-01** | Homepage load (no search / no filter active) | Displays 3 curated showcase blocks (`🔥 Trending Now`, `⚡ On Sale & Offers`, `✨ In The Spotlight`). | Blocks render above main grid with 1st position wishlist items highlighted in pink. | **PASSED ✅** |
| **TC-BLOCK-02** | Active Category pill or Sidebar filter selected | Suppresses homepage showcase blocks to avoid cluttering filtered search view. | Showcase blocks cleanly hide; main grid displays filtered catalog items. | **PASSED ✅** |
| **TC-BLOCK-03** | Wishlisted item qualifies for multiple blocks | Wishlisted item is prioritized FIRST in any block matching its theme without duplicating database records. | Item rendered at 1st position with pink glowing border and `❤️ IN YOUR WISHLIST` tag. | **PASSED ✅** |

---

### 3.5 User Auth & Order Checkout Edge Cases

| Test Case ID | Scenario / Input | Expected Behavior | Actual System Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-01** | Opening Account popover when logged out | Displays `Guest User` popover with `Login / Register` button. | Modal opens prompt for mobile/email ID input. | **PASSED ✅** |
| **TC-AUTH-02** | OTP Verification Flow | Verifies OTP, persists user session in `localStorage` (`nykaa_user`), and updates account header to `Hi <Name>!`. | User session saved; header popover updates dynamically. | **PASSED ✅** |
| **TC-AUTH-03** | Checkout with missing address | Form validation prevents order submission and highlights missing fields. | User prompted to fill required address fields before proceeding. | **PASSED ✅** |
| **TC-AUTH-04** | User with 0 past orders viewing `My Orders` | Renders clean empty order state graphic with message *"No orders found yet"*. | Empty state renders cleanly without throwing API error. | **PASSED ✅** |

---

### 3.6 Admin Dashboard & Database Integrity Edge Cases

| Test Case ID | Scenario / Input | Expected Behavior | Actual System Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-ADM-01** | Accessing `/admin` URL | Dedicated Admin Dashboard loads independently from public storefront header. | Portal displays total sales, total orders, active catalog count, and customer wishlist stats. | **PASSED ✅** |
| **TC-ADM-02** | Deleting product referenced in Cart/Wishlist | Database foreign key `ON DELETE CASCADE` removes dependent cart/wishlist items automatically. | Product deleted cleanly without breaking orphaned cart or wishlist references. | **PASSED ✅** |

---

## 4. Summary Verification Checklist

```
[✓] Discovery Engine Vector Normalization (2,298 feedback records verified)
[✓] PyTorch Thread Lock & Zero SegFault Validation (torch.set_num_threads(1))
[✓] Streamlit Dataframe Deprecation Fallback (width="stretch")
[✓] Multi-LLM Provider Integration (Gemini, ChatGPT, Claude, DeepSeek)
[✓] Nykaa E-Commerce Storefront API & Cart Confirmation Modal
[✓] Database Foreign Key Cascade & Session Persistence
```
