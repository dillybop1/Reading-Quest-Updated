import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Shield,
  RefreshCw,
  Trash2,
  Sun,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  Book,
  CompletedBook,
  UserStats,
  ReadingSession,
  StudentIdentity,
  AdminRosterResponse,
  AdminCreateStudentsResponse,
  AdminReflectionsResponse,
  RoomItemState,
  RoomStateResponse,
  SessionBookCompletion,
  SessionRewardSummary,
  AchievementsResponse,
} from "./types";

const STUDENT_STORAGE_KEY = "reading-quest-student";
const THEME_STORAGE_KEY = "reading-quest-theme";
const CLASS_CODE_REGEX = /^[A-Z0-9-]{2,20}$/;
const NICKNAME_REGEX = /^[A-Za-z0-9 _.-]{2,24}$/;
const BOOK_SPINE_COLORS = ["#f59e0b", "#0ea5e9", "#22c55e", "#ef4444", "#14b8a6", "#f97316"];
const BOOKSHELF_PAGE_SIZE = 5;
const ROOM_SHOP_PAGE_SIZE = 6;
const ROOM_POSITION_MIN = 2;
const ROOM_POSITION_MAX = 98;
const ROOM_Z_INDEX_MIN = 1;
const ROOM_Z_INDEX_MAX = 999;
const OVERTIME_XP_PER_MINUTE = 2;
const OVERTIME_COINS_PER_MINUTE = 3;
const HALL_MILESTONES = [5, 10, 20, 30];
const DEFAULT_HALL_STICKER_POSITION = { x: 86, y: 18 };
const ROOM_TEST_GRANT_ALL_DECOR_KEY = "__all_decor__";

