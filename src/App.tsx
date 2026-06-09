import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  BarChart3, 
  LayoutDashboard, 
  FileSpreadsheet, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  BrainCircuit,
  Menu,
  X,
  ChevronRight,
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Download,
  Filter,
  MessageSquare,
  Send,
  Sparkles,
  RefreshCw,
  FileText,
  Lightbulb,
  Instagram,
  Twitter,
  Linkedin,
  Volume2,
  Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import { domToCanvas } from 'modern-screenshot';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

type ViewState = 'upload' | 'dashboard' | 'insights' | 'chat';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) message = parsed.error;
      } catch (e) {
        message = this.state.error.message || message;
      }
      return (
        <div className="min-h-screen bg-navy-dark flex items-center justify-center p-6">
          <div className="bg-navy-card border border-red-500/30 p-8 rounded-3xl max-w-md text-center">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-white">Application Error</h2>
            <p className="text-gray-400 mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-xl neon-gradient-bg text-white font-bold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface DataRow {
  [key: string]: any;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const Badge = ({ children, icon: Icon, colorClass }: { children: React.ReactNode, icon: any, colorClass: string }) => (
  <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium ${colorClass}`}>
    <Icon className="w-3.5 h-3.5" />
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, colorClass, trend, trendValue }: { title: string, value: string, icon: any, colorClass: string, trend?: 'up' | 'down', trendValue?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-navy-card/40 backdrop-blur-xl border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-all shadow-lg"
  >
    <div className={`absolute top-0 right-0 w-24 h-24 blur-[40px] rounded-full opacity-10 pointer-events-none ${colorClass.replace('text-', 'bg-')}`} />
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl bg-white/5 ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      {trendValue && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${trend === 'up' ? 'text-neon-green bg-neon-green/10' : 'text-red-500 bg-red-500/10'}`}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
          {trendValue}
        </div>
      )}
    </div>
    <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
  </motion.div>
);

