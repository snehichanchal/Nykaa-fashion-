const admin = {
  products: [],
  analytics: {},

  async init() {
    await this.fetchAnalytics();
    await this.fetchProducts();
  },

  async fetchAnalytics() {
    try {
      const res = await fetch('/api/admin/analytics');
      const data = await res.json();
      if (data.success) {
        this.analytics = data.analytics;
        document.getElementById('adminTotalSales').innerText = `₹${(this.analytics.totalSales || 0).toLocaleString()}`;
        document.getElementById('adminTotalOrders').innerText = this.analytics.totalOrders || 0;
        document.getElementById('adminTotalProducts').innerText = this.analytics.totalProducts || 0;
        document.getElementById('adminTotalWishlist').innerText = this.analytics.totalWishlist || 0;
      }
    } catch (err) {
      console.error('Failed to fetch admin analytics:', err);
    }
  },

  async fetchProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) {
        this.products = data.data;
        this.renderTable(this.products);
      }
    } catch (err) {
      console.error('Failed to fetch admin products:', err);
    }
  },

  renderTable(list) {
    const tbody = document.getElementById('adminProductTableBody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px;">No products found in inventory</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => `
      <tr>
        <td>#${p.id}</td>
        <td><img src="${p.images[0] || ''}" style="width:40px; height:50px; object-fit:cover; border-radius:4px;" alt="Product"></td>
        <td style="font-weight:600;">${p.title}</td>
        <td>${p.brand_name}</td>
        <td><span style="text-transform:capitalize;">${p.category_slug}</span></td>
        <td>₹${p.price.toLocaleString()} <span style="color:#9CA3AF; text-decoration:line-through; font-size:11px;">₹${p.mrp.toLocaleString()}</span></td>
        <td><span class="discount-badge">${p.discount_percent}% off</span></td>
        <td>
          <span style="font-weight:700; color: ${p.stock_qty < 15 ? '#DC2626' : '#059669'};">
            ${p.stock_qty} in stock
          </span>
        </td>
        <td>${p.badge ? `<span class="badge-tag bestseller" style="font-size:9px;">${p.badge}</span>` : '-'}</td>
        <td>
          <button style="color:#2563EB; font-weight:600; margin-right:8px;" onclick="admin.editProduct(${p.id})">Edit</button>
          <button style="color:#DC2626; font-weight:600;" onclick="admin.deleteProduct(${p.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  },

  filterTable(e) {
    const query = e.target.value.toLowerCase();
    const filtered = this.products.filter(p => 
      p.title.toLowerCase().includes(query) || 
      p.brand_name.toLowerCase().includes(query) ||
      p.category_slug.toLowerCase().includes(query)
    );
    this.renderTable(filtered);
  },

  openAddProductModal() {
    document.getElementById('adminModalTitle').innerText = 'Add New Product';
    document.getElementById('admProdId').value = '';
    document.getElementById('adminProductForm').reset();
    document.getElementById('adminProductModal').classList.add('open');
  },

  editProduct(id) {
    const prod = this.products.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('adminModalTitle').innerText = `Edit Product #${prod.id}`;
    document.getElementById('admProdId').value = prod.id;
    document.getElementById('admTitle').value = prod.title;
    document.getElementById('admBrand').value = prod.brand_name;
    document.getElementById('admCategory').value = prod.category_slug;
    document.getElementById('admPrice').value = prod.price;
    document.getElementById('admMrp').value = prod.mrp;
    document.getElementById('admStock').value = prod.stock_qty;
    document.getElementById('admBadge').value = prod.badge || '';

    document.getElementById('adminProductModal').classList.add('open');
  },

  closeModal() {
    document.getElementById('adminProductModal').classList.remove('open');
  },

  async saveProduct(e) {
    e.preventDefault();

    const id = document.getElementById('admProdId').value;
    const body = {
      title: document.getElementById('admTitle').value,
      brand_name: document.getElementById('admBrand').value,
      category_slug: document.getElementById('admCategory').value,
      price: document.getElementById('admPrice').value,
      mrp: document.getElementById('admMrp').value,
      stock_qty: document.getElementById('admStock').value,
      badge: document.getElementById('admBadge').value
    };

    try {
      const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        this.closeModal();
        await this.fetchProducts();
        await this.fetchAnalytics();
        alert(id ? 'Product updated successfully!' : 'New product created successfully!');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      console.error('Error saving product:', err);
    }
  },

  async deleteProduct(id) {
    if (!confirm(`Are you sure you want to delete product #${id}?`)) return;

    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.fetchProducts();
        await this.fetchAnalytics();
      }
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  },

  async reseedData() {
    if (!confirm('This will reset inventory to initial mock data. Continue?')) return;

    try {
      const res = await fetch('/api/admin/reseed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await this.fetchProducts();
        await this.fetchAnalytics();
        alert('🎉 Database successfully reseeded!');
      }
    } catch (err) {
      console.error('Error reseeding data:', err);
    }
  }
};

window.addEventListener('DOMContentLoaded', () => admin.init());