const BOOK_STICKER_OPTIONS = [
  { key: "dragon", emoji: "🐉", label: "Dragon", chipClass: "bg-rose-100 text-rose-700 border-rose-200" },
  { key: "rocket", emoji: "🚀", label: "Rocket", chipClass: "bg-sky-100 text-sky-700 border-sky-200" },
  { key: "crown", emoji: "👑", label: "Crown", chipClass: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "owl", emoji: "🦉", label: "Owl", chipClass: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "lightning", emoji: "⚡", label: "Lightning", chipClass: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { key: "mountain", emoji: "🏔️", label: "Mountain", chipClass: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "bookworm", emoji: "📚", label: "Bookworm", chipClass: "bg-teal-100 text-teal-700 border-teal-200" },
  { key: "shield", emoji: "🛡️", label: "Shield", chipClass: "bg-indigo-100 text-indigo-700 border-indigo-200" },
] as const;

const BOOK_RATING_OPTIONS = [
  { key: "loved_it", emoji: "😄", label: "Loved It", chipClass: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "good_read", emoji: "🙂", label: "Good Read", chipClass: "bg-sky-100 text-sky-700 border-sky-200" },
  { key: "hard_for_me", emoji: "😅", label: "Hard For Me", chipClass: "bg-amber-100 text-amber-700 border-amber-200" },
] as const;

type RoomSpriteConfig = {
  className: string;
  defaultX: number;
  defaultY: number;
  defaultZ: number;
};
type RoomLayoutSnapshot = Record<
  string,
  {
    pos_x: number | null;
    pos_y: number | null;
    z_index: number | null;
  }
>;
type RoomShopCategoryId =
  | "all"
  | "beds"
  | "seating"
  | "desks"
  | "tables"
  | "windows"
  | "lighting"
  | "plants"
  | "decor"
  | "bookshelves"
  | "misc";
type AppView =
  | "loading"
  | "student"
  | "admin"
  | "setup"
  | "bookshelf"
  | "hallOfReads"
  | "achievements"
  | "room"
  | "roomView"
  | "roomShop"
  | "dashboard"
  | "reading"
  | "summary"
  | "questions"
  | "bookCompletion"
  | "celebration";

const VIEW_MOTION_ORDER: Record<AppView, number> = {
  loading: 0,
  student: 1,
  admin: 1,
  setup: 2,
  bookshelf: 3,
  achievements: 4,
  hallOfReads: 4,
  room: 4,
  roomShop: 5,
  roomView: 6,
  dashboard: 4,
  reading: 5,
  summary: 6,
  questions: 7,
  bookCompletion: 8,
  celebration: 9,
};

const ROOM_SHOP_CATEGORIES: Array<{ id: RoomShopCategoryId; label: string }> = [
  { id: "all", label: "All" },
  { id: "beds", label: "Beds" },
  { id: "seating", label: "Seating" },
  { id: "desks", label: "Desks" },
  { id: "tables", label: "Tables" },
  { id: "windows", label: "Windows" },
  { id: "lighting", label: "Lighting" },
  { id: "plants", label: "Plants" },
  { id: "decor", label: "Decorations" },
  { id: "bookshelves", label: "Bookshelves" },
  { id: "misc", label: "Misc" },
];

const ROOM_SHOP_CATEGORY_BY_ITEM_KEY: Record<string, RoomShopCategoryId> = {
  blue_bed: "beds",
  pink_bed: "beds",
  bean_bag: "beds",
  blue_chair: "seating",
  green_couch: "seating",
  tree_hammock: "seating",
  desk: "desks",
  small_blue_sidetable: "desks",
  side_table: "tables",
  small_table: "tables",
  colorful_end_table: "tables",
  rectangle_windows: "windows",
  rounded_window: "windows",
  circle_mirror: "windows",
  desk_lamp: "lighting",
  floor_lamp: "lighting",
  hanging_lamp: "lighting",
  small_plant: "plants",
  small_plant_2: "plants",
  cactus: "plants",
  medium_potted_plant: "plants",
  small_blue_picture: "decor",
  small_yellow_picture: "decor",
  multi_pictures: "decor",
  wall_clock: "decor",
  potion_rack: "decor",
  wizard_globe: "decor",
  baby_dragon: "decor",
  radio: "decor",
  alarm_clock: "decor",
  hamper: "misc",
  slippers: "misc",
  bookshelf_1: "bookshelves",
  bookshelf_2: "bookshelves",
};

const ROOM_SHOP_CATEGORY_ORDER = new Map(ROOM_SHOP_CATEGORIES.map((category, index) => [category.id, index]));

const ROOM_SPRITE_CONFIG: Record<string, RoomSpriteConfig> = {
  small_plant: { className: "room-item-sprite-small-plant", defaultX: 8, defaultY: 41, defaultZ: 29 },
  cactus: { className: "room-item-sprite-cactus", defaultX: 30, defaultY: 84, defaultZ: 25 },
  small_blue_picture: { className: "room-item-sprite-small-blue-picture", defaultX: 75, defaultY: 31, defaultZ: 21 },
  small_yellow_picture: { className: "room-item-sprite-small-yellow-picture", defaultX: 90, defaultY: 37, defaultZ: 21 },
  wall_clock: { className: "room-item-sprite-wall-clock", defaultX: 50, defaultY: 13, defaultZ: 20 },
  blue_chair: { className: "room-item-sprite-blue-chair", defaultX: 17, defaultY: 85, defaultZ: 18 },
  side_table: { className: "room-item-sprite-side-table", defaultX: 23, defaultY: 90, defaultZ: 16 },
  small_table: { className: "room-item-sprite-small-table", defaultX: 58, defaultY: 90, defaultZ: 15 },
  small_blue_sidetable: { className: "room-item-sprite-small-blue-sidetable", defaultX: 39, defaultY: 89, defaultZ: 16 },
  desk_lamp: { className: "room-item-sprite-desk-lamp", defaultX: 24, defaultY: 66, defaultZ: 30 },
  hanging_lamp: { className: "room-item-sprite-hanging-lamp", defaultX: 66, defaultY: 19, defaultZ: 30 },
  medium_potted_plant: { className: "room-item-sprite-medium-potted-plant", defaultX: 86, defaultY: 84, defaultZ: 22 },
  potion_rack: { className: "room-item-sprite-potion-rack", defaultX: 88, defaultY: 70, defaultZ: 24 },
  wizard_globe: { className: "room-item-sprite-wizard-globe", defaultX: 35, defaultY: 73, defaultZ: 26 },
  baby_dragon: { className: "room-item-sprite-baby-dragon", defaultX: 85, defaultY: 24, defaultZ: 21 },
  green_couch: { className: "room-item-sprite-green-couch", defaultX: 67, defaultY: 84, defaultZ: 17 },
  tree_hammock: { className: "room-item-sprite-tree-hammock", defaultX: 49, defaultY: 64, defaultZ: 14 },
  alarm_clock: { className: "room-item-sprite-alarm-clock", defaultX: 40, defaultY: 73, defaultZ: 28 },
  bean_bag: { className: "room-item-sprite-bean-bag", defaultX: 78, defaultY: 88, defaultZ: 18 },
  blue_bed: { className: "room-item-sprite-blue-bed", defaultX: 84, defaultY: 79, defaultZ: 15 },
  bookshelf_1: { className: "room-item-sprite-bookshelf-1", defaultX: 8, defaultY: 66, defaultZ: 16 },
  bookshelf_2: { className: "room-item-sprite-bookshelf-2", defaultX: 12, defaultY: 67, defaultZ: 16 },
  circle_mirror: { className: "room-item-sprite-circle-mirror", defaultX: 77, defaultY: 16, defaultZ: 21 },
  colorful_end_table: { className: "room-item-sprite-colorful-end-table", defaultX: 74, defaultY: 75, defaultZ: 18 },
  desk: { className: "room-item-sprite-desk", defaultX: 27, defaultY: 76, defaultZ: 16 },
  hamper: { className: "room-item-sprite-hamper", defaultX: 98, defaultY: 78, defaultZ: 17 },
  floor_lamp: { className: "room-item-sprite-floor-lamp", defaultX: 93, defaultY: 71, defaultZ: 19 },
  multi_pictures: { className: "room-item-sprite-multi-pictures", defaultX: 55, defaultY: 21, defaultZ: 21 },
  pink_bed: { className: "room-item-sprite-pink-bed", defaultX: 84, defaultY: 84, defaultZ: 13 },
  radio: { className: "room-item-sprite-radio", defaultX: 72, defaultY: 66, defaultZ: 28 },
  rectangle_windows: { className: "room-item-sprite-rectangle-windows", defaultX: 83, defaultY: 47, defaultZ: 20 },
  rounded_window: { className: "room-item-sprite-rounded-window", defaultX: 24, defaultY: 17, defaultZ: 20 },
  slippers: { className: "room-item-sprite-slippers", defaultX: 86, defaultY: 91, defaultZ: 27 },
  small_plant_2: { className: "room-item-sprite-small-plant-2", defaultX: 78, defaultY: 66, defaultZ: 28 },
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const buildRoomLayoutSnapshot = (state: RoomStateResponse | null): RoomLayoutSnapshot => {
  const snapshot: RoomLayoutSnapshot = {};
  if (!state?.items?.length) return snapshot;

  for (const item of state.items) {
    if (!item.owned || !ROOM_SPRITE_CONFIG[item.key]) continue;
    snapshot[item.key] = {
      pos_x: isFiniteNumber(item.pos_x) ? item.pos_x : null,
      pos_y: isFiniteNumber(item.pos_y) ? item.pos_y : null,
      z_index: isFiniteNumber(item.z_index) ? item.z_index : null,
    };
  }

  return snapshot;
};

const getRoomSpriteLayout = (item: Pick<RoomItemState, "key" | "pos_x" | "pos_y" | "z_index">) => {
  const config = ROOM_SPRITE_CONFIG[item.key];
  const fallback = { x: 50, y: 50, z: ROOM_Z_INDEX_MIN };
  if (!config) return fallback;

  const x = typeof item.pos_x === "number" ? item.pos_x : config.defaultX;
  const y = typeof item.pos_y === "number" ? item.pos_y : config.defaultY;
  const z = typeof item.z_index === "number" ? item.z_index : config.defaultZ;

  return {
    x: clampNumber(x, ROOM_POSITION_MIN, ROOM_POSITION_MAX),
    y: clampNumber(y, ROOM_POSITION_MIN, ROOM_POSITION_MAX),
    z: clampNumber(z, ROOM_Z_INDEX_MIN, ROOM_Z_INDEX_MAX),
  };
};

const getRoomShopCategory = (itemKey: string): RoomShopCategoryId =>
  ROOM_SHOP_CATEGORY_BY_ITEM_KEY[itemKey] ?? "misc";

const formatRoomItemLabel = (itemKey: string) =>
  itemKey
    .split("_")
    .map((chunk) => (chunk.length ? `${chunk[0].toUpperCase()}${chunk.slice(1)}` : chunk))
    .join(" ");

const getBookSizeBadge = (totalPages: number) => {
  if (totalPages >= 300) {
    return { label: "Long Quest", className: "bg-rose-100 text-rose-700 border-rose-200" };
  }
  if (totalPages >= 150) {
    return { label: "Medium Quest", className: "bg-amber-100 text-amber-700 border-amber-200" };
  }
  return { label: "Short Quest", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
};

const getHallFrameStyle = (completionNumber: number) => {
  if (completionNumber >= 20) {
    return {
      wrapperClass:
        "rounded-2xl p-[2px] bg-[linear-gradient(120deg,#f59e0b,#f43f5e,#0ea5e9,#22c55e)]",
      innerClass: "rounded-[14px] border border-slate-200 bg-white",
      stampClass: "bg-gradient-to-br from-fuchsia-500 to-cyan-500 text-white border-fuchsia-200",
      frameLabel: "Legend Frame",
    };
  }
  if (completionNumber >= 10) {
    return {
      wrapperClass: "rounded-2xl p-[2px] bg-[linear-gradient(120deg,#f59e0b,#fde68a)]",
      innerClass: "rounded-[14px] border border-amber-200 bg-amber-50/40",
      stampClass: "bg-gradient-to-br from-amber-500 to-yellow-400 text-white border-amber-200",
      frameLabel: "Gold Frame",
    };
  }
  if (completionNumber >= 5) {
    return {
      wrapperClass: "rounded-2xl p-[2px] bg-[linear-gradient(120deg,#94a3b8,#cbd5e1)]",
      innerClass: "rounded-[14px] border border-slate-200 bg-slate-50/70",
      stampClass: "bg-gradient-to-br from-slate-500 to-slate-400 text-white border-slate-200",
      frameLabel: "Silver Frame",
    };
  }

  return {
    wrapperClass: "rounded-2xl p-[2px] bg-[linear-gradient(120deg,#f59e0b,#f97316)]",
    innerClass: "rounded-[14px] border border-orange-200 bg-orange-50/70",
    stampClass: "bg-gradient-to-br from-orange-500 to-amber-500 text-white border-orange-200",
    frameLabel: "Bronze Frame",
  };
};

const getStickerOption = (stickerKey: string | null | undefined) =>
  BOOK_STICKER_OPTIONS.find((option) => option.key === stickerKey) ?? null;

const getRatingOption = (ratingKey: string | null | undefined) =>
  BOOK_RATING_OPTIONS.find((option) => option.key === ratingKey) ?? null;

const useCountUpValue = (targetValue: number, prefersReducedMotion: boolean, durationMs = 600) => {
  const safeTarget = Number.isFinite(targetValue) ? Math.round(targetValue) : 0;
  const [displayValue, setDisplayValue] = useState(safeTarget);
  const frameRef = useRef<number | null>(null);
  const fromValueRef = useRef(safeTarget);

  useEffect(() => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (prefersReducedMotion) {
      fromValueRef.current = safeTarget;
      setDisplayValue(safeTarget);
      return;
    }

    const startValue = fromValueRef.current;
    if (startValue === safeTarget) {
      setDisplayValue(safeTarget);
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + (safeTarget - startValue) * eased);
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromValueRef.current = safeTarget;
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [durationMs, prefersReducedMotion, safeTarget]);

  return displayValue;
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [showAddBookForm, setShowAddBookForm] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [student, setStudent] = useState<StudentIdentity | null>(null);
  const [classCodeInput, setClassCodeInput] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [studentError, setStudentError] = useState<string | null>(null);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminRoster, setAdminRoster] = useState<AdminRosterResponse | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminSection, setAdminSection] = useState<"roster" | "teacher" | "responses" | "roomTest">("roster");
  const [teacherClassCodeInput, setTeacherClassCodeInput] = useState("");
  const [teacherNicknamesInput, setTeacherNicknamesInput] = useState("");
  const [teacherSetupError, setTeacherSetupError] = useState<string | null>(null);
  const [teacherSetupResult, setTeacherSetupResult] = useState<AdminCreateStudentsResponse | null>(null);
  const [isTeacherSetupSaving, setIsTeacherSetupSaving] = useState(false);
  const [starterTemplateError, setStarterTemplateError] = useState<string | null>(null);
  const [starterTemplateResult, setStarterTemplateResult] = useState<{
    item_count: number;
    source: { class_code: string; nickname: string };
    updated_at: string;
  } | null>(null);
  const [isStarterTemplateSaving, setIsStarterTemplateSaving] = useState(false);
  const [adminReflections, setAdminReflections] = useState<AdminReflectionsResponse | null>(null);
  const [grantCoinsInputByStudent, setGrantCoinsInputByStudent] = useState<Record<number, string>>({});
  const [grantCoinsBusyStudentId, setGrantCoinsBusyStudentId] = useState<number | null>(null);
  const [responsesSearchInput, setResponsesSearchInput] = useState("");
  const [responsesClassFilter, setResponsesClassFilter] = useState("all");
  const [responsesStudentFilter, setResponsesStudentFilter] = useState("all");
  const [roomTestStudentId, setRoomTestStudentId] = useState("");
  const [roomTestItemKey, setRoomTestItemKey] = useState<string>(Object.keys(ROOM_SPRITE_CONFIG)[0] ?? "small_plant");
  const [roomTestEquipNow, setRoomTestEquipNow] = useState(true);
  const [roomTestBusy, setRoomTestBusy] = useState(false);
  const [roomTestError, setRoomTestError] = useState<string | null>(null);
  const [roomTestMessage, setRoomTestMessage] = useState<string | null>(null);
  const [deleteBusyKey, setDeleteBusyKey] = useState<string | null>(null);
  const [adminTapCount, setAdminTapCount] = useState(0);
  const adminTapResetRef = useRef<NodeJS.Timeout | null>(null);
  const [adminAccessKey, setAdminAccessKey] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("loading");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const previousViewRef = useRef<AppView>("loading");
  const [viewDirection, setViewDirection] = useState(1);
  
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
  const [sessionRewardSummary, setSessionRewardSummary] = useState<SessionRewardSummary | null>(null);
  const [achievementsData, setAchievementsData] = useState<AchievementsResponse | null>(null);
  const [completedBooks, setCompletedBooks] = useState<CompletedBook[]>([]);
  const [pendingBookCompletion, setPendingBookCompletion] = useState<SessionBookCompletion | null>(null);
  const [selectedCompletionSticker, setSelectedCompletionSticker] = useState<string | null>(null);
  const [selectedCompletionRating, setSelectedCompletionRating] = useState<string | null>(null);
  const [hallStickerDraftPositionByCompletion, setHallStickerDraftPositionByCompletion] = useState<
    Record<number, { x: number; y: number }>
  >({});
  const [hallStickerDragState, setHallStickerDragState] = useState<{
    completionNumber: number;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [completedBookSavingKey, setCompletedBookSavingKey] = useState<number | null>(null);
  const [completionChoiceError, setCompletionChoiceError] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomStateResponse | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomBusyKey, setRoomBusyKey] = useState<string | null>(null);
  const [isRoomCustomizeMode, setIsRoomCustomizeMode] = useState(false);
  const [roomLayoutSavingKey, setRoomLayoutSavingKey] = useState<string | null>(null);
  const [roomCustomizeSnapshot, setRoomCustomizeSnapshot] = useState<RoomLayoutSnapshot | null>(null);
  const [roomDragState, setRoomDragState] = useState<{
    itemKey: string;
    offsetXPct: number;
    offsetYPct: number;
  } | null>(null);
  const [bookshelfPage, setBookshelfPage] = useState(1);
  const [roomShopPage, setRoomShopPage] = useState(1);
  const [roomShopCategory, setRoomShopCategory] = useState<RoomShopCategoryId>("all");
  const [roomHubActiveNav, setRoomHubActiveNav] = useState<"roomView" | "roomShop" | "bookshelf">("roomView");
  const [roomActionFeedback, setRoomActionFeedback] = useState<{
    itemKey: string;
    action: "purchase" | "equip" | "unequip";
    token: number;
  } | null>(null);
  const [hallStickerSnapCompletion, setHallStickerSnapCompletion] = useState<number | null>(null);
  const roomFrameRef = useRef<HTMLDivElement | null>(null);
  const roomStateRef = useRef<RoomStateResponse | null>(null);
  const hallCardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    setIsDarkMode(savedTheme === "dark");
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? "dark" : "light");
    document.body.classList.toggle("dark-mode", isDarkMode);
    return () => {
      document.body.classList.remove("dark-mode");
    };
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMotionPreference);
      return () => mediaQuery.removeEventListener("change", handleMotionPreference);
    }

    mediaQuery.addListener(handleMotionPreference);
    return () => mediaQuery.removeListener(handleMotionPreference);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(STUDENT_STORAGE_KEY);
    if (!raw) {
      setView("student");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StudentIdentity>;
      const classCode = normalizeClassCode(parsed.class_code ?? "");
      const nickname = normalizeNickname(parsed.nickname ?? "");

      if (!classCode || !nickname) {
        localStorage.removeItem(STUDENT_STORAGE_KEY);
        setView("student");
        return;
      }

      setStudent({ class_code: classCode, nickname });
    } catch {
      localStorage.removeItem(STUDENT_STORAGE_KEY);
      setView("student");
    }
  }, []);

  useEffect(() => {
    if (!student) return;
    setView("loading");
    fetchInitialData();
  }, [student]);

  useEffect(() => {
    return () => {
      if (adminTapResetRef.current) clearTimeout(adminTapResetRef.current);
    };
  }, []);

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    const previousView = previousViewRef.current;
    if (previousView === view) return;

    const previousOrder = VIEW_MOTION_ORDER[previousView] ?? 0;
    const nextOrder = VIEW_MOTION_ORDER[view] ?? 0;
    const nextDirection = nextOrder === previousOrder ? 0 : nextOrder > previousOrder ? 1 : -1;
    setViewDirection(nextDirection);
    previousViewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (view !== "roomView") {
      setIsRoomCustomizeMode(false);
      setRoomDragState(null);
      setRoomCustomizeSnapshot(null);
    }

    if (view !== "roomShop") {
      setRoomShopPage(1);
      setRoomShopCategory("all");
    }

    if (view !== "bookshelf") {
      setBookshelfPage(1);
    }

    if (view !== "hallOfReads") {
      setHallStickerDragState(null);
    }

    if (view !== "bookCompletion") {
      setCompletionChoiceError(null);
      setCompletedBookSavingKey(null);
    }
  }, [view]);

  useEffect(() => {
    if (view === "room") {
      setRoomHubActiveNav("roomView");
    }
  }, [view]);

  useEffect(() => {
    if (!roomActionFeedback) return;
    const timeoutId = setTimeout(() => {
      setRoomActionFeedback(null);
    }, 900);

    return () => clearTimeout(timeoutId);
  }, [roomActionFeedback]);

  useEffect(() => {
    if (hallStickerSnapCompletion == null) return;
    const timeoutId = setTimeout(() => {
      setHallStickerSnapCompletion(null);
    }, 520);

    return () => clearTimeout(timeoutId);
  }, [hallStickerSnapCompletion]);

  const parseNumberInput = (value: string, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const getBookProgressPercent = (book: Book) => {
    if (!book.total_pages) return 0;
    return Math.max(0, Math.min(100, Math.round((book.current_page / book.total_pages) * 100)));
  };

  const getMilestoneProgressPercent = (totalXp: number, nextMilestoneXp: number) => {
    const safeNextMilestone = Math.max(500, nextMilestoneXp || 500);
    const milestoneStart = safeNextMilestone - 500;
    const progress = ((totalXp - milestoneStart) / 500) * 100;
    return Math.max(0, Math.min(100, progress));
  };

  const getStudentFilterKey = (classCode: string, nickname: string) => `${classCode}::${nickname}`;

  const getTimestampValue = (timestamp: string) => {
    const value = new Date(timestamp).getTime();
    return Number.isFinite(value) ? value : 0;
  };

  const adminReflectionSessions = adminReflections?.reflections ?? [];

  const responseClassOptions = useMemo(() => {
    const classCodes: string[] = adminReflectionSessions.map((session) => String(session.class_code ?? ""));
    return Array.from(new Set<string>(classCodes))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [adminReflectionSessions]);

  const responseStudentOptions = useMemo(() => {
    const filteredByClass =
      responsesClassFilter === "all"
        ? adminReflectionSessions
        : adminReflectionSessions.filter((session) => session.class_code === responsesClassFilter);

    const unique = new Map<string, { key: string; label: string }>();
    for (const session of filteredByClass) {
      const key = getStudentFilterKey(session.class_code, session.nickname);
      if (!unique.has(key)) {
        unique.set(key, {
          key,
          label: `${session.nickname} (${session.class_code})`,
        });
      }
    }

    return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [adminReflectionSessions, responsesClassFilter]);

  const roomTestSpriteKeys = useMemo(
    () => Object.keys(ROOM_SPRITE_CONFIG).slice().sort((a, b) => a.localeCompare(b)),
    []
  );
  const roomTestItemOptions = useMemo(
    () => [
      { key: ROOM_TEST_GRANT_ALL_DECOR_KEY, label: "ALL decor (grant every sprite)" },
      ...roomTestSpriteKeys.map((itemKey) => ({
        key: itemKey,
        label: formatRoomItemLabel(itemKey),
      })),
    ],
    [roomTestSpriteKeys]
  );

  const filteredReflectionSessions = useMemo(() => {
    const search = responsesSearchInput.trim().toLowerCase();

    return adminReflectionSessions.filter((session) => {
      if (responsesClassFilter !== "all" && session.class_code !== responsesClassFilter) return false;

      if (responsesStudentFilter !== "all") {
        const sessionKey = getStudentFilterKey(session.class_code, session.nickname);
        if (sessionKey !== responsesStudentFilter) return false;
      }

      if (!search) return true;

      const basicText = `${session.nickname} ${session.class_code} ${session.book_title ?? ""}`.toLowerCase();
      if (basicText.includes(search)) return true;

      return session.answers.some((entry) => {
        const questionText = entry.question_text?.toLowerCase() ?? "";
        const answerText = entry.answer_text?.toLowerCase() ?? "";
        return questionText.includes(search) || answerText.includes(search);
      });
    });
  }, [adminReflectionSessions, responsesClassFilter, responsesStudentFilter, responsesSearchInput]);

  const groupedReflectionSessions = useMemo(() => {
    const byStudent = new Map<
      string,
      {
        class_code: string;
        nickname: string;
        latest_timestamp: string;
        sessions: typeof filteredReflectionSessions;
      }
    >();

    for (const session of filteredReflectionSessions) {
      const key = getStudentFilterKey(session.class_code, session.nickname);
      if (!byStudent.has(key)) {
        byStudent.set(key, {
          class_code: session.class_code,
          nickname: session.nickname,
          latest_timestamp: session.timestamp,
          sessions: [],
        });
      }

      const current = byStudent.get(key)!;
      current.sessions.push(session);
      if (getTimestampValue(session.timestamp) > getTimestampValue(current.latest_timestamp)) {
        current.latest_timestamp = session.timestamp;
      }
    }

    return Array.from(byStudent.values()).sort(
      (a, b) => getTimestampValue(b.latest_timestamp) - getTimestampValue(a.latest_timestamp)
    );
  }, [filteredReflectionSessions]);

  const equippedRoomSprites = useMemo(() => {
    if (!roomState?.items?.length) return [];

    return roomState.items
      .filter((item) => item.equipped && Boolean(ROOM_SPRITE_CONFIG[item.key]))
      .map((item) => ({
        item,
        config: ROOM_SPRITE_CONFIG[item.key],
        layout: getRoomSpriteLayout(item),
      }))
      .sort((a, b) => a.layout.z - b.layout.z);
  }, [roomState]);

  const pagedBooks = useMemo(() => {
    const startIndex = (bookshelfPage - 1) * BOOKSHELF_PAGE_SIZE;
    return books.slice(startIndex, startIndex + BOOKSHELF_PAGE_SIZE);
  }, [books, bookshelfPage]);

  const bookshelfTotalPages = Math.max(1, Math.ceil(books.length / BOOKSHELF_PAGE_SIZE));

  const sortedRoomShopItems = useMemo(() => {
    if (!roomState?.items?.length) return [];
    return roomState.items
      .slice()
      .sort((a, b) => {
        const categoryRankA = ROOM_SHOP_CATEGORY_ORDER.get(getRoomShopCategory(a.key)) ?? Number.MAX_SAFE_INTEGER;
        const categoryRankB = ROOM_SHOP_CATEGORY_ORDER.get(getRoomShopCategory(b.key)) ?? Number.MAX_SAFE_INTEGER;
        return categoryRankA - categoryRankB || a.min_xp - b.min_xp || a.cost_coins - b.cost_coins;
      });
  }, [roomState]);

  const roomShopCategoryCounts = useMemo(() => {
    const initialCounts = ROOM_SHOP_CATEGORIES.reduce((acc, category) => {
      acc[category.id] = 0;
      return acc;
    }, {} as Record<RoomShopCategoryId, number>);

    for (const item of sortedRoomShopItems) {
      const category = getRoomShopCategory(item.key);
      initialCounts[category] = (initialCounts[category] ?? 0) + 1;
    }

    initialCounts.all = sortedRoomShopItems.length;
    return initialCounts;
  }, [sortedRoomShopItems]);

  const filteredRoomShopItems = useMemo(() => {
    if (roomShopCategory === "all") return sortedRoomShopItems;
    return sortedRoomShopItems.filter((item) => getRoomShopCategory(item.key) === roomShopCategory);
  }, [sortedRoomShopItems, roomShopCategory]);

  const pagedRoomShopItems = useMemo(() => {
    const startIndex = (roomShopPage - 1) * ROOM_SHOP_PAGE_SIZE;
    return filteredRoomShopItems.slice(startIndex, startIndex + ROOM_SHOP_PAGE_SIZE);
  }, [filteredRoomShopItems, roomShopPage]);

  const roomShopTotalPages = Math.max(1, Math.ceil(filteredRoomShopItems.length / ROOM_SHOP_PAGE_SIZE));
  const totalCompletedPages = useMemo(
    () => completedBooks.reduce((sum, book) => sum + Math.max(0, Number(book.total_pages || 0)), 0),
    [completedBooks]
  );
  const completedBookCount = completedBooks.length;
  const averageSessionMinutes = useMemo(() => {
    const totalSessions = Math.max(0, Number(stats?.total_sessions ?? 0));
    if (totalSessions < 1) return 0;
    const totalMinutes = Math.max(0, Number(stats?.total_hours ?? 0) * 60);
    return totalMinutes / totalSessions;
  }, [stats?.total_hours, stats?.total_sessions]);
  const readingStyleBadges = useMemo(() => {
    const badges: Array<{ label: string; className: string }> = [];

    if (averageSessionMinutes >= 30) {
      badges.push({ label: "Marathon Reader", className: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200" });
    } else if (averageSessionMinutes >= 20) {
      badges.push({ label: "Steady Reader", className: "bg-sky-100 text-sky-700 border-sky-200" });
    } else {
      badges.push({ label: "Quick Starter", className: "bg-emerald-100 text-emerald-700 border-emerald-200" });
    }

    const sessions = Math.max(1, Number(stats?.total_sessions ?? 1));
    const pagesPerSession = totalCompletedPages / sessions;
    if (pagesPerSession >= 20) {
      badges.push({ label: "Page Power", className: "bg-amber-100 text-amber-700 border-amber-200" });
    } else if (pagesPerSession >= 10) {
      badges.push({ label: "Page Explorer", className: "bg-indigo-100 text-indigo-700 border-indigo-200" });
    } else {
      badges.push({ label: "Thoughtful Reader", className: "bg-teal-100 text-teal-700 border-teal-200" });
    }

    if (completedBookCount >= 10) {
      badges.push({ label: "Collection Builder", className: "bg-rose-100 text-rose-700 border-rose-200" });
    }

    return badges;
  }, [averageSessionMinutes, completedBookCount, stats?.total_sessions, totalCompletedPages]);
  const hallMilestoneStatus = useMemo(
    () =>
      HALL_MILESTONES.map((milestone) => ({
        milestone,
        unlocked: completedBookCount >= milestone,
      })),
    [completedBookCount]
  );
  const latestHallMilestone = useMemo(() => {
    let unlockedMilestone: number | null = null;
    for (const value of HALL_MILESTONES) {
      if (completedBookCount >= value) unlockedMilestone = value;
    }
    return unlockedMilestone;
  }, [completedBookCount]);
  const nextHallMilestone = useMemo(() => {
    for (const value of HALL_MILESTONES) {
      if (completedBookCount < value) return value;
    }
    return null;
  }, [completedBookCount]);

  const hasPositionableEquippedRoomItems = equippedRoomSprites.length > 0;

  useEffect(() => {
    if (!hasPositionableEquippedRoomItems) {
      setIsRoomCustomizeMode(false);
      setRoomDragState(null);
      setRoomCustomizeSnapshot(null);
    }
  }, [hasPositionableEquippedRoomItems]);

  useEffect(() => {
    if (responsesStudentFilter === "all") return;
    const stillValid = responseStudentOptions.some((option) => option.key === responsesStudentFilter);
    if (!stillValid) {
      setResponsesStudentFilter("all");
    }
  }, [responseStudentOptions, responsesStudentFilter]);

  useEffect(() => {
    const rosterStudents = adminRoster?.students ?? [];
    if (!rosterStudents.length) {
      if (roomTestStudentId) {
        setRoomTestStudentId("");
      }
      return;
    }

    const hasSelected = rosterStudents.some((row) => String(row.id) === roomTestStudentId);
    if (!roomTestStudentId || !hasSelected) {
      setRoomTestStudentId(String(rosterStudents[0].id));
    }
  }, [adminRoster, roomTestStudentId]);

  useEffect(() => {
    setBookshelfPage((prev) => Math.min(prev, bookshelfTotalPages));
  }, [bookshelfTotalPages]);

  useEffect(() => {
    setRoomShopPage((prev) => Math.min(prev, roomShopTotalPages));
  }, [roomShopTotalPages]);

  useEffect(() => {
    setRoomShopPage(1);
  }, [roomShopCategory]);

  useEffect(() => {
    setHallStickerDraftPositionByCompletion((prev) => {
      const next: Record<number, { x: number; y: number }> = {};
      for (const book of completedBooks) {
        const key = book.completion_number;
        if (prev[key]) {
          next[key] = prev[key];
        }
      }
      return next;
    });
  }, [completedBooks]);

  const normalizeClassCode = (value: string) => value.trim().toUpperCase();
  const normalizeNickname = (value: string) => value.trim();

  const buildStudentQuery = () => {
    if (!student) return "";
    return new URLSearchParams({
      class_code: student.class_code,
      nickname: student.nickname,
    }).toString();
  };

  const withStudentQuery = (path: string) => {
    const query = buildStudentQuery();
    if (!query) return path;
    return `${path}?${query}`;
  };

  const updateCompletedBookMeta = async (
    completionNumber: number,
    nextPatch: {
      sticker_key?: string | null;
      rating_key?: string | null;
      sticker_pos_x?: number | null;
      sticker_pos_y?: number | null;
    }
  ) => {
    if (!student) {
      throw new Error("Student session not found");
    }

    const existing = completedBooks.find((book) => book.completion_number === completionNumber);
    if (!existing) {
      throw new Error("Completed book entry not found");
    }

    const stickerKey = nextPatch.sticker_key === undefined ? existing.sticker_key ?? null : nextPatch.sticker_key;
    const ratingKey = nextPatch.rating_key === undefined ? existing.rating_key ?? null : nextPatch.rating_key;
    const stickerPosX = nextPatch.sticker_pos_x === undefined ? existing.sticker_pos_x ?? null : nextPatch.sticker_pos_x;
    const stickerPosY = nextPatch.sticker_pos_y === undefined ? existing.sticker_pos_y ?? null : nextPatch.sticker_pos_y;

    if (
      (existing.sticker_key ?? null) === stickerKey &&
      (existing.rating_key ?? null) === ratingKey &&
      (existing.sticker_pos_x ?? null) === stickerPosX &&
      (existing.sticker_pos_y ?? null) === stickerPosY
    ) {
      return {
        completion_number: completionNumber,
        sticker_key: stickerKey,
        rating_key: ratingKey,
        sticker_pos_x: stickerPosX,
        sticker_pos_y: stickerPosY,
      };
    }

    setCompletedBookSavingKey(completionNumber);

    try {
      const response = await fetch("/api/books/completed", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completion_number: completionNumber,
          sticker_key: stickerKey,
          rating_key: ratingKey,
          sticker_pos_x: stickerPosX,
          sticker_pos_y: stickerPosY,
          class_code: student.class_code,
          nickname: student.nickname,
        }),
      });

      if (!response.ok) {
        let message = `Failed to save completion choices: ${response.status}`;
        try {
          const errorBody = await response.json();
          if (typeof errorBody?.error === "string") {
            message = errorBody.error;
          }
        } catch {
          // Ignore parse failure and keep fallback message.
        }
        throw new Error(message);
      }

      const updated = (await response.json()) as {
        completion_number: number;
        sticker_key: string | null;
        rating_key: string | null;
        sticker_pos_x: number | null;
        sticker_pos_y: number | null;
      };

      setCompletedBooks((prev) =>
        prev.map((book) =>
          book.completion_number === completionNumber
            ? {
                ...book,
                sticker_key: updated.sticker_key ?? null,
                rating_key: updated.rating_key ?? null,
                sticker_pos_x: updated.sticker_pos_x ?? null,
                sticker_pos_y: updated.sticker_pos_y ?? null,
              }
            : book
        )
      );
      return updated;
    } catch (err: any) {
      throw new Error(String(err?.message ?? err));
    } finally {
      setCompletedBookSavingKey(null);
    }
  };

  const getHallStickerPosition = (book: CompletedBook) => {
    const draft = hallStickerDraftPositionByCompletion[book.completion_number];
    if (draft) {
      return {
        x: clampNumber(draft.x, 6, 94),
        y: clampNumber(draft.y, 10, 90),
      };
    }

    const parsedX = Number(book.sticker_pos_x);
    const parsedY = Number(book.sticker_pos_y);
    const hasStoredX = Number.isFinite(parsedX);
    const hasStoredY = Number.isFinite(parsedY);

    return {
      x: clampNumber(hasStoredX ? parsedX : DEFAULT_HALL_STICKER_POSITION.x, 6, 94),
      y: clampNumber(hasStoredY ? parsedY : DEFAULT_HALL_STICKER_POSITION.y, 10, 90),
    };
  };

  const handleHallStickerPointerDown = (event: React.PointerEvent<HTMLButtonElement>, book: CompletedBook) => {
    if (!book.sticker_key || completedBookSavingKey === book.completion_number) return;

    event.preventDefault();
    const current = getHallStickerPosition(book);

    setHallStickerDragState({
      completionNumber: book.completion_number,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: current.x,
      startY: current.y,
    });

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleHallStickerPointerMove = (event: React.PointerEvent<HTMLButtonElement>, book: CompletedBook) => {
    if (
      !hallStickerDragState ||
      hallStickerDragState.completionNumber !== book.completion_number ||
      hallStickerDragState.pointerId !== event.pointerId
    ) {
      return;
    }

    const cardElement = hallCardRefs.current[book.completion_number];
    if (!cardElement) return;

    const rect = cardElement.getBoundingClientRect();
    const dxPct = ((event.clientX - hallStickerDragState.startClientX) / Math.max(1, rect.width)) * 100;
    const dyPct = ((event.clientY - hallStickerDragState.startClientY) / Math.max(1, rect.height)) * 100;

    const nextX = clampNumber(hallStickerDragState.startX + dxPct, 6, 94);
    const nextY = clampNumber(hallStickerDragState.startY + dyPct, 10, 90);

    setHallStickerDraftPositionByCompletion((prev) => ({
      ...prev,
      [book.completion_number]: { x: nextX, y: nextY },
    }));
  };

  const handleHallStickerPointerUp = (event: React.PointerEvent<HTMLButtonElement>, book: CompletedBook) => {
    if (
      !hallStickerDragState ||
      hallStickerDragState.completionNumber !== book.completion_number ||
      hallStickerDragState.pointerId !== event.pointerId
    ) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setHallStickerDragState(null);
    setHallStickerSnapCompletion(book.completion_number);

    const nextPosition =
      hallStickerDraftPositionByCompletion[book.completion_number] ??
      getHallStickerPosition({
        ...book,
        sticker_pos_x: hallStickerDragState.startX,
        sticker_pos_y: hallStickerDragState.startY,
      });

    void updateCompletedBookMeta(book.completion_number, {
      sticker_pos_x: nextPosition.x,
      sticker_pos_y: nextPosition.y,
    }).catch((err: any) => {
      console.error("Failed to save Hall sticker position", err);
    });
  };

  const openAdminPrompt = () => {
    setShowAdminPrompt(true);
    setAdminPasscode("");
    setAdminError(null);
  };

  const loadAdminRoster = async (key: string) => {
    setIsAdminLoading(true);
    setAdminError(null);

    try {
      const response = await fetch("/api/admin/roster", {
        headers: {
          "x-admin-key": key,
        },
      });

      if (!response.ok) {
        let message = `Failed to load admin roster: ${response.status}`;
        try {
          const errorBody = await response.json();
          if (typeof errorBody?.error === "string") {
            message = errorBody.error;
          }
        } catch {
          // Ignore JSON parse failure and use default message.
        }
        throw new Error(message);
      }

      const data = (await response.json()) as AdminRosterResponse;
      setAdminRoster(data);
      setAdminAccessKey(key);
      return true;
    } catch (err: any) {
      setAdminError(String(err?.message ?? err));
      return false;
    } finally {
      setIsAdminLoading(false);
    }
  };

  const loadAdminReflections = async (key: string) => {
    try {
      const response = await fetch("/api/admin/reflections", {
        headers: {
          "x-admin-key": key,
        },
      });

      if (!response.ok) {
        let message = `Failed to load reflections: ${response.status}`;
        try {
          const errorBody = await response.json();
          if (typeof errorBody?.error === "string") {
            message = errorBody.error;
          }
        } catch {
          // Ignore JSON parse failure and use default message.
        }
        throw new Error(message);
      }

      const data = (await response.json()) as AdminReflectionsResponse;
      setAdminReflections(data);
      return true;
    } catch (err: any) {
      setAdminError(String(err?.message ?? err));
      return false;
    }
  };

  const loadRoomState = async () => {
    if (!student) return null;
    setRoomError(null);

    try {
      const response = await fetch(withStudentQuery("/api/room"));
      if (!response.ok) {
        let message = `Failed to load room: ${response.status}`;
        try {
          const errorBody = await response.json();
          if (typeof errorBody?.error === "string") {
            message = errorBody.error;
          }
        } catch {
          // Ignore JSON parse failure and use default message.
        }
        throw new Error(message);
      }

      const data = (await response.json()) as RoomStateResponse;
      setRoomState(data);
      return data;
    } catch (err: any) {
      setRoomError(String(err?.message ?? err));
      return null;
    }
  };

  const handleRoomAction = async (action: "purchase" | "equip" | "unequip", itemKey: string) => {
    if (!student) return;
    setRoomBusyKey(itemKey);
    setRoomError(null);

    try {
      const response = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          item_key: itemKey,
          class_code: student.class_code,
          nickname: student.nickname,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Room action failed: ${response.status}`);
      }

      const nextRoomState = data as RoomStateResponse;
      setRoomState(nextRoomState);
      setStats((prev) =>
        prev
          ? {
              ...prev,
              total_xp: nextRoomState.total_xp,
              coins: nextRoomState.coins,
              next_milestone_xp: nextRoomState.next_milestone_xp,
            }
          : prev
      );
      setRoomActionFeedback({
        itemKey,
        action,
        token: Date.now(),
      });
    } catch (err: any) {
      setRoomError(String(err?.message ?? err));
    } finally {
      setRoomBusyKey(null);
    }
  };

  const setRoomItemLayoutLocally = (itemKey: string, x: number, y: number, z: number) => {
    setRoomState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.key === itemKey
            ? {
                ...item,
                pos_x: clampNumber(x, ROOM_POSITION_MIN, ROOM_POSITION_MAX),
                pos_y: clampNumber(y, ROOM_POSITION_MIN, ROOM_POSITION_MAX),
                z_index: clampNumber(z, ROOM_Z_INDEX_MIN, ROOM_Z_INDEX_MAX),
              }
            : item
        ),
      };
    });
  };

  const handleRoomLayoutSave = async (itemKey: string, x: number, y: number, z: number) => {
    if (!student) return;
    setRoomLayoutSavingKey(itemKey);
    setRoomError(null);

    try {
      const response = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_layout",
          item_key: itemKey,
          pos_x: Number(clampNumber(x, ROOM_POSITION_MIN, ROOM_POSITION_MAX).toFixed(2)),
          pos_y: Number(clampNumber(y, ROOM_POSITION_MIN, ROOM_POSITION_MAX).toFixed(2)),
          z_index: Math.round(clampNumber(z, ROOM_Z_INDEX_MIN, ROOM_Z_INDEX_MAX)),
          class_code: student.class_code,
          nickname: student.nickname,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Layout save failed: ${response.status}`);
      }

      setRoomState(data as RoomStateResponse);
    } catch (err: any) {
      setRoomError(String(err?.message ?? err));
    } finally {
      setRoomLayoutSavingKey(null);
    }
  };

  const handleStartRoomCustomization = () => {
    setRoomCustomizeSnapshot(buildRoomLayoutSnapshot(roomStateRef.current));
    setRoomError(null);
    setRoomDragState(null);
    setIsRoomCustomizeMode(true);
  };

  const handleFinishRoomCustomization = () => {
    setRoomDragState(null);
    setIsRoomCustomizeMode(false);
    setRoomCustomizeSnapshot(null);
  };

  const handleResetRoomLayout = async () => {
    if (!student || !roomCustomizeSnapshot) return;
    setRoomLayoutSavingKey("snapshot");
    setRoomError(null);
    setRoomDragState(null);

    try {
      const entries = Object.entries(roomCustomizeSnapshot) as Array<
        [string, { pos_x: number | null; pos_y: number | null; z_index: number | null }]
      >;
      await Promise.all(
        entries.map(async ([itemKey, layout]) => {
          const hasExactPosition =
            isFiniteNumber(layout.pos_x) && isFiniteNumber(layout.pos_y) && isFiniteNumber(layout.z_index);
          const payload = hasExactPosition
            ? {
                action: "update_layout",
                item_key: itemKey,
                pos_x: Number(clampNumber(layout.pos_x, ROOM_POSITION_MIN, ROOM_POSITION_MAX).toFixed(2)),
                pos_y: Number(clampNumber(layout.pos_y, ROOM_POSITION_MIN, ROOM_POSITION_MAX).toFixed(2)),
                z_index: Math.round(clampNumber(layout.z_index, ROOM_Z_INDEX_MIN, ROOM_Z_INDEX_MAX)),
                class_code: student.class_code,
                nickname: student.nickname,
              }
            : {
                action: "reset_layout",
                item_key: itemKey,
                class_code: student.class_code,
                nickname: student.nickname,
              };

          const response = await fetch("/api/room", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(typeof data?.error === "string" ? data.error : `Layout reset failed: ${response.status}`);
          }
        })
      );

      await loadRoomState();
    } catch (err: any) {
      setRoomError(String(err?.message ?? err));
    } finally {
      setRoomLayoutSavingKey(null);
    }
  };

  const handleRoomItemPointerDown = (event: React.PointerEvent<HTMLDivElement>, itemKey: string) => {
    if (!isRoomCustomizeMode || view !== "roomView" || event.button !== 0) return;

    const frameRect = roomFrameRef.current?.getBoundingClientRect();
    const currentState = roomStateRef.current;
    if (!frameRect || !currentState || frameRect.width <= 0 || frameRect.height <= 0) return;

    const item = currentState.items.find((entry) => entry.key === itemKey && entry.equipped);
    if (!item) return;

    event.preventDefault();
    const currentLayout = getRoomSpriteLayout(item);
    const pointerXPct = ((event.clientX - frameRect.left) / frameRect.width) * 100;
    const pointerYPct = ((event.clientY - frameRect.top) / frameRect.height) * 100;

    const maxCurrentZ = currentState.items.reduce((max, entry) => {
      const config = ROOM_SPRITE_CONFIG[entry.key];
      if (!entry.equipped || !config) return max;
      const layout = getRoomSpriteLayout(entry);
      return Math.max(max, layout.z);
    }, ROOM_Z_INDEX_MIN);
    const nextZ = clampNumber(maxCurrentZ + 1, ROOM_Z_INDEX_MIN, ROOM_Z_INDEX_MAX);

    setRoomItemLayoutLocally(itemKey, currentLayout.x, currentLayout.y, nextZ);
    setRoomDragState({
      itemKey,
      offsetXPct: currentLayout.x - pointerXPct,
      offsetYPct: currentLayout.y - pointerYPct,
    });
  };

  useEffect(() => {
    if (!roomDragState || !isRoomCustomizeMode || view !== "roomView") return;

    const handlePointerMove = (event: PointerEvent) => {
      const frameRect = roomFrameRef.current?.getBoundingClientRect();
      if (!frameRect || frameRect.width <= 0 || frameRect.height <= 0) return;

      const pointerXPct = ((event.clientX - frameRect.left) / frameRect.width) * 100;
      const pointerYPct = ((event.clientY - frameRect.top) / frameRect.height) * 100;
      const nextX = clampNumber(pointerXPct + roomDragState.offsetXPct, ROOM_POSITION_MIN, ROOM_POSITION_MAX);
      const nextY = clampNumber(pointerYPct + roomDragState.offsetYPct, ROOM_POSITION_MIN, ROOM_POSITION_MAX);
      const currentState = roomStateRef.current;
      const currentItem = currentState?.items.find((entry) => entry.key === roomDragState.itemKey);
      const currentZ = getRoomSpriteLayout({
        key: roomDragState.itemKey,
        pos_x: currentItem?.pos_x ?? null,
        pos_y: currentItem?.pos_y ?? null,
        z_index: currentItem?.z_index ?? null,
      }).z;

      setRoomItemLayoutLocally(roomDragState.itemKey, nextX, nextY, currentZ);
    };

    const handlePointerUp = () => {
      const currentState = roomStateRef.current;
      const currentItem = currentState?.items.find((entry) => entry.key === roomDragState.itemKey);
      if (!currentItem) {
        setRoomDragState(null);
        return;
      }

      const { x, y, z } = getRoomSpriteLayout(currentItem);
      void handleRoomLayoutSave(roomDragState.itemKey, x, y, z);
      setRoomDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [roomDragState, isRoomCustomizeMode, view]);

  const handleHiddenAdminTap = () => {
    setAdminTapCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        openAdminPrompt();
        return 0;
      }
      return next;
    });

    if (adminTapResetRef.current) clearTimeout(adminTapResetRef.current);
    adminTapResetRef.current = setTimeout(() => {
      setAdminTapCount(0);
    }, 1600);
  };

  const handleAdminUnlockSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!adminPasscode.trim()) {
      setAdminError("Enter the admin password.");
      return;
    }

    const key = adminPasscode.trim();
    const rosterOk = await loadAdminRoster(key);
    if (!rosterOk) return;
    const reflectionsOk = await loadAdminReflections(key);
    if (!reflectionsOk) return;

    setShowAdminPrompt(false);
    setAdminSection("roster");
    setTeacherSetupError(null);
    setTeacherSetupResult(null);
    setStarterTemplateError(null);
    setStarterTemplateResult(null);
    setView("admin");
  };

  const handleAdminRefresh = async () => {
    if (!adminAccessKey) {
      setAdminError("Admin session expired. Re-open admin mode.");
      return;
    }
    const rosterOk = await loadAdminRoster(adminAccessKey);
    if (!rosterOk) return;
    await loadAdminReflections(adminAccessKey);
  };

  const handleDeleteStudent = async (studentId: number, nickname: string, classCode: string) => {
    if (!adminAccessKey) {
      setAdminError("Admin session expired. Re-open admin mode.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${nickname} from ${classCode}? This removes their books, sessions, stats, and room items.`
    );
    if (!confirmed) return;

    setDeleteBusyKey(`student-${studentId}`);
    setAdminError(null);

    try {
      const response = await fetch("/api/admin/students", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminAccessKey,
        },
        body: JSON.stringify({ student_id: studentId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Delete failed: ${response.status}`);
      }

      const rosterOk = await loadAdminRoster(adminAccessKey);
      if (rosterOk) {
        await loadAdminReflections(adminAccessKey);
      }
    } catch (err: any) {
      setAdminError(String(err?.message ?? err));
    } finally {
      setDeleteBusyKey(null);
    }
  };

  const handleDeleteClass = async (classCode: string, studentCount: number) => {
    if (!adminAccessKey) {
      setAdminError("Admin session expired. Re-open admin mode.");
      return;
    }

    const confirmed = window.confirm(
      `Delete class ${classCode} and ${studentCount} student record(s)? This removes all related books, sessions, stats, and room items.`
    );
    if (!confirmed) return;

    setDeleteBusyKey(`class-${classCode}`);
    setAdminError(null);

    try {
      const response = await fetch("/api/admin/classes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminAccessKey,
        },
        body: JSON.stringify({ class_code: classCode }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Delete failed: ${response.status}`);
      }

      const rosterOk = await loadAdminRoster(adminAccessKey);
      if (rosterOk) {
        await loadAdminReflections(adminAccessKey);
      }
    } catch (err: any) {
      setAdminError(String(err?.message ?? err));
    } finally {
      setDeleteBusyKey(null);
    }
  };

  const handleGrantCoins = async (studentId: number) => {
    if (!adminAccessKey) {
      setAdminError("Admin session expired. Re-open admin mode.");
      return;
    }

    const raw = grantCoinsInputByStudent[studentId] ?? "";
    const coins = Number.parseInt(raw, 10);
    if (!Number.isFinite(coins) || coins <= 0) {
      setAdminError("Enter a positive coin amount.");
      return;
    }

    setGrantCoinsBusyStudentId(studentId);
    setAdminError(null);

    try {
      const response = await fetch("/api/admin/coins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminAccessKey,
        },
        body: JSON.stringify({ student_id: studentId, coins }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Coin update failed: ${response.status}`);
      }

      setGrantCoinsInputByStudent((prev) => ({
        ...prev,
        [studentId]: "",
      }));
      const rosterOk = await loadAdminRoster(adminAccessKey);
      if (rosterOk) {
        await loadAdminReflections(adminAccessKey);
      }
    } catch (err: any) {
      setAdminError(String(err?.message ?? err));
    } finally {
      setGrantCoinsBusyStudentId(null);
    }
  };

  const handleRoomTestGrant = async () => {
    if (!adminAccessKey) {
      setRoomTestError("Admin session expired. Re-open admin mode.");
      return;
    }

    const studentId = Number.parseInt(roomTestStudentId, 10);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      setRoomTestError("Choose a student first.");
      return;
    }

    if (!roomTestItemKey.trim()) {
      setRoomTestError("Choose a room sprite.");
      return;
    }
    const grantAllDecor = roomTestItemKey === ROOM_TEST_GRANT_ALL_DECOR_KEY;
    if (grantAllDecor && roomTestSpriteKeys.length === 0) {
      setRoomTestError("No room sprites are configured.");
      return;
    }

    setRoomTestBusy(true);
    setRoomTestError(null);
    setRoomTestMessage(null);

    try {
      const response = await fetch("/api/admin/room-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminAccessKey,
        },
        body: JSON.stringify({
          student_id: studentId,
          item_key: grantAllDecor ? undefined : roomTestItemKey,
          item_keys: grantAllDecor ? roomTestSpriteKeys : undefined,
          equip: roomTestEquipNow,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Room test failed: ${response.status}`);
      }

      const targetStudent = adminRoster?.students?.find((row) => row.id === studentId);
      const targetLabel = targetStudent ? `${targetStudent.nickname} (${targetStudent.class_code})` : `student #${studentId}`;
      const itemLabel = grantAllDecor
        ? "ALL decor"
        : roomTestItemOptions.find((option) => option.key === roomTestItemKey)?.label ?? roomTestItemKey;
      setRoomTestMessage(
        `Added ${itemLabel} to ${targetLabel}${roomTestEquipNow ? " and equipped it" : ""}.`
      );

      if (
        student &&
        targetStudent &&
        targetStudent.class_code === student.class_code &&
        targetStudent.nickname === student.nickname
      ) {
        await fetchInitialData();
      }
    } catch (err: any) {
      setRoomTestError(String(err?.message ?? err));
    } finally {
      setRoomTestBusy(false);
    }
  };

  const handleTeacherSetupSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!adminAccessKey) {
      setTeacherSetupError("Admin session expired. Re-open admin mode.");
      return;
    }

    const classCode = normalizeClassCode(teacherClassCodeInput);
    if (!CLASS_CODE_REGEX.test(classCode)) {
      setTeacherSetupError("Class code should be 2-20 letters, numbers, or dashes.");
      return;
    }

    if (!teacherNicknamesInput.trim()) {
      setTeacherSetupError("Enter one or more nicknames.");
      return;
    }

    setTeacherSetupError(null);
    setTeacherSetupResult(null);
    setIsTeacherSetupSaving(true);

    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminAccessKey,
        },
        body: JSON.stringify({
          class_code: classCode,
          nicknames: teacherNicknamesInput,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Failed: ${response.status}`);
      }

      setTeacherSetupResult(data as AdminCreateStudentsResponse);
      const rosterOk = await loadAdminRoster(adminAccessKey);
      if (rosterOk) {
        await loadAdminReflections(adminAccessKey);
      }
    } catch (err: any) {
      setTeacherSetupError(String(err?.message ?? err));
    } finally {
      setIsTeacherSetupSaving(false);
    }
  };

  const handleSaveStarterTemplateFromCurrentStudent = async () => {
    if (!adminAccessKey) {
      setStarterTemplateError("Admin session expired. Re-open admin mode.");
      return;
    }
    if (!student) {
      setStarterTemplateError("Select a student first, then open admin mode.");
      return;
    }

    setStarterTemplateError(null);
    setStarterTemplateResult(null);
    setIsStarterTemplateSaving(true);

    try {
      const response = await fetch("/api/admin/starter-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminAccessKey,
        },
        body: JSON.stringify({
          class_code: student.class_code,
          nickname: student.nickname,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Failed: ${response.status}`);
      }

      setStarterTemplateResult({
        item_count: Number(data?.item_count ?? 0),
        source: {
          class_code: String(data?.source?.class_code ?? student.class_code),
          nickname: String(data?.source?.nickname ?? student.nickname),
        },
        updated_at: String(data?.updated_at ?? new Date().toISOString()),
      });
    } catch (err: any) {
      setStarterTemplateError(String(err?.message ?? err));
    } finally {
      setIsStarterTemplateSaving(false);
    }
  };

  const handleExitAdmin = () => {
    setShowAdminPrompt(false);
    setAdminError(null);
    setStarterTemplateError(null);
    setStarterTemplateResult(null);
    setView(student ? (books.length > 0 ? "bookshelf" : "setup") : "student");
  };

  const fetchInitialData = async () => {
    if (!student) {
      setView("student");
      return;
    }

    try {
      const [booksResult, activeBookResult, statsResult, roomResult, achievementsResult, completedBooksResult] = await Promise.allSettled([
        fetch(withStudentQuery("/api/books")),
        fetch(withStudentQuery("/api/books/active")),
        fetch(withStudentQuery("/api/stats")),
        fetch(withStudentQuery("/api/room")),
        fetch(withStudentQuery("/api/achievements")),
        fetch(withStudentQuery("/api/books/completed")),
      ]);

      let booksData: Book[] = [];
      let activeBookData: Book | null = null;
      let statsData: UserStats | null = null;

      if (booksResult.status === "fulfilled") {
        if (booksResult.value.ok) {
          booksData = await booksResult.value.json();
          setBooks(booksData);
        } else {
          console.error(`books failed: ${booksResult.value.status}`);
        }
      } else {
        console.error("books request failed", booksResult.reason);
      }

      if (activeBookResult.status === "fulfilled") {
        if (activeBookResult.value.ok) {
          activeBookData = await activeBookResult.value.json();
        } else {
          console.error(`books/active failed: ${activeBookResult.value.status}`);
        }
      } else {
        console.error("books/active request failed", activeBookResult.reason);
      }

      if (!activeBookData && booksData.length > 0) {
        activeBookData = booksData.find((book) => Boolean(book.is_active)) ?? booksData[0];
      }
      const activeBookIsCompleted =
        Number(activeBookData?.total_pages ?? 0) > 0 &&
        Number(activeBookData?.current_page ?? 0) >= Number(activeBookData?.total_pages ?? 0);

      if (booksData.length === 0 && activeBookData && !activeBookIsCompleted) {
        booksData = [activeBookData];
        setBooks(booksData);
      }

      setActiveBook(activeBookData);
      setStartPage(activeBookData?.current_page || 0);
      setEndPage(activeBookData?.current_page || 0);

      if (statsResult.status === "fulfilled") {
        if (statsResult.value.ok) {
          statsData = await statsResult.value.json();
          setStats(statsData);
        } else {
          console.error(`stats failed: ${statsResult.value.status}`);
        }
      } else {
        console.error("stats request failed", statsResult.reason);
      }

      if (roomResult.status === "fulfilled") {
        if (roomResult.value.ok) {
          const roomData = (await roomResult.value.json()) as RoomStateResponse;
          setRoomState(roomData);
          setRoomError(null);
        } else {
          console.error(`room failed: ${roomResult.value.status}`);
        }
      } else {
        console.error("room request failed", roomResult.reason);
      }

      if (achievementsResult.status === "fulfilled") {
        if (achievementsResult.value.ok) {
          const achievementData = (await achievementsResult.value.json()) as AchievementsResponse;
          setAchievementsData(achievementData);
        } else {
          console.error(`achievements failed: ${achievementsResult.value.status}`);
          setAchievementsData(null);
        }
      } else {
        console.error("achievements request failed", achievementsResult.reason);
        setAchievementsData(null);
      }

      if (completedBooksResult.status === "fulfilled") {
        if (completedBooksResult.value.ok) {
          const completedData = (await completedBooksResult.value.json()) as CompletedBook[];
          setCompletedBooks(Array.isArray(completedData) ? completedData : []);
        } else {
          console.error(`completed books failed: ${completedBooksResult.value.status}`);
          setCompletedBooks([]);
        }
      } else {
        console.error("completed books request failed", completedBooksResult.reason);
        setCompletedBooks([]);
      }

      if (booksData.length === 0 && !statsData) {
        setView("setup");
        return;
      }

      setView(booksData.length > 0 ? "bookshelf" : "setup");
    } catch (err) {
      console.error("Failed to fetch data", err);
      setView("setup");
    }
  };

  const handleStartSession = () => {
    if (!activeBook) return;
    setSessionRewardSummary(null);
    setPendingBookCompletion(null);
    setSelectedCompletionSticker(null);
    setSelectedCompletionRating(null);
    setHallStickerDragState(null);
    setCompletionChoiceError(null);
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
    const overtimeXpBonus = Math.max(0, minutes - safeGoalMinutes) * OVERTIME_XP_PER_MINUTE;
    const sessionXp = (minutes * 1) + (pages * 5) + 20 + overtimeXpBonus; // 20 base XP for finishing
    return sessionXp;
  };

  const handleSummarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSessionRewardSummary(null);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setView("questions");
  };

  const handleStudentSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const classCode = normalizeClassCode(classCodeInput);
    const nickname = normalizeNickname(nicknameInput);

    if (!classCode || !nickname) {
      setStudentError("Please enter both class code and nickname.");
      return;
    }

    if (!CLASS_CODE_REGEX.test(classCode)) {
      setStudentError("Class code should be 2-20 letters, numbers, or dashes.");
      return;
    }

    if (!NICKNAME_REGEX.test(nickname)) {
      setStudentError("Nickname should be 2-24 characters (letters, numbers, spaces, . _ -).");
      return;
    }

    const nextStudent: StudentIdentity = {
      class_code: classCode,
      nickname,
    };

    localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(nextStudent));
    setStudent(nextStudent);
    setStudentError(null);
  };

  const handleSwitchStudent = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsTimerRunning(false);
    setShowAdminPrompt(false);
    setAdminPasscode("");
    setAdminError(null);
    setAdminRoster(null);
    setAdminReflections(null);
    setGrantCoinsInputByStudent({});
    setGrantCoinsBusyStudentId(null);
    setResponsesSearchInput("");
    setResponsesClassFilter("all");
    setResponsesStudentFilter("all");
    setRoomTestStudentId("");
    setRoomTestItemKey(Object.keys(ROOM_SPRITE_CONFIG)[0] ?? "small_plant");
    setRoomTestEquipNow(true);
    setRoomTestBusy(false);
    setRoomTestError(null);
    setRoomTestMessage(null);
    setAdminAccessKey(null);
    setAdminSection("roster");
    setTeacherClassCodeInput("");
    setTeacherNicknamesInput("");
    setTeacherSetupError(null);
    setTeacherSetupResult(null);
    setStarterTemplateError(null);
    setStarterTemplateResult(null);
    setDeleteBusyKey(null);
    setAdminTapCount(0);
    localStorage.removeItem(STUDENT_STORAGE_KEY);
    setStudent(null);
    setClassCodeInput("");
    setNicknameInput("");
    setStudentError(null);
    setBooks([]);
    setActiveBook(null);
    setShowAddBookForm(false);
    setStats(null);
    setSessionRewardSummary(null);
    setAchievementsData(null);
    setCompletedBooks([]);
    setPendingBookCompletion(null);
    setSelectedCompletionSticker(null);
    setSelectedCompletionRating(null);
    setHallStickerDraftPositionByCompletion({});
    setHallStickerDragState(null);
    setCompletedBookSavingKey(null);
    setCompletionChoiceError(null);
    setRoomState(null);
    setRoomError(null);
    setRoomBusyKey(null);
    setBookshelfPage(1);
    setRoomShopPage(1);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setStartPage(0);
    setEndPage(0);
    setChaptersFinished(0);
    setTimerSeconds(0);
    setView("student");
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
    if (!activeBook || !student) return;

    const xp = calculateXp();
    setEarnedXp(xp);
    const questions = getQuestions();
    const sanitizedAnswers = questions.map((_, index) => (answers[index] || "").trim());

    const sessionData: ReadingSession = {
      book_id: activeBook.id,
      start_page: startPage,
      end_page: endPage,
      chapters_finished: chaptersFinished,
      duration_minutes: Math.floor(timerSeconds / 60),
      goal_minutes: safeGoalMinutes,
      xp_earned: xp
    };

    const payload = {
      ...sessionData,
      questions,
      answers: sanitizedAnswers,
      class_code: student.class_code,
      nickname: student.nickname,
    };

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to save session: ${response.status}`);
      }

      const rewardData = (await response.json()) as Partial<SessionRewardSummary> & {
        coins?: number;
      };
      setEarnedXp(Number(rewardData.xp_earned ?? xp));
      setSessionRewardSummary({
        total_xp: Number(rewardData.total_xp ?? (stats?.total_xp ?? 0)),
        level: Number(rewardData.level ?? (stats?.level ?? 1)),
        coins: Number(rewardData.coins ?? (stats?.coins ?? 0)),
        xp_earned: Number(rewardData.xp_earned ?? xp),
        streak_days: Number(rewardData.streak_days ?? (stats?.streak_days ?? 1)),
        streak_multiplier: Number(rewardData.streak_multiplier ?? 1),
        coins_earned: Number(rewardData.coins_earned ?? 0),
        milestone_bonus_coins: Number(rewardData.milestone_bonus_coins ?? 0),
        overtime_bonus_coins: Number(rewardData.overtime_bonus_coins ?? 0),
        overtime_minutes: Number(rewardData.overtime_minutes ?? 0),
        milestones_reached: Number(rewardData.milestones_reached ?? 0),
        achievement_bonus_xp: Number(rewardData.achievement_bonus_xp ?? 0),
        achievement_bonus_coins: Number(rewardData.achievement_bonus_coins ?? 0),
        achievements_unlocked: Array.isArray(rewardData.achievements_unlocked)
          ? rewardData.achievements_unlocked
          : [],
        book_completion: rewardData.book_completion ?? null,
      });

      setActiveBook(prev =>
        prev && prev.id === sessionData.book_id
          ? { ...prev, current_page: sessionData.end_page }
          : prev
      );
      setBooks(prev =>
        prev.map(book =>
          book.id === sessionData.book_id
            ? { ...book, current_page: sessionData.end_page }
            : book
        )
      );

      await fetchInitialData();
      if (rewardData.book_completion?.completion_number) {
        setPendingBookCompletion(rewardData.book_completion);
        setSelectedCompletionSticker(rewardData.book_completion.sticker_key ?? null);
        setSelectedCompletionRating(rewardData.book_completion.rating_key ?? null);
        setCompletionChoiceError(null);
        setView("bookCompletion");
      } else {
        setPendingBookCompletion(null);
        setSelectedCompletionSticker(null);
        setSelectedCompletionRating(null);
        setView("celebration");
      }
    } catch (err) {
      console.error("Failed to save session", err);
    }
  };

  const handleBookCompletionChoiceSubmit = async () => {
    if (!pendingBookCompletion) {
      setView("celebration");
      return;
    }

    if (!selectedCompletionSticker || !selectedCompletionRating) {
      setCompletionChoiceError("Pick one sticker and one rating before continuing.");
      return;
    }

    setCompletionChoiceError(null);

    try {
      await updateCompletedBookMeta(pendingBookCompletion.completion_number, {
        sticker_key: selectedCompletionSticker,
        rating_key: selectedCompletionRating,
        sticker_pos_x: pendingBookCompletion.sticker_pos_x ?? DEFAULT_HALL_STICKER_POSITION.x,
        sticker_pos_y: pendingBookCompletion.sticker_pos_y ?? DEFAULT_HALL_STICKER_POSITION.y,
      });

      setPendingBookCompletion(null);
      setSelectedCompletionSticker(null);
      setSelectedCompletionRating(null);
      setView("celebration");
    } catch (err: any) {
      setCompletionChoiceError(String(err?.message ?? err));
    }
  };

  const handleNewBook = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!student) return;

    e.preventDefault();
    setSetupError(null);
    const formData = new FormData(e.currentTarget);
    const bookData = {
      title: formData.get("title"),
      author: formData.get("author"),
      total_pages: parseNumberInput(formData.get("pages") as string),
      class_code: student.class_code,
      nickname: student.nickname,
    };

    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookData)
      });
      if (!response.ok) {
        let message = `Failed to create book: ${response.status}`;
        try {
          const errorBody = await response.json();
          if (typeof errorBody?.error === "string") {
            message = errorBody.error;
          }
        } catch {
          // Ignore JSON parse failure and use default message.
        }
        throw new Error(message);
      }
      setSetupError(null);
      setShowAddBookForm(false);
      await fetchInitialData();
    } catch (err: any) {
      setSetupError(String(err?.message ?? err));
      console.error("Failed to create book", err);
    }
  };

  const handleSelectBook = async (book: Book) => {
    if (!student) return;

    setActiveBook(book);
    setStartPage(book.current_page || 0);
    setEndPage(book.current_page || 0);
    setView("dashboard");

    try {
      const response = await fetch("/api/books/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: book.id,
          class_code: student.class_code,
          nickname: student.nickname,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to select book: ${response.status}`);
      }

      const updatedBook = await response.json();
      if (updatedBook) {
        setActiveBook(updatedBook);
      }

      setBooks(prev =>
        prev.map(item => ({
          ...item,
          is_active: item.id === book.id ? 1 : 0,
        }))
      );
    } catch (err) {
      console.error("Failed to select active book", err);
      await fetchInitialData();
    }
  };

  const showRoomShell = Boolean(student) && view !== "student" && view !== "admin" && view !== "loading";
  const canEditRoomLayout = isRoomCustomizeMode && view === "roomView";
  const isRoomViewImmersive = view === "roomView" && !isRoomCustomizeMode;
  const showAppChrome = !canEditRoomLayout && !isRoomViewImmersive;
  const roomMenuCardClass = showRoomShell
    ? "quest-card flex flex-col room-tab-frame h-[68vh] min-h-[32rem] max-h-[68vh]"
    : "quest-card";
  const bookshelfMenuCardClass = showRoomShell
    ? "quest-card flex flex-col room-tab-frame h-[54vh] min-h-[22rem] max-h-[54vh]"
    : "quest-card";
  const roomMenuBodyClass = showRoomShell ? "flex-1 min-h-0 room-shop-scroll pr-1" : "";
  const bookshelfMenuBodyClass = showRoomShell ? "flex-1 min-h-0 flex flex-col" : "";
  const appShellClassName = showRoomShell
    ? "min-h-screen h-[100dvh] w-full room-shell-active overflow-hidden"
    : "min-h-screen p-4 md:p-8 max-w-2xl mx-auto";
  const contentShellClassName = showRoomShell
    ? canEditRoomLayout || isRoomViewImmersive
      ? "room-content-layer h-full pointer-events-none"
      : "room-content-layer room-content-fit p-3 md:p-4 h-full"
    : "";
  const showBookshelfHeader = Boolean(student && view === "bookshelf");
  const mainAreaClassName = showRoomShell ? "flex-1 min-h-0" : "";
  const showFooterStats = Boolean(
    stats &&
      view === "bookshelf" &&
      showAppChrome
  );
  const safeGoalMinutes = Math.max(1, targetMinutes);
  const elapsedMinutes = Math.floor(timerSeconds / 60);
  const overtimeMinutes = Math.max(0, elapsedMinutes - safeGoalMinutes);
  const isPastGoalTime = timerSeconds > safeGoalMinutes * 60;
  const roomOwnedCount = roomState?.items.filter((item) => item.owned).length ?? 0;
  const roomEquippedCount = roomState?.items.filter((item) => item.equipped).length ?? 0;
  const roomUnlockedCount = roomState?.items.filter((item) => item.unlocked).length ?? 0;
  const milestoneProgressPercent = getMilestoneProgressPercent(stats?.total_xp || 0, stats?.next_milestone_xp || 500);
  const animatedTotalXp = useCountUpValue(stats?.total_xp ?? 0, prefersReducedMotion, 620);
  const animatedCoins = useCountUpValue(stats?.coins ?? 0, prefersReducedMotion, 560);
  const directionalViewMotion = {
    initial: prefersReducedMotion
      ? { opacity: 0 }
      : { opacity: 0, x: viewDirection >= 0 ? 26 : -26, y: 10, scale: 0.985 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: prefersReducedMotion
      ? { opacity: 0 }
      : { opacity: 0, x: viewDirection >= 0 ? -20 : 20, y: -8, scale: 0.992 },
    transition: prefersReducedMotion
      ? { duration: 0.16 }
      : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  };

  if (view === "loading") {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${isDarkMode ? "bg-slate-900 text-slate-100" : "bg-sky-50"}`}
      >
        <button
          type="button"
          onClick={() => setIsDarkMode((prev) => !prev)}
          className={`fixed right-4 top-4 z-40 rounded-xl border-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
            isDarkMode
              ? "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          title="Toggle dark mode"
        >
          <span className="flex items-center gap-2">
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDarkMode ? "Light" : "Dark"}
          </span>
        </button>
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
    <div
      className={`${appShellClassName} ${
        view === "student" ? "student-shell" : ""
      } ${isDarkMode ? "theme-dark" : "theme-light"}`}
    >
      {showAppChrome && (
        <button
          type="button"
          onClick={() => setIsDarkMode((prev) => !prev)}
          className={`fixed right-4 top-4 z-40 rounded-xl border-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
            isDarkMode
              ? "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          title="Toggle dark mode"
        >
          <span className="flex items-center gap-2">
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDarkMode ? "Light" : "Dark"}
          </span>
        </button>
      )}

      {showRoomShell && (
        <div className="room-frame" ref={roomFrameRef}>
          <div className="room-layer room-layer-wall" />
          <div className="room-layer room-layer-floor" />
          <div className="room-layer room-layer-furniture" />
          <div className="room-layer room-layer-bookshelf" />
          {equippedRoomSprites.map(({ item, config, layout }) => (
            <div
              key={item.key}
              className={`room-item-sprite ${config.className} ${
                canEditRoomLayout ? "is-editable" : ""
              } ${roomDragState?.itemKey === item.key ? "is-dragging" : ""}`}
              style={{
                left: `${layout.x}%`,
                top: `${layout.y}%`,
                zIndex: 20 + layout.z,
              }}
              onPointerDown={(event) => handleRoomItemPointerDown(event, item.key)}
              title={canEditRoomLayout ? `Drag ${item.name}` : undefined}
            />
          ))}
          <div className="room-layer room-layer-atmosphere" />
        </div>
      )}

      <div className={contentShellClassName}>
      {canEditRoomLayout && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-slate-900 bg-white/95 px-3 py-2 shadow-lg pointer-events-auto">
          <button
            type="button"
            onClick={handleFinishRoomCustomization}
            disabled={roomLayoutSavingKey === "snapshot"}
            className="py-2 px-4 rounded-xl border-2 border-emerald-300 bg-emerald-100 text-emerald-800 font-bold disabled:opacity-50"
          >
            Finish Customizing
          </button>
          <button
            type="button"
            onClick={handleResetRoomLayout}
            disabled={roomLayoutSavingKey === "snapshot"}
            className="py-2 px-4 rounded-xl border-2 border-amber-300 bg-amber-100 text-amber-800 font-bold disabled:opacity-50"
          >
            {roomLayoutSavingKey === "snapshot" ? "Resetting..." : "Reset"}
          </button>
          {roomError && <p className="text-sm font-semibold text-rose-600">{roomError}</p>}
        </div>
      )}

      {isRoomViewImmersive && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-slate-900 bg-white/95 px-3 py-2 shadow-lg pointer-events-auto">
          <button
            type="button"
            onClick={() => setView("room")}
            className="py-2 px-4 rounded-xl border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleStartRoomCustomization}
            disabled={!hasPositionableEquippedRoomItems || Boolean(roomLayoutSavingKey)}
            className="py-2 px-4 rounded-xl border-2 border-amber-300 bg-amber-100 text-amber-800 font-bold disabled:opacity-50"
          >
            Customize Room
          </button>
          <button
            type="button"
            onClick={() => setView("roomShop")}
            className="py-2 px-4 rounded-xl border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
          >
            Room Shop
          </button>
        </div>
      )}

      {showAppChrome && (
      <>
      {/* Header / XP Bar */}
      {showBookshelfHeader && (
        <header className={showRoomShell ? "mb-3" : "mb-8"}>
          <div className="flex justify-between items-end mb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleHiddenAdminTap}
                className="bg-amber-400 p-2 rounded-xl border-2 border-slate-900"
                aria-label="Reading badge"
                title="Reading badge"
              >
                <Trophy className="w-5 h-5" />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Level {stats?.level}</p>
                <h1 className="font-display font-bold text-xl">Reading Quest</h1>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {student.class_code} / {student.nickname}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total XP / Coins</p>
              <p className="font-display font-bold text-xl text-amber-600">
                {animatedTotalXp} XP
              </p>
              <p className="font-display font-bold text-lg text-emerald-600">
                {animatedCoins} Coins
              </p>
              <button
                onClick={handleSwitchStudent}
                className="text-xs font-bold uppercase tracking-wide text-sky-600 hover:text-sky-700 mt-1"
                type="button"
              >
                Switch Student
              </button>
            </div>
          </div>
          <div className="h-4 bg-slate-200 rounded-full border-2 border-slate-900 overflow-hidden">
            <motion.div
              className="h-full bg-amber-400 origin-left"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: milestoneProgressPercent / 100 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.16 }
                  : { type: "spring", stiffness: 190, damping: 18, mass: 0.85 }
              }
            />
          </div>
          <p className="text-[11px] mt-2 text-slate-500 font-semibold">
            Next milestone at {stats?.next_milestone_xp ?? 500} XP
          </p>
        </header>
      )}

      <main className={mainAreaClassName}>
      <AnimatePresence mode="wait">
        {view === "student" && (
          <motion.div
            key="student"
            {...directionalViewMotion}
            className="quest-card"
          >
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-2xl font-bold">Who is reading today?</h2>
              <button
                type="button"
                onClick={openAdminPrompt}
                className="p-2 rounded-xl border-2 border-slate-200 text-slate-300 hover:text-slate-400 hover:border-slate-300 transition-colors"
                aria-label="Class tools"
                title="Class tools"
              >
                <Shield className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-500 mb-6">Enter your class code and nickname to load your own quest progress.</p>

            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Class Code</label>
                <input
                  value={classCodeInput}
                  onChange={(e) => setClassCodeInput(e.target.value)}
                  pattern="[A-Za-z0-9-]{2,20}"
                  required
                  className="quest-input"
                  placeholder="e.g. 5A-READ"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Nickname</label>
                <input
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  pattern="[A-Za-z0-9 _.-]{2,24}"
                  required
                  className="quest-input"
                  placeholder="e.g. Maya"
                />
              </div>
              {studentError && <p className="text-sm text-rose-600 font-medium">{studentError}</p>}
              <button type="submit" className="quest-button w-full mt-4">
                Continue
              </button>
            </form>
          </motion.div>
        )}

        {view === "admin" && (
          <motion.div
            key="admin"
            {...directionalViewMotion}
            className="space-y-6"
          >
            <div className="quest-card">
              <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-sky-600" />
                  <h2 className="text-2xl font-bold">Admin Panel</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminSection("roster")}
                    className={`py-2 px-4 rounded-xl border-2 font-bold text-sm ${
                      adminSection === "roster"
                        ? "border-slate-900 bg-amber-200 text-slate-900"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    Roster
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminSection("teacher");
                      if (!teacherClassCodeInput && student?.class_code) {
                        setTeacherClassCodeInput(student.class_code);
                      }
                    }}
                    className={`py-2 px-4 rounded-xl border-2 font-bold text-sm ${
                      adminSection === "teacher"
                        ? "border-slate-900 bg-sky-200 text-slate-900"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    Teacher Setup
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSection("responses")}
                    className={`py-2 px-4 rounded-xl border-2 font-bold text-sm ${
                      adminSection === "responses"
                        ? "border-slate-900 bg-emerald-200 text-slate-900"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    Responses
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSection("roomTest")}
                    className={`py-2 px-4 rounded-xl border-2 font-bold text-sm ${
                      adminSection === "roomTest"
                        ? "border-slate-900 bg-violet-200 text-slate-900"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    Room Test
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminRefresh}
                    disabled={isAdminLoading}
                    className="py-2 px-4 rounded-xl border-2 border-slate-900 bg-slate-100 font-bold text-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleExitAdmin}
                    className="py-2 px-4 rounded-xl border-2 border-slate-900 bg-white font-bold text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>

              {adminError && <p className="text-sm text-rose-600 font-medium">{adminError}</p>}
              {!adminError && (
                <p className="text-sm text-slate-500">
                  {isAdminLoading
                    ? "Loading..."
                    : `Last updated: ${
                        adminSection === "responses"
                          ? adminReflections?.generated_at ?? "just now"
                          : adminRoster?.generated_at ?? "just now"
                      }`}
                </p>
              )}
            </div>

            {adminSection === "roster" && (
              <>
                <div className="quest-card">
                  <h3 className="font-bold text-lg mb-3">Class Codes</h3>
                  {adminRoster?.classes?.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {adminRoster.classes.map((classRow) => (
                        <div key={classRow.class_code} className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs uppercase text-slate-400 font-bold">Class Code</p>
                              <p className="font-bold text-lg">{classRow.class_code}</p>
                              <p className="text-sm text-slate-500">{classRow.student_count} students</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteClass(classRow.class_code, classRow.student_count)}
                              disabled={deleteBusyKey === `class-${classRow.class_code}`}
                              className="px-2 py-1 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                              title="Delete class"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500">No class codes yet.</p>
                  )}
                </div>

                <div className="quest-card">
                  <h3 className="font-bold text-lg mb-3">Students</h3>
                  {adminRoster?.students?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 uppercase text-xs">
                            <th className="pb-2 pr-4">Class</th>
                            <th className="pb-2 pr-4">Nickname</th>
                            <th className="pb-2 pr-4">Level</th>
                            <th className="pb-2 pr-4">XP</th>
                            <th className="pb-2 pr-4">Coins</th>
                            <th className="pb-2 pr-4">Quests</th>
                            <th className="pb-2 pr-4">Hours</th>
                            <th className="pb-2 pr-4">Achievements</th>
                            <th className="pb-2 pr-4">Latest Unlock</th>
                            <th className="pb-2">Active Book</th>
                            <th className="pb-2 pl-3">Grant Coins</th>
                            <th className="pb-2 pl-3">Delete</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminRoster.students.map((row) => (
                            <tr key={row.id} className="border-t border-slate-200">
                              <td className="py-2 pr-4 font-bold">{row.class_code}</td>
                              <td className="py-2 pr-4">{row.nickname}</td>
                              <td className="py-2 pr-4">{row.level}</td>
                              <td className="py-2 pr-4">{row.total_xp}</td>
                              <td className="py-2 pr-4 font-semibold text-emerald-700">{row.coins ?? 0}</td>
                              <td className="py-2 pr-4">{row.total_sessions}</td>
                              <td className="py-2 pr-4">{(row.total_minutes / 60).toFixed(1)}</td>
                              <td className="py-2 pr-4">{row.achievements_unlocked ?? 0}</td>
                              <td className="py-2 pr-4">
                                {row.latest_achievement_at
                                  ? new Date(row.latest_achievement_at).toLocaleDateString()
                                  : "Never"}
                              </td>
                              <td className="py-2">
                                {row.active_book
                                  ? `${row.active_book} (${row.current_page ?? 0}/${row.total_pages ?? 0})`
                                  : "No active book"}
                              </td>
                              <td className="py-2 pl-3">
                                <div className="flex items-center gap-2">
                                  <input
                                    value={grantCoinsInputByStudent[row.id] ?? ""}
                                    onChange={(e) =>
                                      setGrantCoinsInputByStudent((prev) => ({
                                        ...prev,
                                        [row.id]: e.target.value,
                                      }))
                                    }
                                    type="number"
                                    min={1}
                                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                                    placeholder="50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleGrantCoins(row.id)}
                                    disabled={grantCoinsBusyStudentId === row.id}
                                    className="px-2 py-1 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 text-xs font-bold"
                                    title="Grant coins"
                                  >
                                    Give
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 pl-3">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudent(row.id, row.nickname, row.class_code)}
                                  disabled={deleteBusyKey === `student-${row.id}`}
                                  className="px-2 py-1 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                  title="Delete student"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500">No students found.</p>
                  )}
                </div>
              </>
            )}

            {adminSection === "teacher" && (
              <div className="quest-card">
                <h3 className="font-bold text-lg mb-2">Teacher Setup</h3>
                <p className="text-slate-500 mb-4">
                  Pre-create student logins for a class. Add one nickname per line.
                </p>

                <form onSubmit={handleTeacherSetupSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Class Code</label>
                    <input
                      value={teacherClassCodeInput}
                      onChange={(e) => setTeacherClassCodeInput(e.target.value)}
                      pattern="[A-Za-z0-9-]{2,20}"
                      required
                      className="quest-input"
                      placeholder="e.g. 5A-READ"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Student Nicknames</label>
                    <textarea
                      value={teacherNicknamesInput}
                      onChange={(e) => setTeacherNicknamesInput(e.target.value)}
                      className="quest-input h-36 resize-none"
                      placeholder={"Maya\nNoah\nAva"}
                      required
                    />
                  </div>

                  {teacherSetupError && <p className="text-sm text-rose-600 font-medium">{teacherSetupError}</p>}

                  {teacherSetupResult && (
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3 text-sm">
                      <p className="font-bold text-emerald-800">
                        Saved for class {teacherSetupResult.class_code}
                      </p>
                      <p className="text-emerald-700">
                        Created: {teacherSetupResult.created_count}, Existing: {teacherSetupResult.existing_count}
                      </p>
                      {teacherSetupResult.invalid_nicknames.length > 0 && (
                        <p className="text-amber-700">
                          Invalid ignored: {teacherSetupResult.invalid_nicknames.join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="quest-button w-full flex items-center justify-center gap-2"
                    disabled={isTeacherSetupSaving}
                  >
                    {isTeacherSetupSaving ? "Saving..." : "Create Student Logins"}
                  </button>
                </form>

                <div className="mt-6 border-t border-slate-200 pt-5">
                  <h4 className="font-bold text-base mb-1">Starter Room Template</h4>
                  <p className="text-sm text-slate-500 mb-3">
                    Save the currently logged-in student&apos;s equipped room as the starter room for all future students.
                  </p>
                  {student && (
                    <p className="text-xs font-semibold text-slate-500 mb-3">
                      Source student: {student.class_code} / {student.nickname}
                    </p>
                  )}
                  {starterTemplateError && <p className="text-sm text-rose-600 font-medium mb-3">{starterTemplateError}</p>}
                  {starterTemplateResult && (
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3 text-sm mb-3">
                      <p className="font-bold text-emerald-800">
                        Starter template saved from {starterTemplateResult.source.nickname} ({starterTemplateResult.source.class_code})
                      </p>
                      <p className="text-emerald-700">
                        Items: {starterTemplateResult.item_count} | Updated: {new Date(starterTemplateResult.updated_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveStarterTemplateFromCurrentStudent}
                    disabled={isStarterTemplateSaving || !student}
                    className="w-full py-3 rounded-2xl border-2 border-slate-900 bg-slate-100 font-bold text-slate-900 disabled:opacity-50"
                  >
                    {isStarterTemplateSaving ? "Saving Template..." : "Use Current Student Room As Starter Template"}
                  </button>
                </div>
              </div>
            )}

            {adminSection === "roomTest" && (
              <div className="quest-card">
                <h3 className="font-bold text-lg mb-2">Room Deco Test Mode</h3>
                <p className="text-slate-500 mb-4">
                  Admin-only: grant any room sprite directly to a student for testing.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold mb-1">Student</label>
                    <select
                      value={roomTestStudentId}
                      onChange={(e) => setRoomTestStudentId(e.target.value)}
                      className="quest-input"
                      disabled={!adminRoster?.students?.length}
                    >
                      {(adminRoster?.students ?? []).map((row) => (
                        <option key={row.id} value={String(row.id)}>
                          {row.nickname} ({row.class_code}) - L{row.level}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-1">Room Sprite</label>
                    <select
                      value={roomTestItemKey}
                      onChange={(e) => setRoomTestItemKey(e.target.value)}
                      className="quest-input"
                    >
                      {roomTestItemOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={roomTestEquipNow}
                    onChange={(e) => setRoomTestEquipNow(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  Equip immediately
                </label>

                {roomTestError && (
                  <p className="mt-3 text-sm text-rose-600 font-medium">{roomTestError}</p>
                )}
                {roomTestMessage && (
                  <p className="mt-3 text-sm text-emerald-700 font-medium">{roomTestMessage}</p>
                )}

                <button
                  type="button"
                  onClick={handleRoomTestGrant}
                  disabled={roomTestBusy || !roomTestStudentId}
                  className="quest-button w-full md:w-auto mt-4 disabled:opacity-50"
                >
                  {roomTestBusy ? "Applying..." : "Grant Sprite"}
                </button>
              </div>
            )}

            {adminSection === "responses" && (
              <div className="space-y-4">
                <div className="quest-card">
                  <h3 className="font-bold text-lg mb-2">Post-Reading Responses</h3>
                  <p className="text-slate-500">
                    View students&apos; submitted answers from their reading sessions.
                  </p>
                </div>

                {adminReflectionSessions.length ? (
                  <>
                    <div className="quest-card border-2 border-emerald-200 bg-emerald-50/40">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input
                          value={responsesSearchInput}
                          onChange={(e) => setResponsesSearchInput(e.target.value)}
                          className="quest-input md:col-span-2"
                          placeholder="Search student, class, book, or response text"
                        />
                        <select
                          value={responsesClassFilter}
                          onChange={(e) => setResponsesClassFilter(e.target.value)}
                          className="quest-input"
                        >
                          <option value="all">All classes</option>
                          {responseClassOptions.map((classCode) => (
                            <option key={classCode} value={classCode}>
                              {classCode}
                            </option>
                          ))}
                        </select>
                        <select
                          value={responsesStudentFilter}
                          onChange={(e) => setResponsesStudentFilter(e.target.value)}
                          className="quest-input"
                        >
                          <option value="all">All students</option>
                          {responseStudentOptions.map((studentOption) => (
                            <option key={studentOption.key} value={studentOption.key}>
                              {studentOption.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-emerald-800 font-medium">
                          Showing {filteredReflectionSessions.length} session
                          {filteredReflectionSessions.length === 1 ? "" : "s"} across {groupedReflectionSessions.length} student
                          {groupedReflectionSessions.length === 1 ? "" : "s"}.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setResponsesSearchInput("");
                            setResponsesClassFilter("all");
                            setResponsesStudentFilter("all");
                          }}
                          className="px-3 py-1 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-sm font-bold"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </div>

                    {groupedReflectionSessions.length ? (
                      <div className="space-y-4">
                        {groupedReflectionSessions.map((studentGroup) => (
                          <div
                            key={getStudentFilterKey(studentGroup.class_code, studentGroup.nickname)}
                            className="quest-card border-2 border-slate-200"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-900">
                                  {studentGroup.nickname}{" "}
                                  <span className="text-slate-500 font-semibold">({studentGroup.class_code})</span>
                                </p>
                                <p className="text-xs text-slate-500">
                                  {studentGroup.sessions.length} reading session
                                  {studentGroup.sessions.length === 1 ? "" : "s"}
                                </p>
                              </div>
                              <p className="text-xs text-slate-500">
                                Latest: {new Date(studentGroup.latest_timestamp).toLocaleString()}
                              </p>
                            </div>

                            <div className="mt-3 space-y-2">
                              {studentGroup.sessions.map((session, index) => (
                                <details
                                  key={session.session_id}
                                  open={index === 0}
                                  className="rounded-xl border border-slate-200 bg-slate-50"
                                >
                                  <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap justify-between items-center gap-2">
                                    <div>
                                      <p className="font-semibold text-slate-800">
                                        {session.book_title ? session.book_title : "Unknown Book"}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {session.answers.length} answer{session.answers.length === 1 ? "" : "s"}
                                      </p>
                                    </div>
                                    <p className="text-xs text-slate-500">{new Date(session.timestamp).toLocaleString()}</p>
                                  </summary>

                                  <div className="px-4 pb-4 space-y-2">
                                    {session.answers.map((entry) => (
                                      <div
                                        key={`${session.session_id}-${entry.question_index}`}
                                        className="rounded-lg border border-emerald-200 bg-white p-3"
                                      >
                                        <p className="text-xs uppercase tracking-wide text-emerald-700 font-bold mb-1">
                                          Question {entry.question_index + 1}
                                        </p>
                                        <p className="text-sm font-medium text-slate-800">{entry.question_text}</p>
                                        <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                                          {entry.answer_text || "(No answer submitted)"}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="quest-card">
                        <p className="text-slate-500">No response sessions match those filters.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="quest-card">
                    <p className="text-slate-500">No post-reading responses have been submitted yet.</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {view === "setup" && (
          <motion.div 
            key="setup"
            {...directionalViewMotion}
            className={roomMenuCardClass}
          >
            <div className="mb-6 flex items-start justify-between gap-3">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Plus className="text-amber-500" /> Add Your First Book to Your Bookshelf!
              </h2>
              <button
                type="button"
                onClick={openAdminPrompt}
                className="p-2 rounded-xl border-2 border-slate-200 text-slate-300 hover:text-slate-400 hover:border-slate-300 transition-colors"
                aria-label="Class tools"
                title="Class tools"
              >
                <Shield className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleNewBook} className={`space-y-4 ${roomMenuBodyClass}`}>
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
              {setupError && <p className="text-sm text-rose-600 font-medium">{setupError}</p>}
            </form>
          </motion.div>
        )}

        {view === "bookshelf" && (
          <motion.div 
            key="bookshelf"
            {...directionalViewMotion}
            className="space-y-6"
          >
            <div className={bookshelfMenuCardClass}>
              <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-bold">My Bookshelf</h2>
                  <p className="text-slate-500 font-medium">Choose a book spine to make it your current quest.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setView("achievements")}
                    className="menu-action-button group relative overflow-hidden py-2.5 px-4 rounded-2xl border-2 border-amber-300 bg-[linear-gradient(135deg,#fff7d1,#fde68a)] font-extrabold text-amber-900 shadow-[0_3px_0_0_rgba(180,83,9,0.35)] hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_rgba(180,83,9,0.45)] transition-all flex items-center gap-2"
                  >
                    <span className="menu-action-shine" aria-hidden="true" />
                    <Trophy className="menu-action-icon w-4 h-4 text-amber-700 transition-transform" />
                    Achievements
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("hallOfReads")}
                    className="menu-action-button group relative overflow-hidden py-2.5 px-4 rounded-2xl border-2 border-sky-300 bg-[linear-gradient(135deg,#e0f2fe,#bae6fd)] font-extrabold text-sky-900 shadow-[0_3px_0_0_rgba(3,105,161,0.35)] hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_rgba(3,105,161,0.45)] transition-all flex items-center gap-2"
                  >
                    <span className="menu-action-shine" aria-hidden="true" />
                    <BookOpen className="menu-action-icon w-4 h-4 text-sky-700 transition-transform" />
                    Hall of Reads
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setView("room");
                      if (!roomState) {
                        void loadRoomState();
                      }
                    }}
                    className="menu-action-button group relative overflow-hidden py-2.5 px-4 rounded-2xl border-2 border-violet-300 bg-[linear-gradient(135deg,#ede9fe,#ddd6fe)] font-extrabold text-violet-900 shadow-[0_3px_0_0_rgba(91,33,182,0.35)] hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_rgba(91,33,182,0.45)] transition-all flex items-center gap-2"
                  >
                    <span className="menu-action-shine" aria-hidden="true" />
                    <Star className="menu-action-icon w-4 h-4 text-violet-700 transition-transform" />
                    My Room
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddBookForm((prev) => !prev)}
                    className="quest-button px-4 py-2 text-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {showAddBookForm ? "Close" : "Add to Bookshelf"}
                  </button>
                </div>
              </div>

              <div className={bookshelfMenuBodyClass}>
              {showAddBookForm && (
                <form onSubmit={handleNewBook} className="space-y-3 mb-5 p-4 rounded-2xl border-2 border-slate-200 bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input name="title" required className="quest-input" placeholder="Book title" />
                    <input name="author" required className="quest-input" placeholder="Author" />
                    <input name="pages" type="number" min={1} required className="quest-input" placeholder="Total pages" />
                  </div>
                  <button type="submit" className="quest-button w-full md:w-auto">
                    Add Book
                  </button>
                </form>
              )}

              {books.length > 0 ? (
                <div className="bookshelf-wrap bookshelf-wrap-bottom">
                  {bookshelfTotalPages > 1 && (
                    <div className="mb-2 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBookshelfPage((prev) => Math.max(1, prev - 1))}
                        disabled={bookshelfPage === 1}
                        className="px-3 py-1 rounded-lg border-2 border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <p className="text-xs font-bold text-slate-500">
                        Shelf Page {bookshelfPage} / {bookshelfTotalPages}
                      </p>
                      <button
                        type="button"
                        onClick={() => setBookshelfPage((prev) => Math.min(bookshelfTotalPages, prev + 1))}
                        disabled={bookshelfPage === bookshelfTotalPages}
                        className="px-3 py-1 rounded-lg border-2 border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  )}
                  <div className="bookshelf-stack-scroll room-shop-scroll">
                  <div className="bookshelf-stack bookshelf-stack-bottom">
                    {pagedBooks.map((book, index) => {
                      const pageStartIndex = (bookshelfPage - 1) * BOOKSHELF_PAGE_SIZE;
                      const colorIndex = pageStartIndex + index;
                      const progressPercent = getBookProgressPercent(book);
                      const isSelected = activeBook?.id === book.id;
                      return (
                        <button
                          key={book.id}
                          type="button"
                          onClick={() => handleSelectBook(book)}
                          className={`book-spine ${isSelected ? "selected" : ""}`}
                          style={{
                            backgroundColor: BOOK_SPINE_COLORS[colorIndex % BOOK_SPINE_COLORS.length],
                            zIndex: pagedBooks.length - index,
                          }}
                        >
                          <span className="book-spine-topline">
                            {book.title}
                          </span>
                          <span className="book-spine-progress">
                            {progressPercent}%  {book.current_page}/{book.total_pages} Pages
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  </div>
                  <div className="bookshelf-board" />
                </div>
              ) : (
                <p className="text-slate-500 font-medium">No books yet. Add one to start your shelf.</p>
              )}
              </div>
            </div>
          </motion.div>
        )}

        {view === "room" && (
          <motion.div
            key="room"
            {...directionalViewMotion}
            className={showRoomShell ? "" : "space-y-6"}
          >
            <div className={roomMenuCardClass}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-bold">My Reading Room</h2>
                  <p className="text-slate-500 font-medium">
                    Earn XP, collect coins, and decorate your room.
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    Every 500 XP milestone grants a bonus coin reward.
                  </p>
                </div>
                <div className="menu-nav-group flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRoomHubActiveNav("roomView");
                      setView("roomView");
                      if (!roomState) void loadRoomState();
                    }}
                    onPointerEnter={() => setRoomHubActiveNav("roomView")}
                    onFocus={() => setRoomHubActiveNav("roomView")}
                    className={`menu-ripple-button room-hub-nav-button relative overflow-hidden py-2 px-4 rounded-xl border-2 font-bold transition-colors disabled:opacity-50 ${
                      roomHubActiveNav === "roomView"
                        ? "border-slate-900 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {roomHubActiveNav === "roomView" && (
                      <motion.span
                        layoutId="room-hub-nav-pill"
                        className="pointer-events-none absolute inset-[2px] rounded-lg bg-amber-100"
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.12 }
                            : { type: "spring", stiffness: 360, damping: 32, mass: 0.8 }
                        }
                      />
                    )}
                    <span className="relative z-10">View Room</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRoomHubActiveNav("roomShop");
                      setView("roomShop");
                      if (!roomState) void loadRoomState();
                    }}
                    onPointerEnter={() => setRoomHubActiveNav("roomShop")}
                    onFocus={() => setRoomHubActiveNav("roomShop")}
                    className={`menu-ripple-button room-hub-nav-button relative overflow-hidden py-2 px-4 rounded-xl border-2 font-bold transition-colors ${
                      roomHubActiveNav === "roomShop"
                        ? "border-slate-900 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {roomHubActiveNav === "roomShop" && (
                      <motion.span
                        layoutId="room-hub-nav-pill"
                        className="pointer-events-none absolute inset-[2px] rounded-lg bg-amber-100"
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.12 }
                            : { type: "spring", stiffness: 360, damping: 32, mass: 0.8 }
                        }
                      />
                    )}
                    <span className="relative z-10">Room Shop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRoomHubActiveNav("bookshelf");
                      setView("bookshelf");
                    }}
                    onPointerEnter={() => setRoomHubActiveNav("bookshelf")}
                    onFocus={() => setRoomHubActiveNav("bookshelf")}
                    className={`menu-ripple-button room-hub-nav-button relative overflow-hidden py-2 px-4 rounded-xl border-2 font-bold transition-colors ${
                      roomHubActiveNav === "bookshelf"
                        ? "border-slate-900 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {roomHubActiveNav === "bookshelf" && (
                      <motion.span
                        layoutId="room-hub-nav-pill"
                        className="pointer-events-none absolute inset-[2px] rounded-lg bg-amber-100"
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.12 }
                            : { type: "spring", stiffness: 360, damping: 32, mass: 0.8 }
                        }
                      />
                    )}
                    <span className="relative z-10">Back to Bookshelf</span>
                  </button>
                </div>
              </div>

              <div className={roomMenuBodyClass}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
                  <p className="text-xs uppercase font-bold text-amber-700">XP</p>
                  <p className="text-2xl font-display font-bold">{stats?.total_xp ?? 0}</p>
                </div>
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
                  <p className="text-xs uppercase font-bold text-emerald-700">Coins</p>
                  <p className="text-2xl font-display font-bold">{roomState?.coins ?? stats?.coins ?? 0}</p>
                </div>
                <div className="bg-sky-50 border-2 border-sky-200 rounded-xl p-3">
                  <p className="text-xs uppercase font-bold text-sky-700">Next Milestone</p>
                  <p className="text-2xl font-display font-bold">{stats?.next_milestone_xp ?? 500} XP</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border-2 border-slate-200 rounded-xl p-3">
                  <p className="text-xs uppercase font-bold text-slate-500">Owned Items</p>
                  <p className="text-xl font-display font-bold">{roomOwnedCount}</p>
                </div>
                <div className="bg-white border-2 border-slate-200 rounded-xl p-3">
                  <p className="text-xs uppercase font-bold text-slate-500">Equipped Items</p>
                  <p className="text-xl font-display font-bold">{roomEquippedCount}</p>
                </div>
                <div className="bg-white border-2 border-slate-200 rounded-xl p-3">
                  <p className="text-xs uppercase font-bold text-slate-500">Unlocked Shop Items</p>
                  <p className="text-xl font-display font-bold">{roomUnlockedCount}</p>
                </div>
              </div>

              {roomError && <p className="text-sm text-rose-600 font-medium mt-4">{roomError}</p>}
              </div>
            </div>
          </motion.div>
        )}

        {view === "roomShop" && (
          <motion.div
            key="roomShop"
            {...directionalViewMotion}
            className={showRoomShell ? "" : "space-y-6"}
          >
            <div className={roomMenuCardClass}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-2xl font-bold">Room Shop</h2>
                  <p className="text-slate-500 font-medium">Buy, equip, and organize decor by furniture type.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setView("room")}
                    className="py-2 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                  >
                    Back to Reading Room
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("roomView")}
                    className="py-2 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                  >
                    View Room
                  </button>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {ROOM_SHOP_CATEGORIES.map((category) => {
                  const isSelected = roomShopCategory === category.id;
                  const count = roomShopCategoryCounts[category.id] ?? 0;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setRoomShopCategory(category.id)}
                      className={`menu-ripple-button relative overflow-hidden px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-colors ${
                        isSelected
                          ? "border-slate-900 text-slate-900"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {isSelected && (
                        <motion.span
                          layoutId="room-shop-category-pill"
                          className="pointer-events-none absolute inset-[2px] rounded-lg bg-amber-200"
                          transition={
                            prefersReducedMotion
                              ? { duration: 0.12 }
                              : { type: "spring", stiffness: 420, damping: 34, mass: 0.78 }
                          }
                        />
                      )}
                      <span className="relative z-10">
                        {category.label} ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 min-h-[2.25rem]">
                <p className="text-sm font-semibold text-slate-500">
                  Showing {filteredRoomShopItems.length} item{filteredRoomShopItems.length === 1 ? "" : "s"} in{" "}
                  {ROOM_SHOP_CATEGORIES.find((category) => category.id === roomShopCategory)?.label ?? "All"}.
                </p>
                <div className="flex items-center gap-2 min-h-[2rem]">
                  {roomShopTotalPages > 1 ? (
                    <>
                    <button
                      type="button"
                      onClick={() => setRoomShopPage((prev) => Math.max(1, prev - 1))}
                      disabled={roomShopPage === 1}
                      className="px-3 py-1 rounded-lg border-2 border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <p className="text-xs font-bold text-slate-500">
                      Page {roomShopPage} / {roomShopTotalPages}
                    </p>
                    <button
                      type="button"
                      onClick={() => setRoomShopPage((prev) => Math.min(roomShopTotalPages, prev + 1))}
                      disabled={roomShopPage === roomShopTotalPages}
                      className="px-3 py-1 rounded-lg border-2 border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40"
                    >
                      Next
                    </button>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-transparent select-none">Page 1 / 1</span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0">
              <div className="room-shop-scroll h-full pr-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${roomShopCategory}-${roomShopPage}`}
                    className="space-y-2"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: prefersReducedMotion
                        ? { duration: 0.12 }
                        : { duration: 0.2, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.04, delayChildren: 0.02 },
                    }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: 0.14 } }}
                  >
                    {pagedRoomShopItems.length ? (
                      pagedRoomShopItems.map((item) => {
                        const notEnoughCoins = !item.owned && (roomState?.coins ?? 0) < item.cost_coins;
                        const disabled =
                          roomBusyKey === item.key || Boolean(roomLayoutSavingKey) || !item.unlocked || notEnoughCoins;
                        const itemFeedback = roomActionFeedback?.itemKey === item.key ? roomActionFeedback : null;
                        let buttonLabel = `Buy ${item.cost_coins} Coins`;
                        let nextAction: "purchase" | "equip" | "unequip" = "purchase";

                        if (!item.unlocked) {
                          buttonLabel = `Unlock at ${item.min_xp} XP`;
                        } else if (notEnoughCoins) {
                          buttonLabel = `Need ${item.cost_coins} Coins`;
                        } else if (item.owned && item.equipped) {
                          buttonLabel = "Unequip";
                          nextAction = "unequip";
                        } else if (item.owned) {
                          buttonLabel = "Equip";
                          nextAction = "equip";
                        }

                        return (
                          <motion.div
                            key={item.key}
                            layout
                            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={prefersReducedMotion ? { duration: 0.12 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="relative overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                          >
                            <AnimatePresence>
                              {itemFeedback?.action === "equip" && !prefersReducedMotion && (
                                <motion.div
                                  key={`equip-${itemFeedback.token}`}
                                  className="pointer-events-none absolute inset-0 rounded-xl bg-emerald-200/55"
                                  initial={{ opacity: 0, scale: 0.98 }}
                                  animate={{ opacity: [0, 0.85, 0], scale: [0.98, 1.02, 1] }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.45, ease: "easeOut" }}
                                />
                              )}
                              {itemFeedback?.action === "unequip" && !prefersReducedMotion && (
                                <motion.div
                                  key={`unequip-${itemFeedback.token}`}
                                  className="pointer-events-none absolute inset-0 rounded-xl bg-slate-200/50"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: [0, 0.55, 0] }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.42, ease: "easeOut" }}
                                />
                              )}
                            </AnimatePresence>
                            <div className="relative z-10">
                              <p className="font-bold text-slate-900">{item.name}</p>
                              <p className="text-sm text-slate-600">{item.description}</p>
                              <p className="text-xs font-semibold text-slate-500 mt-1">
                                Category: {ROOM_SHOP_CATEGORIES.find((category) => category.id === getRoomShopCategory(item.key))?.label ?? "Misc"}{" "}
                                | Unlock: {item.min_xp} XP | Cost: {item.cost_coins} Coins
                              </p>
                            </div>
                            <div className="relative z-10">
                              <button
                                type="button"
                                onClick={() => handleRoomAction(nextAction, item.key)}
                                disabled={disabled}
                                className={`menu-ripple-button relative overflow-hidden px-3 py-2 rounded-xl border-2 text-sm font-bold ${
                                  item.owned && item.equipped
                                    ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                    : "border-slate-300 bg-white text-slate-700"
                                } disabled:opacity-50`}
                              >
                                {roomBusyKey === item.key ? "Saving..." : buttonLabel}
                              </button>
                              <AnimatePresence>
                                {itemFeedback?.action === "purchase" && !prefersReducedMotion && (
                                  <motion.div
                                    key={`purchase-${itemFeedback.token}`}
                                    className="pointer-events-none absolute left-1/2 top-1/2"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                  >
                                    {[0, 1, 2].map((coinIndex) => (
                                      <motion.span
                                        key={coinIndex}
                                        className="absolute text-[11px] font-black text-amber-600"
                                        initial={{ x: "-50%", y: 8, opacity: 0, scale: 0.8 }}
                                        animate={{
                                          x: `calc(-50% + ${(coinIndex - 1) * 16}px)`,
                                          y: -24 - coinIndex * 8,
                                          opacity: [0, 1, 0],
                                          scale: [0.8, 1.1, 0.92],
                                        }}
                                        transition={{ duration: 0.56, delay: coinIndex * 0.04, ease: "easeOut" }}
                                      >
                                        +{Math.max(1, Math.round(item.cost_coins / 3))}
                                      </motion.span>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <p className="text-slate-500">No room items found in this category.</p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
              </div>

              {roomError && <p className="text-sm text-rose-600 font-medium mt-3">{roomError}</p>}
            </div>
          </motion.div>
        )}

        {view === "dashboard" && activeBook && (
          <motion.div 
            key="dashboard"
            {...directionalViewMotion}
            className="space-y-6"
          >
            <div className={roomMenuCardClass}>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-2xl font-bold">{activeBook.title}</h3>
                  <p className="text-slate-500 font-medium">by {activeBook.author}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setView("bookshelf")}
                  className="py-2 px-4 rounded-xl border-2 border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Back to Bookshelf
                </button>
              </div>
              <div className={roomMenuBodyClass}>
              <div className="mb-6">
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span>Progress</span>
                  <span>{getBookProgressPercent(activeBook)}%</span>
                </div>
                <div className="h-6 bg-slate-100 rounded-xl border-2 border-slate-900 overflow-hidden relative">
                  <motion.div 
                    className="h-full bg-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${getBookProgressPercent(activeBook)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest">
                    {activeBook.current_page}/{activeBook.total_pages} Pages
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-sky-50 p-4 rounded-2xl border-2 border-sky-100">
                  <div className="flex items-center gap-2 text-sky-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Goal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={targetMinutes} 
                      onChange={(e) => setTargetMinutes(Math.max(1, parseNumberInput(e.target.value, 20)))}
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
                  <p className="font-bold text-xl">
                    {Math.max(1, stats?.streak_days ?? 1)} {Math.max(1, stats?.streak_days ?? 1) === 1 ? "Day" : "Days"}
                  </p>
                </div>
              </div>

              <button
                onClick={handleStartSession}
                className="quest-button w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Timer className="w-5 h-5" /> Start Reading Session
              </button>
              </div>
            </div>

          </motion.div>
        )}

        {view === "achievements" && (
          <motion.div
            key="achievements"
            {...directionalViewMotion}
            className="space-y-6"
          >
            <div className={roomMenuCardClass}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-amber-500" />
                    Achievements
                  </h2>
                  <p className="text-sm text-slate-500">
                    {achievementsData
                      ? `${achievementsData.unlocked_total} unlocks • ${achievementsData.completed_books_count} books completed`
                      : "Track your milestones and book completion rewards."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView("bookshelf")}
                  className="py-2 px-4 rounded-xl border-2 border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Back to Bookshelf
                </button>
              </div>

              <div className={roomMenuBodyClass}>
                {achievementsData?.achievements?.length ? (
                  <div className="space-y-3 pr-1">
                    {achievementsData.achievements.map((achievement, index) => {
                      const safeTarget = achievement.target == null ? null : Math.max(1, achievement.target);
                      const safeProgress = Math.max(0, achievement.progress);
                      const progressPct =
                        safeTarget == null ? (safeProgress > 0 ? 100 : 0) : Math.min(100, (safeProgress / safeTarget) * 100);
                      const progressLabel =
                        safeTarget == null
                          ? `${achievement.times_earned} earned`
                          : `${Math.min(safeProgress, safeTarget)}/${safeTarget}`;

                      return (
                        <motion.div
                          key={achievement.key}
                          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={
                            prefersReducedMotion
                              ? { duration: 0.12 }
                              : { duration: 0.24, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }
                          }
                          className={`rounded-xl border-2 p-3 ${
                            achievement.is_unlocked
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{achievement.title}</p>
                              <p className="text-xs text-slate-600 mt-1">{achievement.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {achievement.is_unlocked && (
                                <motion.span
                                  className="achievement-unlocked-stamp rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700"
                                  animate={
                                    prefersReducedMotion ? { opacity: 1 } : { scale: [1, 1.12, 1], rotate: [0, -2, 0] }
                                  }
                                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.45, delay: 0.05 }}
                                >
                                  Unlocked
                                </motion.span>
                              )}
                              <p className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              +{achievement.reward_xp} XP • +{achievement.reward_coins} Coins
                            </p>
                          </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                            <span>{progressLabel}</span>
                            {achievement.is_repeatable && <span className="text-emerald-700">Repeatable</span>}
                          </div>
                          <div className="mt-2 h-2 bg-white rounded-full border border-slate-200 overflow-hidden">
                            <motion.div
                              className="h-full bg-emerald-400 origin-left"
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: progressPct / 100 }}
                              transition={
                                prefersReducedMotion
                                  ? { duration: 0.12 }
                                  : { duration: 0.45, delay: index * 0.02, ease: [0.22, 1, 0.36, 1] }
                              }
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No achievements yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {view === "hallOfReads" && (
          <motion.div
            key="hallOfReads"
            {...directionalViewMotion}
            className="space-y-6"
          >
            <div className={roomMenuCardClass}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-sky-500" />
                    Hall of Reads
                  </h2>
                  <p className="text-sm text-slate-500">
                    {completedBooks.length
                      ? `${completedBooks.length} completed book${completedBooks.length === 1 ? "" : "s"} cataloged.`
                      : "Complete a book to add it to your Hall of Reads."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView("bookshelf")}
                  className="py-2 px-4 rounded-xl border-2 border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Back to Bookshelf
                </button>
              </div>

              <div className={roomMenuBodyClass}>
                {completedBooks.length > 0 && (
                  <div className="mb-3 space-y-3">
                    {latestHallMilestone != null && (
                      <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Milestone Celebration</p>
                        <p className="text-sm font-semibold text-slate-800 mt-1">
                          Hall Badge Unlocked: {latestHallMilestone} Books Completed
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] font-bold uppercase text-slate-500">Completed Books</p>
                        <p className="text-xl font-bold text-slate-900">{completedBookCount}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] font-bold uppercase text-slate-500">Completed Pages</p>
                        <p className="text-xl font-bold text-slate-900">{totalCompletedPages}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] font-bold uppercase text-slate-500">Avg Session</p>
                        <p className="text-xl font-bold text-slate-900">{Math.round(averageSessionMinutes)} min</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">Reading Style Badges</p>
                      <div className="flex flex-wrap gap-2">
                        {readingStyleBadges.map((badge) => (
                          <span
                            key={badge.label}
                            className={`rounded-full border px-2 py-1 text-xs font-bold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">Hall Milestones</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {hallMilestoneStatus.map((entry) => (
                          <span
                            key={entry.milestone}
                            className={`rounded-full border px-2 py-1 text-xs font-bold ${
                              entry.unlocked
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}
                          >
                            {entry.unlocked ? "Unlocked" : "Locked"} {entry.milestone}
                          </span>
                        ))}
                        {nextHallMilestone != null && (
                          <span className="text-xs font-semibold text-slate-500">
                            {Math.max(0, nextHallMilestone - completedBookCount)} more for next frame unlock.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {completedBooks.length ? (
                  <div className="space-y-3 pr-1">
                    {completedBooks.map((book, index) => {
                      const sizeBadge = getBookSizeBadge(Math.max(0, Number(book.total_pages || 0)));
                      const frameStyle = getHallFrameStyle(book.completion_number);
                      const selectedSticker = getStickerOption(book.sticker_key);
                      const selectedRating = getRatingOption(book.rating_key);
                      const stickerPosition = getHallStickerPosition(book);
                      const isDraggingSticker = hallStickerDragState?.completionNumber === book.completion_number;

                      return (
                        <motion.div
                          key={book.completion_number}
                          className={frameStyle.wrapperClass}
                          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.988 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={
                            prefersReducedMotion
                              ? { duration: 0.12 }
                              : { duration: 0.28, delay: index * 0.045, ease: [0.22, 1, 0.36, 1] }
                          }
                        >
                          <div
                            ref={(element) => {
                              hallCardRefs.current[book.completion_number] = element;
                            }}
                            className={`${frameStyle.innerClass} p-4 relative`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{book.title}</p>
                                <p className="text-sm text-slate-600">by {book.author}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black ${frameStyle.stampClass}`}
                                  title={`Completion #${book.completion_number}`}
                                >
                                  #{book.completion_number}
                                </span>
                              </div>
                            </div>

                            {selectedSticker && (
                              <button
                                type="button"
                                onPointerDown={(event) => handleHallStickerPointerDown(event, book)}
                                onPointerMove={(event) => handleHallStickerPointerMove(event, book)}
                                onPointerUp={(event) => handleHallStickerPointerUp(event, book)}
                                onPointerCancel={(event) => handleHallStickerPointerUp(event, book)}
                                disabled={completedBookSavingKey === book.completion_number}
                                className={`hall-sticker-button absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-200 bg-[radial-gradient(circle_at_32%_24%,#fff7d1,#fde68a)] px-3 py-2 text-lg shadow-[0_4px_0_0_rgba(180,83,9,0.35)] transition-transform ${
                                  isDraggingSticker ? "hall-sticker-button-dragging cursor-grabbing" : "cursor-grab hover:scale-105"
                                } ${
                                  hallStickerSnapCompletion === book.completion_number ? "hall-sticker-button-snap" : ""
                                } disabled:opacity-50`}
                                style={{
                                  left: `${stickerPosition.x}%`,
                                  top: `${stickerPosition.y}%`,
                                  touchAction: "none",
                                }}
                                title={`Drag sticker: ${selectedSticker.label}`}
                                aria-label={`Drag sticker: ${selectedSticker.label}`}
                              >
                                <span className="drop-shadow-sm">{selectedSticker.emoji}</span>
                              </button>
                            )}

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                              <span className={`rounded-full border px-2 py-1 ${sizeBadge.className}`}>{sizeBadge.label}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-600">
                                {frameStyle.frameLabel}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                                {book.total_pages} pages
                              </span>
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                                Completed {new Date(book.completed_at).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span
                                className={`rounded-full border px-2 py-1 font-semibold ${
                                  selectedRating?.chipClass ?? "border-slate-200 bg-white text-slate-600"
                                }`}
                              >
                                Rating: {selectedRating ? `${selectedRating.emoji} ${selectedRating.label}` : "Not chosen"}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5">
                    <p className="font-semibold text-slate-800">Your Hall of Reads is waiting for the first trophy.</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Finish your active book by crossing the final page to earn your first book completion reward.
                    </p>
                  </div>
                )}
              </div>
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
                className="w-36 h-36 sm:w-44 sm:h-44 lg:w-48 lg:h-48 rounded-full border-8 border-amber-400 flex items-center justify-center bg-amber-50"
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
            {isPastGoalTime && (
              <div className="mb-6 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-left">
                <p className="font-bold text-emerald-800">Keep Reading for more XP!</p>
                <p className="text-xs font-semibold text-emerald-700 mt-1">
                  Bonus active: +{OVERTIME_XP_PER_MINUTE} XP and +{OVERTIME_COINS_PER_MINUTE} coins per extra minute.
                </p>
                <p className="text-xs font-bold text-emerald-800 mt-1">Extra full minutes so far: {overtimeMinutes}</p>
              </div>
            )}
            
            <button
              onClick={handleFinishReading}
              className="quest-button bg-emerald-400 border-emerald-600 hover:bg-emerald-500 w-full sm:w-auto px-6 sm:px-12"
            >
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Started on Page</label>
                  <input 
                    type="number" 
                    value={startPage} 
                    onChange={(e) => setStartPage(parseNumberInput(e.target.value))}
                    className="quest-input" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Ended on Page</label>
                  <input 
                    type="number" 
                    value={endPage} 
                    onChange={(e) => setEndPage(parseNumberInput(e.target.value))}
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

        {view === "bookCompletion" && pendingBookCompletion && (
          <motion.div
            key="bookCompletion"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="quest-card"
          >
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Book Completed</p>
              <h2 className="text-2xl font-bold mt-1">Customize Your Hall Card</h2>
              <p className="text-sm text-slate-500 mt-2">
                {pendingBookCompletion.title} is now in your Hall of Reads. Pick a sticker and rating first.
              </p>
            </div>

            <div className="mt-5 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Completion #{pendingBookCompletion.completion_number}
              </p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{pendingBookCompletion.total_pages} pages completed</p>
            </div>

            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Pick Your Sticker</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BOOK_STICKER_OPTIONS.map((option) => {
                  const selected = selectedCompletionSticker === option.key;
                  return (
                    <button
                      key={`completion-sticker-${option.key}`}
                      type="button"
                      disabled={completedBookSavingKey === pendingBookCompletion.completion_number}
                      onClick={() => setSelectedCompletionSticker(option.key)}
                      className={`rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors ${option.chipClass} ${
                        selected ? "ring-2 ring-slate-900" : "hover:opacity-100 opacity-90"
                      } disabled:opacity-50`}
                    >
                      <span className="mr-1">{option.emoji}</span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Rate This Book</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {BOOK_RATING_OPTIONS.map((option) => {
                  const selected = selectedCompletionRating === option.key;
                  return (
                    <button
                      key={`completion-rating-${option.key}`}
                      type="button"
                      disabled={completedBookSavingKey === pendingBookCompletion.completion_number}
                      onClick={() => setSelectedCompletionRating(option.key)}
                      className={`rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors ${option.chipClass} ${
                        selected ? "ring-2 ring-slate-900" : "hover:opacity-100 opacity-90"
                      } disabled:opacity-50`}
                    >
                      <span className="mr-1">{option.emoji}</span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {completionChoiceError && (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {completionChoiceError}
              </p>
            )}

            <button
              type="button"
              disabled={
                completedBookSavingKey === pendingBookCompletion.completion_number ||
                !selectedCompletionSticker ||
                !selectedCompletionRating
              }
              onClick={handleBookCompletionChoiceSubmit}
              className="quest-button w-full mt-5 disabled:opacity-50"
            >
              {completedBookSavingKey === pendingBookCompletion.completion_number ? "Saving..." : "Save Choices"}
            </button>
          </motion.div>
        )}

        {view === "celebration" && (
          <motion.div 
            key="celebration"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="quest-card text-center py-12 max-h-[72vh] celebration-scroll"
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
            <p className="text-slate-500 mb-8">You earned XP and coins for your room upgrades!</p>
            
            <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-100 mb-8 max-w-xs mx-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-400 uppercase text-xs">XP Earned</span>
                <span className="font-display font-bold text-2xl text-amber-600">+{earnedXp}</span>
              </div>
              {(sessionRewardSummary?.achievement_bonus_xp ?? 0) > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-400 uppercase text-xs">Achievement XP</span>
                  <span className="font-display font-bold text-xl text-violet-600">
                    +{sessionRewardSummary?.achievement_bonus_xp ?? 0}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-400 uppercase text-xs">Coins Earned</span>
                <span className="font-display font-bold text-2xl text-emerald-600">
                  +{sessionRewardSummary?.coins_earned ?? 0}
                </span>
              </div>
              {(sessionRewardSummary?.achievement_bonus_coins ?? 0) > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-400 uppercase text-xs">Achievement Coins</span>
                  <span className="font-display font-bold text-xl text-violet-600">
                    +{sessionRewardSummary?.achievement_bonus_coins ?? 0}
                  </span>
                </div>
              )}
              {(sessionRewardSummary?.milestone_bonus_coins ?? 0) > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-400 uppercase text-xs">Milestone Bonus</span>
                  <span className="font-display font-bold text-xl text-sky-600">
                    +{sessionRewardSummary?.milestone_bonus_coins ?? 0}
                  </span>
                </div>
              )}
              {(sessionRewardSummary?.overtime_bonus_coins ?? 0) > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-400 uppercase text-xs">Overtime Bonus</span>
                  <span className="font-display font-bold text-xl text-emerald-600">
                    +{sessionRewardSummary?.overtime_bonus_coins ?? 0}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-400 uppercase text-xs">New Level</span>
                <span className="font-display font-bold text-2xl text-emerald-600">{stats?.level}</span>
              </div>
            </div>

            {(sessionRewardSummary?.achievements_unlocked?.length ?? 0) > 0 && (
              <div className="bg-amber-50 rounded-2xl p-4 border-2 border-amber-200 mb-8 max-w-xl mx-auto text-left">
                <p className="font-bold text-amber-800 mb-2">Achievements Unlocked</p>
                <div className="space-y-2">
                  {sessionRewardSummary?.achievements_unlocked?.map((unlock) => (
                    <div key={`${unlock.key}-${unlock.period_key}`} className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-700">{unlock.title}</span>
                      <span className="text-xs font-bold text-emerald-700">
                        +{unlock.reward_xp} XP • +{unlock.reward_coins} Coins
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setView("bookshelf")} className="quest-button w-full sm:w-auto px-6 sm:px-12">
              Back to Bookshelf
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </main>

      {showAdminPrompt && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="quest-card w-full max-w-md">
            <h3 className="text-xl font-bold mb-2">Admin Access</h3>
            <p className="text-sm text-slate-500 mb-4">Enter password to open the admin panel.</p>
            <form onSubmit={handleAdminUnlockSubmit} className="space-y-4">
              <input
                type="password"
                value={adminPasscode}
                onChange={(e) => setAdminPasscode(e.target.value)}
                className="quest-input"
                placeholder="Admin password"
                autoFocus
              />
              {adminError && <p className="text-sm text-rose-600 font-medium">{adminError}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-2xl border-2 border-slate-200 font-bold text-slate-500"
                  onClick={() => {
                    setShowAdminPrompt(false);
                    setAdminPasscode("");
                    setAdminError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 quest-button" disabled={isAdminLoading}>
                  {isAdminLoading ? "Checking..." : "Unlock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Stats */}
      {showFooterStats && (
        <footer className={`${showRoomShell ? "mt-3" : "mt-12"} grid grid-cols-3 gap-4`}>
          <div className="text-center">
            <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 mb-2 flex items-center justify-center">
              <BookIcon className="w-5 h-5 text-sky-500" />
            </div>
            <p className="text-[10px] font-bold uppercase text-slate-700">Books Completed</p>
            <p className="font-bold text-slate-900">{stats.total_books}</p>
          </div>
          <div className="text-center">
            <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 mb-2 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-[10px] font-bold uppercase text-slate-700">Quests Done</p>
            <p className="font-bold text-slate-900">{stats.total_sessions}</p>
          </div>
          <div className="text-center">
            <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 mb-2 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-[10px] font-bold uppercase text-slate-700">Total Hours</p>
            <p className="font-bold text-slate-900">{stats.total_hours}</p>
          </div>
        </footer>
      )}
      </>
      )}
      </div>
    </div>
  );
}
