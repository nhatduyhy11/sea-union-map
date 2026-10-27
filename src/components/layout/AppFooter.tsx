import { useEffect, useState } from "react";
import { Watermark } from "../shared/Watermark";
import styles from "./AppFooter.module.css";

export const FAVORITE_QUOTES = [
  "There are no strings on me.",
  "If you're good at something, never do it for free.",
  "You either die a hero, or you live long enough to see yourself become the villain.",
];

// Footer toàn trang — bộ quote yêu thích bên trái, Watermark bên phải.
export function AppFooter() {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * FAVORITE_QUOTES.length)
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % FAVORITE_QUOTES.length);
        setVisible(true);
      }, 300);
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  const handleNextQuote = () => {
    setVisible(false);
    setTimeout(() => {
      setIndex((prev) => (prev + 1) % FAVORITE_QUOTES.length);
      setVisible(true);
    }, 200);
  };

  return (
    <footer className={styles.footer}>
      <span
        className={`${styles.quote} ${visible ? styles.fadeIn : styles.fadeOut}`}
        onClick={handleNextQuote}
        title="Nhấp để đổi câu nói"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleNextQuote();
          }
        }}
      >
        “{FAVORITE_QUOTES[index]}”
      </span>
      <Watermark variant="text" />
    </footer>
  );
}
