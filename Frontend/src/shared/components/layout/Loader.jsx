import { motion } from "framer-motion";
import darkLogo from "@/assets/ink-rider-dark-logo.png";
import lightLogo from "@/assets/ink-rider-light-logo.png";
import { useTheme } from "../../hooks/useTheme";

function LightLoader() {
  const { dark } = useTheme();
  if (dark) return <DarkLoader />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white overflow-hidden">

      {/* Soft Ambient Glow */}
      <motion.div
        className="
          absolute
          w-56
          h-56
          rounded-full
          bg-black/[0.03]
          blur-3xl
        "
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Rotating Circular Stroke */}
      <motion.div
        className="absolute w-[190px] h-[190px]"
        animate={{ rotate: 360 }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <svg
          width="190"
          height="190"
          viewBox="0 0 190 190"
          className="overflow-visible"
        >
          {/* Background Ring */}
          <circle
            cx="95"
            cy="95"
            r="78"
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="2"
          />

          {/* Animated Arc */}
          <motion.circle
            cx="95"
            cy="95"
            r="78"
            fill="none"
            stroke="black"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="110 400"
            initial={{ rotate: 0 }}
            style={{
              transformOrigin: "50% 50%",
            }}
          />
        </svg>
      </motion.div>

      {/* Logo Card */}
      <motion.div
        className="
          relative
          z-10
          flex
          items-center
          justify-center
          w-28
          h-28
          rounded-[28px]
          bg-white
        "
        animate={{
          y: [0, -4, 0],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <motion.img
          src={lightLogo}
          alt="firstmargin"
          className="w-16 h-16 object-contain"
          animate={{
            scale: [1, 1.04, 1],
            opacity: [0.9, 1, 0.9],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      {/* Loading Text */}
      <motion.div
        className="
          absolute
          bottom-[22%]
          text-[11px]
          tracking-[8px]
          uppercase
          text-black/40
          font-medium
        "
        animate={{
          opacity: [0.4, 1, 0.4],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        Loading
      </motion.div>
    </div>
  );
}

function DarkLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden">

      {/* Ambient Glow */}
      <motion.div
        className="
          absolute
          w-64
          h-64
          rounded-full
          bg-white/[0.04]
          blur-3xl
        "
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.3, 0.55, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Rotating Circular Arc */}
      <motion.div
        className="absolute w-[210px] h-[210px]"
        animate={{ rotate: 360 }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <svg
          width="210"
          height="210"
          viewBox="0 0 210 210"
          className="overflow-visible"
        >
          {/* Background Ring */}
          <circle
            cx="105"
            cy="105"
            r="88"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2"
          />

          {/* Animated Arc */}
          <motion.circle
            cx="105"
            cy="105"
            r="88"
            fill="none"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="125 500"
            style={{
              filter: "drop-shadow(0px 0px 12px rgba(255,255,255,0.55))",
              transformOrigin: "50% 50%",
            }}
          />
        </svg>
      </motion.div>

      {/* Logo Container */}
      <motion.div
        className="
          relative
          z-10
          flex
          items-center
          justify-center
          w-32
          h-32
          rounded-[30px]
        "
        animate={{
          y: [0, -4, 0],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <motion.img
          src={darkLogo}
          alt="firstmargin"
          className="w-18 h-18 object-contain"
          animate={{
            scale: [1, 1.04, 1],
            opacity: [0.82, 1, 0.82],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      {/* Loading Text */}
      <motion.div
        className="
          absolute
          bottom-[22%]
          text-[11px]
          tracking-[10px]
          uppercase
          text-white/45
          font-medium
        "
        animate={{
          opacity: [0.4, 1, 0.4],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        Loading
      </motion.div>
    </div>
  );
}

export {
  LightLoader, 
  DarkLoader 
};
