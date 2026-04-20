import { motion, type Variants } from "framer-motion";
import type { PropsWithChildren } from "react";

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: "easeOut" } },
};

export const PageShell = ({ children }: PropsWithChildren) => (
  <motion.main initial="hidden" animate="show" variants={pageVariants} className="container py-6 md:py-10">
    {children}
  </motion.main>
);
