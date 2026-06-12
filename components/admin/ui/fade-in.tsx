"use client";

import { motion } from "framer-motion";

/**
 * Lightweight mount entrance (fade + rise). Always completes on mount (no
 * whileInView), so content never gets stuck invisible. Reduced motion is
 * honoured globally via the shell's MotionConfig.
 */
export function FadeIn({
  children,
  delay = 0,
  y = 10,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
