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
