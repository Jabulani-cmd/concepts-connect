import { useState, useEffect, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

type CarouselImage = {
  id: string;
  image_url: string;
  display_order: number;
};

const heroSlides = [
  { large: "MavingTech", small: "Business Solutions" },
  { large: "Empowering", small: "Your Business" },
  { large: "Through", small: "Technology" },
];

const HeroCarousel = forwardRef<HTMLElement>(function HeroCarousel(_props, ref) {
  const [images, setImages] = useState<CarouselImage[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    supabase
      .from("carousel_images")
      .select("id, image_url, display_order")
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setImages(data);
        }
      });
  }, []);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <section ref={ref} className="relative w-full overflow-hidden bg-primary" style={{ minHeight: "60vh", height: "100vh", maxHeight: "100svh" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
      </section>
    );
  }

  const slide = heroSlides[current % heroSlides.length];

  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-primary" style={{ minHeight: "60vh", height: "100vh", maxHeight: "100svh" }}>
      {/* Background images */}
      {images.map((img, i) => (
        <img
          key={img.id}
          src={img.image_url}
          alt="MavingTech High School"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
          style={{ 
            opacity: i === current ? 1 : 0,
            objectPosition: "center 30%",
          }}
        />
      ))}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />

      {/* Text overlay — Woodberry style: small caps word + huge accent word */}
      <div className="absolute inset-0 flex items-end pb-28 sm:pb-32 md:pb-36">
        <div className="container">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="font-heading text-5xl font-bold leading-[0.95] text-secondary sm:text-7xl md:text-8xl lg:text-9xl">
                {slide.large}
              </h1>
              <p className="font-heading text-lg font-medium uppercase tracking-[0.35em] text-white/90 sm:text-xl md:text-2xl mt-2">
                {slide.small}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

    </section>
  );
});

export default HeroCarousel;
