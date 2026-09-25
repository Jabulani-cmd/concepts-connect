import { motion } from "framer-motion";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image: string;
}

export default function PageHero({ eyebrow, title, subtitle, image }: PageHeroProps) {
  return (
    <section className="relative isolate h-[52vh] min-h-[380px] w-full overflow-hidden bg-foreground">
      <img
        src={image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "center 45%" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-purple-950/85 via-purple-900/45 to-black/10" />
      <div className="container relative z-10 flex h-full items-end pb-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl text-white"
        >
          {eyebrow && (
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
              {eyebrow}
            </span>
          )}
          <div className="mb-5 mt-4 h-[3px] w-12 bg-purple-400" />
          <h1 className="font-heading text-4xl font-bold leading-tight text-white md:text-6xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/90 md:text-lg">
              {subtitle}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
