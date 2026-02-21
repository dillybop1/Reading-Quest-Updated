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
