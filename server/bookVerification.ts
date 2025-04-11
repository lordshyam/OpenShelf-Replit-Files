
import axios from 'axios';

interface GoogleBookResponse {
  items: {
    volumeInfo: {
      title: string;
      authors: string[];
      description?: string;
    };
  }[];
}

export async function verifyBookInformation(title: string, author: string): Promise<{
  isValid: boolean;
  normalizedTitle: string;
  normalizedAuthor: string;
  error?: string;
}> {
  try {
    // Basic input validation
    if (title.length < 2 || author.length < 2) {
      return {
        isValid: false,
        normalizedTitle: normalizeText(title),
        normalizedAuthor: normalizeText(author),
        error: "Title and author must be at least 2 characters long"
      };
    }

    // Check for nonsense input (repeated characters, random keystrokes)
    if (hasRepeatedCharacters(title) || hasRepeatedCharacters(author)) {
      return {
        isValid: false,
        normalizedTitle: normalizeText(title),
        normalizedAuthor: normalizeText(author),
        error: "Invalid title or author format"
      };
    }

    const query = `${title}+inauthor:${author}`;
    const response = await axios.get<GoogleBookResponse>(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=en`
    );

    if (!response.data.items?.length) {
      return {
        isValid: false,
        normalizedTitle: normalizeText(title),
        normalizedAuthor: normalizeText(author),
        error: "Book not found in Google Books database"
      };
    }

    // Get the closest matching book
    const book = response.data.items[0].volumeInfo;
    const bookTitle = book.title;
    const bookAuthor = book.authors?.[0] || '';

    // Check if the provided title and author are similar to the Google Books data
    const titleSimilarity = calculateSimilarity(normalizeText(title), normalizeText(bookTitle));
    const authorSimilarity = calculateSimilarity(normalizeText(author), normalizeText(bookAuthor));

    // Increase similarity thresholds for stricter matching
    const isValid = titleSimilarity > 0.85 && authorSimilarity > 0.8;

    return {
      isValid,
      normalizedTitle: normalizeText(bookTitle),
      normalizedAuthor: normalizeText(bookAuthor),
      error: isValid ? undefined : "Book details don't match our records closely enough"
    };
  } catch (error) {
    console.error('Error verifying book:', error);
    return {
      isValid: false,
      normalizedTitle: normalizeText(title),
      normalizedAuthor: normalizeText(author),
      error: "Failed to verify book information"
    };
  }
}

// Normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric characters
    .trim();
}

// Check for repeated characters (likely nonsense input)
function hasRepeatedCharacters(text: string): boolean {
  const normalized = text.toLowerCase();
  // Check for 3 or more of the same character in a row
  return /(.)\1{2,}/.test(normalized) || 
    // Check for keyboard row patterns
    /(qwert|asdfg|zxcvb|yuiop|hjkl|bnm)/i.test(normalized);
}

// Calculate similarity between two strings (Levenshtein distance based)
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    costs[i] = i;
  }
  
  let currentValue = 0;
  for (let i = 1; i <= shorter.length; i++) {
    costs[0] = i;
    let previousValue = i - 1;
    for (let j = 1; j <= longer.length; j++) {
      if (shorter[i - 1] === longer[j - 1]) {
        costs[j] = previousValue;
      } else {
        currentValue = costs[j];
        costs[j] = Math.min(costs[j] + 1, costs[j - 1] + 1, previousValue + 1);
        previousValue = currentValue;
      }
    }
  }
  
  return (longer.length - costs[longer.length]) / longer.length;
}
