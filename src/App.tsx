import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  Timer, 
  Trophy, 
  Star, 
  Plus, 
  ChevronRight, 
  CheckCircle2, 
  Book as BookIcon,
  Clock,
  Flame,
  XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Book, UserStats, ReadingSession } from "./types";

export default function App() {
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [view, setView] = useState<"loading" | "setup" | "dashboard" | "reading" | "summary" | "questions" | "celebration">("loading");
  
  // Reading Session State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(20);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Summary State
  const [startPage, setStartPage] = useState(0);
  const [endPage, setEndPage] = useState(0);
  const [chaptersFinished, setChaptersFinished] = useState(0);

  // Questions State
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Celebration State
  const [earnedXp, setEarnedXp] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, []);

const fetchInitialData = async () => {
  try {
    const [bookRes, statsRes] = await Promise.all([
      fetch("/api/books/active"),
      fetch("/api/stats"),
    ]);

    // 🔥 ADD THIS SECTION
    if (!bookRes.ok) {
      throw new Error(`books/active failed: ${bookRes.status}`);
    }

    if (!statsRes.ok) {
      throw new Error(`stats failed: ${statsRes.status}`);
    }
    // 🔥 END ADD

    const book = await bookRes.json();
    const userStats = await statsRes.json();

    setActiveBook(book);
    setStats(userStats);
    setStartPage(book?.current_page || 0);
    setEndPage(book?.current_page || 0);
    setView(book ? "dashboard" : "setup");

  } catch (err) {
    console.error("Failed to fetch data", err);

    // 🚨 This prevents infinite loading
    setView("setup");
  }
};

  const handleStartSession = () => {
    setTimerSeconds(0);
    setIsTimerRunning(true);
    setView("reading");
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
  };

  const handleFinishReading = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsTimerRunning(false);
    setView("summary");
  };

  const calculateXp = () => {
    const minutes = Math.floor(timerSeconds / 60);
    const pages = Math.max(0, endPage - startPage);
    const sessionXp = (minutes * 1) + (pages * 5) + 20; // 20 base XP for finishing
    return sessionXp;
  };

  const handleSummarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setView("questions");
  };

  const getQuestions = () => {
    if (chaptersFinished > 0) {
      return [
        "What are 3 things you learned or found interesting in this chapter?",
        "What are 2 cool details or facts you noticed?",
        "What is 1 question you still have about the story?"
      ];
    }
    return [
      "Find a word you didn't know while reading. What do you think it means? What is the actual definition?",
      "What's one important event or piece of information you learned today?",
      "What do you think is going to happen next in the story?"
    ];
  };

  const handleQuestionSubmit = async () => {
    const xp = calculateXp();
    setEarnedXp(xp);

    const sessionData: ReadingSession = {
      book_id: activeBook!.id,
      start_page: startPage,
      end_page: endPage,
      chapters_finished: chaptersFinished,
      duration_minutes: Math.floor(timerSeconds / 60),
      xp_earned: xp
    };

    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData)
      });
      await fetchInitialData();
      setView("celebration");
    } catch (err) {
      console.error("Failed to save session", err);
    }
  };

  const handleNewBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const bookData = {
      title: formData.get("title"),
      author: formData.get("author"),
      total_pages: parseInt(formData.get("pages") as string)
    };

    try {
      await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookData)
      });
      await fetchInitialData();
    } catch (err) {
      console.error("Failed to create book", err);
    }
  };

  if (view === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <BookOpen className="w-12 h-12 text-amber-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header / XP Bar */}
      <header className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <div className="flex items-center gap-2">
            <div className="bg-amber-400 p-2 rounded-xl border-2 border-slate-900">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Level {stats?.level}</p>
              <h1 className="font-display font-bold text-xl">Reading Quest</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total XP</p>
            <p className="font-display font-bold text-xl text-amber-600">{stats?.total_xp}</p>
          </div>
        </div>
        <div className="h-4 bg-slate-200 rounded-full border-2 border-slate-900 overflow-hidden">
          <motion.div 
            className="h-full bg-amber-400"
            initial={{ width: 0 }}
            animate={{ width: `${((stats?.total_xp || 0) % 500) / 500 * 100}%` }}
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
        {view === "setup" && (
          <motion.div 
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="quest-card"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Plus className="text-amber-500" /> Start a New Book!
            </h2>
            <form onSubmit={handleNewBook} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Book Title</label>
                <input name="title" required className="quest-input" placeholder="e.g. Harry Potter" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Author</label>
                <input name="author" required className="quest-input" placeholder="e.g. J.K. Rowling" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Total Pages</label>
                <input name="pages" type="number" required className="quest-input" placeholder="e.g. 300" />
              </div>
              <button type="submit" className="quest-button w-full mt-4">
                Let's Read!
              </button>
            </form>
          </motion.div>
        )}

        {view === "dashboard" && activeBook && (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="quest-card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{activeBook.title}</h2>
                  <p className="text-slate-500 font-medium">by {activeBook.author}</p>
                </div>
                <button 
                  onClick={() => setView("setup")}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                  title="Change Book"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mb-6">
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span>Progress</span>
                  <span>{Math.round((activeBook.current_page / activeBook.total_pages) * 100)}%</span>
                </div>
                <div className="h-6 bg-slate-100 rounded-xl border-2 border-slate-900 overflow-hidden relative">
                  <motion.div 
                    className="h-full bg-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${(activeBook.current_page / activeBook.total_pages) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest">
                    Page {activeBook.current_page} of {activeBook.total_pages}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-sky-50 p-4 rounded-2xl border-2 border-sky-100">
                  <div className="flex items-center gap-2 text-sky-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Goal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={targetMinutes} 
                      onChange={(e) => setTargetMinutes(parseInt(e.target.value))}
                      className="w-12 bg-transparent font-bold text-xl focus:outline-none"
                    />
                    <span className="font-bold">min</span>
                  </div>
                </div>
                <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-100">
                  <div className="flex items-center gap-2 text-amber-600 mb-1">
                    <Flame className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Streak</span>
                  </div>
                  <p className="font-bold text-xl">3 Days</p>
                </div>
              </div>

              <button onClick={handleStartSession} className="quest-button w-full flex items-center justify-center gap-2">
                <Timer className="w-5 h-5" /> Start Reading Session
              </button>
            </div>
          </motion.div>
        )}

        {view === "reading" && (
          <motion.div 
            key="reading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="quest-card text-center py-12"
          >
            <div className="mb-8 relative inline-block">
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-48 h-48 rounded-full border-8 border-amber-400 flex items-center justify-center bg-amber-50"
              >
                <div>
                  <p className="text-4xl font-display font-bold">
                    {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')}
                  </p>
                  <p className="text-sm font-bold text-amber-600 uppercase tracking-widest mt-1">Reading Time</p>
                </div>
              </motion.div>
            </div>
            
            <h2 className="text-2xl font-bold mb-2">You're doing great!</h2>
            <p className="text-slate-500 mb-8">Keep exploring the world of {activeBook?.title}.</p>
            
            <button onClick={handleFinishReading} className="quest-button bg-emerald-400 border-emerald-600 hover:bg-emerald-500 px-12">
              I'm Finished!
            </button>
          </motion.div>
        )}

        {view === "summary" && (
          <motion.div 
            key="summary"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="quest-card"
          >
            <h2 className="text-2xl font-bold mb-6">Great Reading! 📚</h2>
            <form onSubmit={handleSummarySubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Started on Page</label>
                  <input 
                    type="number" 
                    value={startPage} 
                    onChange={(e) => setStartPage(parseInt(e.target.value))}
                    className="quest-input" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Ended on Page</label>
                  <input 
                    type="number" 
                    value={endPage} 
                    onChange={(e) => setEndPage(parseInt(e.target.value))}
                    className="quest-input" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-1">How many chapters did you finish?</label>
                <div className="flex items-center gap-4">
                  {[0, 1, 2, 3].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setChaptersFinished(num)}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${
                        chaptersFinished === num 
                        ? "bg-amber-400 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]" 
                        : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="quest-button w-full mt-4 flex items-center justify-center gap-2">
                Next: Reflection <ChevronRight className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        )}

        {view === "questions" && (
          <motion.div 
            key="questions"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="quest-card"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Reflection Time</h2>
              <span className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-full">
                Question {currentQuestionIndex + 1} of {getQuestions().length}
              </span>
            </div>

            <div className="mb-8">
              <p className="text-lg font-bold mb-4 text-slate-700">
                {getQuestions()[currentQuestionIndex]}
              </p>
              <textarea 
                className="quest-input h-32 resize-none"
                placeholder="Type your answer here..."
                value={answers[currentQuestionIndex] || ""}
                onChange={(e) => {
                  const newAnswers = [...answers];
                  newAnswers[currentQuestionIndex] = e.target.value;
                  setAnswers(newAnswers);
                }}
              />
            </div>

            <div className="flex gap-4">
              {currentQuestionIndex > 0 && (
                <button 
                  onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                  className="flex-1 py-3 rounded-2xl border-2 border-slate-200 font-bold text-slate-500"
                >
                  Back
                </button>
              )}
              {currentQuestionIndex < getQuestions().length - 1 ? (
                <button 
                  disabled={!answers[currentQuestionIndex]}
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  className="flex-[2] quest-button disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next Question
                </button>
              ) : (
                <button 
                  disabled={!answers[currentQuestionIndex]}
                  onClick={handleQuestionSubmit}
                  className="flex-[2] quest-button bg-emerald-400 border-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                >
                  Complete Quest!
                </button>
              )}
            </div>
          </motion.div>
        )}

        {view === "celebration" && (
          <motion.div 
            key="celebration"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="quest-card text-center py-12"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-6 inline-block bg-amber-100 p-6 rounded-full border-4 border-amber-400"
            >
              <Star className="w-16 h-16 text-amber-500 fill-amber-500" />
            </motion.div>
            
            <h2 className="text-3xl font-display font-bold mb-2">Quest Complete!</h2>
            <p className="text-slate-500 mb-8">You earned some serious XP today!</p>
            
            <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-100 mb-8 max-w-xs mx-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-400 uppercase text-xs">XP Earned</span>
                <span className="font-display font-bold text-2xl text-amber-600">+{earnedXp}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-400 uppercase text-xs">New Level</span>
                <span className="font-display font-bold text-2xl text-emerald-600">{stats?.level}</span>
              </div>
            </div>

            <button onClick={() => setView("dashboard")} className="quest-button px-12">
              Back to Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Stats */}
      {view === "dashboard" && stats && (
        <footer className="mt-12 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 mb-2 flex items-center justify-center">
              <BookIcon className="w-5 h-5 text-sky-500" />
            </div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Books Read</p>
            <p className="font-bold">{stats.total_books}</p>
          </div>
          <div className="text-center">
            <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 mb-2 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Quests Done</p>
            <p className="font-bold">{stats.total_sessions}</p>
          </div>
          <div className="text-center">
            <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 mb-2 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Total Hours</p>
            <p className="font-bold">{stats.total_hours}</p>
          </div>
        </footer>
      )}
    </div>
  );
}
