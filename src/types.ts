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
