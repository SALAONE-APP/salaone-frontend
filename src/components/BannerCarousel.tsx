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

interface BannerItem {
  src: string;
  link: string;
}

function getImages(heroImages?: string[], heroImage?: string | null, heroImageLinks?: string[]): BannerItem[] {
  const merged = [
    ...(Array.isArray(heroImages) ? heroImages : []),
    ...(heroImage ? [heroImage] : []),
  ];
  const seen = new Set<string>();
  return merged.reduce<BannerItem[]>((items, value, index) => {
    const src = value.trim();
    if (!src || seen.has(src)) return items;
    seen.add(src);
    items.push({ src, link: heroImageLinks?.[index]?.trim() ?? '' });
    return items;
  }, []);
}

function isSafeLink(link: string) {
  if (link.startsWith('/') && !link.startsWith('//')) return true;
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function BannerCarousel() {
  const [images, setImages] = useState<BannerItem[]>([]);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getHomeInfo()
      .then((data) => setImages(getImages(data.hero_images, data.hero_image, data.hero_image_links)))
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
          {images.map(({ src, link }, i) => (
            <CarouselItem key={i} className="pl-0">
              {/* sem altura fixa e sem overflow-hidden — a imagem define sua própria altura */}
              {link && isSafeLink(link) ? (
                <a href={link} className="block h-52 w-full overflow-hidden rounded-xl sm:h-64 lg:h-[700px]">
                  <img
                    src={src}
                    alt={`Banner ${i + 1}`}
                    className="h-full w-full object-cover object-center"
                    draggable={false}
                  />
                </a>
              ) : (
                <div className="h-52 w-full overflow-hidden rounded-xl sm:h-64 lg:h-[700px]">
                  <img
                    src={src}
                    alt={`Banner ${i + 1}`}
                    className="h-full w-full object-cover object-center"
                    draggable={false}
                  />
                </div>
              )}
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
