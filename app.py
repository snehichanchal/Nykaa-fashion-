import streamlit as st
import subprocess
import time
import requests
import os

# Page configuration - wide layout & collapsed sidebar
st.set_page_config(
    page_title="Nykaa Fashion – Online Shopping",
    page_icon="🛍️",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS to hide Streamlit header, footer, and sidebar to render ONLY the Nykaa Storefront
st.markdown(
    """
    <style>
        #MainMenu {visibility: hidden;}
        header {visibility: hidden;}
        footer {visibility: hidden;}
        [data-testid="stSidebar"] {display: none;}
        [data-testid="collapsedControl"] {display: none;}
        .block-container {
            padding-top: 0rem !important;
            padding-bottom: 0rem !important;
            padding-left: 0rem !important;
            padding-right: 0rem !important;
            max-width: 100% !important;
        }
        iframe {
            width: 100% !important;
            border: none !important;
        }
    </style>
    """,
    unsafe_allow_html=True
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

# Render ONLY the Nykaa Fashion Storefront
st.components.v1.iframe(
    src=f"{SERVER_URL}/",
    height=950,
    scrolling=True
)
