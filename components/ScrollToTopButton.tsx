import { useState, useEffect } from "react";
import { IconButton } from "@chakra-ui/react";
import { ArrowUpIcon } from "@chakra-ui/icons";

export const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => {
    if (window.scrollY > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    window.addEventListener("scroll", toggleVisibility);
    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  return (
    <IconButton
      aria-label="Scroll to top"
      icon={<ArrowUpIcon />}
      position="fixed"
      bottom="30px"
      right="30px"
      zIndex={20}
      size="md"
      variant="secondary"
      opacity={isVisible ? 1 : 0}
      visibility={isVisible ? "visible" : "hidden"}
      transition="opacity 0.2s ease, visibility 0.2s ease"
      pointerEvents={isVisible ? "auto" : "none"}
      onClick={scrollToTop}
    />
  );
};
