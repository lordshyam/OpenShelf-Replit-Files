// Animal avatars in SVG format
export const animalAvatars = {
  fox: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="18" fill="#FF9580"/>
    <path d="M18 12C16 12 14 13 13 15C12 13 10 12 8 12C4 12 4 15 4 15C4 15 4 24 13 24H18H23C32 24 32 15 32 15C32 15 32 12 28 12C26 12 24 13 23 15C22 13 20 12 18 12Z" fill="white"/>
    <circle cx="13" cy="17" r="1" fill="#FF4F4F"/>
    <circle cx="23" cy="17" r="1" fill="#FF4F4F"/>
    <path d="M16 20C16.5 20.5 17.5 21 18 21C18.5 21 19.5 20.5 20 20" stroke="#FF4F4F" stroke-width="1" stroke-linecap="round"/>
  </svg>`,
  cat: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="18" fill="#FFB084"/>
    <path d="M12 14C12 12 10 10 8 10C4 10 4 14 4 14V22C4 22 4 26 8 26C10 26 12 24 12 22V14Z" fill="white"/>
    <path d="M24 14C24 12 26 10 28 10C32 10 32 14 32 14V22C32 22 32 26 28 26C26 26 24 24 24 22V14Z" fill="white"/>
    <circle cx="18" cy="18" r="8" fill="white"/>
    <circle cx="15" cy="17" r="1" fill="#FF6B6B"/>
    <circle cx="21" cy="17" r="1" fill="#FF6B6B"/>
    <path d="M16 20C16.5 20.5 17.5 21 18 21C18.5 21 19.5 20.5 20 20" stroke="#FF6B6B" stroke-width="1" stroke-linecap="round"/>
  </svg>`,
  bear: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="18" fill="#B58B6D"/>
    <circle cx="18" cy="18" r="12" fill="#8B6B4D"/>
    <circle cx="14" cy="16" r="2" fill="white"/>
    <circle cx="22" cy="16" r="2" fill="white"/>
    <circle cx="14" cy="16" r="1" fill="#333"/>
    <circle cx="22" cy="16" r="1" fill="#333"/>
    <path d="M16 20C16.5 20.5 17.5 21 18 21C18.5 21 19.5 20.5 20 20" stroke="#333" stroke-width="1" stroke-linecap="round"/>
  </svg>`,
  rabbit: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="18" fill="#FFE0E0"/>
    <path d="M10 8C8 8 6 10 6 12C6 14 8 16 10 16C12 16 14 14 14 12C14 10 12 8 10 8Z" fill="white"/>
    <path d="M26 8C24 8 22 10 22 12C22 14 24 16 26 16C28 16 30 14 30 12C30 10 28 8 26 8Z" fill="white"/>
    <circle cx="18" cy="20" r="8" fill="white"/>
    <circle cx="15" cy="19" r="1" fill="#FF9999"/>
    <circle cx="21" cy="19" r="1" fill="#FF9999"/>
    <path d="M16 21C16.5 21.5 17.5 22 18 22C18.5 22 19.5 21.5 20 21" stroke="#FF9999" stroke-width="1" stroke-linecap="round"/>
  </svg>`,
  panda: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="18" fill="#333333"/>
    <circle cx="12" cy="12" r="4" fill="white"/>
    <circle cx="24" cy="12" r="4" fill="white"/>
    <circle cx="18" cy="20" r="8" fill="white"/>
    <circle cx="15" cy="19" r="1" fill="#333"/>
    <circle cx="21" cy="19" r="1" fill="#333"/>
    <path d="M16 21C16.5 21.5 17.5 22 18 22C18.5 22 19.5 21.5 20 21" stroke="#333" stroke-width="1" stroke-linecap="round"/>
  </svg>`
};

export function getRandomAvatar(): string {
  const avatars = Object.values(animalAvatars);
  const randomIndex = Math.floor(Math.random() * avatars.length);
  return avatars[randomIndex];
}
