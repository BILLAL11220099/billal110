import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, Search, Filter, ShieldCheck, ChevronDown, ChevronUp, Star, Bookmark, CheckSquare, 
  Award, Play, Moon, Sun, Clock, 
  HelpCircle, ThumbsUp, Check, AlertTriangle, Eye, RefreshCw, Sparkles, LogOut, ArrowRight, Activity
} from "lucide-react";
import { UserSession, ChecklistItem } from "../types";
import { OPENING_STEPS, CLOSING_STEPS, ProceduralStep } from "../data/mcdProceduresData";

interface DailySystemPanelProps {
  checklist: ChecklistItem[]; // We can still support the existing checklist prop or log to preserve standard records!
  currentSession: UserSession;
  activeSelectedChecklist: any | null; // Support the select callback from core search
  onSave: (checklistList: ChecklistItem[]) => void;
}

// Interactive Quizzes Definition
interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
}

const TRAINING_QUIZZES: Quiz[] = [
  {
    id: "quiz_food_safety",
    title: "Food Safety & HACCP Standards",
    description: "Verify your knowledge of temperature logs, thermometer calibration, and critical cooling values.",
    questions: [
      {
        question: "What is the standard procedure to calibrate a digital thermometer temperature probe?",
        options: [
          "Wipe it down with a dry napkin and check if the screen lights up.",
          "Hold it over the flat top grill surface for exactly 15 seconds.",
          "Stir it continuously in a cup of 50/50 crushed ice and clean cold water to reach 32°F (0°C).",
          "Rinse it under hot tap water until the display stops changing."
        ],
        answerIndex: 2,
        explanation: "Digital probes must be calibrated in a balanced ice-water bath to register a exact freeze point of 32°F (0°C). This ensures all subsequent product logs are accurate and prevent critical safety failures."
      },
      {
        question: "Below what operational level does deep fryer oil present a severe ignition and fire hazard?",
        options: [
          "Below the minimum engraved level-fill line, exposing heating elements.",
          "Above the rear basket holding hook.",
          "Exactly halfway to the sediment zone.",
          "When it begins to smoke during hashbrown drops."
        ],
        answerIndex: 0,
        explanation: "Running vats with oil below the minimum mark leaves heating elements exposed to direct air contact, causing rapid overheating and potential fat fire ignition."
      },
      {
        question: "Where must the sanitizing ice scoop be housed when not in active use?",
        options: [
          "Left resting inside the cold ice pile so it stays cold.",
          "Resting on top of the exterior lid fold.",
          "Hanging from the wire rack near the beverage nozzles.",
          "Safely placed inside the dedicated dry sanitizing scoop holder."
        ],
        answerIndex: 3,
        explanation: "Leaving scoops buried inside the ice hopper invites hand-grease cross-contamination. It must always reside in its designated holder."
      },
      {
        question: "What are the correct holding temperatures for refrigerators and walk-in freezers respectively?",
        options: [
          "Under 50°F (10°C) for chillers and 15°F (-9°C) for freezers.",
          "33°F-40°F (0.5°C-4°C) for refrigerators and 0°F (-18°C) or lower for freezers.",
          "45°F-55°F (7°C-13°C) for walk-ins and 32°F (0°C) for chest freezers.",
          "Exactly 32°F (0°C) for both to conserve power."
        ],
        answerIndex: 1,
        explanation: "To halt bacterial growth, refrigerators must remain cold between 33°F-40°F, and freezers must be kept frozen at 0°F or lower (-18°C)."
      }
    ]
  },
  {
    id: "quiz_opening_grill",
    title: "Opening & Grill Operations Mastery",
    description: "Validate morning setup routines, clamshell configurations, and staggered power schedules.",
    questions: [
      {
        question: "Why should crew members stagger the startup of heavy equipment and holding cabinets during opening?",
        options: [
          "To allow different crew members to take breaks in between.",
          "To prevent heavy power surges and electrical trips at the breaker panels.",
          "Because toasters cannot heat up if the grills are active.",
          "To allow the ventilation hoods to pre-spin for exactly 45 minutes."
        ],
        answerIndex: 1,
        explanation: "Simultaneous power activation on heavy kitchen heating elements and compressors creates a high amperage spike, which can easily trip main breakers."
      },
      {
        question: "When starting breakfast grill operations, which setting must immediately be verified?",
        options: [
          "Select Lunch/Dinner standard burger plates.",
          "The 'Breakfast' configuration, checking Teflon sheets for round eggs & sausage profiles.",
          "Initiate deep clean cycles with chemical acid pads.",
          "Turn heat plates down to 150°F stand-by mode."
        ],
        answerIndex: 1,
        explanation: "Breakfast sausage patties and egg profiles require custom temperature settings and aligned, clean Teflon sheets on clamshell grills."
      },
      {
        question: "If you detect signs of forced entry at the exterior door during opening, what should you do?",
        options: [
          "Go inside quickly, lock the door, and look for intruders.",
          "Ignore it and start heating up the grills to stick to schedule.",
          "Do not go inside. Stand back in a safe spot and contact local emergency lines immediately.",
          "Wait 10 minutes to see if any suspect leaves the building."
        ],
        answerIndex: 2,
        explanation: "Safety first! If secure entries look tampered with, never enter alone; call authorities immediately from a safe coordinate."
      }
    ]
  },
  {
    id: "quiz_closing",
    title: "Closing & Cleanliness Protocols",
    description: "Verify color-coded mop requirements, trash security, and till balancing protocols.",
    questions: [
      {
        question: "Are crew members permitted to utilize the kitchen grease mops in the customer lobby dining areas?",
        options: [
          "Yes, to save water and speed up closing chores.",
          "No - to prevent slippery grease films, slipping accidents, and standard cross-contamination.",
          "Only if the manager is not on the floor to inspect.",
          "Only during rainy seasons when mud tracks are thick."
        ],
        answerIndex: 1,
        explanation: "FOH and BOH use separate color-coded mops. Using grease-saturated kitchen mops in the lobby creates dangerous, oily slip hazards and transfers BOH grime to guest spaces."
      },
      {
        question: "What is the critical safety rule when carrying trash out to late-night dumpsters?",
        options: [
          "Prop the back door open with a box to return quickly.",
          "Carry garbage alone to show independent crew efficiency.",
          "Always take trash out in pairs (2-person buddy rule) and lock back exit doors immediately behind you.",
          "Wait until the morning shift crew arrives to take out trash."
        ],
        answerIndex: 2,
        explanation: "Taking trash out in pairs after dark prevents ambush security risks and protects crew safety under standard double-custody safety guidelines."
      },
      {
        question: "When cleaning clamshell grills, what protective gear is strictly required?",
        options: [
          "An apron and standard kitchen wash cloth.",
          "Safety goggles, heavy heat-insulated arm sleeves, and high-temperature protective gloves.",
          "Surgical breathing mask only.",
          "Standard hairnet and a metal plate scraper."
        ],
        answerIndex: 1,
        explanation: "High-temperature grill chemicals and scraping steam can cause severe burns. Heavy heat-insulated sleeves, thick gloves, and goggles are mandatory safety gear."
      }
    ]
  }
];

