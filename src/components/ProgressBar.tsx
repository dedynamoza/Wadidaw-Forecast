/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

interface ProgressBarProps {
  progress: number;
  target?: number;
  className?: string;
  barClassName?: string;
}

export function ProgressBar({ progress, target = 100, className, barClassName }: ProgressBarProps) {
  const percentage = Math.min(Math.max((progress / target) * 100, 0), 100);
  
  return (
    <div className={cn("w-full flex flex-col gap-3", className)} id="progress-bar-container">
      <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner" id="progress-track">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.2, ease: "circOut" }}
          className={cn("h-full rounded-full", barClassName || "bg-[#17C3B2]")}
          id="progress-fill"
        />
      </div>
    </div>
  );
}
