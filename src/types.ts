export interface Book {
  id: number;
  title: string;
  author: string;
  total_pages: number;
  current_page: number;
  is_active: number;
}

export interface UserStats {
  total_xp: number;
  level: number;
  coins: number;
  total_coins_earned: number;
  streak_days: number;
  next_milestone_xp: number;
  total_sessions: number;
  total_hours: number;
  total_books: number;
}

export interface ReadingSession {
  book_id: number;
  start_page: number;
  end_page: number;
  chapters_finished: number;
  duration_minutes: number;
  goal_minutes?: number;
  xp_earned: number;
}

export interface CompletedBook {
  book_id: number;
  title: string;
  author: string;
  total_pages: number;
  completion_number: number;
  completed_at: string;
  sticker_key: string | null;
  rating_key: string | null;
  sticker_pos_x: number | null;
  sticker_pos_y: number | null;
}

export interface StudentIdentity {
  class_code: string;
  nickname: string;
}

export interface AdminClassSummary {
  class_code: string;
  student_count: number;
}

export interface AdminStudentRow {
  id: number;
  class_code: string;
  nickname: string;
  created_at: string;
  total_xp: number;
  level: number;
  coins: number;
  total_coins_earned: number;
  total_sessions: number;
  total_minutes: number;
  achievements_unlocked: number;
  latest_achievement_at: string | null;
  active_book: string | null;
  current_page: number | null;
  total_pages: number | null;
}

export interface AdminRosterResponse {
  classes: AdminClassSummary[];
  students: AdminStudentRow[];
  generated_at: string;
}

export interface AdminCreateStudentsResponse {
  class_code: string;
  created_count: number;
  existing_count: number;
  invalid_nicknames: string[];
}

export interface AdminReflectionAnswer {
  question_index: number;
  question_text: string;
  answer_text: string;
}

export interface AdminReflectionSession {
  session_id: number;
  timestamp: string;
  class_code: string;
  nickname: string;
  book_title: string | null;
  answers: AdminReflectionAnswer[];
}

export interface AdminReflectionsResponse {
  reflections: AdminReflectionSession[];
  generated_at: string;
}

export interface SessionRewardSummary {
  total_xp: number;
  level: number;
  coins: number;
  xp_earned?: number;
  streak_days?: number;
  streak_multiplier?: number;
  coins_earned: number;
  milestone_bonus_coins: number;
  overtime_bonus_coins?: number;
  overtime_minutes?: number;
  milestones_reached: number;
  achievement_bonus_xp?: number;
  achievement_bonus_coins?: number;
  achievements_unlocked?: AchievementUnlock[];
  book_completion?: SessionBookCompletion | null;
}

export interface SessionBookCompletion {
  book_id: number;
  title: string;
  total_pages: number;
  completion_number: number;
  completed_at: string;
  sticker_key: string | null;
  rating_key: string | null;
  sticker_pos_x: number | null;
  sticker_pos_y: number | null;
}

export interface AchievementUnlock {
  key: string;
  title: string;
  description: string;
  reward_xp: number;
  reward_coins: number;
  period_key: string;
  unlocked_at: string;
  is_repeatable: boolean;
}

export interface AchievementProgress {
  key: string;
  title: string;
  description: string;
  reward_xp: number;
  reward_coins: number;
  target: number | null;
  progress: number;
  is_unlocked: boolean;
  is_repeatable: boolean;
  times_earned: number;
  current_period_key: string | null;
}

export interface AchievementsResponse {
  current_period_key: string;
  completed_books_count: number;
  unlocked_total: number;
  total_available: number;
  achievements: AchievementProgress[];
  recent_unlocks: AchievementUnlock[];
}

export interface RoomItemState {
  key: string;
  name: string;
  description: string;
  category: string;
  cost_coins: number;
  min_xp: number;
  owned: boolean;
  equipped: boolean;
  unlocked: boolean;
  pos_x: number | null;
  pos_y: number | null;
  z_index: number | null;
}

export interface RoomStateResponse {
  total_xp: number;
  coins: number;
  next_milestone_xp: number;
  items: RoomItemState[];
}
