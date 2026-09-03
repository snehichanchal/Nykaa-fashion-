import streamlit as st
import subprocess
import time
import requests
import sqlite3
import os
import pandas as pd

# Page configuration
st.set_page_config(
    page_title="Nykaa Fashion – E-Commerce Platform",
    page_icon="🛍️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Start Node.js Express server in background process if not running
@st.cache_resource
def start_express_server():
    port = os.environ.get("PORT", "3000")
    server_url = f"http://localhost:{port}"
    try:
        res = requests.get(f"{server_url}/api/categories", timeout=2)
        if res.status_code == 200:
            return server_url
    except Exception:
        pass

    # Start node server.js
    env = os.environ.copy()
    env["PORT"] = port
    
    subprocess.Popen(
        ["node", "server.js"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    
    # Wait for server to boot
    for _ in range(15):
        time.sleep(1)
        try:
            res = requests.get(f"{server_url}/api/categories", timeout=2)
            if res.status_code == 200:
                break
        except Exception:
            pass

    return server_url

SERVER_URL = start_express_server()

# Sidebar Header & Branding
st.sidebar.markdown(
    """
    <div style="text-align: center; padding: 10px 0;">
        <h2 style="color: #E80071; font-weight: 900; margin: 0;">NYKAA FASHION</h2>
        <p style="font-size: 12px; color: #666; margin-top: 2px;">Streamlit Full-Stack Application</p>
    </div>
    """,
    unsafe_allow_html=True
)

nav_choice = st.sidebar.radio(
    "Navigation View",
    ["🛍️ Customer Storefront", "📊 Python Data Analytics", "📄 Docs & Architecture"]
)

# Helper function to connect to SQLite DB
def get_db_connection():
    db_path = os.path.join(os.path.dirname(__file__), "db", "database.sqlite")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

if nav_choice == "🛍️ Customer Storefront":
    st.markdown("### 🛍️ Nykaa Fashion Live Storefront")
    st.caption("Complete single-page web app with search, wishlist priority, cart confirmation modal, and category filters.")
    
    st.components.v1.iframe(
        src=f"{SERVER_URL}/",
        height=850,
        scrolling=True
    )

elif nav_choice == "📊 Python Data Analytics":
    st.markdown("### 📊 Database & Inventory Analytics")
    st.caption("Native Streamlit analytics powered by direct SQLite queries.")
    
    try:
        conn = get_db_connection()
        
        # Metrics
        col1, col2, col3, col4 = st.columns(4)
        
        products_df = pd.read_sql_query("SELECT * FROM products", conn)
        cart_df = pd.read_sql_query("SELECT * FROM cart_items", conn)
        wishlist_df = pd.read_sql_query("SELECT * FROM wishlist_items", conn)
        orders_df = pd.read_sql_query("SELECT * FROM orders", conn)
        
        total_revenue = orders_df['total_amount'].sum() if not orders_df.empty and 'total_amount' in orders_df else 0
        
        col1.metric("Total Catalog Products", len(products_df))
        col2.metric("Wishlist Saves", len(wishlist_df))
        col3.metric("Cart Items", len(cart_df))
        col4.metric("Total Sales Revenue", f"₹{total_revenue:,.2f}")
        
        st.divider()
        
        # Category distribution chart
        st.subheader("Category Distribution")
        cat_counts = products_df['category_slug'].value_counts()
        st.bar_chart(cat_counts)
        
        st.divider()
        
        # Products table inspect
        st.subheader("Product Inventory Inspector")
        st.dataframe(products_df[['id', 'title', 'brand_name', 'category_slug', 'price', 'mrp', 'discount_percent', 'badge']])
        
        conn.close()
    except Exception as e:
        st.error(f"Error connecting to database: {e}")

elif nav_choice == "📄 Docs & Architecture":
    st.markdown("### 📄 Architecture & Edge Case Documentation")
    
    doc_tab1, doc_tab2 = st.tabs(["Architecture Spec", "Edge Case Verification"])
    
    with doc_tab1:
        arch_path = os.path.join(os.path.dirname(__file__), "docs", "architecture.md")
        if os.path.exists(arch_path):
            with open(arch_path, "r", encoding="utf-8") as f:
                st.markdown(f.read())
                
    with doc_tab2:
        edge_path = os.path.join(os.path.dirname(__file__), "docs", "edgecase.md")
        if os.path.exists(edge_path):
            with open(edge_path, "r", encoding="utf-8") as f:
                st.markdown(f.read())
