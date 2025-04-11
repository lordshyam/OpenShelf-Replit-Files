
import axios from 'axios';

interface GoogleBookResponse {
  items: {
    volumeInfo: {
      title: string;
      authors: string[];
      description?: string;
      imageLinks?: {
        thumbnail: string;
      };
    };
  }[];
}

// Check if a string contains meaningful content 
function isMeaningfulText(text: string): boolean {
  // Remove spaces and special characters
  const cleaned = text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  // Check for keyboard patterns or repeated characters
  if (/(.)\1{2,}/.test(cleaned)) return false; // Repeated characters
  if (/qwerty|asdfgh|zxcvb/i.test(cleaned)) return false; // Keyboard patterns
  
  // Check for random short strings
  if (cleaned.length < 3) return false;
  
  // Check for strings with no vowels (likely random consonants)
  if (!/[aeiou]/i.test(cleaned)) return false;
  
  // Check if all characters are the same
  if (new Set(cleaned).size < 2) return false;

  return true;
}

// Check if image data is valid and relevant
async function validateBookImage(imageData: string, title: string, author: string): Promise<boolean> {
  try {
    // Verify image data is properly formatted
    if (!imageData.startsWith('data:image/')) {
      return false;
    }

    // Extract base64 data
    const base64Data = imageData.split(',')[1];
    if (!base64Data || base64Data.length < 100) { // Basic size check
      return false;
    }

    // TODO: In a production environment, you would:
    // 1. Use image recognition APIs to verify it's a book cover
    // 2. Compare image with Google Books cover image
    // 3. Use OCR to verify text matches title/author
    // For now, we'll do basic validation

    return true;
  } catch (error) {
    console.error('Error validating image:', error);
    return false;
  }
}

export async function verifyBookInformation(
  title: string, 
  author: string, 
  description?: string,
  imageData?: string
): Promise<{
  isValid: boolean;
  normalizedTitle: string;
  normalizedAuthor: string;
  error?: string;
}> {
  try {
    // Basic input validation
    if (!title || !author) {
      return {
        isValid: false,
        normalizedTitle: normalizeText(title),
        normalizedAuthor: normalizeText(author),
        error: "Title and author are required"
      };
    }

    // Check for meaningful content
    if (!isMeaningfulText(title) || !isMeaningfulText(author)) {
      return {
        isValid: false,
        normalizedTitle: normalizeText(title),
        normalizedAuthor: normalizeText(author),
        error: "Title or author appears to be random text"
      };
    }

    // Validate description if provided
    if (description && !isMeaningfulText(description)) {
      return {
        isValid: false,
        normalizedTitle: normalizeText(title),
        normalizedAuthor: normalizeText(author),
        error: "Description appears to be random text"
      };
    }

    // Check with Google Books API
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

    // Validate image if provided
    if (imageData) {
      const isImageValid = await validateBookImage(imageData, title, author);
      if (!isImageValid) {
        return {
          isValid: false,
          normalizedTitle: normalizeText(title),
          normalizedAuthor: normalizeText(author),
          error: "Invalid or irrelevant book image provided"
        };
      }
    }

    // Check if the provided title and author are similar to the Google Books data
    const titleSimilarity = calculateSimilarity(normalizeText(title), normalizeText(bookTitle));
    const authorSimilarity = calculateSimilarity(normalizeText(author), normalizeText(bookAuthor));

    // Increase similarity thresholds for stricter matching
    const isValid = titleSimilarity > 0.9 && authorSimilarity > 0.85;

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
