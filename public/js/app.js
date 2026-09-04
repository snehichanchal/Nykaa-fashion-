const app = {
  state: {
    category: 'all',
    gender: 'all',
    discount: '0',
    size: null,
    color: null,
    brand: 'all',
    badge: 'all',
    priceRange: 'all',
    search: '',
    sort: 'popularity',
    mode: 'fashion',
    paymentMethod: 'UPI',
    currentUser: JSON.parse(localStorage.getItem('nykaa_user') || 'null'),
    authTempIdentifier: '',
    products: [],
    categories: [],
    brands: [],
    wishlist: [],
    cart: [],
    cartSummary: { itemCount: 0, totalMrp: 0, totalAmount: 0, totalDiscount: 0 }
  },

  async init() {
    await this.fetchCategories();
    await this.fetchBrands();
    await this.fetchProducts();
    await this.fetchWishlist();
    await this.fetchCart();
    this.renderCategoryAvatars();
    this.renderCategoryFilterList();
    this.renderBrandFilterList();
    this.renderAccountPopover();
  },

  async fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        this.state.categories = data.data;
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  },

  async fetchBrands() {
    try {
      const res = await fetch('/api/brands');
      const data = await res.json();
      if (data.success) {
        this.state.brands = data.data;
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    }
  },

  async fetchProducts() {
    try {
      const params = new URLSearchParams();
      if (this.state.category && this.state.category !== 'all') params.append('category', this.state.category);
      if (this.state.gender && this.state.gender !== 'all') params.append('gender', this.state.gender);
      if (this.state.discount && this.state.discount !== '0') params.append('minDiscount', this.state.discount);
      if (this.state.brand && this.state.brand !== 'all') params.append('brand', this.state.brand);
      if (this.state.badge && this.state.badge !== 'all') params.append('badge', this.state.badge);
      if (this.state.size) params.append('size', this.state.size);
      if (this.state.search) params.append('search', this.state.search);
      if (this.state.sort) params.append('sort', this.state.sort);

      if (this.state.priceRange && this.state.priceRange !== 'all') {
        const [min, max] = this.state.priceRange.split('-');
        if (min) params.append('minPrice', min);
        if (max) params.append('maxPrice', max);
      }

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        let items = data.data;
        if (this.state.color) {
          items = items.filter(p => (p.colors || []).includes(this.state.color));
        }
        this.state.products = items;
        this.renderProducts();
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  },

  async fetchWishlist() {
    try {
      const res = await fetch('/api/wishlist');
      const data = await res.json();
      if (data.success) {
        this.state.wishlist = data.data;
        this.updateHeaderBadges();
      }
    } catch (err) {
      console.error('Failed to fetch wishlist:', err);
    }
  },

  async fetchCart() {
    try {
      const res = await fetch('/api/cart');
      const data = await res.json();
      if (data.success) {
        this.state.cart = data.data;
        this.state.cartSummary = data.summary;
        this.updateHeaderBadges();
        this.renderCartDrawer();
      }
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    }
  },

  updateHeaderBadges() {
    const wishlistCount = this.state.wishlist.length;
    const cartCount = this.state.cartSummary ? this.state.cartSummary.itemCount : 0;

    const wishlistDot = document.getElementById('wishlistDot');
    const cartBadge = document.getElementById('cartCount');

    // Rule 1 & 3: Highlight wishlist icon with dot if wishlist has items
    if (wishlistDot) {
      if (wishlistCount > 0) {
        wishlistDot.style.display = 'block';
      } else {
        wishlistDot.style.display = 'none';
      }
    }

    // Rule 2 & 3: Show superscript above cart icon if cart has items
    if (cartBadge) {
      if (cartCount > 0) {
        cartBadge.innerText = cartCount;
        cartBadge.style.display = 'flex';
      } else {
        cartBadge.style.display = 'none';
      }
    }
  },

  renderAccountPopover() {
    const popover = document.getElementById('accountPopover');
    const label = document.getElementById('accountHeaderLabel');
    if (!popover) return;

    if (this.state.currentUser) {
      const user = this.state.currentUser;
      label.innerText = user.name ? user.name.split(' ')[0] : 'Account';

      popover.innerHTML = `
        <div class="popover-header-title">Hi ${user.name || 'User'}!</div>
        <div class="popover-subtitle">${user.phone || user.email}</div>
        <ul class="popover-menu-list">
          <li class="popover-menu-item" onclick="app.openOrdersModal()">
            <span>📦</span> My Orders
          </li>
          <li class="popover-menu-item" onclick="app.showWishlistModal()">
            <span>❤️</span> My Wishlist
          </li>
        </ul>
        <button class="popover-logout-btn" onclick="app.logout()">Logout</button>
      `;
    } else {
      label.innerText = 'Account';
      popover.innerHTML = `
        <div class="popover-header-title">Hi user!</div>
        <div class="popover-subtitle">Get access to your Orders, Wishlist & Recommendations</div>
        <button class="popover-login-btn" onclick="app.openAuthModal()">LOGIN / REGISTER</button>
        <ul class="popover-menu-list">
          <li class="popover-menu-item" onclick="app.openAuthModal()">
            <span>📦</span> My Orders
          </li>
          <li class="popover-menu-item" onclick="app.showWishlistModal()">
            <span>❤️</span> My Wishlist
          </li>
        </ul>
      `;
    }
  },

  openAuthModal() {
    document.getElementById('authStep1').style.display = 'block';
    document.getElementById('authStep2').style.display = 'none';
    document.getElementById('authModal').classList.add('open');
  },

  closeAuthModal() {
    document.getElementById('authModal').classList.remove('open');
  },

  async submitAuthStep1() {
    const idVal = document.getElementById('authIdentifier').value.trim();
    if (!idVal) return alert('Please enter a valid mobile number or email!');

    this.state.authTempIdentifier = idVal;

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: idVal })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('otpSubtext').innerHTML = `OTP sent to ${idVal} (Use <strong>1234</strong>)`;
        document.getElementById('authStep1').style.display = 'none';
        document.getElementById('authStep2').style.display = 'block';
      }
    } catch (err) {
      console.error('Error sending OTP:', err);
    }
  },

  backToAuthStep1() {
    document.getElementById('authStep1').style.display = 'block';
    document.getElementById('authStep2').style.display = 'none';
  },

  async verifyAuthOtp() {
    const otpVal = document.getElementById('authOtp').value.trim();
    const nameVal = document.getElementById('authName').value.trim() || 'Ananya Sharma';

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: this.state.authTempIdentifier,
          name: nameVal,
          otp: otpVal
        })
      });

      const data = await res.json();
      if (data.success) {
        this.state.currentUser = data.user;
        localStorage.setItem('nykaa_user', JSON.stringify(data.user));

        // Pre-fill checkout form name & phone
        if (document.getElementById('chkName')) document.getElementById('chkName').value = data.user.name;
        if (document.getElementById('chkPhone')) document.getElementById('chkPhone').value = data.user.phone;

        this.renderAccountPopover();
        this.closeAuthModal();
        alert(`🎉 Welcome ${data.user.name}! You are logged in successfully.`);
      } else {
        alert(data.error || 'Verification failed!');
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
    }
  },

  logout() {
    this.state.currentUser = null;
    localStorage.removeItem('nykaa_user');
    this.renderAccountPopover();
    alert('Logged out successfully!');
  },

  async openOrdersModal() {
    if (!this.state.currentUser) {
      return this.openAuthModal();
    }

    document.getElementById('ordersModal').classList.add('open');
    await this.fetchUserOrders();
  },

  closeOrdersModal() {
    document.getElementById('ordersModal').classList.remove('open');
  },

  async fetchUserOrders() {
    const user = this.state.currentUser;
    const container = document.getElementById('userOrdersList');
    if (!container || !user) return;

    try {
      const res = await fetch(`/api/user/orders?phone=${user.phone || user.email}`);
      const data = await res.json();
      if (data.success) {
        if (data.data.length === 0) {
          container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
              <div style="font-size: 40px;">📦</div>
              <h3 style="font-size: 16px; font-weight: 700; margin-top: 8px;">No orders found yet</h3>
              <p style="font-size: 12px; color: #666; margin-top: 4px;">Start shopping to place your first order!</p>
            </div>
          `;
        } else {
          container.innerHTML = data.data.map(ord => `
            <div style="background: #F9FAFB; border: 1px solid var(--light-border); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--light-border); padding-bottom: 10px;">
                <div>
                  <span style="font-weight: 800; font-size: 14px; color: #111827;">Order #${ord.order_number}</span>
                  <span style="font-size: 11px; color: #666; margin-left: 10px;">${new Date(ord.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span style="background: #E6F4EA; color: #00875A; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px;">${ord.status}</span>
                  <span style="font-weight: 800; font-size: 14px; margin-left: 12px;">₹${ord.total_amount.toLocaleString()}</span>
                </div>
              </div>
              <div>
                ${(ord.items || []).map(item => `
                  <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 8px;">
                    <img src="${item.image_url || ''}" style="width: 44px; height: 55px; object-fit: cover; border-radius: 4px;" alt="Product">
                    <div>
                      <div style="font-weight: 700; font-size: 12px;">${item.product_title}</div>
                      <div style="font-size: 11px; color: #666;">Qty: ${item.quantity} | Size: ${item.size}</div>
                    </div>
                    <div style="margin-left: auto; font-weight: 700; font-size: 12px;">₹${item.price.toLocaleString()}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Error fetching user orders:', err);
    }
  },

  renderCategoryAvatars() {
    const container = document.getElementById('categoryAvatars');
    if (!container) return;

    container.innerHTML = this.state.categories.map(c => `
      <div class="avatar-item" onclick="app.filterByCategory('${c.slug}')">
        <img src="${c.image_url}" class="avatar-circle" alt="${c.name}">
        <span class="avatar-label">${c.name}</span>
      </div>
    `).join('');
  },

  renderCategoryFilterList() {
    const container = document.getElementById('filterCategoryList');
    if (!container) return;

    const html = `
      <label class="filter-checkbox-label">
        <input type="radio" name="categoryFilter" value="all" ${this.state.category === 'all' ? 'checked' : ''} onchange="app.selectCategoryFilter('all')"> All Categories
      </label>
    ` + this.state.categories.map(c => `
      <label class="filter-checkbox-label">
        <input type="radio" name="categoryFilter" value="${c.slug}" ${this.state.category === c.slug ? 'checked' : ''} onchange="app.selectCategoryFilter('${c.slug}')"> ${c.name}
      </label>
    `).join('');

    container.innerHTML = html;
  },

  renderBrandFilterList() {
    const container = document.getElementById('filterBrandList');
    if (!container) return;

    const html = `
      <label class="filter-checkbox-label">
        <input type="radio" name="brandFilter" value="all" ${this.state.brand === 'all' ? 'checked' : ''} onchange="app.applyFilters()"> All Brands
      </label>
    ` + this.state.brands.map(b => `
      <label class="filter-checkbox-label brand-item-label" data-brand="${b.name.toLowerCase()}">
        <input type="radio" name="brandFilter" value="${b.name}" ${this.state.brand === b.name ? 'checked' : ''} onchange="app.applyFilters()"> ${b.name}
      </label>
    `).join('');

    container.innerHTML = html;
  },

  filterBrandList(e) {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('#filterBrandList .brand-item-label').forEach(el => {
      const brand = el.getAttribute('data-brand') || '';
      el.style.display = brand.includes(query) ? 'flex' : 'none';
    });
  },

  toggleAccordion(headerEl) {
    const accordion = headerEl.parentElement;
    accordion.classList.toggle('collapsed');
  },

  selectCategoryFilter(slug) {
    this.state.category = slug;
    const catObj = this.state.categories.find(c => c.slug === slug);
    document.getElementById('listingCategoryTitle').innerText = catObj ? `Buy ${catObj.name} Online` : "Buy Women's & Designer Collection";

    document.querySelectorAll('.nav-item').forEach(item => {
      const onclickAttr = item.getAttribute('onclick') || '';
      if (onclickAttr.includes(`'${slug}'`)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    this.fetchProducts();
  },

  toggleSizeFilter(size, btnEl) {
    if (this.state.size === size) {
      this.state.size = null;
      btnEl.classList.remove('selected');
    } else {
      this.state.size = size;
      document.querySelectorAll('#sizePills .size-pill').forEach(b => b.classList.remove('selected'));
      btnEl.classList.add('selected');
    }
    this.fetchProducts();
  },

  toggleColorFilter(color, dotEl) {
    if (this.state.color === color) {
      this.state.color = null;
      dotEl.classList.remove('selected');
    } else {
      this.state.color = color;
      document.querySelectorAll('#colorSwatches .color-dot').forEach(d => d.classList.remove('selected'));
      dotEl.classList.add('selected');
    }
    this.fetchProducts();
  },

  renderHomepageBlocks() {
    const container = document.getElementById('homepageBlocksContainer');
    if (!container) return;

    const isHomepage = Boolean(
      (this.state.category === 'all' || !this.state.category) &&
      (!this.state.search || this.state.search.trim() === '') &&
      (this.state.gender === 'all' || !this.state.gender) &&
      (this.state.brand === 'all' || !this.state.brand) &&
      (this.state.badge === 'all' || !this.state.badge) &&
      (!this.state.priceRange || this.state.priceRange === 'all')
    );

    if (!isHomepage || this.state.products.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    const wishlistSet = new Set(this.state.wishlist.map(w => w.id));

    const renderBlockCardHtml = (p, isWishlistFeatured = false) => {
      const isWishlisted = wishlistSet.has(p.id);
      const img = (p.images && p.images[0]) || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80';
      const badgeClass = (p.badge || '').toLowerCase().replace(/\s+/g, '');

      return `
        <div class="product-card ${isWishlistFeatured ? 'wishlist-featured-card' : ''}" onclick="app.openProductDetailModal(${p.id})">
          <div class="product-image-wrap">
            <img src="${img}" class="product-img" alt="${p.title}">
            ${isWishlistFeatured 
              ? `<span class="badge-tag wishlist-match">❤️ IN YOUR WISHLIST</span>`
              : (p.badge ? `<span class="badge-tag ${badgeClass}">${p.badge}</span>` : '')
            }
            <button class="wishlist-heart-btn ${isWishlisted ? 'active' : ''}" onclick="event.stopPropagation(); app.toggleWishlist(${p.id})">
              <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
          </div>
          <div class="product-info-wrap">
            <span class="product-brand">${p.brand_name}</span>
            <span class="product-title">${p.title}</span>
            <div class="price-row">
              <span class="current-price">₹${p.price.toLocaleString()}</span>
              <span class="mrp-price">₹${p.mrp.toLocaleString()}</span>
              <span class="discount-badge">${p.discount_percent}% off</span>
            </div>
            ${isWishlistFeatured
              ? `<button class="card-action-btn" style="background: var(--primary-pink); color: #FFFFFF;" onclick="event.stopPropagation(); app.moveToBag(${p.id})">MOVE TO BAG 🛍️</button>`
              : `<button class="card-action-btn" onclick="event.stopPropagation(); app.addToBag(${p.id})">ADD TO BAG</button>`
            }
          </div>
        </div>
      `;
    };

    // Helper to build block items prioritizing wishlist items
    const buildBlockItems = (candidateFilter, maxItems = 4) => {
      const candidates = this.state.products.filter(candidateFilter);
      const wishlistCandidates = this.state.wishlist.filter(candidateFilter);
      
      const wishlistedIds = new Set(wishlistCandidates.map(w => w.id));
      const remainingCandidates = candidates.filter(c => !wishlistedIds.has(c.id));

      const selectedWishlist = wishlistCandidates.slice(0, 2);
      const selectedRemaining = remainingCandidates.slice(0, maxItems - selectedWishlist.length);

      return {
        wishlistItems: selectedWishlist,
        regularItems: selectedRemaining
      };
    };

    // Block 1: 🔥 Trending Now
    const trending = buildBlockItems(p => (p.badge && (p.badge.includes('BESTSELLER') || p.badge.includes('STYLE'))) || p.is_bestseller === 1 || p.rating >= 4.5);
    
    // Block 2: ⚡ On Sale & Offers
    const onSale = buildBlockItems(p => p.discount_percent >= 40);

    // Block 3: ✨ In The Spotlight
    const spotlight = buildBlockItems(p => p.category_slug === 'luxe' || (p.badge && (p.badge.includes('EXCLUSIVE') || p.badge.includes('RESPONSIBLE'))) || p.price >= 2000);

    const renderBlockHtml = (title, emoji, subtitle, blockData) => {
      const wishlistCards = blockData.wishlistItems.map(p => renderBlockCardHtml(p, true)).join('');
      const regularCards = blockData.regularItems.map(p => renderBlockCardHtml(p, false)).join('');

      return `
        <div class="homepage-block-wrapper">
          <div class="homepage-block-header">
            <div class="homepage-block-title-area">
              <h3 class="homepage-block-title"><span>${emoji}</span> ${title}</h3>
              <span class="homepage-block-subtitle">${subtitle}</span>
            </div>
            ${blockData.wishlistItems.length > 0 ? `<span style="font-size: 11px; color: #E80071; font-weight: 700; background: #FFF5F8; padding: 4px 10px; border-radius: 12px; border: 1px solid #FBCFE8;">❤️ ${blockData.wishlistItems.length} Wishlist Item Included</span>` : ''}
          </div>
          <div class="homepage-block-grid">
            ${wishlistCards}
            ${regularCards}
          </div>
        </div>
      `;
    };

    container.innerHTML = `
      ${renderBlockHtml('Trending Now', '🔥', 'Most loved styles & top fashion picks of the season', trending)}
      ${renderBlockHtml('On Sale & Offers', '⚡', 'Unbeatable markdowns & highest discounts (40%+ off)', onSale)}
      ${renderBlockHtml('In The Spotlight', '✨', 'Curated premium, luxe & designer highlights', spotlight)}
    `;
  },

  renderProducts() {
    this.renderHomepageBlocks();
    const grid = document.getElementById('productGrid');
    const countLabel = document.getElementById('listingCountLabel');
    if (!grid) return;

    countLabel.innerText = `${this.state.products.length} items found`;

    if (this.state.products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
          <div style="font-size: 40px; margin-bottom: 8px;">🛍️</div>
          <h3 style="font-size: 18px; color: #374151; font-weight: 700;">No products found matching your active search/filters.</h3>
          <p style="font-size: 13px; color: #6B7280; margin-top: 4px;">Try resetting filters or searching for another term.</p>
          <button class="hero-cta" style="margin-top: 16px; font-size: 13px; padding: 10px 20px;" onclick="app.resetFilters()">Reset Filters</button>
        </div>
      `;
      return;
    }

    const wishlistSet = new Set(this.state.wishlist.map(w => w.id));

    const renderCardHtml = (p, isWishlistFeatured = false) => {
      const isWishlisted = wishlistSet.has(p.id);
      const img = p.images[0] || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80';
      const badgeClass = (p.badge || '').toLowerCase().replace(/\s+/g, '');

      return `
        <div class="product-card ${isWishlistFeatured ? 'wishlist-featured-card' : ''}" onclick="app.openProductDetailModal(${p.id})">
          <div class="product-image-wrap">
            <img src="${img}" class="product-img" alt="${p.title}">
            ${isWishlistFeatured 
              ? `<span class="badge-tag wishlist-match">❤️ IN YOUR WISHLIST</span>`
              : (p.badge ? `<span class="badge-tag ${badgeClass}">${p.badge}</span>` : '')
            }
            <button class="wishlist-heart-btn ${isWishlisted ? 'active' : ''}" onclick="event.stopPropagation(); app.toggleWishlist(${p.id})">
              <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
          </div>
          <div class="product-info-wrap">
            <span class="product-brand">${p.brand_name}</span>
            <span class="product-title">${p.title}</span>
            <div class="price-row">
              <span class="current-price">₹${p.price.toLocaleString()}</span>
              <span class="mrp-price">₹${p.mrp.toLocaleString()}</span>
              <span class="discount-badge">${p.discount_percent}% off</span>
            </div>
            ${isWishlistFeatured
              ? `<button class="card-action-btn" style="background: var(--primary-pink); color: #FFFFFF;" onclick="event.stopPropagation(); app.moveToBag(${p.id})">MOVE TO BAG 🛍️</button>`
              : `<button class="card-action-btn" onclick="event.stopPropagation(); app.addToBag(${p.id})">ADD TO BAG</button>`
            }
          </div>
        </div>
      `;
    };

    let html = '';
    const isSearching = Boolean(this.state.search && this.state.search.trim().length > 0);

    if (isSearching && this.state.wishlist.length > 0) {
      const searchResultCategories = new Set(this.state.products.map(p => p.category_slug));
      const searchLower = this.state.search.toLowerCase();

      // Find wishlisted items that belong to the same category or match the search term
      const categoryWishlistMatches = this.state.wishlist.filter(w => {
        return searchResultCategories.has(w.category_slug) ||
               w.title.toLowerCase().includes(searchLower) ||
               w.brand_name.toLowerCase().includes(searchLower) ||
               w.category_slug.toLowerCase().includes(searchLower);
      });

      if (categoryWishlistMatches.length > 0) {
        html += `
          <div style="grid-column: 1 / -1; margin-bottom: 4px;">
            <div style="font-size: 15px; font-weight: 800; color: #111827; display: flex; align-items: center; gap: 8px; background: #FFF5F8; padding: 12px 16px; border-radius: 8px; border: 1px solid #FBCFE8;">
              <span>❤️</span>
              <span>From Your Wishlist (Matching Category for "${this.state.search}") (${categoryWishlistMatches.length})</span>
              <span style="margin-left: auto; font-size: 11px; color: #E80071; font-weight: 700; background: #FFFFFF; padding: 4px 10px; border-radius: 12px; border: 1px solid #FBCFE8;">Category Wishlist Match</span>
            </div>
          </div>
        `;
        html += categoryWishlistMatches.map(p => renderCardHtml(p, true)).join('');

        html += `
          <div style="grid-column: 1 / -1; margin-top: 24px; margin-bottom: 4px;">
            <div style="font-size: 14px; font-weight: 700; color: #374151; display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid #E5E7EB;">
              <span>🛍️ All Search Results (${this.state.products.length})</span>
            </div>
          </div>
        `;
        html += this.state.products.map(p => renderCardHtml(p, false)).join('');
      } else {
        // Wishlist has no similar products in that category -> DO NOT SHOW WISHLISTED BLOCK
        html += this.state.products.map(p => renderCardHtml(p, false)).join('');
      }
    } else {
      // Normal browsing homepage OR no search query -> DO NOT SHOW WISHLISTED BLOCK
      html += this.state.products.map(p => renderCardHtml(p, false)).join('');
    }

    grid.innerHTML = html;
  },

  async toggleWishlist(productId) {
    try {
      const res = await fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
      const data = await res.json();
      if (data.success) {
        await this.fetchWishlist();
        this.renderProducts();
      }
    } catch (err) {
      console.error('Error toggling wishlist:', err);
    }
  },

  async addToBag(productId, size = null) {
    let product = this.state.products.find(p => p.id === productId) ||
                  this.state.wishlist.find(p => p.id === productId);

    if (!product) {
      await this.executeAddToCart(productId, 'One Size');
      return;
    }

    const sizes = product.sizes || [];
    const requiresSize = sizes.length > 0 && !(sizes.length === 1 && sizes[0] === 'One Size');

    if (requiresSize && !size) {
      this.promptSizeSelectionModal(product);
      return;
    }

    const chosenSize = size || (sizes.length > 0 ? sizes[0] : 'One Size');
    await this.executeAddToCart(productId, chosenSize);
  },

  async executeAddToCart(productId, size) {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, size, quantity: 1 })
      });
      const data = await res.json();
      if (data.success) {
        await this.fetchCart();
        this.toggleCartDrawer(true);
      }
    } catch (err) {
      console.error('Error adding to bag:', err);
    }
  },

  promptSizeSelectionModal(product) {
    this.state.pendingSizeProduct = product;
    const sizes = product.sizes || ['S', 'M', 'L'];
    this.state.selectedModalSize = sizes[0];

    const isWishlisted = this.state.wishlist.some(w => w.id === product.id);
    const submitBtn = document.getElementById('sizeModalSubmitBtn');
    if (submitBtn) {
      submitBtn.innerText = isWishlisted ? 'Move To Bag' : 'Add To Bag';
    }

    const imgEl = document.getElementById('sizeModalImg');
    if (imgEl) imgEl.src = (product.images && product.images[0]) || product.image || '';

    const brandEl = document.getElementById('sizeModalBrand');
    if (brandEl) brandEl.innerText = product.brand_name || '';

    const titleEl = document.getElementById('sizeModalTitle');
    if (titleEl) titleEl.innerText = product.title || '';

    const priceEl = document.getElementById('sizeModalPrice');
    if (priceEl) priceEl.innerText = `₹${(product.price || 0).toLocaleString()}`;

    const mrpEl = document.getElementById('sizeModalMrp');
    if (mrpEl) mrpEl.innerText = `₹${(product.mrp || 0).toLocaleString()}`;

    const discountEl = document.getElementById('sizeModalDiscount');
    if (discountEl) discountEl.innerText = `${product.discount_percent || 0}% off`;

    const pillsGrid = document.getElementById('sizeModalPillsGrid');
    if (pillsGrid) {
      pillsGrid.innerHTML = sizes.map((s, idx) => `
        <button class="size-modal-pill ${idx === 0 ? 'selected' : ''}" onclick="app.selectModalSize('${s}', this)">${s}</button>
      `).join('');
    }

    const modal = document.getElementById('sizeSelectionModal');
    if (modal) modal.classList.add('open');
  },

  selectModalSize(size, btnEl) {
    this.state.selectedModalSize = size;
    document.querySelectorAll('.size-modal-pill').forEach(b => b.classList.remove('selected'));
    if (btnEl) btnEl.classList.add('selected');
  },

  closeSizeModal() {
    this.state.pendingSizeProduct = null;
    const modal = document.getElementById('sizeSelectionModal');
    if (modal) modal.classList.remove('open');
  },

  openProductDetailModal(productId) {
    let product = this.state.products.find(p => p.id === productId) ||
                  this.state.wishlist.find(p => p.id === productId);

    if (!product) return;
    this.state.activeDetailProduct = product;

    // Breadcrumbs
    const bc = document.getElementById('pdpBreadcrumbs');
    if (bc) bc.innerText = `Home > Women > ${product.category_slug || 'Westernwear'} > ${product.brand_name || 'Brand'}`;

    // Badges
    const badgesEl = document.getElementById('pdpBadges');
    if (badgesEl) badgesEl.innerText = (product.badge || 'EXCLUSIVE | LATEST STYLE').toUpperCase();

    // Title & Brand
    const brandEl = document.getElementById('pdpBrand');
    if (brandEl) brandEl.innerText = product.brand_name || '';

    const titleEl = document.getElementById('pdpTitle');
    if (titleEl) titleEl.innerText = product.title || '';

    // Prices
    const priceEl = document.getElementById('pdpPrice');
    if (priceEl) priceEl.innerText = `₹${(product.price || 0).toLocaleString()}`;

    const discountEl = document.getElementById('pdpDiscount');
    if (discountEl) discountEl.innerText = `${product.discount_percent || 0}% Off`;

    const mrpEl = document.getElementById('pdpMrp');
    if (mrpEl) mrpEl.innerText = `MRP ₹${(product.mrp || 0).toLocaleString()} Inclusive of all taxes`;

    // Images
    const imgs = product.images && product.images.length > 0 ? product.images : [product.image || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80'];
    const galleryImgs = imgs.length >= 3 ? imgs : [imgs[0], imgs[0], imgs[0]];

    const mainImgEl = document.getElementById('pdpMainImg');
    if (mainImgEl) mainImgEl.src = galleryImgs[0];

    const thumbsCol = document.getElementById('pdpThumbsCol');
    if (thumbsCol) {
      thumbsCol.innerHTML = galleryImgs.map((imgUrl, idx) => `
        <img src="${imgUrl}" class="pdp-thumb-img ${idx === 0 ? 'active' : ''}" onclick="app.setMainPdpImage('${imgUrl}', this)" alt="Thumbnail ${idx + 1}">
      `).join('');
    }

    // Size Pills
    const sizes = product.sizes || ['XS', 'S', 'M', 'L', 'XL', '2XL'];
    this.state.selectedPdpSize = sizes[0];
    const sizePillsEl = document.getElementById('pdpSizePills');
    if (sizePillsEl) {
      sizePillsEl.innerHTML = sizes.map((s, idx) => `
        <button class="pdp-size-pill ${idx === 0 ? 'selected' : ''}" onclick="app.selectPdpSize('${s}', this)">${s}</button>
      `).join('');
    }

    // Model Info
    const modelDesc = document.getElementById('pdpModelDesc');
    if (modelDesc) modelDesc.innerText = `Model Height is 5'8" and is Wearing Size ${sizes[0] || 'S'}.`;

    // Update PDP Wishlist Button state
    this.renderPdpWishlistButton();

    // Show modal
    const modal = document.getElementById('productDetailModal');
    if (modal) modal.classList.add('open');
  },

  renderPdpWishlistButton() {
    const product = this.state.activeDetailProduct;
    if (!product) return;

    const btn = document.getElementById('pdpWishlistBtn');
    if (!btn) return;

    const isWishlisted = this.state.wishlist.some(w => w.id === product.id);
    if (isWishlisted) {
      btn.className = 'pdp-wishlist-btn wishlisted';
      btn.innerHTML = `<span style="color: #E80071; font-size: 18px; margin-right: 4px;">❤️</span> Added to Wishlist`;
    } else {
      btn.className = 'pdp-wishlist-btn';
      btn.innerHTML = `<span style="color: #64748B; font-size: 18px; margin-right: 4px;">♡</span> Add to Wishlist`;
    }
  },

  setMainPdpImage(url, el) {
    const mainImgEl = document.getElementById('pdpMainImg');
    if (mainImgEl) mainImgEl.src = url;
    document.querySelectorAll('.pdp-thumb-img').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
  },

  selectPdpSize(size, el) {
    this.state.selectedPdpSize = size;
    document.querySelectorAll('.pdp-size-pill').forEach(p => p.classList.remove('selected'));
    if (el) el.classList.add('selected');
  },

  closeProductDetailModal() {
    this.state.activeDetailProduct = null;
    const modal = document.getElementById('productDetailModal');
    if (modal) modal.classList.remove('open');
  },

  async togglePdpWishlist() {
    const product = this.state.activeDetailProduct;
    if (!product) return;

    await this.toggleWishlist(product.id);
    this.renderPdpWishlistButton();
  },

  async addPdpToBag() {
    const product = this.state.activeDetailProduct;
    const size = this.state.selectedPdpSize || 'S';
    if (!product) return;

    this.closeProductDetailModal();
    const isWishlisted = this.state.wishlist.some(w => w.id === product.id);
    if (isWishlisted) {
      await this.executeMoveToBag(product.id, size);
    } else {
      await this.executeAddToCart(product.id, size);
    }
  },

  checkPincode() {
    const val = document.getElementById('pdpPincodeInput')?.value || '122002';
    const statusEl = document.getElementById('pdpPincodeStatus');
    if (statusEl) statusEl.innerText = `Delivers to ${val} ✔`;
  },

  async confirmSizeMoveToBag() {
    const product = this.state.pendingSizeProduct;
    const size = this.state.selectedModalSize || 'S';
    if (!product) return;

    this.closeSizeModal();

    const isWishlisted = this.state.wishlist.some(w => w.id === product.id);
    if (isWishlisted) {
      await this.executeMoveToBag(product.id, size);
    } else {
      await this.executeAddToCart(product.id, size);
    }
  },

  async moveToBag(productId) {
    let product = this.state.wishlist.find(p => p.id === productId) ||
                  this.state.products.find(p => p.id === productId);

    if (!product) {
      await this.executeMoveToBag(productId, 'One Size');
      return;
    }

    const sizes = product.sizes || [];
    const requiresSize = sizes.length > 0 && !(sizes.length === 1 && sizes[0] === 'One Size');

    if (requiresSize) {
      // Prompt size selection modal matching reference screenshot
      this.promptSizeSelectionModal(product);
    } else {
      await this.executeMoveToBag(productId, 'One Size');
    }
  },

  async executeMoveToBag(productId, size) {
    try {
      const res = await fetch('/api/wishlist/move-to-bag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, size })
      });
      const data = await res.json();
      if (data.success) {
        await this.fetchWishlist();
        await this.fetchCart();
        this.renderWishlistGrid();
        this.toggleCartDrawer(true);
      }
    } catch (err) {
      console.error('Error moving to bag:', err);
    }
  },

  async updateCartQty(cartId, qty) {
    try {
      const res = await fetch(`/api/cart/${cartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(qty) })
      });
      const data = await res.json();
      if (data.success) {
        await this.fetchCart();
      }
    } catch (err) {
      console.error('Error updating cart qty:', err);
    }
  },

  async removeCartItem(cartId) {
    try {
      const res = await fetch(`/api/cart/${cartId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.fetchCart();
      }
    } catch (err) {
      console.error('Error removing cart item:', err);
    }
  },

  promptRemoveCartItem(cartId) {
    const item = this.state.cart.find(c => c.cart_id === cartId || c.id === cartId);
    if (!item) {
      this.removeCartItem(cartId);
      return;
    }

    this.state.pendingRemoveItem = item;

    const imgEl = document.getElementById('removeModalItemImg');
    if (imgEl) {
      imgEl.src = (item.images && item.images[0]) || item.image || '';
    }

    document.getElementById('removeCartModal').classList.add('open');
  },

  closeRemoveCartModal() {
    this.state.pendingRemoveItem = null;
    document.getElementById('removeCartModal').classList.remove('open');
  },

  async confirmMoveToWishlist() {
    const item = this.state.pendingRemoveItem;
    if (!item) return;

    this.closeRemoveCartModal();

    // 1. Move to wishlist if not already wishlisted
    const isWishlisted = this.state.wishlist.some(w => w.id === item.product_id);
    if (!isWishlisted) {
      await this.toggleWishlist(item.product_id);
    }

    // 2. Remove item from cart
    await this.removeCartItem(item.cart_id);
  },

  async confirmRemoveCartItem() {
    const item = this.state.pendingRemoveItem;
    if (!item) return;

    this.closeRemoveCartModal();
    await this.removeCartItem(item.cart_id);
  },

  scrollToPriceSummary() {
    const el = document.getElementById('priceSummarySection');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  renderCartDrawer() {
    const body = document.getElementById('cartBody');
    const headerTitle = document.getElementById('cartHeaderTitle');
    if (!body) return;

    const itemCount = this.state.cart.reduce((sum, i) => sum + i.quantity, 0);
    if (headerTitle) {
      headerTitle.innerHTML = `Bag <span>${itemCount} Items</span>`;
    }

    let html = '';

    // Render active Cart Items
    if (this.state.cart.length === 0) {
      html += `
        <div style="text-align: center; padding: 40px 20px 20px 20px;">
          <div style="font-size: 44px; margin-bottom: 8px;">🛍️</div>
          <h3 style="font-size: 15px; font-weight: 700;">Your Shopping Bag is empty</h3>
          <p style="font-size: 12px; color: #666; margin-top: 4px;">Explore our catalog or move items from your Wishlist below!</p>
        </div>
      `;
    } else {
      html += this.state.cart.map(item => `
        <div class="cart-item-card">
          <img src="${item.images[0] || ''}" class="cart-item-img" alt="${item.title}">
          <div class="cart-item-details">
            <div class="cart-item-brand">${item.brand_name}</div>
            <div class="cart-item-title">${item.title}</div>
            <div class="cart-item-options">
              <label class="select-label">Size:
                <select class="select-box" onchange="app.updateCartQty(${item.cart_id}, ${item.quantity})">
                  ${(item.sizes || ['S', 'M', 'L']).map(s => `<option value="${s}" ${s === item.selected_size ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </label>
              <label class="select-label">Qty:
                <select class="select-box" onchange="app.updateCartQty(${item.cart_id}, this.value)">
                  ${[1,2,3,4,5].map(q => `<option value="${q}" ${q === item.quantity ? 'selected' : ''}>${q}</option>`).join('')}
                </select>
              </label>
            </div>
            <div class="return-policy-tag">7 Day Return</div>
          </div>
          <div class="cart-item-right-price">
            <button class="remove-cart-item" onclick="app.promptRemoveCartItem(${item.cart_id})" title="Remove item">✕</button>
            <div class="you-pay-text">You Pay <strong>₹${(item.price * item.quantity).toLocaleString()}</strong></div>
            <div class="item-discount-subtext">${item.discount_percent}% off <span class="mrp-strikethrough">₹${(item.mrp * item.quantity).toLocaleString()}</span></div>
          </div>
        </div>
      `).join('');

      // Coupons Section
      html += `
        <div class="coupons-card">
          <div class="coupons-left">
            <span class="coupons-icon">🎟️</span>
            <div>
              <div class="coupons-title">Coupons</div>
              <div class="coupons-subtext">Apply coupons and save extra</div>
            </div>
          </div>
          <div class="coupons-arrow">›</div>
        </div>
      `;

      // Price Summary Section (Bordered Card)
      const { totalMrp, totalAmount, totalDiscount } = this.state.cartSummary;

      html += `
        <div class="price-summary-card" id="priceSummarySection">
          <div class="price-summary-title">Price Summary</div>
          <div class="price-summary-subtext">Prices are inclusive of all taxes</div>
          
          <div class="price-breakdown-row">
            <span>Bag Total (${itemCount} items)</span>
            <span class="price-val">₹${totalMrp.toLocaleString()}</span>
          </div>
          <div class="price-breakdown-row">
            <span>Discount on MRP</span>
            <span class="price-val green-text">- ₹${totalDiscount.toLocaleString()}</span>
          </div>
          <div class="price-breakdown-row">
            <span>Sub Total</span>
            <span class="price-val">₹${totalAmount.toLocaleString()}</span>
          </div>
          <div class="price-breakdown-row">
            <span>Convenience Charges</span>
            <span class="price-val green-text">Free</span>
          </div>
          
          <div class="price-divider"></div>
          
          <div class="price-breakdown-row you-pay-row">
            <span class="you-pay-label">You Pay</span>
            <span class="you-pay-value">₹${totalAmount.toLocaleString()}</span>
          </div>

          ${totalDiscount > 0 ? `
            <div class="savings-green-box">
              <span class="check-circle">✔</span>
              <span>Yay! You are saving ₹${totalDiscount.toLocaleString()}.</span>
            </div>
          ` : ''}
        </div>
      `;

      // Trust Badges Row
      html += `
        <div class="trust-badges-row">
          <div class="trust-item">
            <span class="trust-icon">🛡️</span>
            <span>Genuine products</span>
          </div>
          <div class="trust-item">
            <span class="trust-icon">💳</span>
            <span>Secure payments</span>
          </div>
          <div class="trust-item">
            <span class="trust-icon">🔄</span>
            <span>Easy returns</span>
          </div>
        </div>
      `;
    }

    // Wishlist Recommendations Section ("From Your Wishlist ❤️")
    // Filter out items already in cart AND filter out items that are OUT OF STOCK (stock_qty <= 0)
    const cartProductIds = new Set(this.state.cart.map(c => c.product_id));
    const inStockWishlist = this.state.wishlist.filter(w => {
      const notInCart = !cartProductIds.has(w.id);
      const isInStock = (w.stock_qty === undefined || w.stock_qty === null || w.stock_qty > 0);
      return notInCart && isInStock;
    });

    if (inStockWishlist.length > 0) {
      const cartCategories = new Set(this.state.cart.map(c => c.category_slug));
      const cartBrands = new Set(this.state.cart.map(c => c.brand_name));

      // Sort so similar category/brand items appear first, showing ALL relevant items
      const relevantWishlist = [...inStockWishlist].sort((a, b) => {
        const aScore = cartCategories.has(a.category_slug) ? 2 : (cartBrands.has(a.brand_name) ? 1 : 0);
        const bScore = cartCategories.has(b.category_slug) ? 2 : (cartBrands.has(b.brand_name) ? 1 : 0);
        return bScore - aScore;
      });

      html += `
        <div class="cart-wishlist-suggestions">
          <div class="wishlist-section-title">
            <span class="heart-icon">❤️</span>
            <span>From Your Wishlist (${relevantWishlist.length})</span>
          </div>
          ${relevantWishlist.map(item => {
            const isCategoryMatch = cartCategories.has(item.category_slug);
            const isBrandMatch = cartBrands.has(item.brand_name);
            let matchBadge = '';
            if (isCategoryMatch) matchBadge = '✨ Matches Cart Category';
            else if (isBrandMatch) matchBadge = '✨ Similar Brand';

            return `
              <div class="wishlist-suggest-card">
                <img src="${item.images[0] || ''}" class="wishlist-suggest-img" alt="${item.title}">
                <div class="wishlist-suggest-info">
                  <div class="wishlist-suggest-brand">${item.brand_name}</div>
                  <div class="wishlist-suggest-title">${item.title}</div>
                  ${matchBadge ? `<div style="font-size: 10px; color: #E80071; font-weight: 700;">${matchBadge}</div>` : ''}
                  <div class="wishlist-suggest-price">₹${item.price.toLocaleString()}</div>
                </div>
                <button class="wishlist-move-btn" onclick="app.moveToBag(${item.id})">
                  MOVE TO BAG 🛍️
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    body.innerHTML = html;

    // Update Sticky Footer Elements
    const { totalAmount, totalDiscount } = this.state.cartSummary;
    const savingsBanner = document.getElementById('cartSavingsBanner');
    const footerTotal = document.getElementById('footerTotalAmount');

    if (savingsBanner) {
      savingsBanner.innerText = `You saved ₹${totalDiscount.toLocaleString()} on this purchase`;
    }
    if (footerTotal) {
      footerTotal.innerText = `₹${totalAmount.toLocaleString()}`;
    }
  },

  renderWishlistGrid() {
    const grid = document.getElementById('wishlistGrid');
    if (!grid) return;

    if (this.state.wishlist.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
          <div style="font-size: 40px;">💔</div>
          <h3 style="font-size: 16px; font-weight: 700; margin-top: 8px;">Your Wishlist is empty</h3>
        </div>
      `;
    } else {
      grid.innerHTML = this.state.wishlist.map(p => `
        <div class="product-card">
          <div class="product-image-wrap">
            <img src="${p.images[0] || ''}" class="product-img" alt="${p.title}">
            <button class="wishlist-heart-btn active" onclick="app.toggleWishlist(${p.id})" title="Remove">✕</button>
          </div>
          <div class="product-info-wrap">
            <span class="product-brand">${p.brand_name}</span>
            <span class="product-title">${p.title}</span>
            <div class="price-row">
              <span class="current-price">₹${p.price.toLocaleString()}</span>
              <span class="discount-badge">${p.discount_percent}% off</span>
            </div>
            <button class="card-action-btn" onclick="app.moveToBag(${p.id})">Move to Bag</button>
          </div>
        </div>
      `).join('');
    }
  },

  toggleCartDrawer(open) {
    const overlay = document.getElementById('cartOverlay');
    const drawer = document.getElementById('cartDrawer');
    if (open) {
      overlay.classList.add('open');
      drawer.classList.add('open');
    } else {
      overlay.classList.remove('open');
      drawer.classList.remove('open');
    }
  },

  showWishlistModal() {
    this.renderWishlistGrid();
    document.getElementById('wishlistModal').classList.add('open');
  },

  closeWishlistModal() {
    document.getElementById('wishlistModal').classList.remove('open');
  },

  openCheckoutModal() {
    if (this.state.cart.length === 0) return alert('Your cart is empty!');
    this.toggleCartDrawer(false);

    if (this.state.currentUser) {
      if (document.getElementById('chkName')) document.getElementById('chkName').value = this.state.currentUser.name;
      if (document.getElementById('chkPhone')) document.getElementById('chkPhone').value = this.state.currentUser.phone;
    }

    const { totalAmount, totalDiscount } = this.state.cartSummary;
    document.getElementById('chkTotalPayable').innerText = `₹${totalAmount.toLocaleString()}`;
    document.getElementById('chkTotalSaving').innerText = `₹${totalDiscount.toLocaleString()}`;

    document.getElementById('checkoutModal').classList.add('open');
  },

  closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.remove('open');
  },

  selectPaymentMethod(method, element) {
    this.state.paymentMethod = method;
    document.querySelectorAll('.payment-option-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
  },

  async placeOrder() {
    try {
      const name = document.getElementById('chkName').value;
      const phone = document.getElementById('chkPhone').value;
      const address = document.getElementById('chkAddress').value;
      const pincode = document.getElementById('chkPincode').value;

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          address,
          pincode,
          paymentMethod: this.state.paymentMethod
        })
      });

      const data = await res.json();
      if (data.success) {
        this.closeCheckoutModal();
        await this.fetchCart();
        alert(`🎉 Success! Order #${data.order.orderNumber} placed cleanly!\nTotal Paid: ₹${data.order.totalAmount}\nPayment Method: ${data.order.paymentMethod}`);
      } else {
        alert('Checkout error: ' + data.error);
      }
    } catch (err) {
      console.error('Error placing order:', err);
    }
  },

  filterByCategory(slug, el = null) {
    this.state.category = slug;

    const rad = document.querySelector(`input[name="categoryFilter"][value="${slug}"]`);
    if (rad) rad.checked = true;

    if (el) {
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      el.classList.add('active');
    }
    const catObj = this.state.categories.find(c => c.slug === slug);
    document.getElementById('listingCategoryTitle').innerText = catObj ? `Buy ${catObj.name} Online` : "Buy Women's & Designer Collection";
    this.fetchProducts();
  },

  handleSearch(e) {
    this.state.search = e.target.value.trim();
    const titleEl = document.getElementById('listingCategoryTitle');
    if (titleEl) {
      if (this.state.search) {
        titleEl.innerText = `Search Results for "${this.state.search}"`;
      } else {
        const catObj = this.state.categories.find(c => c.slug === this.state.category);
        titleEl.innerText = catObj ? `Buy ${catObj.name} Online` : "Buy Women's & Designer Collection";
      }
    }
    this.fetchProducts();
  },

  applyFilters() {
    const genderEl = document.querySelector('input[name="gender"]:checked');
    const discountEl = document.querySelector('input[name="discount"]:checked');
    const brandEl = document.querySelector('input[name="brandFilter"]:checked');
    const priceEl = document.querySelector('input[name="priceRange"]:checked');
    const badgeEl = document.querySelector('input[name="badge"]:checked');
    const sortEl = document.getElementById('sortSelect');

    this.state.gender = genderEl ? genderEl.value : 'all';
    this.state.discount = discountEl ? discountEl.value : '0';
    this.state.brand = brandEl ? brandEl.value : 'all';
    this.state.priceRange = priceEl ? priceEl.value : 'all';
    this.state.badge = badgeEl ? badgeEl.value : 'all';
    this.state.sort = sortEl ? sortEl.value : 'popularity';

    this.fetchProducts();
  },

  resetFilters() {
    this.state.category = 'all';
    this.state.gender = 'all';
    this.state.discount = '0';
    this.state.brand = 'all';
    this.state.priceRange = 'all';
    this.state.badge = 'all';
    this.state.size = null;
    this.state.color = null;
    this.state.search = '';
    this.state.sort = 'popularity';

    document.getElementById('searchInput').value = '';
    if (document.getElementById('brandSearchInput')) document.getElementById('brandSearchInput').value = '';
    
    document.querySelectorAll('input[type="radio"]').forEach(rad => {
      if (rad.value === 'all' || rad.value === '0') rad.checked = true;
      else rad.checked = false;
    });

    document.querySelectorAll('.size-pill').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
    document.querySelectorAll('.nav-item').forEach((item, idx) => item.classList.toggle('active', idx === 0));
    document.getElementById('sortSelect').value = 'popularity';
    document.getElementById('listingCategoryTitle').innerText = "Buy Women's & Designer Collection";

    this.renderBrandFilterList();
    this.fetchProducts();
  },

  toggleMode(mode) {
    this.state.mode = mode;
    document.getElementById('modeFashion').classList.toggle('active', mode === 'fashion');
    document.getElementById('modeLuxe').classList.toggle('active', mode === 'luxe');
    if (mode === 'luxe') {
      this.filterByCategory('luxe');
    } else {
      this.filterByCategory('all');
    }
  }
};

window.addEventListener('DOMContentLoaded', () => app.init());
