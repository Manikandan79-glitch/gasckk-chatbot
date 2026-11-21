import streamlit as st
from streamlit_mic_recorder import speech_to_text
from gasckk_rag import (
    process_rag_query,
    authenticate_or_register_user,
    get_user_prompt_history,
    sync_website_data,
    process_pdf_document
)

st.set_page_config(page_title="GASCKK Academic AI", page_icon="🎓", layout="wide")

if "logged_in" not in st.session_state:
    st.session_state.logged_in = False
if "user_email" not in st.session_state:
    st.session_state.user_email = ""
if "messages" not in st.session_state:
    st.session_state.messages = []
if "scanned_files" not in st.session_state:
    st.session_state.scanned_files = {}

# --- LOGIN SCREEN ---
if not st.session_state.logged_in:
    st.title("🎓 GASCKK AI Assistant Portal")
    col1, col2, _ = st.columns([1, 1, 1])
    with col1:
        email = st.text_input("College Email / User ID:")
        password = st.text_input("Password:", type="password")
        if st.button("Login / Register", use_container_width=True):
            if email and password:
                if authenticate_or_register_user(email, password):
                    st.session_state.logged_in = True
                    st.session_state.user_email = email
                    st.rerun()
                else:
                    st.error("Invalid credentials.")
            else:
                st.warning("Please fill both fields.")
    st.stop()

# --- MAIN SIDEBAR ---
with st.sidebar:
    st.title("⚙️ Control Panel")
    st.write(f"👤 **{st.session_state.user_email}**")
    
    if st.button("🌐 Sync Website Data", use_container_width=True):
        with st.spinner("Scraping college website..."):
            sync_website_data()
            st.success("Website data synced successfully!")

    st.markdown("---")
    st.subheader("📄 Upload Question Papers / Rules")
    uploaded_file = st.file_uploader("Upload PDF", type=["pdf"])
    if uploaded_file:
        if st.button("Process Document", use_container_width=True):
            with st.spinner("Processing & Indexing..."):
                doc_type = process_pdf_document(uploaded_file, st.session_state.scanned_files)
                st.success(f"Indexed as {doc_type} document!")

    st.markdown("---")
    st.subheader("📜 Prompt History")
    history = get_user_prompt_history(st.session_state.user_email)
    for h in history[:5]:
        with st.expander(f"Q: {h['q'][:25]}..."):
            st.caption(f"Time: {h['time']}")
            st.write(h['a'])

    if st.button("🚪 Logout", use_container_width=True):
        st.session_state.logged_in = False
        st.session_state.messages = []
        st.rerun()

# --- CHAT INTERFACE ---
st.title("🏛️ GASCKK Multilingual Academic AI")
st.caption("Ask questions in English or தமிழ் via text or voice.")

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# --- VOICE & TEXT INPUT ROW ---
col_text, col_voice = st.columns([6, 1])

with col_text:
    text_input = st.chat_input("Type your question here...")

with col_voice:
    voice_input = speech_to_text(
        language='ta-IN',
        start_prompt="🎙️ Speak",
        stop_prompt="⏹️ Stop",
        key='voice_btn'
    )

user_query = text_input if text_input else voice_input

if user_query:
    st.session_state.messages.append({"role": "user", "content": user_query})
    with st.chat_message("user"):
        st.markdown(user_query)

    with st.chat_message("assistant"):
        with st.spinner("Processing..."):
            response, _ = process_rag_query(
                user_email=st.session_state.user_email,
                user_input=user_query,
                chat_history_str="",
                scanned_files_dict=st.session_state.scanned_files
            )
            st.markdown(response)

    st.session_state.messages.append({"role": "assistant", "content": response})