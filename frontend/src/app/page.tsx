"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Mic,
  MicOff,
  LogOut,
  User,
  Calendar,
  Globe,
  UploadCloud,
  History,
  Check,
  Copy,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  GraduationCap,
  Database,
  BookOpen,
  Download,
  FileText,
  Camera,
  SwitchCamera,
  CameraOff,
  Zap,
  Code2,
  Play,
  Terminal,
  Smartphone,
  Monitor,
  Maximize2,
  Volume2,
  VolumeX,
  Radio,
  Headphones,
  Loader2,
  Brain,
  Trash2,
  Plus,
  RefreshCw,
  Users,
  Search,
  Building2,
} from "lucide-react";
const API_BASE = "http://127.0.0.1:8000";
interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  time?: string;
}
interface MemoryItem {
  id: string;
  memory: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}
interface FacultyDept {
  dept_name: string;
  dept_name_tamil?: string;
  established: number;
  hod: string;
  hod_tamil?: string;
  faculty: string[];
  lab?: string;
  scope?: string;
}
interface HistoryItem {
  q: string;
  a: string;
  time: string;
}
const DEPARTMENTS = [
  {
    name: "BCA (Computer App)",
    tamilName: "BCA (கணினி பயன்பாட்டியல்)",
    query: "Tell me about the BCA department courses, lab facilities, and scope",
    tamilQuery: "BCA (கணினி பயன்பாட்டியல்) துறையின் பாடப்பிரிவுகள், ஆய்வக வசதிகள் மற்றும் வேலைவாய்ப்புகள் பற்றி விரிவாகக் கூறுங்கள்"
  },
  {
    name: "BBA (Business Admin)",
    tamilName: "BBA (வணிக மேலாண்மை)",
    query: "What are the key subjects and focus of BBA department?",
    tamilQuery: "BBA (வணிக மேலாண்மை) துறையின் முக்கிய பாடங்கள் மற்றும் சிறப்பு அம்சங்கள் என்ன?"
  },
  {
    name: "B.Com (Commerce)",
    tamilName: "B.Com (வணிகவியல்)",
    query: "Details about B.Com department syllabus and career scope",
    tamilQuery: "B.Com (வணிகவியல்) துறையின் பாடத்திட்டம் மற்றும் வேலைவாய்ப்பு விவரங்கள் என்ன?"
  },
  {
    name: "B.Sc Maths",
    tamilName: "B.Sc கணிதம்",
    query: "What subjects are covered in B.Sc Mathematics?",
    tamilQuery: "B.Sc கணிதவியல் (Mathematics) துறையில் உள்ள பாடப்பிரிவுகள் மற்றும் வாய்ப்புகள் என்ன?"
  },
  {
    name: "B.Sc Physics",
    tamilName: "B.Sc இயற்பியல்",
    query: "Tell me about the Physics department and laboratory",
    tamilQuery: "B.Sc இயற்பியல் (Physics) துறை மற்றும் ஆய்வக வசதிகள் பற்றி கூறுங்கள்"
  },
  {
    name: "B.Sc Chemistry",
    tamilName: "B.Sc வேதியியல்",
    query: "Details on Chemistry degree practicals and labs",
    tamilQuery: "B.Sc வேதியியல் (Chemistry) துறையின் செய்முறை வகுப்புகள் மற்றும் ஆய்வகம் பற்றி கூறுங்கள்"
  },
  {
    name: "Tamil Dept",
    tamilName: "தமிழ்த்துறையியல்",
    query: "தமிழ் துறையின் பாடப்பிரிவுகள் மற்றும் சிறப்பு அம்சங்கள் என்ன?",
    tamilQuery: "தமிழ் துறையின் பாடப்பிரிவுகள் மற்றும் சிறப்பு அம்சங்கள் என்ன?"
  },
  {
    name: "English Dept",
    tamilName: "ஆங்கிலத்துறை",
    query: "Information regarding the English Department curriculum",
    tamilQuery: "ஆங்கிலத்துறை (English Department) பாடத்திட்டம் மற்றும் முக்கிய விவரங்கள் என்ன?"
  },
];
// Quick question paper query shortcuts
const QB_QUERIES = [
  {
    label: "Physics Question Paper",
    tamilLabel: "இயற்பியல் வினாத்தாள்",
    query: "Give me the B.Sc Physics university examination question paper in text format (Part A, Part B, Part C)",
    tamilQuery: "B.Sc இயற்பியல் (Physics) பல்கலைக்கழக தேர்வு வினாத்தாளை மாதிரி வடிவத்தில் தருக (Part A, Part B, Part C)"
  },
  {
    label: "BCA Question Paper",
    tamilLabel: "BCA வினாத்தாள்",
    query: "Give me the BCA Programming in C examination question paper in text format (Part A, Part B, Part C)",
    tamilQuery: "BCA Programming in C தேர்வு வினாத்தாளை மாதிரி வடிவத்தில் தருக (Part A, Part B, Part C)"
  },
  {
    label: "B.Com Question Paper",
    tamilLabel: "வணிகவியல் வினாத்தாள்",
    query: "Give me the B.Com Financial Accounting examination question paper in text format (Part A, Part B, Part C)",
    tamilQuery: "B.Com Financial Accounting தேர்வு வினாத்தாளை மாதிரி வடிவத்தில் தருக (Part A, Part B, Part C)"
  },
  {
    label: "Maths Question Paper",
    tamilLabel: "கணிதம் வினாத்தாள்",
    query: "Give me the B.Sc Mathematics Calculus examination question paper in text format (Part A, Part B, Part C)",
    tamilQuery: "B.Sc கணிதம் Calculus தேர்வு வினாத்தாளை மாதிரி வடிவத்தில் தருக (Part A, Part B, Part C)"
  },
];
// Quick Vibe Coding Application Generators
const VIBE_PROMPTS = [
  { label: "🎮 Retro Snake Game (HTML/JS)", query: "Vibe code a complete modern Retro Snake Game in a single HTML file with score counter, dark theme, smooth arrow key & touch controls, and audio effects." },
  { label: "📊 CGPA & Grade Calculator", query: "Vibe code a single-file interactive College CGPA and Grade Calculator web app with dynamic semester subject rows, letter grades, and export result feature." },
  { label: "🎨 Drawing Board App", query: "Vibe code a complete interactive Drawing Board web app in single-file HTML with color picker, brush size slider, eraser, clear canvas, and download image button." },
  { label: "⏱️ Pomodoro Study Timer", query: "Vibe code a beautiful Glassmorphism Pomodoro Study Timer in a single HTML file with custom session lengths, progress ring animation, and start/pause/reset controls." },
  { label: "🐍 Python DSA Visualizer", query: "Write a complete Python program with sample test cases demonstrating Bubble Sort, Binary Search, and Stack operations with step-by-step console visualization." },
];
export default function ChatbotApp() {
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  // Vibe Coding state
  const [isVibeCodingMode, setIsVibeCodingMode] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [copiedCodeSnippet, setCopiedCodeSnippet] = useState<string | null>(null);
  // Sidebar & Modals
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [promptHistory, setPromptHistory] = useState<HistoryItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  // Question Bank Sync state
  const [isQbSyncing, setIsQbSyncing] = useState(false);
  const [qbSyncStatus, setQbSyncStatus] = useState<string | null>(null);
  const [qbProgress, setQbProgress] = useState<{indexed: number; total: number} | null>(null);
  const qbPollRef = useRef<any>(null);
  // Day Order
  const [todayDayOrder, setTodayDayOrder] = useState<string>("Checking calendar...");
  // Voice recognition state
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"ta-IN" | "en-US">("ta-IN");
  const voiceLangRef = useRef<"ta-IN" | "en-US">("ta-IN");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const realtimeRecognitionRef = useRef<any>(null);
  const realtimeActiveRef = useRef<boolean>(false);
  const isVoiceQueryingRef = useRef<boolean>(false);
  const isRecognitionRunningRef = useRef<boolean>(false);
  const restartTimeoutRef = useRef<any>(null);
  const userSpeechRef = useRef<string>("");
  const speechSilenceTimerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechKeepAliveRef = useRef<any>(null);
  // Audio Visualizer Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [liveTextInput, setLiveTextInput] = useState<string>("");
  // Real-time Voice & TTS features
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [realtimeVoiceOpen, setRealtimeVoiceOpen] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [realtimeUserText, setRealtimeUserText] = useState("");
  const [realtimeAiText, setRealtimeAiText] = useState("");
  const [voiceDialogHistory, setVoiceDialogHistory] = useState<{ user: string; ai: string }[]>([]);
  // Student Memory (Mem0) state
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [memoriesList, setMemoriesList] = useState<MemoryItem[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [newMemoryInput, setNewMemoryInput] = useState("");
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [memoryStatusMessage, setMemoryStatusMessage] = useState<string | null>(null);
  // Faculty & Staff Directory state
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [facultyDirectory, setFacultyDirectory] = useState<Record<string, FacultyDept>>({});
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");
  // ChatGPT-style Plus Menu state
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<string>("Reading photo...");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close plus menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    }
    if (isPlusMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPlusMenuOpen]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);
  // Load Day Order for current date
  useEffect(() => {
    async function fetchDayOrder() {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const res = await fetch(`${API_BASE}/api/day-order?date_query=${todayStr}`);
        if (res.ok) {
          const data = await res.json();
          setTodayDayOrder(data.result);
        }
      } catch (err) {
        setTodayDayOrder("Academic Calendar Active");
      }
    }
    fetchDayOrder();
  }, []);

  // Preload speech synthesis voices on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        try { window.speechSynthesis.getVoices(); } catch {}
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Automatic Login: restore verified Gmail session from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedEmail = localStorage.getItem("gasckk_user_email");
        const savedName = localStorage.getItem("gasckk_user_name");
        const savedActive = localStorage.getItem("gasckk_session_active");
        if (savedName && savedName.trim()) {
          setUserName(savedName.trim());
        }
        if (savedActive === "true" && savedEmail && savedEmail.trim()) {
          const email = savedEmail.trim().toLowerCase();
          setUserEmail(email);
          setIsLoggedIn(true);
          fetchHistory(email);
          fetchMemories(email);
        } else if (savedEmail && savedEmail.trim()) {
          // Pre-fill last used email for easy 1-click login
          setUserEmail(savedEmail.trim().toLowerCase());
        }
      } catch (err) {
        console.warn("Auto-login error:", err);
      } finally {
        setIsCheckingAuth(false);
      }
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  // --- OTP STATE ---
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSentMsg, setOtpSentMsg] = useState("");
  // Fetch prompt history
  const fetchHistory = async (email: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/history?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setPromptHistory(data.history || []);
      }
    } catch (err) {
      // Backend may still be starting up — handle gracefully
      console.warn("Backend /api/history is currently unreachable.");
    }
  };
  // Request OTP (or Auto-Login if verified previously)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    const cleanEmail = userEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setAuthError("Please enter your email.");
      setAuthLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.is_guest || data.already_verified) {
          // Automatic login: Already verified once, no OTP required!
          const targetEmail = (data.email || cleanEmail).trim().toLowerCase();
          setUserEmail(targetEmail);
          setIsLoggedIn(true);
          if (typeof window !== "undefined") {
            localStorage.setItem("gasckk_user_email", targetEmail);
            if (userName.trim()) {
              localStorage.setItem("gasckk_user_name", userName.trim());
              try {
                fetch(`${API_BASE}/api/memories/add`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: targetEmail, text: `Student Name: ${userName.trim()}` })
                });
              } catch {}
            }
            localStorage.setItem("gasckk_session_active", "true");
            try {
              const prev = JSON.parse(localStorage.getItem("gasckk_verified_emails") || "[]");
              if (!prev.includes(targetEmail)) {
                localStorage.setItem("gasckk_verified_emails", JSON.stringify([...prev, targetEmail]));
              }
            } catch {}
          }
          fetchHistory(targetEmail);
          fetchMemories(targetEmail);
        } else {
          // First time user: OTP required
          setOtpMode(true);
          setOtpSentMsg(data.message || "Verification code sent to your email!");
        }
      } else {
        setAuthError(data.detail || "Failed to sign in.");
      }
    } catch (err) {
      setAuthError("Failed to connect to backend server. Make sure API is running.");
    } finally {
      setAuthLoading(false);
    }
  };
  // Verify OTP (One-time initial verification)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    const cleanEmail = userEmail.trim().toLowerCase();
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, code: otpCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsLoggedIn(true);
        setUserEmail(cleanEmail);
        if (typeof window !== "undefined") {
          localStorage.setItem("gasckk_user_email", cleanEmail);
          if (userName.trim()) {
            localStorage.setItem("gasckk_user_name", userName.trim());
            try {
              fetch(`${API_BASE}/api/memories/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: cleanEmail, text: `Student Name: ${userName.trim()}` })
              });
            } catch {}
          }
          localStorage.setItem("gasckk_session_active", "true");
          try {
            const prev = JSON.parse(localStorage.getItem("gasckk_verified_emails") || "[]");
            if (!prev.includes(cleanEmail)) {
              localStorage.setItem("gasckk_verified_emails", JSON.stringify([...prev, cleanEmail]));
            }
          } catch {}
        }
        fetchHistory(cleanEmail);
        fetchMemories(cleanEmail);
      } else {
        setAuthError(data.detail || "Invalid code.");
      }
    } catch (err) {
      setAuthError("Failed to connect to backend server.");
    } finally {
      setAuthLoading(false);
    }
  };
  // Quick Guest Login
  const handleGuestLogin = () => {
    const guestEmail = "student@gasckk.edu.in";
    const guestName = userName.trim() || "Student";
    setUserEmail(guestEmail);
    if (!userName.trim()) setUserName(guestName);
    setIsLoggedIn(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("gasckk_user_email", guestEmail);
      localStorage.setItem("gasckk_user_name", guestName);
      localStorage.setItem("gasckk_session_active", "true");
    }
    fetchHistory(guestEmail);
    fetchMemories(guestEmail);
  };
  // Logout
  const handleLogout = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("gasckk_session_active");
      } catch (err) {}
    }
    setIsLoggedIn(false);
    setOtpCode("");
    setOtpMode(false);
    setMessages([]);
    setMemoriesList([]);
  };

  // Fetch Student Memories from mem0
  const fetchMemories = async (emailOverride?: string) => {
    const emailToUse = emailOverride || userEmail || "student@gasckk.edu.in";
    setIsLoadingMemories(true);
    try {
      const res = await fetch(`${API_BASE}/api/memories?email=${encodeURIComponent(emailToUse)}`);
      if (res.ok) {
        const data = await res.json();
        setMemoriesList(data.memories || []);
      }
    } catch (err) {
      // Backend may still be starting up — handle gracefully
      console.warn("Backend /api/memories is currently unreachable.");
    } finally {
      setIsLoadingMemories(false);
    }
  };

  // Add a manual memory fact
  const handleAddDirectMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryInput.trim()) return;
    const emailToUse = userEmail || "student@gasckk.edu.in";
    setIsAddingMemory(true);
    try {
      const res = await fetch(`${API_BASE}/api/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse, text: newMemoryInput.trim() }),
      });
      if (res.ok) {
        setNewMemoryInput("");
        setMemoryStatusMessage("Memory fact added successfully! / விவரம் சேர்க்கப்பட்டது!");
        setTimeout(() => setMemoryStatusMessage(null), 3000);
        await fetchMemories(emailToUse);
      }
    } catch (err) {
      console.error("Error adding memory:", err);
    } finally {
      setIsAddingMemory(false);
    }
  };

  // Delete a single memory item
  const handleDeleteSingleMemory = async (memoryId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/memories/item/${encodeURIComponent(memoryId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMemoriesList((prev) => prev.filter((m) => m.id !== memoryId));
        setMemoryStatusMessage("Memory deleted / நினைவு நீக்கப்பட்டது.");
        setTimeout(() => setMemoryStatusMessage(null), 3000);
      }
    } catch (err) {
      console.error("Error deleting memory item:", err);
    }
  };

  // Clear all memories for student
  const handleClearAllMemories = async () => {
    if (!confirm("Are you sure you want to clear all personal memories stored for your profile? / உங்கள் சுயவிவரத்திற்கான அனைத்து நினைவுகளையும் அழிக்க விரும்புகிறீர்களா?")) return;
    const emailToUse = userEmail || "student@gasckk.edu.in";
    setIsLoadingMemories(true);
    try {
      const res = await fetch(`${API_BASE}/api/memories?email=${encodeURIComponent(emailToUse)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMemoriesList([]);
        setMemoryStatusMessage("All memories cleared / அனைத்து நினைவுகளும் அழிக்கப்பட்டன.");
        setTimeout(() => setMemoryStatusMessage(null), 3000);
      }
    } catch (err) {
      console.error("Error clearing memories:", err);
    } finally {
      setIsLoadingMemories(false);
    }
  };

  // Fetch Faculty Directory from API
  const fetchFacultyDirectory = async () => {
    setIsLoadingFaculty(true);
    try {
      const res = await fetch(`${API_BASE}/api/faculty-directory`);
      if (res.ok) {
        const data = await res.json();
        setFacultyDirectory(data.departments || {});
      }
    } catch (err) {
      console.error("Error fetching faculty directory:", err);
    } finally {
      setIsLoadingFaculty(false);
    }
  };

  // Send message
  const handleSend = async (queryText?: string) => {
    const text = queryText || inputQuery;
    if (!text.trim() || isLoading) return;
    const userMsg: Message = {
      role: "user",
      content: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputQuery("");
    setIsLoading(true);
    const queryToSend = isVibeCodingMode && !text.toLowerCase().includes("vibe") && !text.toLowerCase().includes("code")
      ? `[VIBE CODING MODE: Please generate complete, production-ready, single-file runnable code with modern styling, clean UI, and interactive controls] ${text}`
      : text;
    const recentHistoryStr = messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "Student" : "GASCKK AI"}: ${m.content}`)
      .join("\n\n");

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail || "student@gasckk.edu.in",
          query: queryToSend,
          language: voiceLang,
          chat_history: recentHistoryStr,
        }),
      });
      if (!res.ok) {
        throw new Error("Server error processing query");
      }
      const data = await res.json();
      let answerText = "";
      if (typeof data.answer === "string") {
        answerText = data.answer;
      } else if (Array.isArray(data.answer)) {
        answerText = data.answer
          .map((x: any) => (typeof x === "string" ? x : x.text || JSON.stringify(x)))
          .join("\n");
      } else if (data.answer) {
        answerText = JSON.stringify(data.answer);
      } else {
        answerText = "No response generated.";
      }
      const botMsg: Message = {
        role: "assistant",
        content: answerText,
        sources: data.sources || [],
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
      fetchHistory(userEmail || "student@gasckk.edu.in");
      setTimeout(() => fetchMemories(userEmail || "student@gasckk.edu.in"), 1500);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ **Error connecting to AI engine.** Please verify that the backend server is running on port 8000.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  // Clean markdown & emojis for smooth natural speech
  const cleanTextForSpeech = (raw: string): string => {
    return raw
      .replace(/\*\*GASCKK AI:\*\*/gi, "")
      .replace(/GASCKK AI:/gi, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*#_~>|•]/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const clearSpeechKeepAlive = () => {
    if (speechKeepAliveRef.current) {
      clearInterval(speechKeepAliveRef.current);
      speechKeepAliveRef.current = null;
    }
  };

  // High-Fidelity Backend Neural TTS (guarantees native Tamil audio on Windows PCs)
  const playBackendTTS = async (text: string, lang: string, onFinish?: () => void) => {
    let finished = false;
    let safetyTimer: any = null;

    const finishAudio = () => {
      if (finished) return;
      finished = true;
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      setIsSpeaking(false);
      setSpeakingIndex(null);
      if (audioPlayerRef.current) {
        try { audioPlayerRef.current.pause(); } catch {}
        audioPlayerRef.current = null;
      }
      if (onFinish) onFinish();
    };

    // Safety timeout: prevents staying stuck on SPEAKING if audio playback hangs
    safetyTimer = setTimeout(() => {
      console.warn("TTS safety timer triggered to prevent hanging");
      finishAudio();
    }, 15000);

    try {
      setIsSpeaking(true);
      if (realtimeVoiceOpen) setRealtimeStatus("speaking");
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.currentTime = 0;
        } catch {}
        audioPlayerRef.current = null;
      }

      // Truncate cleanly up to ~350 characters at sentence or word boundary for snappy voice playback
      let speakSlice = text.trim();
      if (speakSlice.length > 350) {
        const lastPeriod = speakSlice.lastIndexOf(".", 350);
        if (lastPeriod > 80) {
          speakSlice = speakSlice.slice(0, lastPeriod + 1);
        } else {
          const lastSpace = speakSlice.lastIndexOf(" ", 350);
          if (lastSpace > 80) {
            speakSlice = speakSlice.slice(0, lastSpace);
          } else {
            speakSlice = speakSlice.slice(0, 350);
          }
        }
      }
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speakSlice, lang }),
      });

      if (!res.ok) throw new Error("TTS endpoint error");
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        finishAudio();
      };

      audio.onerror = (e) => {
        console.warn("Audio element playback error:", e);
        URL.revokeObjectURL(audioUrl);
        finishAudio();
      };

      try {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("audio.play() promise rejected:", err);
            finishAudio();
          });
        }
      } catch (err) {
        console.warn("audio.play() sync throw:", err);
        finishAudio();
      }
    } catch (e) {
      console.warn("Backend TTS playback error:", e);
      finishAudio();
    }
  };

  // Instant, High-Quality Voice Synthesis (Single-Voice Guaranteed with Tamil Neural TTS)
  const speakText = (text: string, index?: number, onFinish?: () => void) => {
    if (typeof window === "undefined") {
      if (onFinish) onFinish();
      return;
    }

    // 1. Immediately cancel any currently playing speech to guarantee only ONE voice speaks
    clearSpeechKeepAlive();
    currentUtteranceRef.current = null;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch {}
      audioPlayerRef.current = null;
    }

    const clean = cleanTextForSpeech(text);
    if (!clean) {
      setIsSpeaking(false);
      setSpeakingIndex(null);
      if (onFinish) onFinish();
      return;
    }

    setIsSpeaking(true);
    if (index !== undefined) setSpeakingIndex(index);
    if (realtimeVoiceOpen) setRealtimeStatus("speaking");

    const isTamilText = /[\u0B80-\u0BFF]/.test(clean);

    // 2. For any Tamil text, ALWAYS use backend Google TTS (gTTS) because Windows SpeechSynthesis lacks native Tamil voice pack
    if (isTamilText) {
      playBackendTTS(clean, "ta", onFinish);
      return;
    }

    // 4. If browser doesn't have SpeechSynthesis, fallback to backend TTS
    if (!("speechSynthesis" in window)) {
      playBackendTTS(clean, isTamilText ? "ta" : "en", onFinish);
      return;
    }

    let speechEnded = false;
    let speechSafetyTimer: any = null;

    const handleSpeechEnd = () => {
      if (speechEnded) return;
      speechEnded = true;
      if (speechSafetyTimer) {
        clearTimeout(speechSafetyTimer);
        speechSafetyTimer = null;
      }
      clearSpeechKeepAlive();
      currentUtteranceRef.current = null;
      setIsSpeaking(false);
      setSpeakingIndex(null);
      if (onFinish) onFinish();
    };

    speechSafetyTimer = setTimeout(() => {
      console.warn("SpeechSynthesis safety timeout triggered");
      handleSpeechEnd();
    }, Math.max(6000, clean.length * 150));

    const utterance = new SpeechSynthesisUtterance(clean);
    currentUtteranceRef.current = utterance;
    utterance.lang = isTamilText ? "ta-IN" : "en-US";
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      if (isTamilText) {
        const tamilVoice = voices.find((v) =>
          v.lang.toLowerCase().includes("ta") || v.name.toLowerCase().includes("tamil")
        );
        if (tamilVoice) utterance.voice = tamilVoice;
      } else {
        const englishVoice = voices.find((v) =>
          v.lang.toLowerCase().startsWith("en") &&
          (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Online") || v.name.includes("David") || v.name.includes("Zira") || v.name.includes("Samantha"))
        ) || voices.find((v) => v.lang.toLowerCase().startsWith("en"));
        if (englishVoice) utterance.voice = englishVoice;
      }
    }

    utterance.onend = handleSpeechEnd;
    utterance.onerror = (e) => {
      console.warn("SpeechSynthesis error, falling back to /api/tts:", e);
      if (speechSafetyTimer) clearTimeout(speechSafetyTimer);
      playBackendTTS(clean, isTamilText ? "ta" : "en", onFinish);
    };

    speechKeepAliveRef.current = setInterval(() => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearSpeechKeepAlive();
        }
      }
    }, 4500);

    window.speechSynthesis.speak(utterance);
  };

  // Stop Speaking
  const stopSpeaking = () => {
    clearSpeechKeepAlive();
    currentUtteranceRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch {}
      audioPlayerRef.current = null;
    }
    setIsSpeaking(false);
    setSpeakingIndex(null);
    if (realtimeVoiceOpen && realtimeStatus === "speaking") {
      setRealtimeStatus("idle");
    }
  };

  // Safely stop and disconnect any active real-time speech recognition
  const stopRealtimeRecognition = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (speechSilenceTimerRef.current) {
      clearTimeout(speechSilenceTimerRef.current);
      speechSilenceTimerRef.current = null;
    }
    if (realtimeRecognitionRef.current) {
      try {
        realtimeRecognitionRef.current.onstart = null;
        realtimeRecognitionRef.current.onresult = null;
        realtimeRecognitionRef.current.onerror = null;
        realtimeRecognitionRef.current.onend = null;
        realtimeRecognitionRef.current.onspeechstart = null;
        realtimeRecognitionRef.current.onspeechend = null;
        realtimeRecognitionRef.current.abort();
      } catch {}
      realtimeRecognitionRef.current = null;
    }
    isRecognitionRunningRef.current = false;
  };

  // Continuous Real-Time Voice Listener (Using Web Speech API with clean turn handling)
  const listenForUserVoice = (overrideLang?: "ta-IN" | "en-US") => {
    if (!realtimeActiveRef.current || isVoiceQueryingRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Please use Google Chrome or Microsoft Edge for live voice features.");
      return;
    }

    stopRealtimeRecognition();

    try {
      const rec = new SpeechRecognition();
      const currentLang = overrideLang || voiceLangRef.current || voiceLang || "ta-IN";
      rec.lang = currentLang;
      // Note: continuous=false ensures Chrome finalizes utterances cleanly and triggers onend reliably on Windows
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        isRecognitionRunningRef.current = true;
        if (realtimeActiveRef.current && !isVoiceQueryingRef.current) {
          setRealtimeStatus("listening");
        }
      };

      rec.onspeechstart = () => {
        setMicVolume(45);
      };

      rec.onspeechend = () => {
        setMicVolume(0);
      };

      rec.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript + " ";
        }
        const cleaned = transcript.trim();
        if (cleaned) {
          userSpeechRef.current = cleaned;
          setRealtimeUserText(cleaned);
          setMicVolume(65);

          // User paused speaking: auto-submit after 1200ms of silence
          if (speechSilenceTimerRef.current) clearTimeout(speechSilenceTimerRef.current);
          speechSilenceTimerRef.current = setTimeout(() => {
            if (realtimeActiveRef.current && !isVoiceQueryingRef.current && userSpeechRef.current.trim()) {
              const toSend = userSpeechRef.current.trim();
              userSpeechRef.current = "";
              stopRealtimeRecognition();
              isVoiceQueryingRef.current = true;
              executeRealtimeQuery(toSend);
            }
          }, 1200);
        }
      };

      rec.onerror = (event: any) => {
        console.warn("Speech recognition notice:", event.error);
        isRecognitionRunningRef.current = false;
        if (event.error === "no-speech") {
          // Normal silence, don't show error banner
          return;
        }
        if (event.error === "aborted") {
          return;
        }
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setRealtimeUserText("⚠️ Mic access denied by Chrome. Please check chrome://settings/content/microphone");
          return;
        }
        if (event.error === "audio-capture") {
          setRealtimeUserText("⚠️ No microphone hardware found or mic is disabled in Windows Sound Settings.");
          return;
        }
        if (event.error === "network") {
          setRealtimeUserText("⚠️ Speech recognition network connection notice. Please check your internet connection.");
          return;
        }
        setRealtimeUserText(`Voice notice: ${event.error}`);
      };

      rec.onend = () => {
        isRecognitionRunningRef.current = false;
        setMicVolume(0);
        if (!realtimeActiveRef.current || isVoiceQueryingRef.current) return;

        // If user finished speech and onend triggered
        if (userSpeechRef.current.trim()) {
          const toSend = userSpeechRef.current.trim();
          userSpeechRef.current = "";
          stopRealtimeRecognition();
          isVoiceQueryingRef.current = true;
          executeRealtimeQuery(toSend);
        } else {
          // Restart listening loop cleanly after small gap so Chrome releases handle
          if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (realtimeActiveRef.current && !isVoiceQueryingRef.current && !isRecognitionRunningRef.current) {
              listenForUserVoice();
            }
          }, 250);
        }
      };

      realtimeRecognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn("listenForUserVoice exception:", err);
      isRecognitionRunningRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = setTimeout(() => {
        if (realtimeActiveRef.current && !isVoiceQueryingRef.current && !isRecognitionRunningRef.current) {
          listenForUserVoice();
        }
      }, 400);
    }
  };

  // Open & Start Continuous Live Voice Conversation
  const startRealtimeVoice = async () => {
    stopSpeaking();
    stopRealtimeRecognition();
    realtimeActiveRef.current = true;
    isVoiceQueryingRef.current = false;
    userSpeechRef.current = "";
    setRealtimeVoiceOpen(true);
    setRealtimeStatus("listening");
    setRealtimeUserText("");
    setRealtimeAiText("");
    setMicVolume(0);

    // If getUserMedia is used, give browser 200ms to fully release the audio device before starting Web Speech
    if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err: any) {
        console.warn("getUserMedia error:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setRealtimeUserText("⚠️ Microphone access was blocked by browser. Please check Chrome address bar permissions.");
          return;
        }
      }
    }

    setTimeout(() => {
      if (realtimeActiveRef.current) {
        listenForUserVoice();
      }
    }, 250);
  };

  // Execute query in Real-Time Voice Mode
  const executeRealtimeQuery = async (queryText: string) => {
    setRealtimeStatus("thinking");
    setRealtimeAiText("Thinking...");
    try {
      // Build previous conversation transcript for context continuity
      const historyTranscript = voiceDialogHistory
        .slice(-4)
        .map(h => `Student: ${h.user}\nGASCKK AI: ${h.ai}`)
        .join("\n\n");

      const voicePrompt = `[VOICE ASSISTANT MODE: You are GASCKK Academic AI assistant for Government Arts and Science College Palkulam. Always identify as GASCKK AI. Respond concisely in 1-2 direct, natural sentences in the same language as the user's question] ${queryText}`;
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail || "student@gasckk.edu.in",
          query: voicePrompt,
          language: voiceLang,
          chat_history: historyTranscript,
        }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      let answerText = typeof data.answer === "string" ? data.answer : "No answer generated.";
      setRealtimeAiText(answerText);
      setRealtimeStatus("speaking");
      setVoiceDialogHistory(prev => [...prev.slice(-6), { user: queryText, ai: answerText }]);

      // Append to chat history
      const userMsg: Message = {
        role: "user",
        content: `🎙️ ${queryText}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      const botMsg: Message = {
        role: "assistant",
        content: answerText,
        sources: data.sources || [],
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg, botMsg]);

      // Speak response aloud, then CONTINUOUSLY RESUME LISTENING for the next question!
      speakText(answerText, undefined, () => {
        isVoiceQueryingRef.current = false;
        if (realtimeActiveRef.current) {
          setTimeout(() => {
            if (realtimeActiveRef.current) {
              setRealtimeUserText("");
              setRealtimeStatus("listening");
              listenForUserVoice();
            }
          }, 350);
        }
      });
    } catch (err) {
      setRealtimeAiText("Error connecting to server. Please speak again.");
      isVoiceQueryingRef.current = false;
      setTimeout(() => {
        if (realtimeActiveRef.current) {
          setRealtimeUserText("");
          setRealtimeStatus("listening");
          listenForUserVoice();
        }
      }, 1000);
    }
  };

  // Close Real-Time Voice Mode
  const closeRealtimeVoice = () => {
    realtimeActiveRef.current = false;
    isVoiceQueryingRef.current = false;
    stopRealtimeRecognition();
    setMicVolume(0);
    stopSpeaking();
    setRealtimeVoiceOpen(false);
    setRealtimeStatus("idle");
    setRealtimeUserText("");
    setRealtimeAiText("");
  };
  // Speech Recognition (Web Speech API)
  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = voiceLang; // 'ta-IN' for Tamil, 'en-US' for English
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => {
        setIsListening(true);
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputQuery((prev) => (prev ? prev + " " + transcript : transcript));
      };
      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setVoiceError("🎤 Microphone permission was blocked. Please click the site settings/lock icon in your browser URL bar to allow microphone access.");
          setTimeout(() => setVoiceError(null), 8000);
        } else if (event.error === "no-speech") {
          // User did not say anything, silence error
        } else if (event.error === "aborted") {
          // User aborted, silence error
        } else {
          setVoiceError(`Voice input notice: ${event.error}`);
          setTimeout(() => setVoiceError(null), 5000);
        }
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setVoiceError("Could not start speech recognition in this browser.");
      setTimeout(() => setVoiceError(null), 5000);
    }
  };
  // Sync College Website
  const handleSyncWebsite = async () => {
    setIsSyncing(true);
    setSyncStatus("Crawling college portal...");
    try {
      const res = await fetch(`${API_BASE}/api/sync-website`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncStatus("✅ Synced successfully!");
      } else {
        setSyncStatus(`❌ ${data.detail || "Sync failed"}`);
      }
    } catch (err) {
      setSyncStatus("❌ Connection error");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };
  // Sync Question Bank - crawl & index ALL department question papers
  const handleSyncQuestionBank = async () => {
    setIsQbSyncing(true);
    setQbSyncStatus("Starting question bank crawl...");
    setQbProgress(null);
    try {
      const res = await fetch(`${API_BASE}/api/sync-questionbank`, { method: "POST" });
      if (!res.ok) {
        setQbSyncStatus("❌ Failed to start sync");
        setIsQbSyncing(false);
        return;
      }
      // Poll status every 3 seconds until done
      const poll = async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/api/sync-questionbank/status`);
          if (statusRes.ok) {
            const data = await statusRes.json();
            const st = data.status;
            setQbSyncStatus(st.message);
            if (st.indexed > 0) {
              setQbProgress({ indexed: st.indexed, total: st.total });
            }
            if (st.running) {
              qbPollRef.current = setTimeout(poll, 3000);
            } else {
              setIsQbSyncing(false);
              setTimeout(() => {
                setQbSyncStatus(null);
                setQbProgress(null);
              }, 8000);
            }
          }
        } catch {
          setIsQbSyncing(false);
        }
      };
      qbPollRef.current = setTimeout(poll, 2000);
    } catch (err) {
      setQbSyncStatus("❌ Connection error");
      setIsQbSyncing(false);
    }
  };
  // PDF Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadStatus("Uploading & Indexing into Vector DB...");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/upload-pdf`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus(`✅ ${file.name} indexed!`);
      } else {
        setUploadStatus(`❌ ${data.detail || "Upload failed"}`);
      }
    } catch (err) {
      setUploadStatus("❌ Upload error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setUploadStatus(null), 4000);
    }
  };
  // Copy text helper
  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  const [downloadingPdfIndex, setDownloadingPdfIndex] = useState<number | null>(null);
  // Download question paper as PDF helper
  const handleDownloadPdf = async (content: string, index: number) => {
    setDownloadingPdfIndex(index);
    try {
      const firstLine = content.split("\n")[0] || "University Examination Question Paper";
      const cleanTitle = firstLine.replace(/[*#]/g, "").trim().slice(0, 60);
      const res = await fetch(`${API_BASE}/api/export-question-paper-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          content: content,
          filename: "GASCKK_Question_Paper.pdf",
        }),
      });
      if (!res.ok) throw new Error("Failed to export PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "GASCKK_Question_Paper.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error generating PDF. Please ensure the backend server is running.");
    } finally {
      setDownloadingPdfIndex(null);
    }
  };
  // --- CAMERA FUNCTIONS ---
  const openCamera = async () => {
    setCameraError(null);
    setCapturedImage(null);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError("Camera access denied. Please allow camera permission in your browser settings.");
    }
  };
  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCapturedImage(null);
    setCameraError(null);
    setIsAnalyzingImage(false);
  };
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Scale image down to max 960px to make upload & analysis 10x faster while keeping crisp text
    const maxDim = 960;
    let targetW = video.videoWidth || 640;
    let targetH = video.videoHeight || 480;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, targetW, targetH);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      setCapturedImage(dataUrl);
      // Stop camera stream after capture
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };
  const analyzePhoto = async () => {
    if (!capturedImage) return;
    setIsAnalyzingImage(true);
    setAnalyzeStatus("Reading photo text...");
    const statusTimer = setTimeout(() => {
      setAnalyzeStatus("Generating answer...");
    }, 2500);
    try {
      const res = await fetch(`${API_BASE}/api/analyze-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: capturedImage,
          prompt: "Read all questions or text from this image and provide complete, detailed answers in the same language (Tamil / English).",
          email: userEmail,
        }),
      });
      clearTimeout(statusTimer);
      const data = await res.json();
      if (res.ok && data.answer) {
        const photoMsg: Message = {
          role: "user",
          content: "📸 [Photo uploaded — Question from camera]",
          time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        };
        const answerMsg: Message = {
          role: "assistant",
          content: data.answer,
          time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages(prev => [...prev, photoMsg, answerMsg]);
        closeCamera();
      } else {
        setCameraError(`Analysis failed: ${data.detail || "Unknown error"}`);
        setIsAnalyzingImage(false);
      }
    } catch (err) {
      clearTimeout(statusTimer);
      setCameraError("Could not connect to backend. Ensure the server is running.");
      setIsAnalyzingImage(false);
    }
  };
  // --- VIBE CODING DOWNLOAD HELPER ---
  const handleDownloadCode = (code: string, lang: string) => {
    const cleanLang = (lang || "").toLowerCase();
    const ext = cleanLang === "python" || cleanLang === "py" ? "py"
      : cleanLang === "javascript" || cleanLang === "js" ? "js"
      : cleanLang === "css" ? "css"
      : cleanLang === "sql" ? "sql"
      : cleanLang === "c" || cleanLang === "cpp" ? "c"
      : cleanLang === "java" ? "java"
      : "html";
    const filename = `gasckk_vibe_app.${ext}`;
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  // --- SESSION CHECK SCREEN ---
  if (isCheckingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-radial from-slate-900 via-slate-950 to-black p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500/30 border-t-blue-500" />
          <p className="text-sm font-medium text-slate-300">Restoring session / அமர்வு தொடங்குகிறது...</p>
        </div>
      </main>
    );
  }

  // --- LOGIN SCREEN ---
  if (!isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-radial from-slate-900 via-slate-950 to-black p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 h-24 w-24 overflow-hidden rounded-full border-2 border-amber-600/50 bg-stone-900 p-1 shadow-lg shadow-amber-950/40">
              <Image
                src="/college_logo.svg"
                alt="GASCKK Logo"
                fill
                sizes="96px"
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              GASCKK Academic AI
            </h1>
            <p className="mt-1 text-xs text-blue-400 font-medium">
              அரசு கலை மற்றும் அறிவியல் கல்லூரி, பால்குளம்
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Government Arts and Science College Assistant
            </p>
          </div>
          <form onSubmit={otpMode ? handleVerifyOtp : handleRequestOtp} className="mt-8 space-y-4">
            {authError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {authError}
              </div>
            )}
            {otpSentMsg && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
                {otpSentMsg}
              </div>
            )}
            {!otpMode ? (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Your Name / உங்கள் பெயர்
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Manikandan, Priya, Arun..."
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Email / Gmail ID
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="name@gmail.com or student@gasckk.edu.in"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    ✓ One-time verification only. Previously verified accounts log in automatically without OTP.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Enter 6-digit Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white placeholder-slate-600 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => { setOtpMode(false); setAuthError(""); setOtpSentMsg(""); setOtpCode(""); }}
                  className="mt-2 text-xs text-blue-400 hover:underline"
                >
                  ← Use a different email
                </button>
              </div>
            )}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50"
            >
              {authLoading ? "Signing in..." : (otpMode ? "Verify Code & Login" : "Continue / Login →")}
            </button>
            {!otpMode && (
              <button
                type="button"
                onClick={handleGuestLogin}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/40 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                Quick Access as Guest Student 🚀
              </button>
            )}
          </form>
          <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <span>Powered by GASCKK Academic Intelligence Engine</span>
            <span>•</span>
            <span>English & தமிழ்</span>
          </div>
        </div>
      </main>
    );
  }
  // --- MAIN CHAT DASHBOARD ---
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* SIDEBAR BACKDROP ON MOBILE */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}
      {/* LEFT SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-slate-900/95 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* College Header in Sidebar */}
        <div className="flex items-center gap-3 border-b border-slate-800 p-4">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-amber-600/40 bg-stone-900 p-0.5 shadow-sm">
            <Image
              src="/college_logo.svg"
              alt="GASCKK Logo"
              fill
              sizes="40px"
              className="object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-white">GASCKK AI Portal</h2>
            <p className="truncate text-xs text-blue-400">Palkulam College</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* User profile info with Logout button */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white uppercase shadow-sm shrink-0">
              {userName ? userName.charAt(0) : (userEmail ? userEmail.charAt(0) : "U")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Signed in as</p>
              <p className="truncate text-xs font-semibold text-slate-100" title={userName || userEmail}>
                {userName ? `👋 ${userName}` : (userEmail || "Student")}
              </p>
              {userName && (
                <p className="truncate text-[10px] text-slate-400" title={userEmail}>
                  {userEmail}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-950/30 px-2 py-1 text-[11px] font-semibold text-red-300 hover:border-red-500/70 hover:bg-red-900/50 hover:text-white transition shadow-xs shrink-0"
            title="Log out of this account"
          >
            <LogOut className="h-3 w-3 text-red-400" />
            <span>Logout</span>
          </button>
        </div>
        {/* Student Memory Quick Panel Button in Sidebar */}
        <div className="border-b border-slate-800/80 bg-gradient-to-r from-pink-950/20 via-purple-950/20 to-blue-950/20 p-3">
          <button
            onClick={() => {
              setIsMemoryModalOpen(true);
              fetchMemories();
              setSidebarOpen(false);
            }}
            className="group flex w-full items-center justify-between rounded-xl border border-pink-500/30 bg-slate-900/90 p-2.5 text-left transition hover:border-pink-500/60 hover:bg-slate-800 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400 group-hover:scale-105 transition">
                <Brain className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">My Memory / என் தகவல்கள்</span>
                  <span className="rounded-full bg-pink-500/20 px-1.5 py-0.2 text-[10px] font-bold text-pink-300 border border-pink-500/30">
                    {memoriesList.length}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">View what AI remembers</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-pink-400 group-hover:translate-x-0.5 transition" />
          </button>
        </div>
        {/* Sidebar scrollable tools */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4 text-xs">
          {/* Calendar & Day order indicator */}
          <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-3">
            <div className="flex items-center gap-2 font-medium text-blue-400">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>College Calendar</span>
            </div>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">{todayDayOrder}</p>
          </div>
          {/* Quick Departments */}
          <div>
            <div className="flex items-center justify-between font-semibold uppercase tracking-wider text-slate-400">
              <span>Departments & Scope</span>
            </div>
            <div className="mt-2 space-y-1">
              {/* Full Faculty Directory Modal Button */}
              <button
                onClick={() => {
                  setIsFacultyModalOpen(true);
                  fetchFacultyDirectory();
                  setSidebarOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-blue-500/40 bg-gradient-to-r from-blue-950/60 to-indigo-950/60 px-2.5 py-2 text-left font-bold text-blue-300 transition hover:bg-blue-900/50 hover:text-white shadow-sm mb-2"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-blue-400" />
                  <span>🏛️ Faculty Directory (8 Depts)</span>
                </div>
                <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-200">
                  ALL
                </span>
              </button>
              {DEPARTMENTS.map((dept, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const q = voiceLang === "ta-IN" ? (dept.tamilQuery || dept.query) : dept.query;
                    handleSend(q);
                    setSidebarOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  <span className="truncate">{voiceLang === "ta-IN" && dept.tamilName ? dept.tamilName : dept.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                </button>
              ))}
            </div>
          </div>
          {/* College Knowledge Sync - ADMIN ONLY */}
          {userEmail === "admin@gasckk.edu.in" && (
          <div>
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Admin & Documents
            </span>
            <div className="mt-2 space-y-2">
              <button
                onClick={handleSyncWebsite}
                disabled={isSyncing}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-200 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
              >
                <Globe className={`h-4 w-4 text-emerald-400 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Syncing Web Data..." : "Sync College Website"}</span>
              </button>
              {syncStatus && (
                <p className="text-[11px] text-emerald-400 font-medium">{syncStatus}</p>
              )}
              {/* Upload PDF */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-200 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
              >
                <UploadCloud className="h-4 w-4 text-blue-400" />
                <span>{isUploading ? "Processing PDF..." : "Upload Syllabus / PDF"}</span>
              </button>
              {uploadStatus && (
                <p className="text-[11px] text-blue-400 font-medium">{uploadStatus}</p>
              )}
              {/* Sync Question Bank */}
              <button
                onClick={handleSyncQuestionBank}
                disabled={isQbSyncing}
                className="flex w-full items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-amber-300 transition hover:bg-amber-900/30 hover:text-white disabled:opacity-50"
              >
                <Database className={`h-4 w-4 text-amber-400 ${isQbSyncing ? "animate-pulse" : ""}`} />
                <span className="text-xs">
                  {isQbSyncing ? "Syncing Question Bank..." : "Sync Question Bank (All Depts)"}
                </span>
              </button>
              {isQbSyncing && qbProgress && (
                <div className="mt-1 space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-slate-700">
                    <div
                      className="h-1.5 rounded-full bg-amber-500 transition-all duration-500"
                      style={{ width: qbProgress.total > 0 ? `${Math.min(100, (qbProgress.indexed / qbProgress.total) * 100)}%` : "10%" }}
                    />
                  </div>
                  <p className="text-[10px] text-amber-400">{qbProgress.indexed} papers indexed</p>
                </div>
              )}
              {qbSyncStatus && !isQbSyncing && (
                <p className="text-[11px] text-amber-400 font-medium">{qbSyncStatus}</p>
              )}
            </div>
          </div>
          )}
          {/* Question Paper Quick Access */}
          <div>
            <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-slate-400">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Question Papers</span>
            </div>
            <div className="mt-2 space-y-1">
              {QB_QUERIES.map((qb, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const q = voiceLang === "ta-IN" ? (qb.tamilQuery || qb.query) : qb.query;
                    handleSend(q);
                    setSidebarOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-amber-200/80 transition hover:bg-amber-900/20 hover:text-white"
                >
                  <span className="truncate text-xs">{voiceLang === "ta-IN" && qb.tamilLabel ? qb.tamilLabel : qb.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                </button>
              ))}
              <p className="mt-1 text-[10px] text-slate-500 italic">
                💡 First click "Sync Question Bank" to index all papers.
              </p>
            </div>
          </div>
          {/* Vibe Coding Studio */}
          <div>
            <div className="flex items-center justify-between font-semibold uppercase tracking-wider text-purple-400 text-xs">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 fill-purple-400 text-purple-400" />
                Vibe Coding Studio
              </span>
              <span className="rounded bg-purple-900/50 px-1.5 py-0.5 text-[9px] font-bold text-purple-300 border border-purple-700/40">
                PRO
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {VIBE_PROMPTS.map((vp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsVibeCodingMode(true);
                    handleSend(vp.query);
                    setSidebarOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-purple-200/90 transition hover:bg-purple-900/30 hover:text-white"
                >
                  <span className="truncate text-xs">{vp.label}</span>
                  <Code2 className="h-3.5 w-3.5 shrink-0 opacity-60 text-purple-400" />
                </button>
              ))}
            </div>
          </div>
          {/* Prompt History */}
          {promptHistory.length > 0 && (
            <div>
              <div className="flex items-center justify-between font-semibold uppercase tracking-wider text-slate-400">
                <span>Recent History</span>
                <History className="h-3.5 w-3.5" />
              </div>
              <div className="mt-2 space-y-1.5">
                {promptHistory.slice(0, 6).map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      handleSend(item.q);
                      setSidebarOpen(false);
                    }}
                    className="w-full rounded-lg bg-slate-800/30 p-2 text-left transition hover:bg-slate-800"
                  >
                    <p className="truncate text-xs text-slate-200">{item.q}</p>
                    <p className="text-[10px] text-slate-500">{item.time}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Logout button at bottom */}
        <div className="border-t border-slate-800 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-900/20 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-900/30"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      {/* MAIN CHAT AREA */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-2.5 sm:px-4 backdrop-blur-md gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative h-7 w-7 sm:h-8 sm:w-8 shrink-0 overflow-hidden rounded-full border border-amber-600/40 bg-stone-900 p-0.5">
                <Image
                  src="/college_logo.svg"
                  alt="Logo"
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs font-bold text-white sm:text-base truncate">
                  GASCKK AI
                </h1>
                <p className="hidden text-[11px] text-slate-400 sm:block truncate">
                  English & தமிழ் • RAG Knowledge Base
                </p>
              </div>
            </div>
          </div>
          {/* Action Buttons (Smooth horizontal scroll without scrollbar on small screens) */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar shrink-0 py-1">
            {/* Auto-Speak Toggle (Desktop only to prevent mobile clutter) */}
            <button
              onClick={() => {
                const next = !autoSpeak;
                setAutoSpeak(next);
                if (!next) stopSpeaking();
              }}
              className={`hidden md:flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition shrink-0 ${
                autoSpeak
                  ? "border border-blue-500/50 bg-blue-600/20 text-blue-300"
                  : "border border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
              }`}
              title={autoSpeak ? "Auto-Speak ON (AI reads answers out loud)" : "Auto-Speak OFF"}
            >
              <Headphones className={`h-3.5 w-3.5 ${autoSpeak ? "text-blue-400" : "text-slate-500"}`} />
              <span>{autoSpeak ? "Auto-Read ON" : "Auto-Read"}</span>
            </button>
            {/* Student Profile & AI Memory Button */}
            <button
              onClick={() => {
                setIsMemoryModalOpen(true);
                fetchMemories();
              }}
              className="flex items-center gap-1 rounded-lg border border-pink-500/40 bg-gradient-to-r from-pink-950/40 to-purple-950/40 px-2 sm:px-2.5 py-1.5 text-xs font-bold text-pink-300 shadow-sm transition hover:bg-pink-900/50 hover:text-white shrink-0"
              title="View & manage what GASCKK AI remembers about your academic profile"
            >
              <Brain className="h-3.5 w-3.5 text-pink-400" />
              <span className="hidden sm:inline">🧠 Memory</span>
              {memoriesList.length > 0 && (
                <span className="rounded-full bg-pink-500/30 px-1.5 py-0.2 text-[10px] font-extrabold text-pink-200 border border-pink-500/40">
                  {memoriesList.length}
                </span>
              )}
            </button>
            {/* Faculty & Staff Directory Button */}
            <button
              onClick={() => {
                setIsFacultyModalOpen(true);
                fetchFacultyDirectory();
              }}
              className="flex items-center gap-1 rounded-lg border border-blue-500/40 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 px-2 sm:px-2.5 py-1.5 text-xs font-bold text-blue-300 shadow-sm transition hover:bg-blue-900/50 hover:text-white shrink-0"
              title="Browse official Faculty & Staff directory for all 8 departments"
            >
              <Users className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden sm:inline">🏛️ Faculty</span>
            </button>
            {/* Voice Language Selector */}
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-0.5 sm:p-1 text-xs shrink-0">
              <button
                onClick={() => setVoiceLang("ta-IN")}
                className={`rounded px-1.5 sm:px-2 py-0.5 font-medium transition text-[11px] sm:text-xs ${
                  voiceLang === "ta-IN"
                    ? "bg-blue-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                தமிழ்
              </button>
              <button
                onClick={() => setVoiceLang("en-US")}
                className={`rounded px-1.5 sm:px-2 py-0.5 font-medium transition text-[11px] sm:text-xs ${
                  voiceLang === "en-US"
                    ? "bg-blue-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ENG
              </button>
            </div>
            {/* User Gmail ID & Header Logout Button */}
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-700/60 ml-0.5 shrink-0">
              <div
                className="flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-800/90 px-2 py-1 text-xs text-slate-300 max-w-[140px] sm:max-w-[210px]"
                title={`Logged in as: ${userEmail}`}
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-[10px] font-bold text-white uppercase shadow-sm">
                  {userName ? userName.charAt(0) : (userEmail ? userEmail.charAt(0) : "U")}
                </div>
                <span className="truncate text-[11px] font-medium text-slate-200">
                  {userName ? `👋 ${userName}` : (userEmail || "Student")}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-gradient-to-r from-red-950/40 to-rose-950/40 px-2 sm:px-2.5 py-1 text-xs font-semibold text-red-300 shadow-sm transition hover:border-red-500/80 hover:bg-red-900/50 hover:text-white shrink-0"
                title={`Log out of ${userEmail}`}
              >
                <LogOut className="h-3.5 w-3.5 text-red-400" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>
        {/* Chat Message Scroll List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Welcome banner if empty chat */}
            {messages.length === 0 && (
              <div className="my-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center shadow-xl">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-400">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  {userName
                    ? `Hello ${userName}! Welcome to GASCKK AI`
                    : "Welcome to GASCKK Academic Assistant!"}
                </h2>
                <p className="mt-1 text-xs text-blue-400 font-medium">
                  {userName
                    ? `வணக்கம் ${userName}! உங்களுக்கு உதவ நாங்கள் தயாராக உள்ளோம்.`
                    : "அரசு கலை மற்றும் அறிவியல் கல்லூரி, பால்குளம்"}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Ask any questions about college departments, syllabus, exams, day orders, or rules in{" "}
                  <span className="font-semibold text-blue-400">English</span> or{" "}
                  <span className="font-semibold text-blue-400">தமிழ் (Tamil)</span>.
                </p>
                <div className="mt-6 grid grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
                  {(voiceLang === "ta-IN"
                    ? [
                        "இன்றைய கல்லூரி நாள் வரிசை (Day Order) என்ன?",
                        "BCA துறையின் பாடப்பிரிவுகள் மற்றும் ஆய்வக வசதிகள் என்ன?",
                        "கல்லூரி சேர்க்கை மற்றும் விதிமுறைகள் என்ன?",
                        "B.Com மற்றும் BBA துறைகள் பற்றிய விவரங்கள் கூறுங்கள்.",
                      ]
                    : [
                        "What is today's college day order?",
                        "What courses and lab facilities does BCA offer?",
                        "What are the college admission rules and regulations?",
                        "Tell me about the B.Com and BBA departments.",
                      ]
                  ).map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(sug)}
                      className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 text-xs text-slate-300 transition hover:border-blue-500/50 hover:bg-slate-800 hover:text-white"
                    >
                      💡 {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Chat Messages */}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-amber-600/40 bg-stone-900 p-0.5 shadow">
                    <Image
                      src="/college_logo.svg"
                      alt="Bot"
                      fill
                      sizes="32px"
                      className="object-contain"
                    />
                  </div>
                )}
                <div
                  className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "border border-slate-800 bg-slate-900 text-slate-200 rounded-tl-none"
                  }`}
                >
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        pre({ children }) {
                          return <>{children}</>;
                        },
                        p({ children }) {
                          return <div className="my-1.5 leading-relaxed">{children}</div>;
                        },
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || "");
                          const codeString = String(children).replace(/\n$/, "");
                          const isBlock = Boolean(match) || (!inline && codeString.includes("\n"));
                          const lang = match ? match[1] : "";
                          if (!isBlock) {
                            return (
                              <code className="rounded bg-slate-800/80 px-1.5 py-0.5 text-xs text-purple-300 font-mono" {...props}>
                                {children}
                              </code>
                            );
                          }
                          const isHtmlOrJs =
                            lang === "html" ||
                            lang === "htm" ||
                            codeString.includes("<!DOCTYPE") ||
                            codeString.includes("<html") ||
                            codeString.includes("<body") ||
                            (codeString.includes("<script") && codeString.includes("</script>")) ||
                            (codeString.includes("<div") && codeString.includes("<style"));
                          return (
                            <div className="my-3 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 font-mono text-xs shadow-xl">
                              {/* Code Header Bar */}
                              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3.5 py-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-1.5">
                                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
                                  </div>
                                  <span className="font-semibold uppercase tracking-wider text-purple-400 text-[10px] ml-1">
                                    {lang || "code"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {/* Live Preview Button */}
                                  {isHtmlOrJs && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewCode(codeString)}
                                      className="flex items-center gap-1 rounded-md bg-emerald-600/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-600 hover:text-white"
                                      title="Run & test this web app live!"
                                    >
                                      <Play className="h-2.5 w-2.5 fill-emerald-400" />
                                      <span>▶ Live Preview</span>
                                    </button>
                                  )}
                                  {/* Download Code Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadCode(codeString, lang)}
                                    className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
                                    title="Download source code file"
                                  >
                                    <Download className="h-2.5 w-2.5" />
                                    <span>Download</span>
                                  </button>
                                  {/* Copy Code Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(codeString);
                                      setCopiedCodeSnippet(codeString);
                                      setTimeout(() => setCopiedCodeSnippet(null), 2000);
                                    }}
                                    className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
                                    title="Copy code"
                                  >
                                    {copiedCodeSnippet === codeString ? (
                                      <Check className="h-2.5 w-2.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-2.5 w-2.5" />
                                    )}
                                    <span>{copiedCodeSnippet === codeString ? "Copied!" : "Copy"}</span>
                                  </button>
                                </div>
                              </div>
                              {/* Code Body */}
                              <pre className="overflow-x-auto p-3.5 text-xs text-slate-200 leading-relaxed">
                                <code>{children}</code>
                              </pre>
                            </div>
                          );
                        }
                      }}
                    >
                      {(typeof msg.content === "string" ? msg.content : String(msg.content ?? ""))
                        .replace(/<br\s*\/?>/gi, "\n")}
                    </ReactMarkdown>
                  </div>
                  {/* Sources tag and Original PDF Download Links */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 border-t border-slate-800/80 pt-2 text-[11px] text-slate-400 space-y-1.5">
                      {msg.sources.some(s => s.toLowerCase().endsWith(".pdf")) && (
                        <div>
                          <span className="font-semibold text-amber-300 flex items-center gap-1 mb-1">
                            <FileText className="h-3.5 w-3.5 text-amber-400" />
                            Original College Question Papers:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.filter(s => s.toLowerCase().endsWith(".pdf")).map((src, sIdx) => {
                              const fname = src.split(/[/\\]/).pop() || src;
                              return (
                                <a
                                  key={sIdx}
                                  href={`${API_BASE}/api/download-college-file?file_path=${encodeURIComponent(src)}`}
                                  download={fname}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition hover:bg-amber-800/50 hover:text-white"
                                  title={`Download ${fname}`}
                                >
                                  <Download className="h-3 w-3 text-amber-400" />
                                  <span className="max-w-xs truncate">{fname}</span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-slate-300">Sources: </span>
                        {msg.sources.join(", ")}
                      </div>
                    </div>
                  )}
                  {/* Footer info, Download PDF button & Copy button */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/40">
                    <span className="opacity-60 text-[10px]">{msg.time}</span>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-2">
                        {/* Read Aloud / Stop Voice Button */}
                        <button
                          onClick={() => {
                            if (isSpeaking && speakingIndex === idx) {
                              stopSpeaking();
                            } else {
                              speakText(typeof msg.content === "string" ? msg.content : String(msg.content ?? ""), idx);
                            }
                          }}
                          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                            isSpeaking && speakingIndex === idx
                              ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 animate-pulse"
                              : "border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                          }`}
                          title={isSpeaking && speakingIndex === idx ? "Stop speaking" : "Listen to this answer"}
                        >
                          {isSpeaking && speakingIndex === idx ? (
                            <>
                              <VolumeX className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3.5 w-3.5 text-blue-400" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                        {/* Download as PDF Button */}
                        <button
                          onClick={() => handleDownloadPdf(typeof msg.content === "string" ? msg.content : String(msg.content ?? ""), idx)}
                          disabled={downloadingPdfIndex === idx}
                          className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/20 px-2.5 py-1 text-xs font-semibold text-blue-300 transition hover:bg-blue-600 hover:text-white disabled:opacity-50"
                          title="Download this question paper as a formatted PDF"
                        >
                          <Download className={`h-3.5 w-3.5 ${downloadingPdfIndex === idx ? "animate-bounce" : ""}`} />
                          <span>{downloadingPdfIndex === idx ? "Generating..." : "📥 Download Question PDF"}</span>
                        </button>
                        {/* Copy button */}
                        <button
                          onClick={() => copyToClipboard(typeof msg.content === "string" ? msg.content : String(msg.content ?? ""), idx)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                          title="Copy text"
                        >
                          {copiedIndex === idx ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {/* Loading / Typing Indicator */}
            {isLoading && (
              <div className="flex gap-3 items-center">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-amber-600/40 bg-stone-900 p-0.5 shadow">
                  <Image
                    src="/college_logo.svg"
                    alt="Bot"
                    fill
                    sizes="32px"
                    className="object-contain"
                  />
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 rounded-tl-none">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
                    <span className="ml-2 text-xs text-slate-400">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        {/* Input Bar */}
        <div className="border-t border-slate-800 bg-slate-900/95 p-2.5 sm:p-4 pb-safe">
          <div className="mx-auto max-w-3xl">
            {voiceError && (
              <div className="mb-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-center text-xs text-amber-300 shadow-sm">
                {voiceError}
              </div>
            )}
            {/* Vibe Coding Active Mode Banner */}
            {isVibeCodingMode && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-purple-500/40 bg-gradient-to-r from-purple-950/60 via-indigo-950/60 to-purple-950/60 px-3 py-1.5 text-xs text-purple-200 shadow-md">
                <span className="flex items-center gap-1.5 font-bold truncate">
                  <Zap className="h-3.5 w-3.5 fill-purple-400 text-purple-400 shrink-0" />
                  <span className="truncate">⚡ Vibe Coding Active — Build apps & games</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsVibeCodingMode(false)}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold text-purple-300 hover:bg-purple-800/40 hover:text-white transition shrink-0 ml-2"
                >
                  Exit ✕
                </button>
              </div>
            )}
            {/* Mobile Quick Action Pill Shortcuts (Visible on mobile screens) */}
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:hidden py-0.5">
              <button
                type="button"
                onClick={startRealtimeVoice}
                className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shrink-0 shadow-sm"
              >
                <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
                <span>Live Voice</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMemoryModalOpen(true);
                  fetchMemories();
                }}
                className="flex items-center gap-1 rounded-full border border-pink-500/40 bg-pink-950/50 px-2.5 py-1 text-[11px] font-semibold text-pink-300 shrink-0 shadow-sm"
              >
                <Brain className="h-3 w-3 text-pink-400" />
                <span>Memory ({memoriesList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFacultyModalOpen(true);
                  fetchFacultyDirectory();
                }}
                className="flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-950/50 px-2.5 py-1 text-[11px] font-semibold text-blue-300 shrink-0 shadow-sm"
              >
                <Users className="h-3 w-3 text-blue-400" />
                <span>Faculty (8 Depts)</span>
              </button>
              <button
                type="button"
                onClick={openCamera}
                className="flex items-center gap-1 rounded-full border border-teal-500/40 bg-teal-950/50 px-2.5 py-1 text-[11px] font-semibold text-teal-300 shrink-0 shadow-sm"
              >
                <Camera className="h-3 w-3 text-teal-400" />
                <span>Scan Question</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className={`relative flex items-center gap-1.5 sm:gap-2 rounded-2xl border bg-slate-800/80 px-2 sm:px-3 py-1.5 sm:py-2 shadow-lg transition ${
                isVibeCodingMode
                  ? "border-purple-500/60 ring-2 ring-purple-500/20 shadow-purple-950/40"
                  : "border-slate-700 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
              }`}
            >
              {/* ChatGPT-Style Plus (+) Action Button & Popover Menu */}
              <div ref={plusMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-all duration-200 shadow-sm ${
                    isPlusMenuOpen
                      ? "bg-slate-700 text-white rotate-45 scale-105"
                      : isVibeCodingMode
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/50 hover:bg-purple-600 hover:text-white"
                      : "bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                  title="Tools & Attachments (Camera, Vibe Coding, PDF, Memory, Faculty)"
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200" />
                </button>

                {/* ChatGPT-Style Action Popover Menu */}
                {isPlusMenuOpen && (
                  <div className="absolute bottom-12 left-0 z-50 w-72 sm:w-80 rounded-2xl border border-slate-700 bg-slate-900/98 p-2 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between">
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                        <span>Academic Tools</span>
                      </p>
                      <span className="text-[10px] text-slate-500 font-medium">ChatGPT Style</span>
                    </div>

                    {/* Camera / Scan Question Paper Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        openCamera();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-800/90 group"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 group-hover:scale-105 group-hover:bg-teal-500/25 transition">
                        <Camera className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white group-hover:text-teal-300">
                          📷 Camera & Scan Question
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          Snap photo of question paper, textbook or notes
                        </p>
                      </div>
                    </button>

                    {/* Vibe Coding Mode Toggle Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        setIsVibeCodingMode(!isVibeCodingMode);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition group ${
                        isVibeCodingMode
                          ? "bg-purple-950/40 border border-purple-500/30"
                          : "hover:bg-slate-800/90"
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400 group-hover:scale-105 group-hover:bg-purple-500/25 transition">
                        <Zap className={`h-4 w-4 ${isVibeCodingMode ? "fill-purple-400" : ""}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-white group-hover:text-purple-300">
                            ⚡ Vibe Coding Mode
                          </p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isVibeCodingMode ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400"
                          }`}>
                            {isVibeCodingMode ? "ON" : "OFF"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          Generate runnable HTML/JS apps, games & tools
                        </p>
                      </div>
                    </button>

                    {/* Upload Syllabus / PDF Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-800/90 group"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 group-hover:scale-105 group-hover:bg-blue-500/25 transition">
                        <UploadCloud className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white group-hover:text-blue-300">
                          📄 Upload Syllabus / PDF
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          Upload university circulars or notes for AI to index
                        </p>
                      </div>
                    </button>

                    {/* Student Memory (Mem0) Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        setIsMemoryModalOpen(true);
                        fetchMemories();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-800/90 group"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/15 text-pink-400 group-hover:scale-105 group-hover:bg-pink-500/25 transition">
                        <Brain className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-white group-hover:text-pink-300">
                            🧠 My Memory Profile
                          </p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300">
                            {memoriesList.length} facts
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          Manage what AI remembers about your academic profile
                        </p>
                      </div>
                    </button>

                    {/* Faculty Directory Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        setIsFacultyModalOpen(true);
                        fetchFacultyDirectory();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-800/90 group"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 group-hover:scale-105 group-hover:bg-amber-500/25 transition">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white group-hover:text-amber-300">
                          🏛️ Faculty Directory (8 Depts)
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          Search 47 professors, HODs & lab facilities
                        </p>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Text Input */}
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening in " + (voiceLang === "ta-IN" ? "Tamil..." : "English...")
                    : isVibeCodingMode
                    ? "⚡ Vibe Code: Describe any app or game..."
                    : "Ask in English or தமிழ்..."
                }
                className="flex-1 min-w-0 bg-transparent px-1.5 sm:px-2 text-base sm:text-sm text-white placeholder-slate-400 focus:outline-none"
              />

              {/* Voice Controls: Speech-to-Text Mic + Live Voice side-by-side */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Speech-to-Text Mic Button */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition shadow-xs ${
                    isListening
                      ? "bg-red-500 text-white animate-pulse shadow-red-500/40"
                      : "text-slate-400 hover:bg-slate-700/80 hover:text-white"
                  }`}
                  title={`Speech to Text Dictation (${voiceLang === "ta-IN" ? "Tamil" : "English"})`}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </button>

                {/* Real-Time Live Voice Assistant Button (Directly beside Mic) */}
                <button
                  type="button"
                  onClick={startRealtimeVoice}
                  className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 shadow-sm transition hover:border-emerald-500/80 hover:bg-emerald-600 hover:text-white hover:shadow-emerald-500/30 shrink-0"
                  title="Live Voice Assistant (இருவழி நேரடி குரல் உரையாடல்)"
                >
                  <Radio className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 animate-pulse" />
                </button>
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputQuery.trim() || isLoading}
                className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-white shadow-md transition disabled:opacity-30 shrink-0 ${
                  isVibeCodingMode
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30"
                    : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30"
                }`}
                title="Send Message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Voice recognition configured for{" "}
              <span className="font-semibold text-slate-400">
                {voiceLang === "ta-IN" ? "Tamil (தமிழ்)" : "English"}
              </span>
              . Tap the language button in header to switch.
            </p>
          </div>
        </div>
      </div>
      {/* ── CAMERA MODAL ── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Camera className="h-5 w-5 text-emerald-400" />
                <span>Scan Question Paper</span>
              </div>
              <button onClick={closeCamera} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Camera Error */}
            {cameraError && (
              <div className="px-4 py-3 bg-red-900/30 border-b border-red-700/40 text-sm text-red-300 text-center">
                {cameraError}
              </div>
            )}
            {/* Video / Preview */}
            <div className="relative bg-black aspect-video flex items-center justify-center">
              {!capturedImage ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
              )}
              {/* Overlay guide frame */}
              {!capturedImage && (
                <div className="absolute inset-4 border-2 border-emerald-400/50 rounded-xl pointer-events-none" />
              )}
            </div>
            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
            {/* Info text */}
            <p className="text-center text-xs text-slate-400 px-4 pt-3">
              {!capturedImage
                ? "📷 Point camera at your question paper or handwritten question"
                : "✅ Photo taken! Click Analyze to get the AI answer."}
            </p>
            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3 p-4">
              {!capturedImage ? (
                <button
                  onClick={capturePhoto}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 active:scale-95"
                >
                  <Camera className="h-5 w-5" />
                  Capture Photo
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      setCameraError(null);
                      openCamera();
                    }}
                    className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    <SwitchCamera className="h-4 w-4" />
                    Retake
                  </button>
                  <button
                    onClick={analyzePhoto}
                    disabled={isAnalyzingImage}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:opacity-60 active:scale-95"
                  >
                    {isAnalyzingImage ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>{analyzeStatus}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Get AI Answer</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── REAL-TIME LIVE VOICE CONVERSATION MODAL (GEMINI LIVE STYLE) ── */}
      {realtimeVoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-3 sm:p-6 animate-in fade-in duration-300">
          
          {/* Ambient Gemini Nebula Glow */}
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-blue-600/20 via-purple-600/25 to-pink-500/20 blur-[130px]" />
          <div className="pointer-events-none absolute -bottom-40 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-cyan-500/15 via-blue-600/20 to-indigo-600/20 blur-[120px]" />

          <div className="relative flex h-[90vh] max-h-[750px] w-full max-w-xl flex-col items-center justify-between rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            
            {/* Top Bar — Gemini Live Header */}
            <div className="flex w-full items-center justify-between border-b border-slate-800/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-500 shadow-md shadow-purple-500/30">
                  <Sparkles className="h-4 w-4 text-white animate-spin [animation-duration:8s]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tracking-tight text-white">GASCKK Live Voice</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                      realtimeStatus === "listening"
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                        : realtimeStatus === "speaking"
                        ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                        : realtimeStatus === "thinking"
                        ? "border-pink-500/40 bg-pink-500/10 text-pink-300"
                        : "border-slate-700 bg-slate-800 text-slate-400"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        realtimeStatus === "listening" ? "bg-cyan-400 animate-ping" :
                        realtimeStatus === "speaking" ? "bg-purple-400 animate-pulse" :
                        realtimeStatus === "thinking" ? "bg-pink-400 animate-ping" : "bg-slate-500"
                      }`} />
                      {realtimeStatus === "listening" ? "LISTENING" :
                       realtimeStatus === "speaking" ? "SPEAKING" :
                       realtimeStatus === "thinking" ? "THINKING..." : "READY"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Government Arts &amp; Science College Palkulam</p>
                </div>
              </div>

              {/* Language Switch & Close Pill */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-full border border-slate-700/80 bg-slate-800/80 p-0.5 text-xs shadow-inner">
                  <button
                    onClick={() => {
                      voiceLangRef.current = "ta-IN";
                      setVoiceLang("ta-IN");
                      stopSpeaking();
                      stopRealtimeRecognition();
                      setTimeout(() => { if (realtimeActiveRef.current) listenForUserVoice("ta-IN"); }, 200);
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      voiceLang === "ta-IN"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    தமிழ்
                  </button>
                  <button
                    onClick={() => {
                      voiceLangRef.current = "en-US";
                      setVoiceLang("en-US");
                      stopSpeaking();
                      stopRealtimeRecognition();
                      setTimeout(() => { if (realtimeActiveRef.current) listenForUserVoice("en-US"); }, 200);
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      voiceLang === "en-US"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    ENG
                  </button>
                </div>

                <button
                  onClick={closeRealtimeVoice}
                  className="rounded-full border border-slate-700 bg-slate-800/80 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition shadow"
                  title="Close GASCKK Live Voice"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Center Stage — Real-Audio Driven Morphing Aura Orb */}
            <div className="my-auto flex flex-col items-center justify-center py-4">
              <div className="relative flex items-center justify-center">
                
                {/* Layer 1: Ambient Outer Pulse Rings (reacts to real voice volume) */}
                {realtimeStatus === "listening" && (
                  <>
                    <div
                      className="absolute rounded-full bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-teal-400/20 transition-all duration-150"
                      style={{
                        width: `${220 + micVolume * 1.2}px`,
                        height: `${220 + micVolume * 1.2}px`,
                        opacity: micVolume > 3 ? 0.9 : 0.4,
                      }}
                    />
                    <div
                      className="absolute rounded-full border border-cyan-400/40 bg-cyan-500/10 transition-all duration-150"
                      style={{
                        width: `${180 + micVolume * 0.8}px`,
                        height: `${180 + micVolume * 0.8}px`,
                      }}
                    />
                  </>
                )}
                {realtimeStatus === "speaking" && (
                  <>
                    <div className="absolute h-64 w-64 rounded-full bg-gradient-to-tr from-purple-600/30 via-pink-500/30 to-blue-500/30 animate-ping [animation-duration:2.5s]" />
                    <div className="absolute h-52 w-52 rounded-full border border-purple-400/40 bg-purple-600/20 animate-pulse" />
                  </>
                )}
                {realtimeStatus === "thinking" && (
                  <div className="absolute h-56 w-56 rounded-full border-2 border-pink-500/40 border-t-transparent animate-spin [animation-duration:1.5s]" />
                )}

                {/* Layer 2: Glowing Morphing Aura Sphere */}
                <button
                  onClick={() => {
                    if (realtimeStatus === "speaking") {
                      stopSpeaking();
                      startRealtimeVoice();
                    } else if (userSpeechRef.current.trim()) {
                      const toSend = userSpeechRef.current.trim();
                      userSpeechRef.current = "";
                      stopRealtimeRecognition();
                      isVoiceQueryingRef.current = true;
                      executeRealtimeQuery(toSend);
                    } else {
                      startRealtimeVoice();
                    }
                  }}
                  className={`group relative z-10 flex h-36 w-36 items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${
                    realtimeStatus === "listening"
                      ? micVolume > 4
                        ? "bg-gradient-to-tr from-emerald-500 via-cyan-500 to-blue-600 shadow-[0_0_60px_rgba(16,185,129,0.7)] scale-110"
                        : "bg-gradient-to-tr from-cyan-500 via-blue-600 to-teal-400 shadow-[0_0_50px_rgba(6,182,212,0.6)] scale-105"
                      : realtimeStatus === "speaking"
                      ? "bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-500 shadow-[0_0_60px_rgba(168,85,247,0.7)] scale-110"
                      : realtimeStatus === "thinking"
                      ? "bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 shadow-[0_0_40px_rgba(236,72,153,0.5)]"
                      : "bg-gradient-to-tr from-slate-800 to-slate-700 shadow-xl hover:scale-105"
                  }`}
                  title={userSpeechRef.current.trim() ? "Click to send question now" : "Tap to speak"}
                >
                  {/* Real-time Microphone Reactive Equalizer Waves */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 rounded-full bg-white transition-all duration-75"
                      style={{
                        height: realtimeStatus === "speaking" ? "24px" : `${Math.max(6, Math.min(36, 6 + micVolume * 0.4))}px`,
                      }}
                    />
                    <span
                      className="w-1.5 rounded-full bg-white transition-all duration-75"
                      style={{
                        height: realtimeStatus === "speaking" ? "42px" : `${Math.max(10, Math.min(52, 10 + micVolume * 0.7))}px`,
                      }}
                    />
                    <span
                      className="w-1.5 rounded-full bg-white transition-all duration-75"
                      style={{
                        height: realtimeStatus === "speaking" ? "58px" : `${Math.max(14, Math.min(68, 14 + micVolume * 1.0))}px`,
                      }}
                    />
                    <span
                      className="w-1.5 rounded-full bg-white transition-all duration-75"
                      style={{
                        height: realtimeStatus === "speaking" ? "42px" : `${Math.max(10, Math.min(52, 10 + micVolume * 0.7))}px`,
                      }}
                    />
                    <span
                      className="w-1.5 rounded-full bg-white transition-all duration-75"
                      style={{
                        height: realtimeStatus === "speaking" ? "24px" : `${Math.max(6, Math.min(36, 6 + micVolume * 0.4))}px`,
                      }}
                    />
                  </div>
                </button>
              </div>

              {/* Status Pill Label */}
              <div className="mt-6 flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/80 px-4 py-1.5 text-xs font-semibold backdrop-blur-md shadow-lg">
                {realtimeStatus === "listening" && (
                  <span className="text-cyan-300 flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${micVolume > 3 ? "bg-emerald-400 animate-ping" : "bg-cyan-400 animate-pulse"}`} />
                    {realtimeUserText
                      ? `🎤 "${realtimeUserText}"`
                      : micVolume > 3
                      ? "🎤 Voice detected! Keep speaking..."
                      : `Listening in ${voiceLang === "ta-IN" ? "தமிழ் (Tamil)" : "English"}...`}
                  </span>
                )}
                {realtimeStatus === "thinking" && (
                  <span className="text-pink-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-pink-400 animate-spin" />
                    GASCKK AI is processing...
                  </span>
                )}
                {realtimeStatus === "speaking" && (
                  <span className="text-purple-300 flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
                    Speaking... Tap orb to interrupt
                  </span>
                )}
                {realtimeStatus === "idle" && (
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-slate-400" />
                    Tap orb or speak to start
                  </span>
                )}
              </div>

              {/* Quick Language Toggle Bar under Orb */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    voiceLangRef.current = "ta-IN";
                    setVoiceLang("ta-IN");
                    stopSpeaking();
                    stopRealtimeRecognition();
                    setTimeout(() => { if (realtimeActiveRef.current) listenForUserVoice("ta-IN"); }, 200);
                  }}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold border transition ${
                    voiceLang === "ta-IN"
                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-300 shadow-sm"
                      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                >
                  🇮🇳 தமிழ் (Tamil)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    voiceLangRef.current = "en-US";
                    setVoiceLang("en-US");
                    stopSpeaking();
                    stopRealtimeRecognition();
                    setTimeout(() => { if (realtimeActiveRef.current) listenForUserVoice("en-US"); }, 200);
                  }}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold border transition ${
                    voiceLang === "en-US"
                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-300 shadow-sm"
                      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                >
                  🌐 English
                </button>
              </div>
            </div>

            {/* Live Subtitle Transcript Glass Card */}
            <div className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 text-left shadow-inner max-h-40 overflow-y-auto space-y-2.5">
              {/* Previous Conversation Turns */}
              {voiceDialogHistory.slice(-3).map((item, idx) => (
                <div key={idx} className="space-y-1 pb-2 border-b border-slate-850/60 last:border-b-0 last:pb-0 opacity-75">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/90 flex items-center gap-1">
                      <User className="h-3 w-3" /> You
                    </span>
                    <p className="text-xs text-slate-300 font-medium mt-0.5 leading-relaxed">{item.user}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-450 flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" /> GASCKK AI
                    </span>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{item.ai}</p>
                  </div>
                </div>
              ))}

              {/* Current Active User Utterance */}
              {realtimeUserText ? (
                <div className="mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                    <User className="h-3 w-3" /> You
                  </span>
                  <p className="text-xs text-slate-100 font-medium mt-0.5 leading-relaxed">{realtimeUserText}</p>
                </div>
              ) : null}

              {/* Current Active AI Reply */}
              {realtimeAiText ? (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> GASCKK AI
                  </span>
                  <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">{realtimeAiText}</p>
                </div>
              ) : !realtimeUserText && voiceDialogHistory.length === 0 ? (
                <div className="text-center py-2">
                  <p className="text-xs text-slate-400 font-medium">
                    Ask anything in Tamil or English • Speak naturally
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    💡 If your microphone is not responding, make sure Windows Voice Access is awake/unmuted, or type below
                  </p>
                </div>
              ) : null}
            </div>

            {/* Inline Quick Text Input (Always available in Live Voice mode) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (liveTextInput.trim()) {
                  const q = liveTextInput.trim();
                  setLiveTextInput("");
                  executeRealtimeQuery(q);
                }
              }}
              className="mt-3 flex w-full items-center gap-2"
            >
              <input
                type="text"
                value={liveTextInput}
                onChange={(e) => setLiveTextInput(e.target.value)}
                placeholder="Or type your question and press Enter..."
                className="flex-1 rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none shadow-inner"
              />
              <button
                type="submit"
                disabled={!liveTextInput.trim()}
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:opacity-95 disabled:opacity-30 transition shadow"
              >
                Send
              </button>
            </form>

            {/* Bottom Floating Control Pill (Gemini Live Bar) */}
            <div className="mt-3 flex w-full items-center justify-between gap-3">
              <button
                onClick={() => {
                  if (realtimeStatus === "speaking") stopSpeaking();
                  else if (realtimeStatus === "listening") {
                    stopRealtimeRecognition();
                    setRealtimeStatus("idle");
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-800/80 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition shadow"
              >
                <MicOff className="h-3.5 w-3.5" />
                <span>Pause / Mute</span>
              </button>

              <button
                onClick={() => {
                  if (userSpeechRef.current.trim()) {
                    const toSend = userSpeechRef.current.trim();
                    userSpeechRef.current = "";
                    stopRealtimeRecognition();
                    isVoiceQueryingRef.current = true;
                    executeRealtimeQuery(toSend);
                  } else {
                    startRealtimeVoice();
                  }
                }}
                className="flex-[1.5] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 py-3 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:opacity-95 active:scale-95 transition"
              >
                <Radio className="h-4 w-4 animate-pulse" />
                <span>{userSpeechRef.current.trim() ? "⚡ Send Question" : "🎙️ Tap to Speak"}</span>
              </button>

              <button
                onClick={closeRealtimeVoice}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-red-500/30 bg-red-500/10 py-3 text-xs font-bold text-red-400 hover:bg-red-500/20 transition shadow"
              >
                <X className="h-3.5 w-3.5" />
                <span>End Live</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── VIBE CODING LIVE PREVIEW SANDBOX MODAL ── */}
      {previewCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="relative flex h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-purple-500/40 bg-slate-950 shadow-2xl shadow-purple-950/40 overflow-hidden">
            {/* Sandbox Top Bar */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600/30 text-purple-400">
                  <Zap className="h-4 w-4 fill-purple-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">Vibe Coding Live Sandbox</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE RUNNING
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Device viewport toggle */}
                <div className="hidden sm:flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                      previewDevice === "desktop" ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Monitor className="h-3 w-3" />
                    Desktop
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                      previewDevice === "mobile" ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Smartphone className="h-3 w-3" />
                    Mobile
                  </button>
                </div>
                {/* Close modal */}
                <button
                  onClick={() => setPreviewCode(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  title="Close sandbox"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {/* Sandbox IFrame */}
            <div className="flex-1 bg-slate-900/90 flex items-center justify-center p-2 sm:p-4 overflow-auto">
              <div
                className={`h-full transition-all duration-300 rounded-xl overflow-hidden border border-slate-700/60 shadow-2xl bg-white ${
                  previewDevice === "mobile" ? "w-[380px] max-w-full" : "w-full"
                }`}
              >
                <iframe
                  srcDoc={previewCode}
                  title="Vibe Coding Sandbox Output"
                  className="h-full w-full border-none bg-white"
                  sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STUDENT MEMORY (MEM0) MODAL ── */}
      {isMemoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-pink-500/30 bg-slate-900 shadow-2xl shadow-pink-950/30 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/40 text-pink-400 shadow-inner">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      My Profile Memory / என் விவரங்கள் & நினைவுகள்
                    </h3>
                    <span className="rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold text-pink-300 border border-pink-500/30">
                      mem0 AI
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    GASCKK AI automatically learns your academic facts (Name, Department, Semester, Preferences) across conversations.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMemoryModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Status Alert Banner if any */}
            {memoryStatusMessage && (
              <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-5 py-2 text-xs font-medium text-emerald-400 flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>{memoryStatusMessage}</span>
              </div>
            )}

            {/* Modal Content Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Direct Add Fact Input Form */}
              <form onSubmit={handleAddDirectMemory} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-pink-400" />
                    <span>Add Custom Academic Fact / புதிய விவரம் சேர்க்க</span>
                  </label>
                  <span className="text-[10px] text-slate-400">e.g. "I am in 3rd year BCA Shift 1"</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMemoryInput}
                    onChange={(e) => setNewMemoryInput(e.target.value)}
                    placeholder="Type details (e.g. My register number is 2026BCA101, I love Python...)"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                    disabled={isAddingMemory}
                  />
                  <button
                    type="submit"
                    disabled={isAddingMemory || !newMemoryInput.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow transition hover:from-pink-500 hover:to-purple-500 disabled:opacity-50"
                  >
                    {isAddingMemory ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    <span>Add</span>
                  </button>
                </div>
              </form>

              {/* Saved Memories List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Learned Facts & Preferences ({memoriesList.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchMemories()}
                      disabled={isLoadingMemories}
                      className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white transition disabled:opacity-50"
                      title="Refresh memories"
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingMemories ? "animate-spin" : ""}`} />
                      <span>Refresh</span>
                    </button>
                    {memoriesList.length > 0 && (
                      <button
                        onClick={handleClearAllMemories}
                        disabled={isLoadingMemories}
                        className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                        title="Delete all memories for this profile"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Clear All</span>
                      </button>
                    )}
                  </div>
                </div>

                {isLoadingMemories ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
                    <p className="text-xs">Loading profile memories...</p>
                  </div>
                ) : memoriesList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/30 p-8 text-center space-y-2">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-500">
                      <Brain className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-300">
                      No memories stored yet / எந்த நினைவுகளும் இல்லை
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      As you chat with GASCKK AI (telling your name, department, or preferences), the AI will automatically extract and remember important academic details here!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {memoriesList.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="group flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 transition hover:border-pink-500/40 hover:bg-slate-900/80"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-pink-400">
                            <Sparkles className="h-3 w-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-200 font-medium leading-relaxed break-words">
                              {item.memory}
                            </p>
                            {item.created_at && (
                              <p className="mt-1 text-[10px] text-slate-500">
                                Learned: {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSingleMemory(item.id)}
                          className="rounded-lg p-1.5 text-slate-500 opacity-70 hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100 transition shrink-0"
                          title="Delete this memory"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-5 py-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-500" />
                <span className="truncate">Profile: {userEmail || "student@gasckk.edu.in"}</span>
              </div>
              <button
                onClick={() => setIsMemoryModalOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
              >
                Done / முடிந்தது
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FACULTY & STAFF DIRECTORY MODAL (ALL 8 DEPARTMENTS) ── */}
      {isFacultyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-blue-500/40 bg-slate-950 shadow-2xl shadow-blue-950/40 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/40 text-blue-400 shadow-inner">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white sm:text-lg">
                      🏛️ Faculty & Staff Directory / கல்லூரி பேராசிரியர்கள் விவரம்
                    </h3>
                    <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">
                      8 DEPARTMENTS
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Government Arts & Science College Palkulam • Official HODs, Faculty qualifications, designations & labs.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFacultyModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Bar & Department Filter Pills */}
            <div className="border-b border-slate-800 bg-slate-900/60 p-4 space-y-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={facultySearchQuery}
                  onChange={(e) => setFacultySearchQuery(e.target.value)}
                  placeholder="Search professor name, qualification (Ph.D, M.Phil), designation (HOD), or department..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
                />
                {facultySearchQuery && (
                  <button
                    onClick={() => setFacultySearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Department Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {[
                  { id: "all", label: "All (அனைத்தும்)" },
                  { id: "bca", label: "BCA (கணினி)" },
                  { id: "physics", label: "Physics (இயற்பியல்)" },
                  { id: "chemistry", label: "Chemistry (வேதியியல்)" },
                  { id: "maths", label: "Maths (கணிதம்)" },
                  { id: "commerce", label: "Commerce (காமர்ஸ்)" },
                  { id: "bba", label: "BBA (வணிக மேலாண்மை)" },
                  { id: "tamil", label: "Tamil (தமிழ்)" },
                  { id: "english", label: "English (ஆங்கிலம்)" },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setSelectedDeptFilter(pill.id)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                      selectedDeptFilter === pill.id
                        ? "bg-blue-600 text-white shadow"
                        : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Department Cards List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {isLoadingFaculty ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  <p className="text-xs">Loading official college directory...</p>
                </div>
              ) : Object.keys(facultyDirectory).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center space-y-3">
                  <Users className="mx-auto h-8 w-8 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-300">Directory loading or unavailable</p>
                  <button
                    onClick={fetchFacultyDirectory}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition"
                  >
                    Retry Loading
                  </button>
                </div>
              ) : (
                (() => {
                  const filtered = Object.entries(facultyDirectory).filter(([key, dept]) => {
                    if (selectedDeptFilter !== "all" && key !== selectedDeptFilter && key !== (selectedDeptFilter === "commerce" ? "bcom" : "")) {
                      return false;
                    }
                    if (!facultySearchQuery.trim()) return true;
                    const q = facultySearchQuery.toLowerCase();
                    const matchName = dept.dept_name.toLowerCase().includes(q) || (dept.dept_name_tamil && dept.dept_name_tamil.toLowerCase().includes(q));
                    const matchHod = dept.hod.toLowerCase().includes(q) || (dept.hod_tamil && dept.hod_tamil.toLowerCase().includes(q));
                    const matchFaculty = dept.faculty.some((f) => f.toLowerCase().includes(q));
                    const matchScope = dept.scope && dept.scope.toLowerCase().includes(q);
                    const matchLab = dept.lab && dept.lab.toLowerCase().includes(q);
                    return matchName || matchHod || matchFaculty || matchScope || matchLab;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center space-y-2">
                        <Search className="mx-auto h-8 w-8 text-slate-600" />
                        <p className="text-sm font-semibold text-slate-300">No matching faculty or departments found</p>
                        <p className="text-xs text-slate-500">Try searching with a different name, degree, or select "All".</p>
                      </div>
                    );
                  }

                  return filtered.map(([key, dept]) => (
                    <div
                      key={key}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl transition hover:border-slate-700 space-y-4"
                    >
                      {/* Department Title Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-white">{dept.dept_name}</h4>
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-slate-700">
                              Est. {dept.established}
                            </span>
                          </div>
                          {dept.dept_name_tamil && (
                            <p className="text-xs font-semibold text-blue-300 mt-0.5">{dept.dept_name_tamil}</p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setIsFacultyModalOpen(false);
                            handleSend(`Tell me about the ${dept.dept_name} HOD, staff members, and curriculum`);
                          }}
                          className="self-start sm:self-auto rounded-lg border border-blue-500/30 bg-blue-950/40 px-2.5 py-1 text-xs font-bold text-blue-300 hover:bg-blue-900/50 hover:text-white transition"
                        >
                          💬 Ask in Chat
                        </button>
                      </div>

                      {/* HOD Spotlight Box */}
                      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-900 to-blue-950/20 p-3.5 space-y-1.5 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                          <GraduationCap className="h-4 w-4" />
                          <span>Head of Department (HOD) / துறைத் தலைவர்</span>
                        </div>
                        <p className="text-sm font-bold text-amber-100">{dept.hod}</p>
                        {dept.hod_tamil && (
                          <p className="text-xs font-semibold text-amber-300/90">{dept.hod_tamil}</p>
                        )}
                      </div>

                      {/* Teaching Faculty List */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-blue-400" />
                          <span>Teaching Staff Members ({dept.faculty.length})</span>
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {dept.faculty.map((member, fIdx) => (
                            <div
                              key={fIdx}
                              className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-slate-950/50 p-2.5 text-xs"
                            >
                              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-blue-400 font-bold text-[10px]">
                                {fIdx + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-200 leading-snug break-words">
                                  {member}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Lab Facilities & Career Scope */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60 text-xs">
                        {dept.lab && (
                          <div className="rounded-xl bg-slate-950/40 border border-slate-800/60 p-3 space-y-1">
                            <span className="font-bold text-slate-300 text-[11px] flex items-center gap-1 text-emerald-400">
                              🔬 Laboratory Facilities
                            </span>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{dept.lab}</p>
                          </div>
                        )}
                        {dept.scope && (
                          <div className="rounded-xl bg-slate-950/40 border border-slate-800/60 p-3 space-y-1">
                            <span className="font-bold text-slate-300 text-[11px] flex items-center gap-1 text-purple-400">
                              🎯 Career Opportunities
                            </span>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{dept.scope}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900 px-5 py-3 text-[11px] text-slate-400">
              <span className="truncate">Affiliated with Manonmaniam Sundaranar University (MSU) • GASCKK Palkulam</span>
              <button
                onClick={() => setIsFacultyModalOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
              >
                Close / மூடுக
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}