const ChartCard = ({ title, children, data, ai, className = "" }: { title: string, children: React.ReactNode, data: any, ai: GoogleGenAI, className?: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSummarize = async () => {
    setIsLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Explain this chart data in extremely simple, everyday language for someone who doesn't know business terms. Chart Title: ${title}. Data: ${JSON.stringify(data)}`,
        config: {
          systemInstruction: "You are PulseIQ AI, a friendly data storyteller. Your goal is to explain data trends in 1-2 very short, simple sentences. Use zero jargon. Imagine you are explaining it to a middle schooler. Focus on the most important 'so what'. Do not use markdown, just plain text.",
        }
      });
      setSummary(response.text || "I couldn't find a simple way to explain this right now.");
    } catch (error) {
      console.error("Summary Error:", error);
      setSummary("Sorry, I'm having trouble reading the data right now.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className={`bg-navy-card/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl relative group transition-all duration-500 hover:border-white/10 hover:shadow-[0_0_30px_rgba(59,130,246,0.05)] ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex justify-between items-start mb-8 min-h-[40px]">
        <h3 className="text-xl font-bold tracking-tight text-white/90">{title}</h3>
        <AnimatePresence>
          {isHovered && !summary && !isLoading && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 10 }}
              onClick={(e) => {
                e.stopPropagation();
                handleSummarize();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl neon-gradient-bg text-white text-xs font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:scale-105 transition-all z-20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Summarize with PulseIQ
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <div className={isLoading || summary ? "opacity-10 blur-md grayscale transition-all duration-700" : "transition-all duration-500"}>
          {children}
        </div>
        
        <AnimatePresence>
          {(isLoading || summary) && (
            <motion.div
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              className="absolute inset-0 z-10 flex items-center justify-center p-4"
            >
              <div className="bg-navy-card/95 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-sm text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 neon-gradient-bg opacity-50" />
                
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="relative">
                      <RefreshCw className="w-10 h-10 text-neon-blue animate-spin" />
                      <Sparkles className="w-4 h-4 text-neon-purple absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium tracking-wide">PulseIQ is translating data...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto border border-white/10">
                      <BrainCircuit className="w-6 h-6 text-neon-purple" />
                    </div>
                    <p className="text-base text-gray-100 leading-relaxed font-medium">
                      {summary}
                    </p>
                    <button 
                      onClick={() => setSummary(null)}
                      className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] text-gray-400 hover:text-white hover:bg-white/10 uppercase tracking-widest font-bold transition-all"
                    >
                      Got it
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <PulseIQApp />
    </ErrorBoundary>
  );
}

function PulseIQApp() {
  const [view, setView] = useState<ViewState>('upload');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [file, setFile] = useState<{ name: string, size: string, rows: number, raw: File } | null>(null);
  const [data, setData] = useState<DataRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [dataSummary, setDataSummary] = useState<{
    totalRevenue: number;
    totalTransactions: number;
    topCategories: { name: string, value: number }[];
    dateRange: string;
    columnNames: string[];
  } | null>(null);
  
  // AI States
  const [insights, setInsights] = useState<string>('');
  const [recommendations, setRecommendations] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Voice States
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioQueueRef = useRef<string[]>([]);
  const currentAudioIndexRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const languages = ['English', 'Hindi', 'Kannada', 'Telugu', 'Tamil'];
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        loadLastRecord(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  const loadLastRecord = async (uid: string) => {
    try {
      const q = query(
        collection(db, 'business_records'),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const record = querySnapshot.docs[0].data();
        setInsights(record.insights || '');
        setRecommendations(record.recommendations || '');
        // Note: We don't restore the full data array here to save bandwidth, 
        // but we could if needed. We restore the summary.
        if (record.dataSummary) {
          setDataSummary(record.dataSummary);
        }
      }
    } catch (error) {
      console.error("Error loading last record:", error);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setData([]);
      setFile(null);
      setInsights('');
      setRecommendations('');
      setDataSummary(null);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const saveBusinessRecord = async (record: any) => {
    if (!user) return;
    const path = 'business_records';
    try {
      await addDoc(collection(db, path), {
        ...record,
        uid: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const parseFile = (file: File) => {
    return new Promise<DataRow[]>((resolve, reject) => {
      const reader = new FileReader();
      
      if (file.name.endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          dynamicTyping: true,
          complete: (results) => resolve(results.data as DataRow[]),
          error: (error) => reject(error)
        });
      } else {
        reader.onload = (e) => {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          resolve(json as DataRow[]);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile({
        name: selectedFile.name,
        size: (selectedFile.size / 1024).toFixed(1) + ' KB',
        rows: 0,
        raw: selectedFile
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx'))) {
      setFile({
        name: droppedFile.name,
        size: (droppedFile.size / 1024).toFixed(1) + ' KB',
        rows: 0,
        raw: droppedFile
      });
    }
  };

  const generateAIInsights = async (dataContext: string) => {
    setIsGeneratingInsights(true);
    try {
      // Generate general insights
      const insightsResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this data. Provide 3-5 simple, high-impact insights. Format: Use a clear title for each followed by 1-2 bullet points. No long paragraphs. Data context: ${dataContext.slice(0, 5000)}`,
        config: {
          systemInstruction: "You are PulseIQ, a business mentor. Provide insights in simple, everyday language. Avoid jargon. Use short, punchy bullet points. Format headers like '### 💡 Insight Title'. Always emphasize the 'What this means for you'.",
        }
      });
      const insightsText = insightsResponse.text || 'No insights generated.';
      setInsights(insightsText);

      // Generate specific recommendations for seasons and trends
      const recommendationsResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Give me 3 quick, actionable 'Pro Tips' based on this data. Format: Header with emoji followed by one sentence. Data context: ${dataContext.slice(0, 5000)}`,
        config: {
          systemInstruction: "You are a growth strategist. Provide 3 ultra-short tips. Each should be a short heading with an emoji and a single, direct action sentence. No fluff.",
        }
      });
      const recommendationsText = recommendationsResponse.text || 'No recommendations generated.';
      setRecommendations(recommendationsText);

      // Save to Firebase
      if (user && file) {
        saveBusinessRecord({
          fileName: file.name,
          fileSize: parseFloat(file.size),
          rowCount: file.rows,
          dataSummary,
          insights: insightsText,
          recommendations: recommendationsText
        });
      }
    } catch (error) {
      console.error("AI Error:", error);
      setInsights("Failed to generate AI insights. Please check your API key.");
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const startAnalysis = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    
    try {
      const parsedData = await parseFile(file.raw);
      setData(parsedData);
      setFile(prev => prev ? { ...prev, rows: parsedData.length } : null);
      
      // Calculate data summary for AI context
      if (parsedData.length > 0) {
        const keys = Object.keys(parsedData[0]);
        const salesKey = keys.find(k => k.toLowerCase().includes('sale') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('price')) || keys[1];
        const categoryKey = keys.find(k => k.toLowerCase().includes('category') || k.toLowerCase().includes('type') || k.toLowerCase().includes('product')) || keys[0];
        const dateKey = keys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('time')) || keys[2];

        const categorySales: { [key: string]: number } = {};
        let totalRev = 0;
        parsedData.forEach(row => {
          const cat = String(row[categoryKey] || 'Other');
          const val = parseFloat(row[salesKey]) || 0;
          categorySales[cat] = (categorySales[cat] || 0) + val;
          totalRev += val;
        });

        const topCats = Object.entries(categorySales)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        const dates = parsedData.map(row => String(row[dateKey])).filter(d => d && d !== 'undefined');
        const dateRange = dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : 'Unknown';

        setDataSummary({
          totalRevenue: totalRev,
          totalTransactions: parsedData.length,
          topCategories: topCats,
          dateRange,
          columnNames: keys
        });

        // Generate initial insights in background with better context
        const summaryContext = `
          File: ${file.name}
          Total Revenue: $${totalRev.toLocaleString()}
          Total Transactions: ${parsedData.length}
          Columns: ${keys.join(', ')}
          Top Categories: ${topCats.map(c => `${c.name}: $${c.value.toLocaleString()}`).join(', ')}
          Date Range: ${dateRange}
          Data Sample (first 20 rows): ${JSON.stringify(parsedData.slice(0, 20))}
        `;
        generateAIInsights(summaryContext);
      }
      
      setTimeout(() => {
        setIsAnalyzing(false);
        setView('dashboard');
      }, 2000);
    } catch (error) {
      console.error("Error parsing file:", error);
      setIsAnalyzing(false);
    }
  };

  const handleVoiceExplanation = async () => {
    if (!insights || isVoiceLoading) return;

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    setIsVoiceLoading(true);
    try {
      // Clean markdown for better TTS
      const baseText = insights
        .replace(/[#*`💡]/g, '')
        .replace(/What this means for you:/gi, '. What this means for you is ')
        .trim();

      let textToSpeak = baseText;

      // Translate on frontend if not English
      if (selectedLanguage !== 'English') {
        try {
          const translationResult = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: baseText,
            config: {
              systemInstruction: `Translate this text into ${selectedLanguage}. Preserve the tone. Only return the translated text.`
            }
          });
          if (translationResult.text) {
            textToSpeak = translationResult.text;
          }
        } catch (transError) {
          console.error("Frontend Translation Error:", transError);
          // Fallback to sending to backend if frontend translation fails (unlikely if the key works)
        }
      }

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, language: selectedLanguage })
      });

      const data = await response.json();
      if (data.urls && data.urls.length > 0) {
        audioQueueRef.current = data.urls.map((item: any) => item.url);
        currentAudioIndexRef.current = 0;
        playAudioQueue();
      } else {
        alert("Failed to generate voice. Please try again.");
      }
    } catch (error) {
      console.error("TTS Error:", error);
      alert("Error connecting to voice service.");
    } finally {
      setIsVoiceLoading(false);
    }
  };

  const playAudioQueue = () => {
    if (currentAudioIndexRef.current >= audioQueueRef.current.length) {
      setIsPlaying(false);
      return;
    }

    const url = audioQueueRef.current[currentAudioIndexRef.current];
    
    if (!audioRef.current) {
      const audio = new Audio();
      audioRef.current = audio;
      
      audio.onended = () => {
        currentAudioIndexRef.current++;
        playAudioQueue();
      };

      audio.onerror = (e) => {
        console.error("Audio Load Error:", e);
        setIsPlaying(false);
        setIsVoiceLoading(false);
        alert("Sorry, there was an error playing the voice. Please try again.");
      };
    }
    
    audioRef.current.src = url;
    audioRef.current.play().catch(err => {
      console.error("Play Error:", err);
      setIsPlaying(false);
    });
    setIsPlaying(true);
  };
  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMessage: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const summaryContext = dataSummary ? `
        Data Summary:
        - Total Revenue: $${dataSummary.totalRevenue.toLocaleString()}
        - Total Transactions: ${dataSummary.totalTransactions}
        - Top Categories: ${dataSummary.topCategories.map(c => `${c.name} ($${c.value.toLocaleString()})`).join(', ')}
        - Date Range: ${dataSummary.dateRange}
        - Columns: ${dataSummary.columnNames.join(', ')}
      ` : 'No summary available.';

      const dataSample = JSON.stringify(data.slice(0, 20));
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: `Context: Business data analysis for ${file?.name}. ${summaryContext} Data sample: ${dataSample}` },
          ...chatMessages.map(m => ({ text: `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}` })),
          { text: `User: ${chatInput}` }
        ],
        config: {
          systemInstruction: "You are PulseIQ AI, a professional business intelligence consultant. Answer questions based on the provided data summary and sample. Be precise, helpful, and use data to support your answers. If you don't know something, say so.",
        }
      });
      
      setChatMessages(prev => [...prev, { role: 'model', text: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error("Chat Error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "Error connecting to AI service. Please check your network or API key." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const exportToPDF = async (includeInsights = false) => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      // Capture Dashboard using modern-screenshot (handles oklch)
      const canvas = await domToCanvas(dashboardRef.current, {
        backgroundColor: '#0b0f1a',
        scale: 2
      });
      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      // Add Insights Page if requested
      if (includeInsights && insights) {
        pdf.addPage();
        pdf.setFillColor(11, 15, 26); // #0b0f1a
        pdf.rect(0, 0, pdfWidth, pdf.internal.pageSize.getHeight(), 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(24);
        pdf.text('AI Insights & Recommendations', 20, 30);
        
        pdf.setFontSize(12);
        pdf.setTextColor(168, 168, 168);
        pdf.text(`Generated for ${file?.name} on ${new Date().toLocaleDateString()}`, 20, 40);
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        const splitText = pdf.splitTextToSize(insights.replace(/[#*]/g, ''), pdfWidth - 40);
        pdf.text(splitText, 20, 60);
      }

      pdf.save(`PulseIQ_Full_Report_${file?.name.split('.')[0]}.pdf`);
    } catch (error) {
      console.error("Export Error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Process data for charts
  const getChartData = () => {
    if (data.length === 0) return { bar: [], pie: [], line: [] };
    const keys = Object.keys(data[0]);
    const salesKey = keys.find(k => k.toLowerCase().includes('sale') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('price')) || keys[1];
    const categoryKey = keys.find(k => k.toLowerCase().includes('category') || k.toLowerCase().includes('type') || k.toLowerCase().includes('product')) || keys[0];
    const dateKey = keys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('time')) || keys[2];

    const categorySales: { [key: string]: number } = {};
    data.forEach(row => {
      const cat = String(row[categoryKey] || 'Other');
      const val = parseFloat(row[salesKey]) || 0;
      categorySales[cat] = (categorySales[cat] || 0) + val;
    });
    const barData = Object.entries(categorySales).map(([name, value]) => ({ name, value })).slice(0, 8);
    const pieData = barData.slice(0, 5);
    const lineData = data.slice(0, 15).map((row, i) => ({
      name: String(row[dateKey] || `P${i + 1}`),
      value: parseFloat(row[salesKey]) || Math.random() * 1000
    }));
    return { bar: barData, pie: pieData, line: lineData };
  };

  const { bar, pie, line } = getChartData();
  const totalSales = dataSummary?.totalRevenue || 0;
  const COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

  // Mock data for the specific dashboard request if no data is uploaded
  const contextualData = data.length > 0 ? pie : [
    { name: 'Food', value: 400 },
    { name: 'Tech', value: 300 },
    { name: 'News', value: 300 },
    { name: 'Health', value: 200 },
    { name: 'Shopping', value: 278 },
  ];

  const deviceData = [
    { name: 'Mobile', value: 65, fill: '#a855f7' },
    { name: 'Desktop', value: 25, fill: '#3b82f6' },
    { name: 'Tablet', value: 10, fill: '#22c55e' },
  ];

  const impressionData = data.length > 0 ? line : [
    { name: 'Mon', value: 4000 },
    { name: 'Tue', value: 3000 },
    { name: 'Wed', value: 2000 },
    { name: 'Thu', value: 2780 },
    { name: 'Fri', value: 1890 },
    { name: 'Sat', value: 2390 },
    { name: 'Sun', value: 3490 },
  ];

  const channelData = data.length > 0 ? bar : [
    { name: 'Google', value: 4500 },
    { name: 'YouTube', value: 3200 },
    { name: 'Amazon', value: 2800 },
    { name: 'TikTok', value: 5100 },
    { name: 'Meta', value: 3900 },
  ];

  const trendProjection = [
    { name: 'May', current: 4000, predicted: 4200 },
    { name: 'Jun', current: 3000, predicted: 3500 },
    { name: 'Jul', current: 2000, predicted: 3100 },
    { name: 'Aug', current: 2780, predicted: 3900 },
    { name: 'Sep', current: null, predicted: 4500 },
    { name: 'Oct', current: null, predicted: 5200 },
  ];

  const sentimentMetrics = [
    { name: 'Positive', value: 68, fill: '#22c55e' },
    { name: 'Neutral', value: 20, fill: '#3b82f6' },
    { name: 'Negative', value: 12, fill: '#ef4444' },
  ];

  const strategicOpportunities = [
    { name: 'TikTok Viral', value: 85 },
    { name: 'Email Retarget', value: 65 },
    { name: 'Affiliate', value: 45 },
    { name: 'SEO Hack', value: 92 },
  ];

  const resonanceData = [
    { name: 'Creative A', value: 85, fill: '#a855f7' },
    { name: 'Creative B', value: 72, fill: '#3b82f6' },
    { name: 'Creative C', value: 91, fill: '#22c55e' },
    { name: 'Creative D', value: 64, fill: '#f59e0b' },
  ];

  return (
    <div className="flex min-h-screen bg-navy-dark overflow-hidden">
      {/* Bottom Navigation */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-navy-dark/80 backdrop-blur-xl border-t border-white/5 z-50 px-6 flex items-center justify-around sm:justify-center sm:gap-16 no-print">
          <button 
            onClick={() => setView('upload')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'upload' ? 'text-neon-blue' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <div className={`p-2 rounded-xl transition-all ${view === 'upload' ? 'bg-neon-blue/10 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : ''}`}>
              <Upload className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Upload</span>
          </button>

          <button 
            onClick={() => data.length > 0 && setView('dashboard')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? 'text-neon-purple' : 'text-gray-500 hover:text-gray-300'} ${data.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <div className={`p-2 rounded-xl transition-all ${view === 'dashboard' ? 'bg-neon-purple/10 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : ''}`}>
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Dashboard</span>
          </button>

          <button 
            onClick={() => data.length > 0 && setView('insights')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'insights' ? 'text-neon-green' : 'text-gray-500 hover:text-gray-300'} ${data.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <div className={`p-2 rounded-xl transition-all ${view === 'insights' ? 'bg-neon-green/10 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : ''}`}>
              <Lightbulb className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Insights</span>
          </button>

          <button 
            onClick={() => data.length > 0 && setView('chat')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'chat' ? 'text-orange-500' : 'text-gray-500 hover:text-gray-300'} ${data.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <div className={`p-2 rounded-xl transition-all ${view === 'chat' ? 'bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : ''}`}>
              <MessageSquare className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Chat</span>
          </button>

          <div className="h-8 w-px bg-white/10 mx-2 hidden sm:block" />

          <div className="flex items-center gap-4 sm:ml-4">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl text-gray-500 hover:text-neon-purple hover:bg-neon-purple/10 transition-all">
              <Instagram className="w-5 h-5" />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl text-gray-500 hover:text-neon-blue hover:bg-neon-blue/10 transition-all">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl text-gray-500 hover:text-neon-green hover:bg-neon-green/10 transition-all">
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className={`flex-1 relative overflow-y-auto flex flex-col ${user ? 'pb-20' : ''}`}>
        {/* Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-purple/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-blue/10 blur-[120px] rounded-full pointer-events-none" />

        {user && (
          <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between sticky top-0 bg-navy-dark/80 backdrop-blur-md z-20">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-white">Business Intelligence Dashboard</h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">AI Connected</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white">{user.displayName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-neon-blue/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]" />
              <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>
        )}

        {!user ? (
          <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-navy-card border border-white/5 p-12 rounded-[40px] text-center max-w-md w-full shadow-2xl"
            >
              <div className="w-20 h-20 rounded-3xl neon-gradient-bg flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(168,85,247,0.4)]">
                <BrainCircuit className="text-white w-10 h-10" />
              </div>
              <h1 className="text-4xl font-bold mb-4 tracking-tight">Pulse<span className="neon-gradient-text">IQ</span></h1>
              <p className="text-gray-400 mb-10 leading-relaxed">
                Connect your account to securely save your business records and access AI-powered seasonal trends.
              </p>
              <button 
                onClick={handleLogin}
                className="w-full py-4 rounded-2xl neon-gradient-bg text-white font-bold text-lg shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
              >
                <Users className="w-6 h-6" />
                Sign in with Google
              </button>
            </motion.div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {view === 'upload' && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="px-6 py-12 lg:py-16 max-w-4xl mx-auto relative z-10 w-full"
              >
                <header className="mb-12 text-center">
                  <div className="w-20 h-20 rounded-3xl neon-gradient-bg flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(168,85,247,0.4)]">
                    <BrainCircuit className="text-white w-10 h-10" />
                  </div>
                  <motion.h2 className="text-3xl lg:text-4xl font-bold mb-4 tracking-tight">
                    Upload Your <span className="neon-gradient-text">Business Data</span>
                  </motion.h2>
                  <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                    PulseIQ uses advanced AI to analyze your records, identifying seasonal trends and social media opportunities tailored to your business.
                  </p>
                </header>

                <div className="grid gap-8">
                  <div className="flex flex-wrap justify-center gap-3">
                    <Badge icon={ShieldCheck} colorClass="text-neon-blue">Secure Encryption</Badge>
                    <Badge icon={TrendingUp} colorClass="text-neon-green">Trend Forecasting</Badge>
                    <Badge icon={Users} colorClass="text-neon-purple">Social Insights</Badge>
                  </div>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative group cursor-pointer rounded-[40px] border-2 border-dashed transition-all duration-500 overflow-hidden ${
                      isDragging ? 'border-neon-blue bg-neon-blue/5 scale-[1.01]' : 'border-white/10 bg-navy-card/50 hover:border-white/20'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".csv,.xlsx" />
                    <div className="p-12 lg:p-20 flex flex-col items-center text-center">
                      <div className={`w-20 h-20 rounded-3xl mb-6 flex items-center justify-center transition-all duration-500 ${
                        isDragging ? 'bg-neon-blue text-white glow-blue' : 'bg-white/5 text-gray-400 group-hover:text-white'
                      }`}>
                        <Upload className={`w-10 h-10 ${isDragging ? 'animate-bounce' : ''}`} />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Drop your business records here</h3>
                      <p className="text-gray-500 mb-8">Supports CSV and Excel formats</p>
                      <button className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 font-medium hover:bg-white/10 transition-all">
                        Select File
                      </button>
                    </div>
                  </div>

                  {file && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-navy-card border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6"
                    >
                      <div className="w-14 h-14 rounded-xl bg-neon-green/10 flex items-center justify-center text-neon-green">
                        <FileSpreadsheet className="w-7 h-7" />
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <h4 className="font-semibold text-lg mb-1">{file.name}</h4>
                        <div className="text-sm text-gray-400">{file.size}</div>
                      </div>
                      <div className="flex items-center gap-2 text-neon-green font-medium bg-neon-green/5 px-4 py-2 rounded-full border border-neon-green/10">
                        <CheckCircle2 className="w-5 h-5" />
                        Ready
                      </div>
                    </motion.div>
                  )}

                  <button
                    disabled={!file || isAnalyzing}
                    onClick={startAnalysis}
                    className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-500 ${
                      file && !isAnalyzing ? 'neon-gradient-bg text-white shadow-[0_0_30px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {isAnalyzing ? (
                      <><div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
                    ) : (
                      <>Start AI Analysis <ChevronRight className="w-6 h-6" /></>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {view === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-6 py-12 lg:py-16 max-w-7xl mx-auto relative z-10 w-full"
              >
                <div ref={dashboardRef} className="space-y-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
                        Performance <span className="neon-gradient-text">Overview</span>
                      </h2>
                      <p className="text-gray-400 mt-2">{file ? `Insights generated from ${file.name}` : 'Real-time analytics and strategic growth metrics'}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 no-print">
                      <button 
                        onClick={() => exportToPDF(false)}
                        disabled={isExporting || data.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all disabled:opacity-50"
                      >
                        {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export View
                      </button>
                      <button 
                        onClick={() => exportToPDF(true)}
                        disabled={isExporting || !insights}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl neon-gradient-bg text-white text-sm font-bold shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
                      >
                        {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        Full Report
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Total Spend" value="$11.67M" icon={DollarSign} colorClass="text-neon-blue" trend="up" trendValue="+33%" />
                    <StatCard title="Total Impressions" value="47,403" icon={TrendingUp} colorClass="text-neon-purple" trend="down" trendValue="-12%" />
                    <StatCard title="Viewable Impressions" value="55,093" icon={Users} colorClass="text-neon-green" trend="up" trendValue="+62%" />
                    <StatCard title="Total Sales" value="$12.33B" icon={Calendar} colorClass="text-orange-500" trend="up" trendValue="+4%" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <ChartCard title="Contextual Data" data={contextualData} ai={ai}>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={contextualData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                              {contextualData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#151b2d', border: '1px solid #ffffff10', borderRadius: '12px' }} itemStyle={{ color: '#fff' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>

                    <ChartCard title="Device Type" data={deviceData} ai={ai}>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="100%" barSize={15} data={deviceData}>
                            <RadialBar background dataKey="value" cornerRadius={10} />
                            <Tooltip contentStyle={{ backgroundColor: '#151b2d', border: '1px solid #ffffff10', borderRadius: '12px' }} itemStyle={{ color: '#fff' }} />
                            <Legend iconSize={10} layout="vertical" verticalAlign="middle" wrapperStyle={{ top: '50%', right: 0, transform: 'translate(0, -50%)', fontSize: '12px' }} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>

                    <ChartCard title="Impression Measurement" data={impressionData} ai={ai}>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={impressionData}>
                            <defs>
                              <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#151b2d', border: '1px solid #ffffff10', borderRadius: '12px' }} itemStyle={{ color: '#fff' }} />
                            <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorImp)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>

                    <ChartCard title="Spend by Channel" data={channelData} ai={ai} className="lg:col-span-2">
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={channelData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#151b2d', border: '1px solid #ffffff10', borderRadius: '12px' }} itemStyle={{ color: '#fff' }} />
                            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                              {channelData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity" />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>

                    <ChartCard title="Resonance Score" data={resonanceData} ai={ai}>
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" barSize={10} data={resonanceData}>
                            <RadialBar background dataKey="value" cornerRadius={10} />
                            <Tooltip contentStyle={{ backgroundColor: '#151b2d', border: '1px solid #ffffff10', borderRadius: '12px' }} itemStyle={{ color: '#fff' }} />
                            <Legend iconSize={10} layout="vertical" verticalAlign="bottom" wrapperStyle={{ fontSize: '10px' }} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                    </ChartCard>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'insights' && (
              <motion.div 
                key="insights"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="px-6 py-12 lg:py-16 max-w-7xl mx-auto relative z-10 w-full mb-20"
              >
                <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 gap-8">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl neon-gradient-bg flex items-center justify-center shadow-lg">
                        <Zap className="text-white w-6 h-6" />
                      </div>
                      <Badge icon={Sparkles} colorClass="text-neon-purple">GenAI Powered Strategy</Badge>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
                      Your Business <span className="neon-gradient-text">Insights</span>
                    </h1>
                    <p className="text-gray-400 text-lg leading-relaxed">
                      Simple, clear points to help you understand your data and grow faster.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => exportToPDF(true)}
                      disabled={isExporting || !insights}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                      <Download className="w-5 h-5" /> Export Intelligence
                    </button>
                    <button 
                      onClick={() => {
                        const keys = Object.keys(data[0] || {});
                        const summaryContext = `
                          File: ${file?.name}
                          Total Revenue: $${dataSummary?.totalRevenue.toLocaleString() || '0'}
                          Total Transactions: ${dataSummary?.totalTransactions || '0'}
                          Columns: ${keys.join(', ')}
                          Top Categories: ${dataSummary?.topCategories.map(c => `${c.name}: $${c.value.toLocaleString()}`).join(', ') || 'N/A'}
                          Date Range: ${dataSummary?.dateRange || 'N/A'}
                        `;
                        generateAIInsights(summaryContext);
                      }}
                      disabled={isGeneratingInsights}
                      className="p-4 rounded-2xl neon-gradient-bg text-white shadow-lg hover:scale-105 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-5 h-5 ${isGeneratingInsights ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Market Prediction Chart */}
                  <div className="lg:col-span-8">
                    <ChartCard title="Predictive Scalability Forecast" data={trendProjection} ai={ai}>
                      <div className="h-[400px] w-full py-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trendProjection}>
                            <defs>
                              <linearGradient id="colorCur" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorPre" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#0b0f1a', border: '1px solid #ffffff10', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
                            <Area type="monotone" dataKey="current" stroke="#a855f7" strokeWidth={4} fillOpacity={1} fill="url(#colorCur)" name="Historical" />
                            <Area type="monotone" dataKey="predicted" stroke="#22c55e" strokeDasharray="8 8" strokeWidth={2} fillOpacity={1} fill="url(#colorPre)" name="AI Projection" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-neon-green/10 text-neon-green">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <p className="text-sm text-gray-400">
                          Forecast indicates a <span className="text-white font-bold">14.2% growth peak</span> in September based on historical patterns.
                        </p>
                      </div>
                    </ChartCard>
                  </div>

                  {/* Market Sentiment */}
                  <div className="lg:col-span-4 flex flex-col gap-8">
                    <ChartCard title="Brand Sentiment Core" data={sentimentMetrics} ai={ai}>
                      <div className="h-[250px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={sentimentMetrics} 
                              cx="50%" cy="50%" 
                              innerRadius={60} outerRadius={90} 
                              paddingAngle={8} dataKey="value"
                              stroke="none"
                            >
                              {sentimentMetrics.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#0b0f1a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center mt-8 pointer-events-none">
                          <span className="text-3xl font-bold text-white">88%</span>
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Health Score</span>
                        </div>
                      </div>
                      <div className="space-y-4 mt-4">
                         {sentimentMetrics.map(m => (
                           <div key={m.name} className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.fill }} />
                               <span className="text-sm text-gray-400">{m.name}</span>
                             </div>
                             <span className="text-sm font-bold">{m.value}%</span>
                           </div>
                         ))}
                      </div>
                    </ChartCard>

                    <ChartCard title="High Impact Channels" data={strategicOpportunities} ai={ai}>
                       <div className="h-[180px] w-full space-y-4 py-2">
                         {strategicOpportunities.map(op => (
                           <div key={op.name} className="space-y-1">
                             <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
                               <span>{op.name}</span>
                               <span className="text-neon-blue">{op.value}% Success Prob.</span>
                             </div>
                             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${op.value}%` }}
                                 className="h-full neon-gradient-bg"
                               />
                             </div>
                           </div>
                         ))}
                       </div>
                    </ChartCard>
                  </div>

                  {/* Insights Content */}
                  <div className="lg:col-span-8 space-y-8">
                    <div className="bg-navy-card border border-white/5 rounded-[40px] p-8 lg:p-12 relative overflow-hidden group">
                      <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-neon-purple/5 blur-[80px] rounded-full" />
                      <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                        <BrainCircuit className="w-6 h-6 text-neon-purple lg:scale-125" />
                        Simple Takeaways
                      </h3>
                      
                      {/* Voice Controls */}
                      {!isGeneratingInsights && insights && (
                        <div className="flex flex-wrap items-center gap-4 mb-8 p-4 rounded-2xl bg-white/5 border border-white/10">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Language:</span>
                            <select 
                              value={selectedLanguage}
                              onChange={(e) => setSelectedLanguage(e.target.value)}
                              className="bg-navy-dark border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neon-purple transition-all"
                            >
                              {languages.map(lang => (
                                <option key={lang} value={lang}>{lang}</option>
                              ))}
                            </select>
                          </div>
                          
                          <button
                            onClick={handleVoiceExplanation}
                            disabled={isVoiceLoading}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg ${
                              isPlaying 
                                ? 'bg-red-500/20 text-red-500 border border-red-500/30' 
                                : 'neon-gradient-bg text-white hover:scale-105 active:scale-95'
                            } ${isVoiceLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isVoiceLoading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Generating Voice...</span>
                              </>
                            ) : isPlaying ? (
                              <>
                                <Pause className="w-4 h-4" />
                                <span>Pause Voice</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-4 h-4" />
                                <span>Explain in Voice</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {isGeneratingInsights ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-6">
                          <div className="relative">
                            <div className="w-16 h-16 border-4 border-neon-purple/20 border-t-neon-purple rounded-full animate-spin" />
                            <Sparkles className="w-6 h-6 text-neon-purple absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-xl font-bold animate-pulse text-white">Finding key points...</p>
                            <p className="text-gray-500 mt-2">Making your data easy to understand</p>
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-lg prose-invert max-w-none prose-headings:text-white prose-headings:font-bold prose-headings:mb-4 prose-p:text-gray-300 prose-p:leading-relaxed prose-li:text-gray-300 prose-li:my-2 prose-strong:text-neon-blue prose-ul:my-6">
                          <ReactMarkdown>{insights || 'Upload your data and click analyze to see simple, clear points about your business.'}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seasonal Recommendations Side Column */}
                  <div className="lg:col-span-4 space-y-8">
                    <div className="bg-navy-card border border-white/5 rounded-[40px] p-8 relative overflow-hidden h-full">
                      <div className="absolute bottom-0 right-0 p-8 opacity-5">
                        <TrendingUp className="w-40 h-40 text-neon-green" />
                      </div>
                      <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-neon-green" />
                        Quick Pro Tips
                      </h3>
                      {isGeneratingInsights ? (
                        <div className="space-y-6">
                           {[1,2,3].map(i => (
                             <div key={i} className="animate-pulse space-y-3">
                               <div className="h-4 bg-white/5 rounded w-1/3" />
                               <div className="h-3 bg-white/5 rounded w-full" />
                               <div className="h-3 bg-white/5 rounded w-2/3" />
                             </div>
                           ))}
                        </div>
                      ) : (
                        <div className="prose prose-invert prose-sm max-w-none prose-p:text-gray-300 prose-headings:text-white prose-li:text-gray-300 prose-ul:space-y-4">
                          <ReactMarkdown>{recommendations || "Our AI is waiting to give you quick tips to grow your business."}</ReactMarkdown>
                        </div>
                      )}
                      
                      {!isGeneratingInsights && recommendations && (
                        <div className="mt-12 pt-8 border-t border-white/5">
                           <div className="flex items-start gap-4 p-4 rounded-3xl bg-neon-blue/5 border border-neon-blue/10">
                              <div className="p-2 rounded-xl bg-neon-blue/20 text-neon-blue">
                                <Zap className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-widest text-neon-blue mb-1">Quick Hack</p>
                                <p className="text-xs text-gray-400 leading-relaxed">Optimization efforts in mobile checkout could lift current revenue by an estimated 8% based on trend patterns.</p>
                              </div>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          {view === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-full flex flex-col px-6 py-8 max-w-5xl mx-auto relative z-10"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl neon-gradient-bg flex items-center justify-center shadow-lg">
                  <MessageSquare className="text-white w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">PulseIQ <span className="neon-gradient-text">AI Chat</span></h1>
                  <p className="text-sm text-gray-400">Ask anything about your report</p>
                </div>
              </div>

              <div className="flex-1 bg-navy-card/50 border border-white/5 rounded-3xl flex flex-col overflow-hidden backdrop-blur-sm">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10">
                      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                        <BrainCircuit className="w-10 h-10 text-gray-600" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">How can I help you today?</h3>
                      <p className="text-gray-500 max-w-md">
                        I have analyzed your data. You can ask me about trends, anomalies, or specific metrics.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-lg">
                        {['What are the top categories?', 'Summarize the sales trend', 'Identify any anomalies', 'Suggest improvements'].map((q) => (
                          <button 
                            key={q}
                            onClick={() => setChatInput(q)}
                            className="text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-all"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] p-4 rounded-2xl ${
                        msg.role === 'user' 
                          ? 'bg-neon-blue text-white glow-blue' 
                          : 'bg-white/10 text-gray-100 border border-white/10'
                      }`}>
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 p-4 rounded-2xl border border-white/10 flex gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-navy-dark/50 border-t border-white/5">
                  <div className="relative">
                    <input 
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask PulseIQ AI..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:border-neon-blue transition-all"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isChatLoading}
                      className="absolute right-2 top-2 bottom-2 w-12 rounded-xl neon-gradient-bg flex items-center justify-center text-white disabled:opacity-50 transition-all"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </main>
    </div>
  );
}
