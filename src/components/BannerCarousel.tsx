import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getHomeInfo } from '@/service/homeInfoService';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

const AUTOPLAY_INTERVAL = 4000;

function getImages(heroImages?: string[], heroImage?: string | null): string[] {
  const merged = [
    ...(Array.isArray(heroImages) ? heroImages : []),
    ...(heroImage ? [heroImage] : []),
  ];
  return [...new Set(merged.map((s) => s.trim()).filter(Boolean))];
}

export function BannerCarousel() {
  const [images, setImages] = useState<string[]>([]);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getHomeInfo()
      .then((data) => setImages(getImages(data.hero_images, data.hero_image)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!api) return;

    const updateCurrent = () => setCurrent(api.selectedScrollSnap());
    api.on('select', updateCurrent);
    updateCurrent();

    return () => { api.off('select', updateCurrent); };
  }, [api]);

  useEffect(() => {
    if (!api || images.length <= 1) return;

    timerRef.current = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
      }
    }, AUTOPLAY_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [api, images.length]);

  if (images.length === 0) return null;

  return (
    <div className="relative rounded-xl">
      <Carousel
        opts={{ loop: true, align: 'start' }}
        setApi={setApi}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {images.map((src, i) => (
            <CarouselItem key={i} className="pl-0">
              {/* sem altura fixa e sem overflow-hidden — a imagem define sua própria altura */}
              <div className="w-full rounded-xl overflow-hidden">
                <img
                  src={src}
                  alt={`Banner ${i + 1}`}
                  className="block w-full h-auto"
                  draggable={false}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Botões de navegação (visíveis apenas com 2+ imagens) */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => api?.scrollPrev()}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              aria-label="Banner anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => api?.scrollNext()}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              aria-label="Próximo banner"
            >
              <ChevronRight size={18} />
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => api?.scrollTo(i)}
                  aria-label={`Ir para banner ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current
                      ? 'w-5 bg-white'
                      : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </Carousel>
    </div>
  );
}