export default function DailySystemPanel({
  checklist,
  currentSession,
  activeSelectedChecklist,
  onSave
}: DailySystemPanelProps) {
  // Navigation tabs for the daily system
  const [activeSubTab, setActiveSubTab] = useState<"opening" | "closing" | "training">("opening");

  // Global Interactive States
  const [searchTerm, setSearchTerm] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<ProceduralStep[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("mcd_dark_mode") === "true";
  });

  // Local Storage lists for interactive bookmarks, favorites, and progress
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("mcd_bookmarks") || "[]");
    } catch {
      return [];
    }
  });

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("mcd_favorites") || "[]");
    } catch {
      return [];
    }
  });

  // Mastered steps tracking
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("mcd_learning_progress") || "[]");
    } catch {
      return [];
    }
  });

  // Filter category in procedures
  const [procedureFilter, setProcedureFilter] = useState<"all" | "bookmarked" | "favorites" | "mastered">("all");

  // Quiz interactive states
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [quizScore, setQuizScore] = useState<number>(0);
  const [isQuizComplete, setIsQuizComplete] = useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState<boolean>(false);
  const [quizAttempts, setQuizAttempts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("mcd_quiz_scores") || "{}");
    } catch {
      return {};
    }
  });

  // Persistence of Dark mode
  useEffect(() => {
    localStorage.setItem("mcd_dark_mode", String(isDarkMode));
  }, [isDarkMode]);

  // Sync state to local storage when changed
  useEffect(() => {
    localStorage.setItem("mcd_bookmarks", JSON.stringify(bookmarkedIds));
  }, [bookmarkedIds]);

  useEffect(() => {
    localStorage.setItem("mcd_favorites", JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    localStorage.setItem("mcd_learning_progress", JSON.stringify(completedSteps));
  }, [completedSteps]);

  // Real-time synchronization of completed/mastered steps with the Firestore checklist collection
  useEffect(() => {
    if (checklist) {
      const allSteps = [...OPENING_STEPS, ...CLOSING_STEPS];
      const completedFromDb = allSteps
        .filter((step) => {
          const matched = checklist.find((c) => c.id === step.id || c.task === step.title);
          return matched ? matched.completed : false;
        })
        .map((step) => step.id);

      setCompletedSteps((prev) => {
        const prevSorted = [...prev].sort().join(",");
        const dbSorted = [...completedFromDb].sort().join(",");
        if (prevSorted !== dbSorted) {
          return completedFromDb;
        }
        return prev;
      });
    }
  }, [checklist]);

  // Handle Search Input Suggestions
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const val = searchTerm.toLowerCase();
    const all = [...OPENING_STEPS, ...CLOSING_STEPS];
    const filtered = all.filter(step => 
      step.title.toLowerCase().includes(val) || 
      step.description.toLowerCase().includes(val) ||
      step.purpose.toLowerCase().includes(val) ||
      step.importantNotes.toLowerCase().includes(val)
    );
    setSearchSuggestions(filtered.slice(0, 5));
  }, [searchTerm]);

  const handleSuggestionClick = (step: ProceduralStep) => {
    setActiveSubTab(step.category === "Opening" ? "opening" : "closing");
    setExpandedStepId(step.id);
    setSearchTerm("");
    setSearchSuggestions([]);
    
    // Smooth scroll
    setTimeout(() => {
      const element = document.getElementById(`step-card-${step.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("ring-2", isDarkMode ? "ring-amber-400" : "ring-[#DA291C]", "ring-offset-2", "scale-[1.02]", "transition-all", "duration-500");
        setTimeout(() => {
          element.classList.remove("ring-2", isDarkMode ? "ring-amber-400" : "ring-[#DA291C]", "ring-offset-2", "scale-[1.02]");
        }, 3000);
      }
    }, 200);
  };

  // Toggle helpers
  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedIds(prev => 
      prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
    );
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteIds(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const toggleStepMastery = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletedSteps(prev => {
      const isCompleted = prev.includes(id);
      const next = isCompleted ? prev.filter(cId => cId !== id) : [...prev, id];
      
      const stepDetail = OPENING_STEPS.find(s => s.id === id) || CLOSING_STEPS.find(s => s.id === id);
      const existsInList = checklist.some(item => item.id === id || (stepDetail && item.task === stepDetail.title));
      
      let standardChecklistTasks: ChecklistItem[] = [];

      if (existsInList) {
        standardChecklistTasks = checklist.map(item => {
          if (item.id === id || (stepDetail && item.task === stepDetail.title)) {
            return {
              ...item,
              id: item.id || id,
              completed: !isCompleted,
              completedBy: !isCompleted ? currentSession.username : undefined,
              timeCompleted: !isCompleted ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
            };
          }
          return item;
        });
      } else if (stepDetail) {
        const newItem: ChecklistItem = {
          id: id,
          task: stepDetail.title,
          category: activeSubTab === "closing" ? "Closing" : "Opening",
          completed: !isCompleted,
          completedBy: !isCompleted ? currentSession.username : undefined,
          timeCompleted: !isCompleted ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
        };
        standardChecklistTasks = [...checklist, newItem];
      } else {
        standardChecklistTasks = [...checklist];
      }

      onSave(standardChecklistTasks);
      return next;
    });
  };

  const handleResetQuiz = () => {
    setCurrentQuestionIdx(0);
    setQuizScore(0);
    setIsQuizComplete(false);
    setSelectedAnswer(null);
    setAnswerSubmitted(false);
  };

  const handleStartQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    handleResetQuiz();
  };

  const handleAnswerClick = (index: number) => {
    if (answerSubmitted) return;
    setSelectedAnswer(index);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null || !selectedQuiz) return;
    setAnswerSubmitted(true);
    const isCorrect = selectedAnswer === selectedQuiz.questions[currentQuestionIdx].answerIndex;
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (!selectedQuiz) return;
    setSelectedAnswer(null);
    setAnswerSubmitted(false);
    
    if (currentQuestionIdx < selectedQuiz.questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      setIsQuizComplete(true);
      // Save attempt to local storage
      const percentage = Math.round((quizScore / selectedQuiz.questions.length) * 100);
      const updatedScores = {
        ...quizAttempts,
        [selectedQuiz.id]: percentage
      };
      setQuizAttempts(updatedScores);
      localStorage.setItem("mcd_quiz_scores", JSON.stringify(updatedScores));
    }
  };

  // Progress metrics
  const totalSteps = OPENING_STEPS.length + CLOSING_STEPS.length;
  const openingMastered = OPENING_STEPS.filter(s => completedSteps.includes(s.id)).length;
  const closingMastered = CLOSING_STEPS.filter(s => completedSteps.includes(s.id)).length;
  const overallMasteryPercent = Math.round((completedSteps.length / totalSteps) * 100) || 0;

  // Final rendering lists based on sub-tab and dynamic filters (bookmarked, favorites, mastered)
  const unfilteredSteps = activeSubTab === "opening" ? OPENING_STEPS : CLOSING_STEPS;
  
  const filteredSteps = unfilteredSteps.filter(step => {
    // text search
    if (searchTerm.trim()) {
      const matchText = searchTerm.toLowerCase();
      const inTitle = step.title.toLowerCase().includes(matchText);
      const inDesc = step.description.toLowerCase().includes(matchText);
      const inPurpose = step.purpose.toLowerCase().includes(matchText);
      const inNotes = step.importantNotes.toLowerCase().includes(matchText);
      if (!inTitle && !inDesc && !inPurpose && !inNotes) return false;
    }

    if (procedureFilter === "bookmarked") return bookmarkedIds.includes(step.id);
    if (procedureFilter === "favorites") return favoriteIds.includes(step.id);
    if (procedureFilter === "mastered") return completedSteps.includes(step.id);
    return true;
  });

  return (
    <div className={`rounded-2xl border transition-all duration-300 font-sans ${
      isDarkMode 
        ? "bg-slate-900 border-slate-800 text-slate-100" 
        : "bg-slate-50 border-slate-200 text-slate-800"
    } p-3 sm:p-6 space-y-6 shadow-xs`}>
      
      {/* 1. COMPONENT HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-[#DA291C] text-white p-1.5 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase flex items-center gap-2 text-[#DA291C] dark:text-amber-400">
              MCDONALD'S RESTAURANT DAILY SYSTEM
            </h1>
          </div>
          <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"} max-w-2xl`}>
            Step-by-step Standard Operating Procedures (SOPs) for shift openers, closers, and trainers. Take quizzes to verify crew mastery and play video guides natively.
          </p>
        </div>

        {/* Global theme toggle & statistics quick tag */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Progress Badge */}
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl ${
            isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
          } border shadow-2xs`}>
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Mastery: <span className="text-[#DA291C] dark:text-amber-400 font-black">{overallMasteryPercent}%</span></span>
            <div className="w-16 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden shrink-0">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${overallMasteryPercent}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2.5 rounded-xl border cursor-pointer transition-all hover:scale-105 ${
              isDarkMode 
                ? "bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-755" 
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode for Night Shifts"}
          >
            {isDarkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>

      {/* 2. SMART SEARCH BAR (WITH DROPDOWN SUGGESTIONS) */}
      <div className="relative w-full">
        <label htmlFor="smart-search-procedures" className="absolute left-3.5 top-3.5 flex items-center pointer-events-none">
          <Search className={`w-4 h-4 ${isDarkMode ? "text-slate-400" : "text-slate-400"}`} />
        </label>
        <input
          id="smart-search-procedures"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Smart Search: Type any opening step, closing step, grill calibrate, cleaning, or food safety protocol..."
          className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 transition-all ${
            isDarkMode 
              ? "bg-slate-800 border-slate-700 text-white placeholder-slate-505 focus:ring-amber-500" 
              : "bg-white border-slate-300 text-slate-850 placeholder-slate-405 focus:ring-[#DA291C]"
          } border shadow-xs`}
        />
        
        {/* Instant suggestion dropdown */}
        {searchSuggestions.length > 0 && (
          <div className={`absolute left-0 right-0 mt-1.5 rounded-xl border shadow-lg z-50 overflow-hidden divide-y ${
            isDarkMode 
              ? "bg-slate-850 border-slate-700 divide-slate-750" 
              : "bg-white border-slate-201 divide-slate-100"
          }`}>
            <div className={`text-[10px] font-bold px-3.5 py-2 uppercase tracking-widest ${isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-50 text-slate-500"}`}>
              Instant SOP Suggestions
            </div>
            {searchSuggestions.map(step => (
              <button
                key={step.id}
                onClick={() => handleSuggestionClick(step)}
                className={`w-full text-left p-3 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                  isDarkMode ? "hover:bg-slate-750 text-slate-200" : "hover:bg-slate-50 text-slate-850"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate flex items-center gap-1.5 text-[#DA291C] dark:text-amber-400">
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      Step {step.stepNumber} - {step.category}
                    </span>
                    {step.title}
                  </div>
                  <p className={`truncate text-[10px] mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {step.description}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
          </div>
        )}
      </div>



      {/* 3. CORE SUB-PANEL NAVIGATION */}
      <div className="flex flex-wrap items-center gap-1.5 border-b pb-1 border-slate-200 dark:border-slate-800">
        <button
          onClick={() => {
            setActiveSubTab("opening");
            setProcedureFilter("all");
          }}
          className={`flex items-center gap-2 text-xs font-black px-4 py-2.5 rounded-t-xl transition-all cursor-pointer ${
            activeSubTab === "opening"
              ? "bg-[#DA291C] text-white border-b-2 border-[#FFC72C] shadow-sm transform translate-y-[1px]"
              : isDarkMode 
                ? "text-slate-400 hover:text-white hover:bg-slate-800" 
                : "text-slate-500 hover:text-slate-850 hover:bg-slate-120"
          }`}
        >
          <Clock className="w-4 h-4" />
          1. OPENING PROCEDURES
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 ml-1">
            {openingMastered}/18
          </span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab("closing");
            setProcedureFilter("all");
          }}
          className={`flex items-center gap-2 text-xs font-black px-4 py-2.5 rounded-t-xl transition-all cursor-pointer ${
            activeSubTab === "closing"
              ? "bg-[#DA291C] text-white border-b-2 border-[#FFC72C] shadow-sm transform translate-y-[1px]"
              : isDarkMode 
                ? "text-slate-400 hover:text-white hover:bg-slate-800" 
                : "text-slate-500 hover:text-slate-850 hover:bg-slate-120"
          }`}
        >
          <LogOut className="w-4 h-4 transform rotate-180" />
          2. CLOSING PROCEDURES
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 ml-1">
            {closingMastered}/14
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("training")}
          className={`flex items-center gap-2 text-xs font-black px-4 py-2.5 rounded-t-xl transition-all cursor-pointer ${
            activeSubTab === "training"
              ? "bg-[#FFC72C] text-slate-900 border-b-2 border-[#DA291C] shadow-sm transform translate-y-[1px]"
              : isDarkMode 
                ? "text-slate-400 hover:text-white hover:bg-slate-800" 
                : "text-slate-500 hover:text-slate-850 hover:bg-slate-120"
          }`}
        >
          <Award className="w-4 h-4" />
          3. TRAINING MODE &amp; QUIZZES
        </button>
      </div>

      {/* 4. SUB-PANEL: PROCEDURAL VIEWS (OPENING & CLOSING) */}
      {(activeSubTab === "opening" || activeSubTab === "closing") && (
        <div className="space-y-4">
          
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 p-2 rounded-xl border border-slate-205 dark:border-slate-800">
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 text-slate-500 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filters:
              </span>
              <button
                onClick={() => setProcedureFilter("all")}
                className={`text-[11px] px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  procedureFilter === "all"
                    ? "bg-[#DA291C]/10 text-[#DA291C] dark:text-amber-400 font-extrabold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                All Steps
              </button>
              <button
                onClick={() => setProcedureFilter("bookmarked")}
                className={`text-[11px] px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  procedureFilter === "bookmarked"
                    ? "bg-blue-550/10 text-blue-600 dark:text-blue-400 font-extrabold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" /> Bookmarks ({unfilteredSteps.filter(s => bookmarkedIds.includes(s.id)).length})
              </button>
              <button
                onClick={() => setProcedureFilter("favorites")}
                className={`text-[11px] px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  procedureFilter === "favorites"
                    ? "bg-amber-450/10 text-amber-500 dark:text-amber-400 font-extrabold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <Star className="w-3.5 h-3.5" /> Favorites ({unfilteredSteps.filter(s => favoriteIds.includes(s.id)).length})
              </button>
              <button
                onClick={() => setProcedureFilter("mastered")}
                className={`text-[11px] px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  procedureFilter === "mastered"
                    ? "bg-emerald-555/10 text-emerald-600 dark:text-emerald-400 font-extrabold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" /> Mastered ({unfilteredSteps.filter(s => completedSteps.includes(s.id)).length})
              </button>
            </div>

            <div className="text-[10px] font-mono text-slate-500">
              Showing <span className="font-bold text-[#DA291C] dark:text-amber-400">{filteredSteps.length}</span> of {unfilteredSteps.length} standards
            </div>
          </div>

          {/* Steps List Grid */}
          {filteredSteps.length === 0 ? (
            <div className={`p-12 text-center rounded-2xl border ${
              isDarkMode ? "bg-slate-850 border-slate-800" : "bg-white border-slate-200"
            } space-y-3`}>
              <HelpCircle className="w-10 h-10 mx-auto text-slate-350" />
              <p className="text-sm text-slate-500 font-bold">No operational procedures match your selected filter.</p>
              <button 
                onClick={() => setProcedureFilter("all")}
                className="text-xs text-[#DA291C] dark:text-amber-400 underline font-black cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredSteps.map((step) => {
                const isExpanded = expandedStepId === step.id;
                const isBookmarked = bookmarkedIds.includes(step.id);
                const isFavorite = favoriteIds.includes(step.id);
                const isMastered = completedSteps.includes(step.id);

                return (
                  <div
                    key={step.id}
                    id={`step-card-${step.id}`}
                    onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                    className={`border transition-all duration-300 rounded-xl cursor-pointer ${
                      isExpanded
                        ? isDarkMode 
                          ? "bg-slate-850 border-slate-700 shadow-md transform scale-[1.002]" 
                          : "bg-white border-slate-300 shadow-md transform scale-[1.002]"
                        : isDarkMode
                          ? "bg-slate-800/80 hover:bg-slate-800 border-slate-750"
                          : "bg-white hover:bg-slate-50/50 border-slate-200/90"
                    } p-3.5 sm:p-5`}
                  >
                    
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5 min-w-0">
                        {/* Big Step Number Circle */}
                        <div className={`w-10 h-10 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center justify-center shrink-0 border transition-all ${
                          isMastered
                            ? "bg-emerald-500 border-emerald-555 text-white"
                            : isDarkMode
                              ? "bg-slate-700 border-slate-600 text-slate-300"
                              : "bg-slate-100 border-slate-300 text-slate-600"
                        }`}>
                          {isMastered ? <Check className="w-5 h-5 stroke-[3]" /> : step.stepNumber}
                        </div>

                        {/* Title and main brief */}
                        <div className="min-w-0">
                          <h3 className={`text-sm sm:text-base font-black tracking-tight ${
                            isMastered ? "text-slate-400 line-through font-bold" : isDarkMode ? "text-slate-100" : "text-slate-900"
                          }`}>
                            {step.title}
                          </h3>
                          <p className={`text-xs mt-1 sm:mt-1.5 leading-relaxed line-clamp-2 ${
                            isExpanded ? "" : "opacity-90"
                          } ${isDarkMode ? "text-slate-305" : "text-slate-605"}`}>
                            {step.description}
                          </p>
                        </div>
                      </div>

                      {/* Interactive Buttons (Desktop view) */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        {/* Mastery Button */}
                        <button
                          onClick={(e) => toggleStepMastery(step.id, e)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            isMastered
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-450 dark:border-emerald-800"
                              : isDarkMode
                                ? "bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-400 hover:text-slate-200"
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-750"
                          }`}
                          title={isMastered ? "Mark as Incomplete" : "Mark as Mastered"}
                        >
                          <CheckSquare className={`w-4 h-4 ${isMastered ? "text-emerald-500" : ""}`} />
                        </button>

                        {/* Favorite Star */}
                        <button
                          onClick={(e) => toggleFavorite(step.id, e)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            isFavorite
                              ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900"
                              : isDarkMode
                                ? "bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-400 hover:text-slate-200"
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-755"
                          }`}
                          title="Favorite Standard"
                        >
                          <Star className={`w-4 h-4 ${isFavorite ? "fill-amber-400 text-amber-400" : ""}`} />
                        </button>

                        {/* Bookmark Button */}
                        <button
                          onClick={(e) => toggleBookmark(step.id, e)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            isBookmarked
                              ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900"
                              : isDarkMode
                                ? "bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-400 hover:text-slate-205"
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-750"
                          }`}
                          title="Bookmark SOP"
                        >
                          <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-blue-500 text-blue-500" : ""}`} />
                        </button>

                        <div className={`p-1 text-slate-400 ${isExpanded ? "transform rotate-180" : ""} transition-transform`}>
                          <ChevronDown className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    {/* Expandable Details Container */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-700 dark:text-slate-300 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. Purpose */}
                        <div className={`p-3.5 rounded-xl ${isDarkMode ? "bg-slate-800/50" : "bg-slate-50"} space-y-1`}>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-[#DA291C] dark:text-amber-450 uppercase tracking-wider">
                            <BookOpen className="w-3.5 h-3.5" /> Core Purpose
                          </div>
                          <p className="leading-relaxed font-medium">
                            {step.purpose}
                          </p>
                        </div>

                        {/* 2. Important Notes */}
                        <div className={`p-3.5 rounded-xl ${isDarkMode ? "bg-slate-800/50" : "bg-slate-50"} space-y-1`}>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-450 uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5" /> Quality &amp; Safety Notes
                          </div>
                          <p className="leading-relaxed font-medium">
                            {step.importantNotes}
                          </p>
                        </div>

                        {/* 3. Mistakes to Avoid */}
                        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-rose-950/15 text-rose-800 dark:text-rose-300 space-y-1 border border-red-100 dark:border-rose-950/20">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-[#DA291C] dark:text-rose-400 uppercase tracking-wider">
                            <AlertTriangle className="w-3.5 h-3.5" /> Common Mistakes
                          </div>
                          <p className="leading-relaxed font-medium">
                            {step.commonMistakes}
                          </p>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* 5. SUB-PANEL: TRAINING MODE & INTEGRATIVE QUIZZES */}
      {activeSubTab === "training" && (
        <div className="space-y-6">

          {/* Progress Tracker Card */}
          <div className={`p-4 sm:p-5 rounded-2xl border ${
            isDarkMode 
              ? "bg-gradient-to-br from-slate-850 to-slate-800 border-slate-750" 
              : "bg-gradient-to-br from-[#DA291C]/5 to-[#FFC72C]/10 border-amber-200"
          } grid grid-cols-1 md:grid-cols-3 gap-6 items-center`}>
            
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-black text-[#DA291C] dark:text-amber-400">
                CREW TRAINING STATUS
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Checked off items translate to standard operation procedures memorized and verified inside the live restaurant vats, grills, and front lobby.
              </p>
            </div>

            <div className="space-y-3 md:col-span-2">
              {/* Stats segments */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-white/40 dark:bg-slate-900/40 rounded-xl border">
                  <div className="text-lg font-black text-[#DA291C] dark:text-amber-400">{openingMastered}/18</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Opening Standard</div>
                </div>
                <div className="p-3 bg-white/40 dark:bg-slate-900/40 rounded-xl border">
                  <div className="text-lg font-black text-[#DA291C] dark:text-amber-400">{closingMastered}/14</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Closing Standards</div>
                </div>
                <div className="p-3 bg-white/40 dark:bg-slate-900/40 rounded-xl border">
                  <div className="text-lg font-black text-emerald-500">{overallMasteryPercent}%</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Total Mastery</div>
                </div>
              </div>

              {/* Graphical line progress */}
              <div className="w-full bg-slate-200 dark:bg-slate-750 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-[#DA291C] to-emerald-500 h-full transition-all duration-700"
                  style={{ width: `${overallMasteryPercent}%` }}
                />
              </div>
            </div>

          </div>

          {/* Active Quiz vs Quiz lists */}
          {selectedQuiz ? (
            /* ACTIVE QUIZ MODULE */
            <div className={`p-4 sm:p-6 rounded-2xl border ${
              isDarkMode ? "bg-slate-850 border-slate-700" : "bg-white border-slate-201"
            } space-y-6`}>
              
              {/* Quiz Header */}
              <div className="flex items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-6 h-6 text-amber-500" />
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                      EVALUATION INTERACTIVE
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-[#DA291C] dark:text-amber-400">{selectedQuiz.title}</h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedQuiz(null)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  Exit Quiz
                </button>
              </div>

              {!isQuizComplete ? (
                /* QUIZ ACTIVE Q's */
                <div className="space-y-6">
                  {/* Progress info */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-550">
                    <span>Question {currentQuestionIdx + 1} of {selectedQuiz.questions.length}</span>
                    <span className="text-[#DA291C] dark:text-amber-400">Score: {quizScore}/{selectedQuiz.questions.length}</span>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div 
                      className="bg-amber-400 h-full transition-all duration-300"
                      style={{ width: `${((currentQuestionIdx + 1) / selectedQuiz.questions.length) * 100}%` }}
                    />
                  </div>

                  {/* Question Title */}
                  <h4 className="text-base sm:text-lg font-extrabold text-slate-850 dark:text-white">
                    {selectedQuiz.questions[currentQuestionIdx].question}
                  </h4>

                  {/* Question Options */}
                  <div className="grid grid-cols-1 gap-3">
                    {selectedQuiz.questions[currentQuestionIdx].options.map((opt, i) => {
                      let btnStyle = isDarkMode 
                        ? "bg-slate-800 border-slate-700 hover:bg-slate-750" 
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100";

                      if (selectedAnswer === i) {
                        btnStyle = isDarkMode 
                          ? "bg-amber-400/10 border-amber-400 text-amber-400 ring-2 ring-amber-400/20" 
                          : "bg-red-50 border-[#DA291C]/60 text-[#DA291C] ring-2 ring-[#DA291C]/10";
                      }

                      if (answerSubmitted) {
                        if (i === selectedQuiz.questions[currentQuestionIdx].answerIndex) {
                          btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400 font-bold ring-2 ring-emerald-500/20";
                        } else if (selectedAnswer === i) {
                          btnStyle = "bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-450 font-bold ring-2 ring-rose-500/25";
                        } else {
                          btnStyle = "opacity-45 scale-95 border-slate-100 dark:border-slate-800 cursor-not-allowed";
                        }
                      }

                      return (
                        <button
                          key={i}
                          disabled={answerSubmitted}
                          onClick={() => handleAnswerClick(i)}
                          className={`w-full text-left p-4 rounded-xl border text-xs sm:text-sm transition-all duration-300 flex items-center gap-3 cursor-pointer ${btnStyle}`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border font-bold ${
                            selectedAnswer === i
                              ? "bg-[#DA291C] text-white border-transparent dark:bg-amber-400 dark:text-slate-900"
                              : "text-slate-400 border-slate-300 dark:border-slate-600"
                          }`}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback explanation block */}
                  {answerSubmitted && (
                    <div className={`p-4 rounded-xl border ${
                      selectedAnswer === selectedQuiz.questions[currentQuestionIdx].answerIndex
                        ? "bg-emerald-50 dark:bg-emerald-950/15 border-emerald-250 text-emerald-800 dark:text-emerald-400"
                        : "bg-rose-50 dark:bg-rose-950/15 border-rose-250 text-rose-800 dark:text-rose-300"
                    } space-y-1.5`}>
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
                        {selectedAnswer === selectedQuiz.questions[currentQuestionIdx].answerIndex ? (
                          <><Check className="w-4 h-4 text-emerald-500 stroke-[3]" /> STANDARD COMPLIANT RESULT</>
                        ) : (
                          <><AlertTriangle className="w-4 h-4 text-red-500" /> EXPLANATION OF STANDARD</>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs leading-relaxed font-medium">
                        {selectedQuiz.questions[currentQuestionIdx].explanation}
                      </p>
                    </div>
                  )}

                  {/* Submit / Next Button */}
                  <div className="flex justify-end pt-3">
                    {!answerSubmitted ? (
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={selectedAnswer === null}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-colors ${
                          selectedAnswer === null
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                            : "bg-[#DA291C] hover:bg-[#C21B10] text-white font-extrabold"
                        }`}
                      >
                        Submit Answer
                      </button>
                    ) : (
                      <button
                        onClick={handleNextQuestion}
                        className="bg-emerald-600 hover:bg-emerald-555 text-white font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        {currentQuestionIdx < selectedQuiz.questions.length - 1 ? (
                          <>Next Question <ArrowRight className="w-4 h-4" /></>
                        ) : (
                          "View Evaluation Score"
                        )}
                      </button>
                    )}
                  </div>

                </div>
              ) : (
                /* QUIZ SCORE COMPLETION PREVIEW */
                <div className="p-6 text-center space-y-6 max-w-md mx-auto">
                  <div className="w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mx-auto border-3 border-[#FFC72C]">
                    <Award className="w-12 h-12 text-[#FFC72C]" />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-slate-850 dark:text-white uppercase tracking-tight">
                      Quiz Completed!
                    </h4>
                    <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Standard Operations Knowledge Check Score:
                    </p>
                    <div className="text-4xl font-black text-[#DA291C] dark:text-amber-400">
                      {Math.round((quizScore / selectedQuiz.questions.length) * 100)}%
                    </div>
                    <div className="text-sm font-bold text-slate-500">
                      Correct Answers: {quizScore} out of {selectedQuiz.questions.length}
                    </div>
                  </div>

                  {/* Standard Performance comment */}
                  <div className={`p-4 rounded-xl border ${
                    quizScore === selectedQuiz.questions.length 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-450"
                      : "bg-slate-50 border-slate-201 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  } text-xs font-semibold leading-relaxed`}>
                    {quizScore === selectedQuiz.questions.length ? (
                      "🌟 PERFECT SCORE! You have achieved Certified Kitchen Standard status. Always maintain these critical parameters."
                    ) : quizScore >= selectedQuiz.questions.length - 1 ? (
                      "👍 Excellent mastery! Review the incorrect steps occasionally to lock in 100% calibration compliance."
                    ) : (
                      "⚠️ Trainee review required. Read the procedural step details on standard temp checks and retry to hit 100% compliance."
                    )}
                  </div>

                  <div className="flex gap-2.5 justify-center pt-2">
                    <button
                      onClick={handleResetQuiz}
                      className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer select-none"
                    >
                      Retry Quiz
                    </button>
                    <button
                      onClick={() => setSelectedQuiz(null)}
                      className="bg-[#DA291C] hover:bg-[#C21B10] text-white font-extrabold px-4 py-2 rounded-xl text-xs cursor-pointer select-none"
                    >
                      Return to Quiz List
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* LIST OF ALL RETRIEVABLE QUIZZES */
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                Interactive SOP Assessments ({TRAINING_QUIZZES.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TRAINING_QUIZZES.map(quiz => {
                  const lastPct = quizAttempts[quiz.id];

                  return (
                    <div
                      key={quiz.id}
                      className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                        isDarkMode 
                          ? "bg-slate-850 hover:bg-slate-800 border-slate-750" 
                          : "bg-white hover:bg-slate-50 border-slate-201 shadow-2xs"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="p-2 bg-amber-400/10 text-amber-500 rounded-xl">
                            <BookOpen className="w-5 h-5 text-[#DA291C] dark:text-amber-400" />
                          </span>
                          {lastPct !== undefined && (
                            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                              lastPct === 100 
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                                : "bg-slate-100 text-slate-700"
                            }`}>
                              Last: {lastPct}%
                            </span>
                          )}
                        </div>
                        
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-850 dark:text-white">
                          {quiz.title}
                        </h4>
                        
                        <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"} leading-relaxed line-clamp-3`}>
                          {quiz.description}
                        </p>
                      </div>

                      <div className="pt-4 mt-2">
                        <button
                          onClick={() => handleStartQuiz(quiz)}
                          className="w-full bg-[#DA291C] hover:bg-[#C21B10] dark:bg-amber-400 dark:hover:bg-amber-500 text-white dark:text-slate-900 font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> Start Assessment
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}



    </div>
  );
}
