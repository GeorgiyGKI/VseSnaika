type BookRecord = {
  _id: string;
  clerkId: string;
  title: string;
  slug: string;
  author: string;
  persona?: string;
  fileURL: string;
  fileBlobKey: string;
  coverURL?: string;
  coverBlobKey?: string;
  fileSize: number;
  totalSegments: number;
};

const BOOKS_KEY = "bookified:books";

const readBooks = (): BookRecord[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(BOOKS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BookRecord[];
  } catch {
    return [];
  }
};

const writeBooks = (books: BookRecord[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0400-\u04ff\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const checkBookExists = async (title: string) => {
  const books = readBooks();
  const slug = slugify(title);
  const book = books.find((item) => item.slug === slug);
  return { exists: Boolean(book), book };
};

export const createBook = async (
  payload: Omit<BookRecord, "_id" | "slug" | "totalSegments">
) => {
  const books = readBooks();
  const slug = slugify(payload.title);
  const existing = books.find((item) => item.slug === slug);

  if (existing) {
    return { success: true, alreadyExists: true, data: existing };
  }

  const book: BookRecord = {
    _id: crypto.randomUUID(),
    slug,
    totalSegments: 0,
    ...payload,
  };

  books.push(book);
  writeBooks(books);

  return { success: true, data: book };
};

export const saveBookSegments = async (bookId: string, userId: string, segments: string[]) => {
  if (typeof window === "undefined") {
    return { success: false, error: "Storage unavailable" };
  }
  const key = `bookified:segments:${bookId}:${userId}`;
  window.localStorage.setItem(key, JSON.stringify(segments));
  return { success: true };
};
